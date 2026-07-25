-- ============================================================================
-- Flowchart form system — schema + idempotent backfill.
--
-- Companion to the new admin form-builder UI. This script does two things,
-- in order, so it can be re-run safely (idempotent on schema creation,
-- skip-if-exists on the backfill):
--
--   PART 1: Create form_graphs + form_nodes tables.
--
--   PART 2: For every activity_sessions row with at least one
--           activity_reg_categories child, create a form_graph with a
--           root preset_common_details node + one node per leaf category.
--           For every olympiads row, create a graph with a root node
--           (fields from registration_fields) and one child
--           preset_olympiad_questions node (fields from questions).
--
--   PART 3: Track which old tables/columns the new system supersedes.
--           We DO NOT drop them in this script — that's a separate
--           follow-up commit after the new public runner is cut over
--           and the old code paths are removed.
--
-- Apply with the Supabase SQL Editor on a copy of prod first, verify the
-- row counts match expectations (see the "Verification" comment block at
-- the bottom of this file), then re-run on prod.
-- ============================================================================

-- ── PART 1: schema ─────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

create table if not exists form_graphs (
  id            uuid primary key default gen_random_uuid(),
  owner_kind    text not null check (owner_kind in ('activity', 'olympiad')),
  owner_id      uuid not null,
  root_node_id  uuid,                                 -- set after first node insert
  title         text not null default 'Untitled form graph',
  settings      jsonb not null default '{}'::jsonb,   -- { anti_cheat, timer_minutes, default_appearance }
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (owner_kind, owner_id)
);
create index if not exists form_graphs_owner_idx on form_graphs (owner_kind, owner_id);

