-- ============================================================================
-- Local dev seed data.
--
-- Idempotent: re-runs are no-ops. Designed to mirror a realistic prod
-- shape so the new form-graph system, FormRunner, and CSV exports can be
-- exercised end-to-end before the prod migration runs.
--
-- What you get:
--
--   1. Activity: "Science Olympiad 2025" with a 3-level picker tree:
--        Common details
--        └── By track (picker)
--            ├── Physics track
--            │   ├── Beginner (leaf, 4 custom fields)
--            │   └── Advanced (leaf, 5 custom fields + requires_team)
--            └── Chemistry track
--                └── General (leaf, 3 custom fields)
--
--   2. Olympiad: "NDSC Math Olympiad 2025" with 5 MCQs + 3 short answers
--      + 1 photo question. Timer 45 min, anti-cheat = timer_no_copy.
--
--   3. A handful of sample registrations for the activity so the CSV
--      download endpoint has real rows to export.
--
--   4. The form_graphs + form_nodes rows for both, pre-created so the
--      admin diagram view shows something on first load. (We don't
--      rely on the backfill migration for this — we hand-build a
--      realistic graph here so the picker tree is preserved exactly
--      the way the new backfill migration now produces it.)
--
-- Apply:    psql -h localhost -U postgres -d postgres -f db/seed_local.sql
-- Reset:    the same file is idempotent, but to wipe state first do
--              delete from form_nodes where graph_id in (
--                select id from form_graphs where owner_kind in ('activity','olympiad')
--                and owner_id in (select id from activity_sessions where title = 'Science Olympiad 2025')
--              );
--              delete from form_graphs where ...;
--              delete from activity_registrations where ...;
-- ============================================================================

-- Stable UUIDs so the seed is reproducible. Production uses real UUIDs
-- generated server-side; for dev we just pick a known set so the same
-- id shows up across re-seeds.
do $$
declare
  v_activity_id        uuid := '11111111-1111-1111-1111-111111111111';
  v_activity_type_id   uuid := '22222222-2222-2222-2222-222222222222';
  v_activity_version_id uuid := '33333333-3333-3333-3333-333333333333';
  v_olympiad_id        uuid := '44444444-4444-4444-4444-444444444444';

  v_cat_root           uuid := 'aaaa1111-aaaa-1111-aaaa-111111111111';
  v_cat_picker_tracks  uuid := 'aaaa2222-aaaa-2222-aaaa-222222222222';
  v_cat_picker_physics uuid := 'aaaa3333-aaaa-3333-aaaa-333333333333';
  v_cat_physics_begin  uuid := 'aaaa4444-aaaa-4444-aaaa-444444444444';
  v_cat_physics_adv    uuid := 'aaaa5555-aaaa-5555-aaaa-555555555555';
  v_cat_chem_gen       uuid := 'aaaa6666-aaaa-6666-aaaa-666666666666';

  v_graph_activity     uuid;
  v_graph_olympiad     uuid;
  v_node_root          uuid;
  v_node_picker        uuid;
  v_node_physics_pick  uuid;
  v_node_physics_begin uuid;
  v_node_physics_adv   uuid;
  v_node_chem_gen      uuid;
  v_node_olympiad_root uuid;
  v_node_olympiad_q    uuid;
