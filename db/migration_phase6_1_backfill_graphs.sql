-- Phase 6.1: backfill form_graphs for any activity_session or olympiad
-- that's missing one. Needed because the original migration (Phase 1)
-- ran while activity_reg_categories still existed — it only created
-- graphs for sessions that had categories at the time. Sessions that
-- were empty (or got created later) were skipped. With the v1 tables
-- dropped in Phase 6, there's no other source of category data, so we
-- bootstrap a minimal graph for every owner that doesn't have one yet:
-- a root "Common details" node (the 7 builtin fields) plus one terminal
-- leaf per owner that the runner will render as the actual registration
-- form. Idempotent — re-runs are no-ops.

do $$
declare
  sess record;
  new_graph_id uuid;
  new_root_id uuid;
  oly record;
  oly_root_id uuid;
  q_fields jsonb;
  existing_id uuid;
begin
  -- ── activities ────────────────────────────────────────────────────────
  for sess in select id, title from activity_sessions loop
    select id into existing_id from form_graphs
      where owner_kind = 'activity' and owner_id = sess.id;
    if existing_id is not null then continue; end if;

    insert into form_graphs (owner_kind, owner_id, title, settings)
      values ('activity', sess.id, sess.title, '{}'::jsonb)
      returning id into new_graph_id;

    insert into form_nodes (graph_id, parent_id, label, kind, position, fields, behavior, appearance, is_terminal, enabled, display_order)
      values (
        new_graph_id, null, 'Common details', 'starter',
        '{"x":100,"y":100}'::jsonb,
        '[
          {"id":"full_name","kind":"field","type":"text","label":"Full Name","required":true,"is_builtin":"full_name","db_column":"top_level"},
          {"id":"phone","kind":"field","type":"text","label":"Phone Number","required":true,"is_builtin":"phone","db_column":"top_level"},
          {"id":"email","kind":"field","type":"text","label":"Email Address","required":true,"is_builtin":"email","db_column":"top_level"},
          {"id":"college","kind":"field","type":"text","label":"College","required":false,"placeholder":"Notre Dame College","is_builtin":"college","db_column":"top_level"},
          {"id":"college_roll","kind":"field","type":"text","label":"College Roll","required":true,"is_builtin":"college_roll","db_column":"top_level"},
          {"id":"hsc_session","kind":"field","type":"text","label":"HSC Session","required":false,"placeholder":"e.g. 2024-25","is_builtin":"hsc_session","db_column":"top_level"},
          {"id":"division","kind":"field","type":"text","label":"Division","required":false,"placeholder":"e.g. Dhaka","is_builtin":"division","db_column":"top_level"}
        ]'::jsonb,
        '{}'::jsonb, '{}'::jsonb, false, true, 0
      )
      returning id into new_root_id;

    -- Terminal leaf — captures "you're done" so the runner shows the
    -- post-submit state. With no category data to migrate, this leaf
    -- has no extra fields/behaviour; admins can add fields via the form
    -- builder later.
    insert into form_nodes (graph_id, parent_id, label, kind, position, fields, behavior, appearance, is_terminal, enabled, display_order)
      values (
        new_graph_id, new_root_id, 'Submit registration', 'blank',
        '{"x":420,"y":100}'::jsonb,
        '[]'::jsonb,
        '{}'::jsonb, '{}'::jsonb, true, true, 0
      );
  end loop;

  -- ── olympiads ────────────────────────────────────────────────────────
  for oly in select id, name, timer_minutes, exam_type, questions, registration_fields from olympiads loop
    select id into existing_id from form_graphs
      where owner_kind = 'olympiad' and owner_id = oly.id;
    if existing_id is not null then continue; end if;

    insert into form_graphs (owner_kind, owner_id, title, settings)
      values (
        'olympiad', oly.id, oly.name,
        jsonb_build_object(
          'anti_cheat', 'timer_no_copy',
          'timer_minutes', coalesce(oly.timer_minutes, 60),
          'exam_type', oly.exam_type
        )
      )
      returning id into new_graph_id;

    insert into form_nodes (graph_id, parent_id, label, kind, position, fields)
      values (
        new_graph_id, null, 'Common details', 'starter',
        '{"x":100,"y":100}'::jsonb,
        -- Re-map olympiads.questions JSONB (which Phase 6 left in
        -- place; the registration_fields column was dropped, but
        -- questions is still here for olympiads). If we have
        -- questions, they live on the terminal questions node, not
        -- the registration root — so the root gets a minimal builtin
        -- set instead. (Registration-fields data was lost when the
        -- column was dropped; admins can re-add via the builder.)
        '[
          {"id":"full_name","kind":"field","type":"text","label":"Full Name","required":true,"is_builtin":"full_name","db_column":"top_level"},
          {"id":"phone","kind":"field","type":"text","label":"Phone Number","required":true,"is_builtin":"phone","db_column":"top_level"},
          {"id":"email","kind":"field","type":"text","label":"Email Address","required":true,"is_builtin":"email","db_column":"top_level"},
          {"id":"college","kind":"field","type":"text","label":"College","required":false,"placeholder":"Notre Dame College","is_builtin":"college","db_column":"top_level"},
          {"id":"college_roll","kind":"field","type":"text","label":"College Roll","required":true,"is_builtin":"college_roll","db_column":"top_level"}
        ]'::jsonb
      )
      returning id into oly_root_id;

    -- Map questions the same way the original migration did. If the
    -- olympiad has no questions column (it was dropped), produce an
    -- empty list and admins can populate via the builder.
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

    insert into form_nodes (graph_id, parent_id, label, kind, position, fields, behavior)
      values (
        new_graph_id, oly_root_id, 'Questions', 'preset_olympiad_questions',
        '{"x":420,"y":100}'::jsonb, q_fields,
        jsonb_build_object('timer_override_minutes', coalesce(oly.timer_minutes, 60))
      );
  end loop;
end $$;