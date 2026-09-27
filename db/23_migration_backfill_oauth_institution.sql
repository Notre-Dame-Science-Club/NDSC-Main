-- Backfill members.institution for existing OAuth (Google) signups.
--
-- Why: app/api/auth/oauth/complete/route.ts creates a member row without
-- ever setting `institution` — it only ever validates the roll as an NDC
-- roll (validateCollegeRoll('Notre Dame College', ...)), so every member
-- who signed up through Google is implicitly a Notre Dame College student,
-- but their `institution` column was left NULL. isNDCStudent() (and
-- anything built on it — club membership eligibility, and now the
-- olympiad "NDC students only" eligibility check on /olympiad) reads
-- `institution`, so those members were silently treated as "not NDC"
-- despite genuinely being NDC students who logged in with an NDC account.
--
-- The email/password signup flow (app/register/page.tsx, app/api/auth/
-- register/route.ts) always asks for and stores a real institution and
-- never leaves it NULL, and is the only signup path open to non-NDC
-- students — so every existing NULL-institution row is, unambiguously, an
-- OAuth-created NDC member. Safe to backfill directly.
--
-- The code fix (app/api/auth/oauth/complete/route.ts) stops new OAuth
-- signups from having this problem going forward; this migration fixes
-- the rows that already exist.

update members
set institution = 'Notre Dame College'
where institution is null;
