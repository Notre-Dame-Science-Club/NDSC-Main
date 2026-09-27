-- Adds a per-olympiad toggle for whether a student can overwrite an already-
-- submitted exam. Defaults to true so every existing olympiad keeps today's
-- behavior (resubmission allowed) until an admin explicitly turns it off for
-- ones where seeing your own submitted sheet again could enable copying.
-- Enforced in app/api/olympiad-register/route.ts (PUT handler).

ALTER TABLE olympiads
  ADD COLUMN IF NOT EXISTS allow_resubmission boolean NOT NULL DEFAULT true;
