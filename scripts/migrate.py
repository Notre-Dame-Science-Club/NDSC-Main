#!/usr/bin/env python3
"""
Supabase project migration script.

Pushes exported data (JSON per table), auth users, and storage files
from a Supabase export into a NEW Supabase project.

Expected folder layout (same as the export zip), placed next to this script:

    ./supabase-export/json/<table>.json
    ./supabase-export/csv/<table>.csv        (fallback only, used if the
                                               json file is missing/empty)
    ./supabase-export/auth-users.json
    ./storage-export/<bucket>/<file>

Configure the TARGET (new) project in a `.env` file next to this script:

    TARGET_SUPABASE_URL=https://xxxx.supabase.co
    TARGET_SUPABASE_SERVICE_ROLE_KEY=eyJ....

Usage:
    pip install -r scripts/requirements.txt
    python scripts/migrate.py --all                 # do everything, in the right order
    python scripts/migrate.py --auth                # only auth users
    python scripts/migrate.py --data                # only table data
    python scripts/migrate.py --storage             # only storage files
    python scripts/migrate.py --all --dry-run        # show what would happen, no writes
    python scripts/migrate.py --data --only members,admins   # just specific tables
"""

import argparse
import csv
import json
import mimetypes
import secrets
import sys
from pathlib import Path

import requests
import os

try:
    from dotenv import load_dotenv
    load_dotenv(".env")
except ImportError:
    pass  # optional; env vars can also be set directly in the shell/CI

# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR / "supabase-export"
JSON_DIR = DATA_DIR / "json"
CSV_DIR = DATA_DIR / "csv"
AUTH_USERS_FILE = DATA_DIR / "auth-users.json"
STORAGE_DIR = SCRIPT_DIR / "storage-export"
ID_MAP_FILE = SCRIPT_DIR / "auth_id_mapping.json"

# NOTE (2026-07-17 cleanup): this used to be a hardcoded live Supabase URL +
# service_role key committed directly in this file, even though the docstring
# above always documented env-var configuration. That key gives full,
# RLS-bypassing admin access to the project it belongs to. It has been
# replaced with env-var loading as originally documented. If that key was
# ever committed/shared anywhere, rotate it immediately from the Supabase
# dashboard (Project Settings → API → reset service_role key) and treat it
# as compromised in the meantime.
SUPABASE_URL = os.environ.get("TARGET_SUPABASE_URL", "")
SERVICE_KEY = os.environ.get("TARGET_SUPABASE_SERVICE_ROLE_KEY", "")

# Table insert order — respects foreign key dependencies found in this export.
# auth users are handled separately (always first, see migrate_auth_users()),
# because `members.id` is the same UUID as `auth.users.id` in this dataset.
TABLE_ORDER = [
    "admins",
    "members",
    "activity_types",
    "activity_versions",
    "activity_sessions",
    "olympiads",
    "activity_reg_categories",
    "olympiad_registrations",
    "activity_registrations",
    "activity_submissions",
    "payment_transactions",
    "relay_exam_state",
    "team_subject_assignments",
    "member_shoutbox",
    "announcements",
    "form_configs",
    "publications",
    "science_media",
    "homepage_settings",
    "executives",
]

BATCH_SIZE = 200


def _require_config():
    if not SUPABASE_URL or not SERVICE_KEY:
        print(
            "ERROR: TARGET_SUPABASE_URL / TARGET_SUPABASE_SERVICE_ROLE_KEY "
            "are not set. Copy .env.example to .env and fill in the NEW "
            "(target) project's values."
        )
        sys.exit(1)


def _headers(extra=None):
    h = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
    }
    if extra:
        h.update(extra)
    return h


# --------------------------------------------------------------------------
# Loading rows (JSON preferred, CSV fallback with best-effort type coercion)
# --------------------------------------------------------------------------

def _coerce_csv_value(v):
    if v == "":
        return None
    if v in ("true", "false"):
        return v == "true"
    if v.startswith("[") or v.startswith("{"):
        try:
            return json.loads(v)
        except json.JSONDecodeError:
            return v
    return v


def load_csv_table(table):
    path = CSV_DIR / f"{table}.csv"
    if not path.exists():
        return []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return [{k: _coerce_csv_value(v) for k, v in row.items()} for row in reader]


