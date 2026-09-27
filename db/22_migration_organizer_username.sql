-- Organizer login username.
--
-- Why: the organizer panel only ever checked a plaintext password against
-- EVERY active olympiad's `organizer_password` — there was no notion of a
-- "login" at all, just a shared secret. Two organizers who happened to pick
-- the same password would each see the other's olympiad. This adds a
-- companion `organizer_username` column so the admin panel can issue a real
-- username + password pair per olympiad from Admin → Olympiads.
--
-- Backward compatible: existing rows get NULL. The login route treats a NULL
-- organizer_username as "no username required for this olympiad" so
-- previously-configured organizer passwords keep working unchanged until an
-- admin sets a username for that row.
--
-- Additive only.

alter table olympiads
  add column if not exists organizer_username text;
