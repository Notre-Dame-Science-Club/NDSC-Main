-- 37: safety net for migration 35 + group re-keying for migration 36.
-- Idempotent and non-destructive; safe to re-run. Run AFTER 35 and 36.
--
-- (a) Migration 35 marks a registration "complete" only when its path ended at a
--     terminal node. A few legitimate legacy shapes fail that test and would
--     silently disappear from the site (admin list, CSV, member dashboard):
--       - anyone who has PAID (money was taken, so they are registered), and
--       - rows with an empty / missing path (pre-graph legacy rows).
--     Only genuine abandoned drafts (path stops at a node that still has
--     enabled children, and nothing was paid) stay incomplete.
--
-- (b) When an admin creates a segment group or moves a segment into one AFTER
--     people already registered, their slots still carry the old group_key.
--     recompute_slot_groups() re-keys them. A row that would collide (a person
--     who is ALREADY in two segments of the new group) is left as-is and
--     reported, never deleted.

update activity_registrations
   set completed_at = coalesce(created_at, now())
 where completed_at is null
   and (
        payment_status = 'paid'
     or payment_validated_at is not null
     or submitted_node_ids is null
     or jsonb_typeof(submitted_node_ids) <> 'array'
     or jsonb_array_length(submitted_node_ids) = 0
   );

create or replace function recompute_slot_groups(
  p_session_id uuid,
  p_mapping    jsonb          -- { "<terminal_node_id>": "<group_key>" | null }
) returns jsonb
language plpgsql
as $$
declare
  s record;
  want text;
  n_updated int := 0;
  n_skipped int := 0;
  conflicts jsonb := '[]'::jsonb;
begin
  for s in
    select id, registration_id, terminal_node_id, group_key, identity_kind, identity_value
      from registration_slots
     where activity_session_id = p_session_id
     order by created_at, id
  loop
    want := p_mapping ->> (s.terminal_node_id)::text;
    if want is not distinct from s.group_key then
      continue;
    end if;
    begin
      update registration_slots set group_key = want where id = s.id;
      n_updated := n_updated + 1;
    exception when unique_violation then
      n_skipped := n_skipped + 1;
      if jsonb_array_length(conflicts) < 50 then
        conflicts := conflicts || jsonb_build_array(jsonb_build_object(
          'registration_id', s.registration_id,
          'kind', s.identity_kind,
          'value', s.identity_value));
      end if;
    end;
  end loop;
  return jsonb_build_object('updated', n_updated, 'skipped', n_skipped, 'conflicts', conflicts);
end;
$$;

do $$
declare n_incomplete int;
begin
  select count(*) into n_incomplete from activity_registrations where completed_at is null;
  raise notice '37: % registrations remain incomplete (abandoned drafts). Review them if this number looks too high.', n_incomplete;
end $$;