begin

  -- ── 0. Admin account ──
  -- The local dev login at /admin/login reads ADMIN_PASSWORD from the
  -- env, then looks up the admins table by email. We seed one row
  -- here so the admin pages are reachable after a fresh bring-up.
  -- Email: admin@ndsc.local, password: set ADMIN_PASSWORD=localdev in
  -- .env.local.localstack.
  if not exists (select 1 from admins where email = 'admin@ndsc.local') then
    insert into admins (email, role) values ('admin@ndsc.local', 'admin');
  end if;

  -- ── 1. Activity / version / type ──
  insert into activity_types (id, name, slug, icon, description, display_order)
  values (v_activity_type_id, 'Olympiad', 'olympiad', '🧪', 'Olympiads and competitions', 0)
  on conflict (id) do nothing;

  insert into activity_versions (id, activity_type_id, version_number, version_label, year_start, year_end, description)
  values (v_activity_version_id, v_activity_type_id, 1, '2025', 2025, 2025, 'First edition of the 2025 cycle')
  on conflict (id) do nothing;

  insert into activity_sessions (id, activity_version_id, activity_type_id, title, slug, session_date, location, description, is_published, is_upcoming, registration_enabled, reg_status, image_display_mode)
  values (v_activity_id, v_activity_version_id, v_activity_type_id,
    'Science Olympiad 2025', 'science-olympiad-2025',
    '2025-11-15', 'NDSC Auditorium',
    'Annual science olympiad spanning physics, chemistry, and biology tracks.',
    true, true, true, 'Open', 'cover')
  on conflict (id) do nothing;

  -- ── 2. The picker tree of categories (v1 legacy shape) ──
  -- Picker: "Choose your track"
  insert into activity_reg_categories (id, activity_session_id, parent_id, name, description, display_order, registration_open, is_segment, icon)
  values (v_cat_root, v_activity_id, null, 'Choose your track', 'Pick the science track you want to compete in.', 0, true, true, '🎯')
  on conflict (id) do nothing;
  -- Picker: Physics branch
  insert into activity_reg_categories (id, activity_session_id, parent_id, name, description, display_order, registration_open, is_segment, icon)
  values (v_cat_picker_physics, v_activity_id, v_cat_root, 'Physics track', 'Two divisions: Beginner and Advanced.', 0, true, false, '⚛️')
  on conflict (id) do nothing;
  -- Picker: Chemistry branch (single child, so it shows the leaf directly when selected)
  insert into activity_reg_categories (id, activity_session_id, parent_id, name, description, display_order, registration_open, is_segment, icon)
  values (v_cat_picker_tracks, v_activity_id, v_cat_root, 'Chemistry track', '', 1, true, false, '🧪')
  on conflict (id) do nothing;

  -- Leaves (with form_field_schema and behavior that the migration will copy into form_nodes)
  insert into activity_reg_categories (id, activity_session_id, parent_id, name, description, display_order, registration_open, form_field_schema)
  values (v_cat_physics_begin, v_activity_id, v_cat_picker_physics,
    'Beginner', 'For students in their first year of physics olympiad prep.', 0, true,
    '[
      {"id":"maths_grade","kind":"field","type":"number","label":"Math grade (last exam)","required":true,"key":"maths_grade"},
      {"id":"school","kind":"field","type":"text","label":"School","required":true,"key":"school"},
      {"id":"why_join","kind":"field","type":"textarea","label":"Why do you want to join?","required":false,"key":"why_join"},
      {"id":"tshirt","kind":"field","type":"dropdown","label":"T-shirt size","required":true,"options":["S","M","L","XL"],"key":"tshirt"}
    ]'::jsonb)
  on conflict (id) do nothing;

  insert into activity_reg_categories (id, activity_session_id, parent_id, name, description, display_order, registration_open, requires_team, team_size_min, team_size_max, form_field_schema)
  values (v_cat_physics_adv, v_activity_id, v_cat_picker_physics,
    'Advanced', 'For students with prior olympiad experience. Teams of 2-3.', 1, true, true, 2, 3,
    '[
      {"id":"topics","kind":"field","type":"checkboxes","label":"Topics covered this year","required":true,"options":["Mechanics","Waves","Optics","Thermodynamics","Modern Physics"],"key":"topics"},
      {"id":"olympiad_history","kind":"field","type":"textarea","label":"Past olympiad experience","required":false,"key":"olympiad_history"},
      {"id":"maths_grade","kind":"field","type":"number","label":"Math grade (last exam)","required":true,"key":"maths_grade"},
      {"id":"school","kind":"field","type":"text","label":"School","required":true,"key":"school"},
      {"id":"tshirt","kind":"field","type":"dropdown","label":"T-shirt size","required":true,"options":["S","M","L","XL"],"key":"tshirt"}
    ]'::jsonb)
  on conflict (id) do nothing;

  insert into activity_reg_categories (id, activity_session_id, parent_id, name, description, display_order, registration_open, form_field_schema)
  values (v_cat_chem_gen, v_activity_id, v_cat_picker_tracks,
    'General Chemistry', 'Open to all students.', 0, true,
    '[
      {"id":"fav_element","kind":"field","type":"text","label":"Favorite element + why","required":true,"key":"fav_element"},
      {"id":"lab_experience","kind":"field","type":"textarea","label":"Any lab experience?","required":false,"key":"lab_experience"},
      {"id":"tshirt","kind":"field","type":"dropdown","label":"T-shirt size","required":true,"options":["S","M","L","XL"],"key":"tshirt"}
    ]'::jsonb)
  on conflict (id) do nothing;

  -- ── 3. Olympiad ──
  -- external_only=true means "open to anyone" (the default for a public
  -- olympiad). Set to false only when the olympiad is restricted to
  -- Notre Dame College students.
  insert into olympiads (id, name, description, timer_minutes, is_active, exam_type, external_only, registration_fields, questions)
  values (v_olympiad_id,
    'NDSC Math Olympiad 2025',
    'Annual math olympiad for HSC students. 5 MCQs + 3 short answer + 1 photo (workbook) submission.',
    45, true, 'mixed', true,
    '[
      {"key":"full_name","type":"text","label":"Full Name","required":true},
      {"key":"phone","type":"text","label":"Phone","required":true},
      {"key":"email","type":"email","label":"Email","required":true},
      {"key":"college","type":"text","label":"College","required":true},
      {"key":"college_roll","type":"text","label":"College Roll","required":true},
      {"key":"hsc_session","type":"text","label":"HSC Session","required":false}
    ]'::jsonb,
    '[
      {"id":"q1","type":"mcq","text":"What is 2+2?","marks":1,"options":[{"id":"a","text":"3"},{"id":"b","text":"4"},{"id":"c","text":"5"}],"correct_option_id":"b"},
      {"id":"q2","type":"mcq","text":"What is the derivative of x^2?","marks":2,"options":[{"id":"a","text":"2x"},{"id":"b","text":"x^2"},{"id":"c","text":"x"}],"correct_option_id":"a"},
      {"id":"q3","type":"mcq","text":"Solve: 3x = 12","marks":1,"options":[{"id":"a","text":"3"},{"id":"b","text":"4"},{"id":"c","text":"5"}],"correct_option_id":"b"},
      {"id":"q4","type":"checkbox","text":"Which of these are prime?","marks":2,"options":[{"id":"a","text":"2"},{"id":"b","text":"3"},{"id":"c","text":"4"},{"id":"d","text":"9"}],"correct_option_ids":["a","b"]},
      {"id":"q5","type":"mcq","text":"sin(0) = ?","marks":1,"options":[{"id":"a","text":"0"},{"id":"b","text":"1"},{"id":"c","text":"undefined"}],"correct_option_id":"a"},
      {"id":"q6","type":"short","text":"Prove that sqrt(2) is irrational.","marks":5},
      {"id":"q7","type":"short","text":"State the fundamental theorem of algebra.","marks":3},
      {"id":"q8","type":"short","text":"Define a continuous function.","marks":2},
      {"id":"q9","type":"photo","text":"Upload a photo of your written solution to Q6.","marks":5,"max_files":1}
    ]'::jsonb)
  on conflict (id) do nothing;

  -- ── 4. Pre-build the form_graphs + form_nodes the new system expects ──
  -- We do this here (rather than relying on the backfill migration) so
  -- the diagram view has something to show on first run, AND so the
  -- picker tree is exactly what we want. The backfill migration will
  -- see the rows already exist and skip them (the `continue` guards).

  -- activity graph
  select id into v_graph_activity from form_graphs where owner_kind = 'activity' and owner_id = v_activity_id;
  if v_graph_activity is null then
    insert into form_graphs (owner_kind, owner_id, title, settings)
    values ('activity', v_activity_id, 'Science Olympiad 2025', '{"default_appearance":{"bg_theme":"var(--blue)"}}'::jsonb)
    returning id into v_graph_activity;
  end if;

  -- root = common details
  select id into v_node_root from form_nodes where graph_id = v_graph_activity and parent_id is null;
  if v_node_root is null then
    insert into form_nodes (graph_id, parent_id, label, kind, position, fields, appearance)
    values (v_graph_activity, null, 'Common details', 'starter',
      '{"x":100,"y":100}'::jsonb,
      '[
        {"id":"full_name","kind":"field","type":"text","label":"Full Name","required":true,"is_builtin":"full_name","db_column":"top_level"},
        {"id":"phone","kind":"field","type":"text","label":"Phone","required":true,"is_builtin":"phone","db_column":"top_level"},
        {"id":"email","kind":"field","type":"text","label":"Email","required":true,"is_builtin":"email","db_column":"top_level"},
        {"id":"college","kind":"field","type":"text","label":"College","required":false,"is_builtin":"college","db_column":"top_level"},
        {"id":"college_roll","kind":"field","type":"text","label":"College Roll","required":true,"is_builtin":"college_roll","db_column":"top_level"},
        {"id":"hsc_session","kind":"field","type":"text","label":"HSC Session","required":false,"is_builtin":"hsc_session","db_column":"top_level"},
        {"id":"division","kind":"field","type":"text","label":"Division","required":false,"is_builtin":"division","db_column":"top_level"}
      ]'::jsonb,
      '{"title":"Activity registration","subtitle":"Fill in your details, then pick your track.","theme":"var(--blue)"}'::jsonb)
    returning id into v_node_root;
  end if;

  -- picker: "Choose your track" — empty fields, children become cards
  select id into v_node_picker from form_nodes where graph_id = v_graph_activity and label = 'Choose your track';
  if v_node_picker is null then
    insert into form_nodes (graph_id, parent_id, label, kind, position, fields, behavior, display_order)
    values (v_graph_activity, v_node_root, 'Choose your track', 'blank',
      '{"x":420,"y":100}'::jsonb, '[]'::jsonb,
      '{"note":"Picker. Children are sub-tracks."}'::jsonb, 0)
    returning id into v_node_picker;
  end if;

  -- sub-picker: Physics
  select id into v_node_physics_pick from form_nodes where graph_id = v_graph_activity and label = 'Physics track';
  if v_node_physics_pick is null then
    insert into form_nodes (graph_id, parent_id, label, kind, position, fields, behavior, display_order)
    values (v_graph_activity, v_node_picker, 'Physics track', 'blank',
      '{"x":740,"y":0}'::jsonb, '[]'::jsonb, '{}'::jsonb, 0)
    returning id into v_node_physics_pick;
  end if;

  -- leaf: Physics Beginner
  select id into v_node_physics_begin from form_nodes where graph_id = v_graph_activity and label = 'Beginner';
  if v_node_physics_begin is null then
    insert into form_nodes (graph_id, parent_id, label, kind, position, fields, display_order)
    values (v_graph_activity, v_node_physics_pick, 'Beginner', 'blank',
      '{"x":1060,"y":-100}'::jsonb,
      '[
        {"id":"maths_grade","kind":"field","type":"number","label":"Math grade (last exam)","required":true,"key":"maths_grade"},
        {"id":"school","kind":"field","type":"text","label":"School","required":true,"key":"school"},
        {"id":"why_join","kind":"field","type":"textarea","label":"Why do you want to join?","required":false,"key":"why_join"},
        {"id":"tshirt","kind":"field","type":"dropdown","label":"T-shirt size","required":true,"options":["S","M","L","XL"],"key":"tshirt"}
      ]'::jsonb, 0)
    returning id into v_node_physics_begin;
  end if;

  -- leaf: Physics Advanced (team)
  select id into v_node_physics_adv from form_nodes where graph_id = v_graph_activity and label = 'Advanced';
  if v_node_physics_adv is null then
    insert into form_nodes (graph_id, parent_id, label, kind, position, fields, behavior, display_order, is_terminal)
    values (v_graph_activity, v_node_physics_pick, 'Advanced', 'blank',
      '{"x":1060,"y":100}'::jsonb,
      '[
        {"id":"topics","kind":"field","type":"checkboxes","label":"Topics covered","required":true,"options":["Mechanics","Waves","Optics","Thermodynamics","Modern Physics"],"key":"topics"},
        {"id":"olympiad_history","kind":"field","type":"textarea","label":"Past olympiad experience","required":false,"key":"olympiad_history"},
        {"id":"maths_grade","kind":"field","type":"number","label":"Math grade","required":true,"key":"maths_grade"},
        {"id":"school","kind":"field","type":"text","label":"School","required":true,"key":"school"},
        {"id":"tshirt","kind":"field","type":"dropdown","label":"T-shirt size","required":true,"options":["S","M","L","XL"],"key":"tshirt"}
      ]'::jsonb,
      '{"require_team":{"min":2,"max":3,"optional":false,"fields":[],"password_required":true}}'::jsonb, 1, true)
    returning id into v_node_physics_adv;
  end if;

  -- sub-picker: Chemistry
  select id into v_node_chem_gen from form_nodes where graph_id = v_graph_activity and label = 'General Chemistry';
  if v_node_chem_gen is null then
    insert into form_nodes (graph_id, parent_id, label, kind, position, fields, display_order, is_terminal)
    values (v_graph_activity, v_node_picker, 'General Chemistry', 'blank',
      '{"x":740,"y":200}'::jsonb,
      '[
        {"id":"fav_element","kind":"field","type":"text","label":"Favorite element + why","required":true,"key":"fav_element"},
        {"id":"lab_experience","kind":"field","type":"textarea","label":"Any lab experience?","required":false,"key":"lab_experience"},
        {"id":"tshirt","kind":"field","type":"dropdown","label":"T-shirt size","required":true,"options":["S","M","L","XL"],"key":"tshirt"}
      ]'::jsonb, 1, true)
    returning id into v_node_chem_gen;
  end if;

  -- olympiad graph
  select id into v_graph_olympiad from form_graphs where owner_kind = 'olympiad' and owner_id = v_olympiad_id;
  if v_graph_olympiad is null then
    insert into form_graphs (owner_kind, owner_id, title, settings)
    values ('olympiad', v_olympiad_id, 'NDSC Math Olympiad 2025',
      '{"anti_cheat":"timer_no_copy","timer_minutes":45,"exam_type":"mixed","default_appearance":{"bg_theme":"var(--accent2)"}}'::jsonb)
    returning id into v_graph_olympiad;
  end if;

  select id into v_node_olympiad_root from form_nodes where graph_id = v_graph_olympiad and parent_id is null;
  if v_node_olympiad_root is null then
    insert into form_nodes (graph_id, parent_id, label, kind, position, fields, appearance)
    values (v_graph_olympiad, null, 'Olympiad registration', 'starter',
      '{"x":100,"y":100}'::jsonb,
      '[
        {"id":"full_name","kind":"field","type":"text","label":"Full Name","required":true,"key":"full_name","is_builtin":"full_name","db_column":"top_level"},
        {"id":"email","kind":"field","type":"text","label":"Email","required":true,"key":"email","is_builtin":"email","db_column":"top_level"},
        {"id":"phone","kind":"field","type":"text","label":"Phone","required":true,"key":"phone","is_builtin":"phone","db_column":"top_level"},
        {"id":"college","kind":"field","type":"text","label":"College","required":true,"key":"college","is_builtin":"college","db_column":"top_level"},
        {"id":"college_roll","kind":"field","type":"text","label":"College Roll","required":true,"key":"college_roll","is_builtin":"college_roll","db_column":"top_level"},
        {"id":"hsc_session","kind":"field","type":"text","label":"HSC Session","required":true,"key":"hsc_session","is_builtin":"hsc_session","db_column":"top_level"}
      ]'::jsonb,
      '{"title":"Olympiad registration","subtitle":"Tell us who you are before starting the exam.","theme":"var(--accent2)"}'::jsonb)
    returning id into v_node_olympiad_root;
  end if;

  select id into v_node_olympiad_q from form_nodes where graph_id = v_graph_olympiad and kind = 'preset_olympiad_questions';
  if v_node_olympiad_q is null then
    insert into form_nodes (graph_id, parent_id, label, kind, position, fields, behavior, is_terminal)
    values (v_graph_olympiad, v_node_olympiad_root, 'Questions', 'preset_olympiad_questions',
      '{"x":420,"y":100}'::jsonb,
      '[
        {"id":"q1","kind":"field","type":"mcq","label":"What is 2+2?","required":true,"marks":1,"key":"q1","mcq_options":[{"id":"a","text":"3"},{"id":"b","text":"4"},{"id":"c","text":"5"}],"correct_option_id":"b"},
        {"id":"q2","kind":"field","type":"mcq","label":"Derivative of x^2?","required":true,"marks":2,"key":"q2","mcq_options":[{"id":"a","text":"2x"},{"id":"b","text":"x^2"},{"id":"c","text":"x"}],"correct_option_id":"a"},
        {"id":"q3","kind":"field","type":"mcq","label":"Solve: 3x = 12","required":true,"marks":1,"key":"q3","mcq_options":[{"id":"a","text":"3"},{"id":"b","text":"4"},{"id":"c","text":"5"}],"correct_option_id":"b"},
        {"id":"q4","kind":"field","type":"checkbox","label":"Which of these are prime?","required":true,"marks":2,"key":"q4","mcq_options":[{"id":"a","text":"2"},{"id":"b","text":"3"},{"id":"c","text":"4"},{"id":"d","text":"9"}],"correct_option_ids":["a","b"]},
        {"id":"q5","kind":"field","type":"mcq","label":"sin(0) = ?","required":true,"marks":1,"key":"q5","mcq_options":[{"id":"a","text":"0"},{"id":"b","text":"1"},{"id":"c","text":"undefined"}],"correct_option_id":"a"},
        {"id":"q6","kind":"field","type":"short_answer","label":"Prove that sqrt(2) is irrational.","required":true,"marks":5,"key":"q6"},
        {"id":"q7","kind":"field","type":"short_answer","label":"State the fundamental theorem of algebra.","required":true,"marks":3,"key":"q7"},
        {"id":"q8","kind":"field","type":"short_answer","label":"Define a continuous function.","required":true,"marks":2,"key":"q8"},
        {"id":"q9","kind":"field","type":"photo","label":"Upload a photo of your written solution to Q6.","required":false,"marks":5,"key":"q9","max_files":1}
      ]'::jsonb,
      '{"timer_override_minutes":45}'::jsonb, true)
    returning id into v_node_olympiad_q;
  end if;

  -- ── 5. Test member for local login ──
  -- The local stack has no Supabase Auth, so members authenticate via
  -- /api/auth/login (which reads password_hash directly from this
  -- table) instead of GoTrue. We seed one verified member with
  -- known credentials so the user can immediately test the login
  -- flow after `npm run db:up && npm run db:init && npm run db:seed`.
  --
  --   Email:    testmember@ndsc.local
  --   Password: localdev
  --
  -- The hash is "seededmember$<sha256( 'seededmember' :: 'localdev' )>"
  -- — same algorithm as /api/auth/register, with a fixed salt so the
  -- value is deterministic across re-seeds. NEVER do this on a real
  -- environment; on prod, GoTrue stores the password and salt.
  if not exists (select 1 from members where email = 'testmember@ndsc.local') then
    insert into members (id, email, full_name, college_roll, is_verified, password_hash)
    values (
      '99999999-9999-9999-9999-999999999999',
      'testmember@ndsc.local',
      'Test Member',
      'NDC-2024-999',
      true,
      'seededmember$0b25800ea8f51032986dcb8123967755eefa475baaf95341cf25ad9bae9321c2'
    );
  end if;

  -- ── 6. Sample registrations (so the CSV export has rows) ──
  -- Three activity regs across the picker tree: one for each leaf
  -- (Beginner, Advanced, Chemistry). We use legacy category_id since
  -- the v2 columns are nullable, and the CSV endpoint handles both.
  -- Guarded by NOT EXISTS (not on-conflict) because neither
  -- activity_registrations nor olympiad_registrations have a natural
  -- unique key we can target.
  if not exists (select 1 from activity_registrations where activity_session_id = v_activity_id and full_name = 'Aarav Khan') then
    insert into activity_registrations (activity_session_id, category_id, full_name, phone, email, college, college_roll, hsc_session, division, custom_answers, team_members, payment_status, project_name)
    values
      (v_activity_id, v_cat_physics_begin, 'Aarav Khan', '+8801711000001', 'aarav@example.com', 'Notre Dame College', 'NDC-2024-001', '2024-25', 'Dhaka',
       '{"maths_grade": 92, "school": "NDC", "why_join": "I love physics and want to meet other students.", "tshirt": "L"}'::jsonb, '[]'::jsonb, 'not_required', null);
  end if;
  if not exists (select 1 from activity_registrations where activity_session_id = v_activity_id and full_name = 'Sara Hossain') then
    insert into activity_registrations (activity_session_id, category_id, full_name, phone, email, college, college_roll, hsc_session, division, custom_answers, team_members, payment_status, project_name)
    values
      (v_activity_id, v_cat_physics_adv, 'Sara Hossain', '+8801711000002', 'sara@example.com', 'Notre Dame College', 'NDC-2024-002', '2024-25', 'Dhaka',
       '{"topics": ["Mechanics","Waves"], "olympiad_history": "BDMO 2024 — round 2 qualifier.", "maths_grade": 96, "school": "NDC", "tshirt": "M"}'::jsonb,
       '[{"full_name":"Tariq Ahmed","email":"tariq@example.com","college_roll":"NDC-2024-099"}]'::jsonb, 'paid', null);
  end if;
  if not exists (select 1 from activity_registrations where activity_session_id = v_activity_id and full_name = 'Mehedi Rahman') then
    insert into activity_registrations (activity_session_id, category_id, full_name, phone, email, college, college_roll, hsc_session, division, custom_answers, team_members, payment_status, project_name)
    values
      (v_activity_id, v_cat_chem_gen, 'Mehedi Rahman', '+8801711000003', 'mehedi@example.com', 'Notre Dame College', 'NDC-2024-003', '2024-25', 'Dhaka',
       '{"fav_element": "Carbon — it forms more compounds than any other element.", "lab_experience": "School lab only.", "tshirt": "XL"}'::jsonb, '[]'::jsonb, 'not_required', null);
  end if;

  -- One olympiad reg (mid-exam) so the olympiad CSV has a row with
  -- partial answers and exam_started_at set.
  if not exists (select 1 from olympiad_registrations where olympiad_id = v_olympiad_id and full_name = 'Test Student') then
    insert into olympiad_registrations (olympiad_id, full_name, phone, email, college, college_roll, hsc_session, custom_answers, mcq_answers, short_answers, photo_answers, exam_started_at)
    values (v_olympiad_id, 'Test Student', '+8801711999999', 'test@example.com', 'Notre Dame College', 'NDC-2024-100', '2024-25',
      '{}'::jsonb,
      '{"q1":"b","q2":"a","q3":"b","q5":"a"}'::jsonb,
      '{"q7":"Every non-constant single-variable polynomial with complex coefficients has at least one complex root."}'::jsonb,
      '[]'::jsonb,
      now() - interval '15 minutes');
  end if;
end $$;