def load_rows(table):
    json_path = JSON_DIR / f"{table}.json"
    if json_path.exists():
        with open(json_path, encoding="utf-8") as f:
            rows = json.load(f)
        if rows:
            return rows
    # fall back to csv if json missing or empty
    csv_rows = load_csv_table(table)
    if csv_rows:
        print(f"  [info] {table}: using CSV fallback ({len(csv_rows)} rows) - json export was empty/missing")
    return csv_rows


# --------------------------------------------------------------------------
# Data table migration (REST/PostgREST upsert)
# --------------------------------------------------------------------------

def _chunks(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i : i + n]


def upsert_batch(table, batch, dry_run):
    """POST a batch with upsert semantics. Keeps retrying, stripping any
    column PostgREST reports as unknown, until the request succeeds or a
    retry doesn't remove a *new* column (meaning we're stuck for some
    other reason). Handles tables missing multiple columns, not just one."""
    if dry_run:
        return True, None

    url = f"{SUPABASE_URL}/rest/v1/{table}?on_conflict=id"
    headers = _headers(
        {
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        }
    )

    stripped_cols = set()
    msg = None

    while True:
        resp = requests.post(url, headers=headers, data=json.dumps(batch))
        if resp.status_code in (200, 201, 204):
            return True, None

        msg = resp.text
        missing_col = None
        try:
            body = resp.json()
            detail = f"{body.get('message', '')} {body.get('hint', '')}"
            import re

            m = re.search(r"'([a-zA-Z0-9_]+)' column", detail) or re.search(
                r"column \"?([a-zA-Z0-9_]+)\"? does not exist", detail
            )
            if m:
                missing_col = m.group(1)
        except ValueError:
            pass

        # Stop if there's nothing to strip, or we've already stripped this
        # exact column before (would loop forever otherwise).
        if not missing_col or missing_col in stripped_cols:
            return False, msg

        print(f"  [info] {table}: target schema has no column '{missing_col}' - dropping it from this batch and retrying")
        stripped_cols.add(missing_col)
        for row in batch:
            row.pop(missing_col, None)

    return False, msg


def migrate_table(table, dry_run, filter_tables=None):
    if filter_tables and table not in filter_tables:
        return

    rows = load_rows(table)
    if not rows:
        print(f"- {table}: 0 rows, skipping")
        return

    print(f"- {table}: {len(rows)} rows" + (" (dry run)" if dry_run else ""))
    ok_count = 0
    fail_count = 0
    for batch in _chunks(rows, BATCH_SIZE):
        ok, err = upsert_batch(table, batch, dry_run)
        if ok:
            ok_count += len(batch)
        else:
            fail_count += len(batch)
            print(f"  [error] {table}: batch of {len(batch)} rows failed: {err}")
    print(f"  -> {ok_count} upserted, {fail_count} failed")


def migrate_data(dry_run, only=None):
    print("\n=== Migrating table data ===")
    filter_tables = set(only) if only else None
    for table in TABLE_ORDER:
        migrate_table(table, dry_run, filter_tables)


# --------------------------------------------------------------------------
# Auth users migration
# --------------------------------------------------------------------------

def migrate_auth_users(dry_run):
    print("\n=== Migrating auth users ===")
    if not AUTH_USERS_FILE.exists():
        print("- no auth-users.json found, skipping")
        return

    with open(AUTH_USERS_FILE, encoding="utf-8") as f:
        users = json.load(f)

    if not users:
        print("- 0 users, skipping")
        return

    id_map = {}
    for u in users:
        email = u.get("email")
        old_id = u.get("id")
        payload = {
            "email": email,
            "email_confirm": bool(u.get("email_confirmed_at")),
            "user_metadata": u.get("user_metadata") or {},
            "app_metadata": u.get("app_metadata") or {},
            "password": secrets.token_urlsafe(16),  # random - no original password exists
        }
        if old_id:
            payload["id"] = old_id  # try to preserve the UUID (needed for members.id linkage)

        if dry_run:
            print(f"- would create user {email} (id={old_id})")
            continue

        resp = requests.post(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            headers=_headers({"Content-Type": "application/json"}),
            data=json.dumps(payload),
        )

        if resp.status_code in (200, 201):
            new_id = resp.json().get("id")
            id_map[old_id] = new_id
            same = " (same id preserved)" if new_id == old_id else " (id CHANGED)"
            print(f"- created {email}: {old_id} -> {new_id}{same}")
        elif resp.status_code == 422 and old_id and "id" in payload:
            # some Supabase/GoTrue versions reject a client-supplied id - retry without it
            payload.pop("id")
            resp2 = requests.post(
                f"{SUPABASE_URL}/auth/v1/admin/users",
                headers=_headers({"Content-Type": "application/json"}),
                data=json.dumps(payload),
            )
            if resp2.status_code in (200, 201):
                new_id = resp2.json().get("id")
                id_map[old_id] = new_id
                print(f"- created {email}: {old_id} -> {new_id} (id CHANGED - target rejected custom id)")
            else:
                print(f"  [error] failed to create {email}: {resp2.status_code} {resp2.text}")
        else:
            print(f"  [error] failed to create {email}: {resp.status_code} {resp.text}")

    if id_map:
        with open(ID_MAP_FILE, "w", encoding="utf-8") as f:
            json.dump(id_map, f, indent=2)
        changed = {k: v for k, v in id_map.items() if k != v}
        if changed:
            print(
                f"\n[info] {len(changed)} user id(s) changed on the target project. "
                f"Mapping saved to {ID_MAP_FILE.name}. "
                "You must remap any FK columns (e.g. members.id) using this file "
                "before/while migrating dependent tables."
            )


