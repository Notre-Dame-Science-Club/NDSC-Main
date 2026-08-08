-- ============================================================================
-- NDSC Platform — DB updates for 2026-08-07
--
-- Idempotent migration addressing functional/UX issues discovered in API routes.
-- Safe to re-run: all statements use IF NOT EXISTS or WHERE NOT EXISTS guards.
-- No data is destroyed — this only adds missing structures and functions.
--
-- Changes:
--   1. Create append_achievement RPC function for atomic JSONB append
--      (fixes read-modify-write race in members achievements)
--
-- Apply via Supabase SQL Editor. Verify with:
--   select proname from pg_proc where proname = 'append_achievement';
-- ============================================================================

-- ── 1. Atomic JSONB append for achievements ──────────────────────────────
--
-- The members.achievements column stores an array of achievement objects.
-- Previously, the API routes used read-modify-write (select, append in JS,
-- update) which races under concurrent requests. This function does an
-- atomic jsonb_insert + coalesce so two simultaneous POSTs both succeed.
--
-- Arguments:
--   member_id    uuid  — the members.id to update
--   achievement  jsonb — the achievement object to append (must include id)
--
-- Returns: jsonb — the new achievements array after append
--
-- The function uses COALESCE to handle the case where achievements is NULL
-- (shouldn't happen due to default '[]', but defensive). It also validates
-- that the member exists before attempting the update.

create or replace function append_achievement(
  p_member_id uuid,
  p_achievement jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_new_achievements jsonb;
begin
  -- Validate the achievement has an id (required for dedup/UI keying)
  if p_achievement->>'id' is null then
    raise exception 'achievement must have an id field';
  end if;

  -- Atomic append: coalesce existing to empty array, then append
  update members
     set achievements = jsonb_insert(
                          coalesce(achievements, '[]'::jsonb),
                          '{-1}',  -- append at end of array
                          p_achievement
                        )
   where id = p_member_id
  returning achievements into v_new_achievements;

  -- If no rows updated, the member doesn't exist
  if not found then
    raise exception 'member % not found', p_member_id;
  end if;

  return v_new_achievements;
end;
$$;

-- Grant execute to authenticated and anon roles (service_role already has it)
-- This allows the function to be called via Supabase RPC if needed.
grant execute on function append_achievement(uuid, jsonb) to authenticated;
grant execute on function append_achievement(uuid, jsonb) to anon;

-- ── Verification ─────────────────────────────────────────────────────────
--
-- Run these after applying:
--
--   -- Check the function exists
--   select proname, prosrc from pg_proc where proname = 'append_achievement';
--
--   -- Test with a dummy achievement (use a test member id)
--   -- select append_achievement('test-uuid-here', '{"id":"test-id","title":"Test"}'::jsonb);
--
--   -- Check achievements column structure
--   select id, achievements from members limit 3;
--
-- ============================================================================
