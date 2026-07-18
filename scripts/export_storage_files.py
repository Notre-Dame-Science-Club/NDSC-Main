"""
NDSC Supabase Storage full download
--------------------------------------
Downloads every file from every Storage bucket in your project, preserving
folder structure. Uses the service role key, so it bypasses storage RLS
policies and gets everything, including private buckets.

Usage:
    1. Run from the project root (this file lives in scripts/, but Python still resolves .env.local from the cwd)
    2. pip install supabase python-dotenv
    3. python scripts/export_storage_files.py

Output:
    ./storage-export/<bucket_name>/<same path as in Supabase>/...

Notes:
    - This is separate from export_supabase_data.py, which only covers
      Postgres table rows. Tables like activity_sessions, publications,
      olympiads etc. store *URLs* pointing into Storage (cover_image_url,
      pdf_url, gallery_urls, payment_slip_url, ...) - the actual files live
      in Storage buckets, not in the database, hence this separate script.
    - After downloading, re-upload the same folder structure into Storage
      on your new project (script for that included below the export code,
      run with --upload flag) and the old URLs will resolve the same way,
      as long as the new project uses the same bucket names.
"""

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(".env.local")


def get_client(url_env, key_env):
    url = os.environ.get(url_env)
    key = os.environ.get(key_env)
    if not url or not key:
        print(f"Missing {url_env} or {key_env} in .env.local / environment.")
        sys.exit(1)
    return create_client(url, key)


OUT_DIR = Path(__file__).parent / "storage-export"


def list_all_files(storage, bucket_name, prefix=""):
    """Recursively list every file in a bucket (Supabase storage list() is
    not recursive by default - folders show up as entries with id=None)."""
    files = []
    entries = storage.from_(bucket_name).list(prefix, {"limit": 1000, "offset": 0})
    for entry in entries:
        full_path = f"{prefix}/{entry['name']}" if prefix else entry["name"]
        # Supabase returns folders as entries with metadata=None (no id)
        if entry.get("id") is None and entry.get("metadata") is None:
            files.extend(list_all_files(storage, bucket_name, full_path))
        else:
            files.append(full_path)
    return files


def download_all(storage_url_env="NEXT_PUBLIC_SUPABASE_URL", key_env="SUPABASE_SERVICE_ROLE_KEY"):
    client = get_client(storage_url_env, key_env)
    storage = client.storage

    print("Listing buckets...")
    buckets = storage.list_buckets()
    if not buckets:
        print("No buckets found (or storage API not reachable with this key).")
        return

    total_files = 0
    for bucket in buckets:
        bucket_name = bucket.name if hasattr(bucket, "name") else bucket["name"]
        print(f"\nBucket: {bucket_name}")
        try:
            files = list_all_files(storage, bucket_name)
        except Exception as e:
            print(f"  Failed to list files: {e}")
            continue

        print(f"  {len(files)} file(s) found")
        bucket_dir = OUT_DIR / bucket_name
        bucket_dir.mkdir(parents=True, exist_ok=True)

        for i, file_path in enumerate(files, 1):
            local_path = bucket_dir / file_path
            local_path.parent.mkdir(parents=True, exist_ok=True)
            try:
                data = storage.from_(bucket_name).download(file_path)
                local_path.write_bytes(data)
                total_files += 1
                if i % 25 == 0 or i == len(files):
                    print(f"  downloaded {i}/{len(files)}")
            except Exception as e:
                print(f"  FAILED: {file_path} - {e}")

    print(f"\nDone. {total_files} file(s) saved under ./storage-export/")


def upload_all(storage_url_env="NEW_SUPABASE_URL", key_env="NEW_SUPABASE_SERVICE_ROLE_KEY"):
    """Re-upload everything in ./storage-export/ into a NEW project.
    Buckets must already exist on the new project (create them first in
    the dashboard or via storage.create_bucket(), matching the same names
    and public/private setting as the old ones)."""
    client = get_client(storage_url_env, key_env)
    storage = client.storage

    if not OUT_DIR.exists():
        print(f"No {OUT_DIR} folder found - run the export first.")
        sys.exit(1)

    total_files = 0
    for bucket_dir in sorted(p for p in OUT_DIR.iterdir() if p.is_dir()):
        bucket_name = bucket_dir.name
        print(f"\nBucket: {bucket_name}")
        for local_file in bucket_dir.rglob("*"):
            if local_file.is_dir():
                continue
            remote_path = str(local_file.relative_to(bucket_dir)).replace(os.sep, "/")
            try:
                with open(local_file, "rb") as f:
                    storage.from_(bucket_name).upload(
                        remote_path, f.read(), {"upsert": "true"}
                    )
                total_files += 1
            except Exception as e:
                print(f"  FAILED: {remote_path} - {e}")

        print(f"  uploaded files from {bucket_name}")

    print(f"\nDone. {total_files} file(s) uploaded.")


def main():
    parser = argparse.ArgumentParser(description="Export/import Supabase Storage files.")
    parser.add_argument(
        "--upload",
        action="store_true",
        help="Upload ./storage-export/ into NEW_SUPABASE_URL/NEW_SUPABASE_SERVICE_ROLE_KEY "
        "instead of downloading from the old project.",
    )
    args = parser.parse_args()

    if args.upload:
        upload_all()
    else:
        download_all()


if __name__ == "__main__":
    main()
