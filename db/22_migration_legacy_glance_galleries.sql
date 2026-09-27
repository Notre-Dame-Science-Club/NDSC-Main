-- Legacy (vintage/"oldest") photo gallery and the "What We Do at a Glance"
-- gallery, both for the homepage.
--
-- legacy_gallery: free-form — admin adds/removes/reorders up to ~10 old
-- photos, each with a year label. Nothing about it is fixed in code.
--
-- glance_gallery: the 14 tiles are fixed content (title/description live in
-- app/_components/home2/glanceGalleryContent.ts, per the brief — "the code
-- shouldn't change, just the photo"). This table only ever holds what an
-- admin actually sets per tile: the photo, its focal point for each layout,
-- the "Learn More" link, and whether it's shown. Rows are matched to their
-- content by slot_key, not by position, so re-ordering the content file
-- later can never silently mismatch a row with the wrong photo.
--
-- Both photos store a focal point (0-100, percentage) per layout instead of
-- a hard pixel crop: the same uploaded image renders with
-- `object-fit: cover; object-position: {x}% {y}%`, and desktop/mobile can
-- pick different focal points on the one file — no re-encoding, no second
-- upload, no extra storage.

create table if not exists legacy_gallery (
  id                 uuid primary key default gen_random_uuid(),
  image_url          text,
  year_label         text,
  desktop_focal_x    numeric default 50,
  desktop_focal_y    numeric default 50,
  mobile_focal_x     numeric default 50,
  mobile_focal_y     numeric default 50,
  display_order      int default 0,
  is_active          boolean default true,
  created_at         timestamptz default now()
);

create table if not exists glance_gallery (
  id                 uuid primary key default gen_random_uuid(),
  slot_key           text unique not null,
  image_url          text,
  desktop_focal_x    numeric default 50,
  desktop_focal_y    numeric default 50,
  mobile_focal_x     numeric default 50,
  mobile_focal_y     numeric default 50,
  learn_more_url     text,
  is_active          boolean default true,
  updated_at         timestamptz default now()
);

-- Seed the 14 fixed slots so Admin ▸ Glance Gallery always has exactly one
-- row per content-file entry to attach a photo/link to. Safe to re-run —
-- on_conflict makes this a no-op for slots that already exist.
insert into glance_gallery (slot_key, is_active) values
  ('workshops', true),
  ('project-development', true),
  ('science-podcasts', true),
  ('science-tech-week', true),
  ('science-festivals', true),
  ('general-knowledge-competitions', true),
  ('intra-science-competitions', true),
  ('brainstorming-sessions', true),
  ('research-development', true),
  ('olympiad-guidance', true),
  ('scientific-content', true),
  ('scientific-tours', true),
  ('skill-development', true),
  ('partnerships', true)
on conflict (slot_key) do nothing;
