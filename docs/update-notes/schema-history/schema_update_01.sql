-- ARCHIVED (2026-07-17 cleanup) — historical only. Folded into db/schema.sql.
-- Do not run this file directly; it may conflict with or duplicate the merged schema.

alter table olympiads
  add column if not exists theme_bg_color text,
  add column if not exists theme_bg_image_url text,
  add column if not exists theme_accent_color text,
  add column if not exists theme_header_title text,
  add column if not exists theme_header_subtitle text,
  add column if not exists theme_header_logo_url text;