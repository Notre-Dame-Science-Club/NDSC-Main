-- 36: registration_slots (B9 + Segment Groups foundation)
-- One row per (registration, identity). Unique indexes make "one person, one
-- registration per segment" and "one person, one segment per group" race-free.
-- group_key: resolved segment-group id, '__all__' when the root has
-- disable_multi_segment_enroll, NULL when the segment is ungrouped.
-- Idempotent and non-destructive; safe to re-run. Deleting a registration frees
-- its slots (ON DELETE CASCADE).

create table if not exists registration_slots (
  id                  uuid primary key default gen_random_uuid(),
  registration_id     uuid not null references activity_registrations(id) on delete cascade,
  activity_session_id uuid not null,
  terminal_node_id    uuid not null,
  group_key           text,
  identity_kind       text not null check (identity_kind in ('member','email','phone','roll')),
  identity_value      text not null,
  role                text not null check (role in ('leader','team_member')),
  created_at          timestamptz not null default now()
);

create unique index if not exists registration_slots_one_per_terminal
  on registration_slots (activity_session_id, terminal_node_id, identity_kind, identity_value);
create unique index if not exists registration_slots_one_per_group
  on registration_slots (activity_session_id, group_key, identity_kind, identity_value)
  where group_key is not null;
create index if not exists registration_slots_reg_idx on registration_slots (registration_id);
create index if not exists registration_slots_identity_idx
  on registration_slots (activity_session_id, identity_kind, identity_value);

-- Marks a registration complete AND writes its slots in ONE transaction.
-- p_identities: [{ "kind": "email|phone|roll|member", "value": "...", "role": "leader|team_member" }]
-- Returns {ok:true} or {ok:false, conflict:{...}}. On conflict nothing is written
-- (the registration stays an incomplete draft).
create or replace function complete_registration(
  p_registration_id uuid,
  p_session_id      uuid,
  p_terminal_id     uuid,
  p_group_key       text,
  p_identities      jsonb
) returns jsonb
language plpgsql
as $$
declare
  ident jsonb;
  c record;
begin
  begin
    delete from registration_slots where registration_id = p_registration_id;
    for ident in select * from jsonb_array_elements(coalesce(p_identities, '[]'::jsonb)) loop
      insert into registration_slots
        (registration_id, activity_session_id, terminal_node_id, group_key, identity_kind, identity_value, role)
      values
        (p_registration_id, p_session_id, p_terminal_id, p_group_key,
         ident->>'kind', ident->>'value', coalesce(ident->>'role', 'team_member'));
    end loop;
  exception when unique_violation then
    select s.* into c
      from registration_slots s
     where s.activity_session_id = p_session_id
       and s.registration_id <> p_registration_id
       and (s.terminal_node_id = p_terminal_id
            or (p_group_key is not null and s.group_key = p_group_key))
       and exists (select 1 from jsonb_array_elements(coalesce(p_identities, '[]'::jsonb)) i
                    where i->>'kind' = s.identity_kind and i->>'value' = s.identity_value)
     limit 1;
    if c.id is null then
      return jsonb_build_object('ok', false, 'conflict', jsonb_build_object('self', true));
    end if;
    return jsonb_build_object('ok', false, 'conflict', jsonb_build_object(
      'registration_id', c.registration_id,
      'terminal_node_id', c.terminal_node_id,
      'group_key', c.group_key,
      'kind', c.identity_kind,
      'value', c.identity_value,
      'role', c.role,
      'same_terminal', c.terminal_node_id = p_terminal_id));
  end;

  update activity_registrations
     set completed_at = coalesce(completed_at, now()),
         terminal_node_id = p_terminal_id
   where id = p_registration_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- ── Backfill slots for existing COMPLETE registrations ─────────────────────
-- Conflicts (legacy data that already violates the rules) are skipped, not fatal;
-- the NOTICE at the end reports how many registrations ended up with no slots.
create or replace function _slot_norm_phone(v text) returns text language sql immutable as $$
  select case
    when v is null then ''
    else (
      with s as (select regexp_replace(trim(v), '[\s\-().]', '', 'g') as x)
      select case
        when x like '+880%' then '0' || substr(x, 5)
        when x like '880%' and length(x) >= 12 then '0' || substr(x, 4)
        else x end
      from s)
  end
$$;

with reg as (
  select r.id, r.activity_session_id, r.terminal_node_id, r.member_id,
         r.email, r.phone, r.college_roll, r.team_members,
         case when coalesce((rn.behavior->>'disable_multi_segment_enroll')::boolean, false)
              then '__all__' else null end as group_key
    from activity_registrations r
    left join form_graphs g on g.owner_kind = 'activity' and g.owner_id = r.activity_session_id
    left join form_nodes rn on rn.id = g.root_node_id
   where r.completed_at is not null and r.terminal_node_id is not null
     and r.activity_session_id is not null
     and not exists (select 1 from registration_slots s where s.registration_id = r.id)
), ids as (
  select id, activity_session_id, terminal_node_id, group_key, 'member' as kind, member_id::text as val, 'leader' as role from reg where member_id is not null
  union all select id, activity_session_id, terminal_node_id, group_key, 'email', lower(trim(email)), 'leader' from reg where nullif(trim(email), '') is not null
  union all select id, activity_session_id, terminal_node_id, group_key, 'phone', _slot_norm_phone(phone), 'leader' from reg where nullif(trim(phone), '') is not null
  union all select id, activity_session_id, terminal_node_id, group_key, 'roll', lower(trim(college_roll)), 'leader' from reg where nullif(trim(college_roll), '') is not null
  union all
  select reg.id, reg.activity_session_id, reg.terminal_node_id, reg.group_key, k.kind, k.val, 'team_member'
    from reg
    cross join lateral jsonb_array_elements(case when jsonb_typeof(reg.team_members) = 'array' then reg.team_members else '[]'::jsonb end) m
    cross join lateral (values
      ('email', lower(trim(m->>'email'))),
      ('phone', _slot_norm_phone(m->>'phone')),
      ('roll',  lower(trim(m->>'college_roll')))) as k(kind, val)
   where nullif(k.val, '') is not null
  union all
  select reg.id, reg.activity_session_id, reg.terminal_node_id, reg.group_key, 'member', l.member_id::text, 'team_member'
    from reg join team_member_links l on l.registration_id = reg.id and l.role <> 'leader'
)
insert into registration_slots (registration_id, activity_session_id, terminal_node_id, group_key, identity_kind, identity_value, role)
select distinct on (id, kind, val) id, activity_session_id, terminal_node_id, group_key, kind, val, role
  from ids
 where val is not null and val <> ''
 order by id, kind, val, (role = 'leader') desc
on conflict do nothing;

do $$
declare n_missing int; n_slots int;
begin
  select count(*) into n_slots from registration_slots;
  select count(*) into n_missing from activity_registrations r
   where r.completed_at is not null and r.terminal_node_id is not null
     and not exists (select 1 from registration_slots s where s.registration_id = r.id);
  raise notice 'registration_slots: % rows; % complete registrations have no slots (legacy conflicts or no identity)', n_slots, n_missing;
end $$;