# --------------------------------------------------------------------------
# Storage migration
# --------------------------------------------------------------------------

def ensure_bucket(bucket, dry_run):
    if dry_run:
        print(f"  [info] would check/create bucket '{bucket}'")
        return
    resp = requests.get(f"{SUPABASE_URL}/storage/v1/bucket/{bucket}", headers=_headers())
    if resp.status_code == 200:
        return
    if dry_run:
        print(f"  [info] bucket '{bucket}' does not exist yet - would create as public")
        return
    create = requests.post(
        f"{SUPABASE_URL}/storage/v1/bucket",
        headers=_headers({"Content-Type": "application/json"}),
        data=json.dumps({"id": bucket, "name": bucket, "public": True}),
    )
    if create.status_code in (200, 201):
        print(f"  [info] created public bucket '{bucket}'")
    else:
        print(f"  [error] could not create bucket '{bucket}': {create.status_code} {create.text}")


def migrate_storage(dry_run):
    print("\n=== Migrating storage files ===")
    if not STORAGE_DIR.exists():
        print("- no storage-export folder found, skipping")
        return

    for bucket_dir in sorted(p for p in STORAGE_DIR.iterdir() if p.is_dir()):
        bucket = bucket_dir.name
        files = [p for p in bucket_dir.rglob("*") if p.is_file()]
        if not files:
            print(f"- {bucket}: 0 files, skipping")
            continue

        print(f"- {bucket}: {len(files)} file(s)" + (" (dry run)" if dry_run else ""))
        ensure_bucket(bucket, dry_run)

        ok_count = 0
        fail_count = 0
        for file_path in files:
            rel_path = file_path.relative_to(bucket_dir).as_posix()
            if dry_run:
                ok_count += 1
                continue
            content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
            with open(file_path, "rb") as f:
                resp = requests.post(
                    f"{SUPABASE_URL}/storage/v1/object/{bucket}/{rel_path}",
                    headers=_headers(
                        {"Content-Type": content_type, "x-upsert": "true"}
                    ),
                    data=f.read(),
                )
            if resp.status_code in (200, 201):
                ok_count += 1
            else:
                fail_count += 1
                print(f"  [error] {bucket}/{rel_path}: {resp.status_code} {resp.text}")
        print(f"  -> {ok_count} uploaded, {fail_count} failed")


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Migrate export data to a new Supabase project")
    parser.add_argument("--all", action="store_true", help="run auth + data + storage, in that order")
    parser.add_argument("--auth", action="store_true", help="migrate auth users only")
    parser.add_argument("--data", action="store_true", help="migrate table data only")
    parser.add_argument("--storage", action="store_true", help="migrate storage files only")
    parser.add_argument("--only", help="comma-separated list of table names to restrict --data to")
    parser.add_argument("--dry-run", action="store_true", help="print what would happen, write nothing")
    args = parser.parse_args()

    if not any([args.all, args.auth, args.data, args.storage]):
        parser.print_help()
        sys.exit(0)

    _require_config()

    if args.all or args.auth:
        migrate_auth_users(args.dry_run)
    if args.all or args.data:
        only = [t.strip() for t in args.only.split(",")] if args.only else None
        migrate_data(args.dry_run, only)
    if args.all or args.storage:
        migrate_storage(args.dry_run)

    print("\nDone.")


if __name__ == "__main__":
    main()
