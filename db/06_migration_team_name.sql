-- ============================================================================
-- Add a top-level team_name column to activity_registrations.
--
-- Why: today every "team" is identified only by the leader's full_name —
-- even in events where team is optional and a solo entrant could plausibly
-- want to name themselves ("Solo Squad"). This column gives the leader
-- an explicit, editable team identity separate from their personal name.
--
-- Nullable: only set when the registration is a team event (any flavor of
-- require_team). Solo / non-team events leave it null.
--
-- No index — this is a display label, not a lookup key. (We could add
-- one later if "find all teams starting with X" becomes a thing.)
-- ============================================================================

alter table activity_registrations
  add column if not exists team_name text;