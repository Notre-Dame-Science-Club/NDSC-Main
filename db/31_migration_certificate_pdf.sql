-- Adds a per-event certificate PDF the organizer can upload from the
-- event dashboard (Admin -> Manage Activity -> Files), separate from the
-- existing `pdf_url` (the event's public rulebook/info PDF). Shown to
-- registrants on their own registration dashboard as a "Download
-- Certificate" link once the organizer has uploaded one.
--
-- Additive only. Safe to re-run.

alter table activity_sessions
  add column if not exists certificate_pdf_url text;

-- Note: the companion "disable multiple segment enroll" feature needs no
-- schema change — it's a boolean flag (`disable_multi_segment_enroll`)
-- inside the graph's root form_node's existing `behavior` jsonb column
-- (see lib/formGraph.ts FormNodeBehavior). Set/read entirely in
-- application code; nothing to migrate.