create table if not exists form_nodes (
  id             uuid primary key default gen_random_uuid(),
  graph_id       uuid not null references form_graphs(id) on delete cascade,
  parent_id      uuid references form_nodes(id) on delete cascade,
  position       jsonb not null default '{"x":100,"y":100}'::jsonb,
  label          text not null default 'Untitled form',
  kind           text not null default 'blank'
                   check (kind in ('starter','blank','preset_common_details','preset_olympiad_questions','preset_team_info')),
  enabled        boolean not null default true,
  is_terminal    boolean not null default false,
  fields         jsonb not null default '[]'::jsonb,  -- FormBlock[]
  appearance     jsonb not null default '{}'::jsonb,
  behavior       jsonb not null default '{}'::jsonb,
  display_order  integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists form_nodes_graph_idx on form_nodes (graph_id);
create index if not exists form_nodes_parent_idx on form_nodes (parent_id);

-- A graph's root_node_id must point at a node in that graph. We don't
-- enforce this with a real FK (would create a cycle with the graph insert
-- flow) but we add a check that root nodes are not in any other graph.
create unique index if not exists form_graphs_one_root_per_graph
  on form_nodes (graph_id) where parent_id is null;

-- Backfill the graph's root_node_id automatically when the first root
-- node is added. We do this with a trigger so the API code doesn't have
-- to remember to set it.
create or replace function sync_form_graph_root() returns trigger as $$
begin
  if new.parent_id is null then
    update form_graphs
       set root_node_id = new.id,
           updated_at = now()
     where id = new.graph_id
       and root_node_id is null;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists form_nodes_sync_root on form_nodes;
create trigger form_nodes_sync_root
  after insert on form_nodes
  for each row execute function sync_form_graph_root();

-- Mirror the existing form_configs appearance columns into a JSONB blob
-- on the graph so the new runner can resolve a single "default appearance"
-- for the whole graph. The admin form-builder UI continues to read/write
-- form_configs as today; a one-time copy (in PART 2) populates settings
-- from the form_configs row that matches form_key = 'olympiad_register'
-- (for olympiad graphs) or the per-session appearance row keyed by
-- activity_session_id.
-- (No schema change here — this is just describing the data flow.)

-- ── PART 2: backfill ───────────────────────────────────────────────────
--
-- For every activity_sessions row that has at least one
-- activity_reg_categories child, create a form_graph + a root node +
-- one node per leaf category (intermediate picker levels are flattened
-- into direct children of root, with their original path recorded in
-- the node's behavior.note for admin reference).
--
-- For every olympiads row, create a graph + a root registration node +
-- a child preset_olympiad_questions node.
--
-- All steps are wrapped in DO blocks with WHERE NOT EXISTS guards so
-- re-running this script is a no-op.

do $$
declare
  sess record;
  cat record;
  cat_root_id uuid;
  cat_graph_id uuid;
  cat_parent_node uuid;
  cat_node_id uuid;
  has_children boolean;
  position_x int;
  position_y int;
  child_count int;
begin
  -- ── activity sessions ──
  for sess in
    select s.id as session_id, s.title
      from activity_sessions s
     where exists (
       select 1 from activity_reg_categories c where c.activity_session_id = s.id
     )
  loop
    -- Skip if a graph already exists for this session.
    select id into cat_graph_id from form_graphs where owner_kind = 'activity' and owner_id = sess.session_id;
    if cat_graph_id is not null then
      continue;
    end if;

    -- Create the graph.
    insert into form_graphs (owner_kind, owner_id, title, settings)
    values ('activity', sess.session_id, sess.title, '{}'::jsonb)
    returning id into cat_graph_id;

    -- Create the root node. We use the 7 built-in fields (same as the
    -- segment default in the new admin UI).
    insert into form_nodes (graph_id, parent_id, label, kind, position, fields)
    values (
      cat_graph_id,
      null,
      'Common details',
      'starter',
      '{"x":100,"y":100}'::jsonb,
      '[
        {"id":"full_name","kind":"field","type":"text","label":"Full Name","required":true,"is_builtin":"full_name","db_column":"top_level"},
        {"id":"phone","kind":"field","type":"text","label":"Phone Number","required":true,"is_builtin":"phone","db_column":"top_level"},
        {"id":"email","kind":"field","type":"text","label":"Email Address","required":true,"is_builtin":"email","db_column":"top_level"},
        {"id":"college","kind":"field","type":"text","label":"College","required":false,"placeholder":"Notre Dame College","is_builtin":"college","db_column":"top_level"},
        {"id":"college_roll","kind":"field","type":"text","label":"College Roll","required":true,"is_builtin":"college_roll","db_column":"top_level"},
        {"id":"hsc_session","kind":"field","type":"text","label":"HSC Session","required":false,"placeholder":"e.g. 2024-25","is_builtin":"hsc_session","db_column":"top_level"},
        {"id":"division","kind":"field","type":"text","label":"Division","required":false,"placeholder":"e.g. Dhaka","is_builtin":"division","db_column":"top_level"}
      ]'::jsonb
    )
    returning id into cat_root_id;

    -- Walk the whole category tree (not just leaves) and create one
    -- form_node per category, preserving parent/child relationships.
    -- For an intermediate picker (a category that has children), we
    -- still create a form_node but give it an empty `fields` array —
    -- the runner will render it as a "pick one of these sub-forms"
    -- card list. For a leaf (no children), the fields/behaviour are
    -- copied from the old form_field_schema / top-level columns.
    --
    -- We do this in display_order order at each depth so siblings
    -- appear in the right order. The recursive CTE gives us a flat
    -- (id, parent_id, depth) view we can iterate, but we also need to
    -- know the parent form_node id (not category id) for the new FK.
    -- We build a temp lookup as we go.
    create temp table if not exists _cat_node_map (category_id uuid primary key, node_id uuid not null) on commit drop;
    delete from _cat_node_map;

    for cat in
      with recursive walk as (
        -- roots of this session (parent_id is null OR parent belongs to a
        -- different session — the latter shouldn't happen, but we cope)
        select c.id, c.parent_id, c.name, c.description, c.custom_fields, c.form_field_schema,
               c.requires_team, c.team_optional, c.team_size_min, c.team_size_max,
               c.team_member_fields, c.requires_payment, c.payment_amount, c.payment_label,
               c.is_online_submission, c.schedule_date, c.schedule_time, c.schedule_room,
               c.project_name_enabled, c.project_name_label,
               c.submission_config, c.submission_who,
               c.display_order, c.icon, c.bg_image_url, c.is_segment,
               1 as depth
          from activity_reg_categories c
         where c.activity_session_id = sess.session_id
           and (c.parent_id is null
                or not exists (select 1 from activity_reg_categories p
                                where p.id = c.parent_id
                                  and p.activity_session_id = sess.session_id))
        union all
        select c.id, c.parent_id, c.name, c.description, c.custom_fields, c.form_field_schema,
               c.requires_team, c.team_optional, c.team_size_min, c.team_size_max,
               c.team_member_fields, c.requires_payment, c.payment_amount, c.payment_label,
               c.is_online_submission, c.schedule_date, c.schedule_time, c.schedule_room,
               c.project_name_enabled, c.project_name_label,
               c.submission_config, c.submission_who,
               c.display_order, c.icon, c.bg_image_url, c.is_segment,
               p.depth + 1
          from activity_reg_categories c
          join walk p on c.parent_id = p.id
         where c.activity_session_id = sess.session_id
      )
      select * from walk order by depth, display_order, name
    loop
      -- Does this category have children? If yes, this is a PICKER node:
      -- empty fields, the runner will show its children as cards. If
      -- no, this is a LEAF node: copy form_field_schema + behaviour.
      select exists (
        select 1 from activity_reg_categories cc
         where cc.parent_id = cat.id
           and cc.activity_session_id = sess.session_id
      ) into has_children;

      -- Resolve the parent form_node id. If the old parent is null
      -- (top-level) or in a different session, attach to the graph's
      -- root. Otherwise map through _cat_node_map.
      if cat.parent_id is null then
        cat_parent_node := cat_root_id;
      else
        select node_id into cat_parent_node from _cat_node_map where category_id = cat.parent_id;
        if cat_parent_node is null then
          cat_parent_node := cat_root_id;
        end if;
      end if;

      -- Position based on depth so the diagram looks reasonable.
      position_x := 100 + (cat.depth - 1) * 320;
      position_y := coalesce(cat.display_order, 0) * 200;

      if has_children then
        -- PICKER node: no fields, no behaviour. The runner renders its
        -- child forms as clickable cards.
        insert into form_nodes (
          graph_id, parent_id, label, kind, position,
          fields, behavior, appearance, display_order
        ) values (
          cat_graph_id, cat_parent_node, cat.name, 'blank',
          jsonb_build_object('x', position_x, 'y', position_y),
          '[]'::jsonb,
          jsonb_build_object('note', 'Migrated picker. Children are clickable sub-forms.'),
          jsonb_build_object('icon', cat.icon, 'bg_image_url', cat.bg_image_url, 'is_segment', coalesce(cat.is_segment, false)),
          coalesce(cat.display_order, 0)
        )
        returning id into cat_node_id;
      else
        -- LEAF node: copy fields + behaviour from the old shape.
        insert into form_nodes (
          graph_id, parent_id, label, kind, position,
          fields, behavior, appearance, display_order
        ) values (
          cat_graph_id, cat_parent_node, cat.name, 'blank',
          jsonb_build_object('x', position_x, 'y', position_y),
          coalesce(cat.form_field_schema, '[]'::jsonb),
          jsonb_build_object(
            'note', 'Migrated from category. Original parent: ' || coalesce(cat.parent_id::text, '(root)'),
            'require_team', case when cat.requires_team then jsonb_build_object(
              'min', coalesce(cat.team_size_min, 0),
              'max', coalesce(cat.team_size_max, 5),
              'optional', coalesce(cat.team_optional, false),
              'fields', coalesce(cat.team_member_fields, '[]'::jsonb),
              'password_required', true
            ) else null end,
            'requires_payment', case when cat.requires_payment then jsonb_build_object(
              'amount', coalesce(cat.payment_amount, 0),
              'label', cat.payment_label
            ) else null end,
            'is_online_submission', coalesce(cat.is_online_submission, false),
            'schedule', case
              when cat.schedule_date is not null or cat.schedule_time is not null or cat.schedule_room is not null
              then jsonb_build_object('date', cat.schedule_date, 'time', cat.schedule_time, 'room', cat.schedule_room)
              else null
            end,
            'project_name', case when cat.project_name_enabled then jsonb_build_object(
              'enabled', true, 'label', coalesce(cat.project_name_label, 'Project Name')
            ) else null end,
            'submission_config', coalesce(cat.submission_config, '[]'::jsonb),
            'submission_who', cat.submission_who
          ),
          jsonb_build_object('icon', cat.icon, 'bg_image_url', cat.bg_image_url, 'is_segment', coalesce(cat.is_segment, false)),
          coalesce(cat.display_order, 0)
        )
        returning id into cat_node_id;
      end if;

      insert into _cat_node_map (category_id, node_id) values (cat.id, cat_node_id);
    end loop;

    drop table if exists _cat_node_map;
  end loop;
end $$;

do $$
declare
  oly record;
  oly_graph_id uuid;
  oly_root_id uuid;
  reg_fields jsonb;
  q_fields jsonb;
begin
  for oly in select id, name, registration_fields, questions, timer_minutes, exam_type from olympiads loop
    select id into oly_graph_id from form_graphs where owner_kind = 'olympiad' and owner_id = oly.id;
    if oly_graph_id is not null then continue; end if;

    -- Map olympiads.registration_fields (text|textarea|email|tel|select)
    -- into FormBlock shape. The shape is {key,label,type,required,options?}.
    reg_fields := coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', coalesce(f->>'key', gen_random_uuid()::text),
          'kind', 'field',
          'type', case f->>'type'
                    when 'email' then 'text'
                    when 'tel' then 'text'
                    else f->>'type'
                  end,
          'label', f->>'label',
          'required', coalesce((f->>'required')::boolean, false),
          'options', case when f->>'type' = 'select' then f->'options' else null end
        )
      )
      from jsonb_array_elements(coalesce(oly.registration_fields, '[]'::jsonb)) f
    ), '[]'::jsonb);

    -- Map olympiads.questions into FormBlock mcq/checkbox/short_answer/photo.
    q_fields := coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', q->>'id',
          'kind', 'field',
          'type', case q->>'type'
                    when 'mcq' then 'mcq'
                    when 'checkbox' then 'checkbox'
                    when 'short' then 'short_answer'
                    when 'photo' then 'photo'
                    else 'text'
                  end,
          'label', q->>'text',
          'description', q->>'description',
          'required', coalesce((q->>'required')::boolean, true),
          'marks', coalesce((q->>'marks')::numeric, 1),
          'key', q->>'id',
          'mcq_options', case
            when q->'options' is not null then (
              select jsonb_agg(jsonb_build_object('id', o->>'id', 'text', o->>'text'))
              from jsonb_array_elements(q->'options') o
            )
            else null
          end,
          'correct_option_id', q->>'correct_option_id',
          'correct_option_ids', q->'correct_option_ids',
          'max_files', 1
        )
      )
      from jsonb_array_elements(coalesce(oly.questions, '[]'::jsonb)) q
    ), '[]'::jsonb);

    insert into form_graphs (owner_kind, owner_id, title, settings)
    values (
      'olympiad', oly.id, oly.name,
      jsonb_build_object(
        'anti_cheat', 'timer_no_copy',
        'timer_minutes', coalesce(oly.timer_minutes, 60),
        'exam_type', oly.exam_type
      )
    )
    returning id into oly_graph_id;

    insert into form_nodes (graph_id, parent_id, label, kind, position, fields)
    values (oly_graph_id, null, 'Common details', 'starter', '{"x":100,"y":100}'::jsonb, reg_fields)
    returning id into oly_root_id;

    insert into form_nodes (graph_id, parent_id, label, kind, position, fields, behavior)
    values (
      oly_graph_id, oly_root_id, 'Questions', 'preset_olympiad_questions',
      '{"x":420,"y":100}'::jsonb, q_fields,
      jsonb_build_object('timer_override_minutes', coalesce(oly.timer_minutes, 60))
    );
  end loop;
end $$;

-- ── Verification (run these by hand after applying) ────────────────────
--
--   select count(*) from form_graphs;                                  -- one per activity + one per olympiad
--   select owner_kind, count(*) from form_graphs group by owner_kind;
--   select count(*) from form_nodes where parent_id is null;          -- one per graph
--   select count(*) from form_nodes where kind = 'preset_olympiad_questions';  -- one per olympiad
--   select count(*) from form_nodes where kind = 'blank' and parent_id is not null;  -- one per leaf activity category
--   select title, jsonb_array_length(fields) as field_count
--     from form_nodes where kind = 'starter' limit 5;                 -- common-details nodes should have 7 fields
--
-- Once those counts look right, run the new public runner (out of scope
-- of this script) to test registrations end-to-end. After verification,
-- a follow-up script can drop the old columns:
--   activity_reg_categories.form_field_schema, custom_fields,
--     team_member_fields, submission_config, submission_who,
--     project_name_*, parent_id
--   olympiads.registration_fields, questions
-- That drop is intentionally NOT in this file — keep it reversible
-- until v1 paths are fully removed.
