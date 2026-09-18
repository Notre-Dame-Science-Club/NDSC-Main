-- Per-publication flip-book link.
--
-- Why: the publication page had ONE hardcoded Heyzine flip-book URL
-- (the AUDRI 2025 issue). Every publication's "Read online" button and every
-- previous-edition cover opened that same 2025 flip-book, no matter which
-- issue was clicked. The link belongs to the row, not to the page.
--
-- Additive only. Existing rows get NULL and fall back to viewing pdf_url.

alter table publications
  add column if not exists flipbook_url text;

-- Optional backfill: point the current AUDRI flip-book at the right row.
-- Uncomment and set the year/category if that Heyzine link belongs to a
-- specific issue.
--
-- update publications
--    set flipbook_url = 'https://heyzine.com/flip-book/a9df397b9b.html'
--  where category = 'annual_magazine'
--    and published_year = 2025;
