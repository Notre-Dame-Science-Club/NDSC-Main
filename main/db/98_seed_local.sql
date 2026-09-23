-- ============================================================================
-- Local dev seed data.
--
-- Idempotent: re-runs are no-ops. Designed to mirror a realistic prod
-- shape so the new form-graph system, FormRunner, and CSV exports can be
-- exercised end-to-end before the prod migration runs.
--
-- PART 1 (below) is the original baseline: one activity, one olympiad.
-- PART 2 (bottom of this file, search "FEATURE SHOWCASE") adds six more
-- activities and two more olympiads, each isolating a different feature
-- of the registration system (team registration, payment, offline
-- schedules, relay exams — sequential and chain, subject assignment,
-- post-registration submissions, scheduled/themed olympiads, and a v2
-- form-graph-only activity with every content-block type). See
-- docs/FEATURE_TOUR.md for the guided walkthrough of what to click on
-- each one.
--
-- What you get (PART 1):
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


-- ============================================================================
-- PART 2 — FEATURE SHOWCASE extension.
--
-- Companion to db/seed_local.sql (which already seeds "Science Olympiad
-- 2025" + "NDSC Math Olympiad 2025" as a paired v1/v2 example). This file
-- adds six more activities and two more standalone olympiads, each one
-- deliberately isolating a different slice of the registration system so
-- every admin-configurable feature has a concrete, clickable example in
-- local dev. See docs/FEATURE_TOUR.md for the guided walkthrough of what
-- to click on each one.
--
-- Idempotent, same conventions as seed_local.sql: fixed UUIDs, NOT EXISTS /
-- ON CONFLICT guards, safe to re-run. Apply AFTER seed_local.sql (order
-- doesn't actually matter — nothing here depends on it — but keeping them
-- in sequence matches how npm run db:seed will eventually chain both).
--
-- Apply:  psql -h localhost -U postgres -d postgres -f db/seed_local_showcase.sql
--
-- What you get (see docs/FEATURE_TOUR.md for the full tour):
--
--   S1  Brain Rain 4.0             — simplest possible case: one session,
--                                     one leaf, zero picking step, no team,
--                                     no payment. notify_publicly popup +
--                                     pinned/highlighted version.
--   S2  Robo Wars 2025             — team registration (with a solo-allowed
--                                     option), payment gate, offline
--                                     schedule (date/time/room), project
--                                     name, edit-window locking, a closed
--                                     division, and a per-session appearance
--                                     override.
--   S3  Code Sprint Hackathon      — is_online_submission WITHOUT a linked
--                                     olympiad: post-registration file/text
--                                     deliverable upload (submission_config),
--                                     draft vs final submission states.
--   S4  Physics Live Challenge     — is_online_submission WITH a linked
--                                     olympiad: sequential relay exam,
--                                     self-select subject assignment,
--                                     mid-relay state.
--   S5  Bio Quiz Relay             — linked olympiad, CHAIN relay (each
--                                     member sees the previous member's
--                                     answer via {{chain.*}} tokens),
--                                     admin-assigned subjects.
--   S6  Debate Championship 2025   — v2 form-graph ONLY (no legacy
--                                     category tree): every content-block
--                                     type, a link_button "skip ahead" jump,
--                                     a preset_team_info node, unique_field
--                                     duplicate detection, step progress bar.
--
--   O1  Photo-Only Sprint Olympiad — v2 standalone olympiad: exam_type =
--                                     photo_only, one_by_one question
--                                     display, a future scheduled_start_at
--                                     (tests the countdown/lock gate), full
--                                     theme override.
--   O2  Live MCQ Blitz             — v2 standalone olympiad: exam_type =
--                                     live_only, restricted to NDC students
--                                     (external_only = false), and one
--                                     FULLY graded registration so you can
--                                     see the results/annotations pipeline
--                                     end-to-end without marking anything
--                                     yourself.
--
-- Every UUID below is in the `b...` block so it never collides with
-- seed_local.sql's `1111.../aaaa.../9999...` ids.
-- ============================================================================

do $$
declare
  -- shared activity_type/version for everything in this file
  s_type_id     uuid := 'b1000000-0000-0000-0000-000000000001';
  s_version_id  uuid := 'b1000000-0000-0000-0000-000000000002';

  -- activity sessions
  s1_id uuid := 'b2000000-0000-0000-0000-000000000001'; -- Brain Rain 4.0
  s2_id uuid := 'b2000000-0000-0000-0000-000000000002'; -- Robo Wars 2025
  s3_id uuid := 'b2000000-0000-0000-0000-000000000003'; -- Code Sprint Hackathon
  s4_id uuid := 'b2000000-0000-0000-0000-000000000004'; -- Physics Live Challenge
  s5_id uuid := 'b2000000-0000-0000-0000-000000000005'; -- Bio Quiz Relay
  s6_id uuid := 'b2000000-0000-0000-0000-000000000006'; -- Debate Championship 2025

  -- v1 categories
  c1_id uuid := 'b3000000-0000-0000-0000-000000000001'; -- S1 leaf (direct, no picker)
  c2_picker_id uuid := 'b3000000-0000-0000-0000-000000000002'; -- S2 picker "Choose your division"
  c2_std_id    uuid := 'b3000000-0000-0000-0000-000000000003'; -- S2 leaf: Standard Division (open)
  c2_elite_id  uuid := 'b3000000-0000-0000-0000-000000000004'; -- S2 leaf: Elite Division (CLOSED)
  c3_id uuid := 'b3000000-0000-0000-0000-000000000005'; -- S3 leaf
  c4_id uuid := 'b3000000-0000-0000-0000-000000000006'; -- S4 leaf
  c5_id uuid := 'b3000000-0000-0000-0000-000000000007'; -- S5 leaf

  -- olympiads
  o1_id uuid := 'b4000000-0000-0000-0000-000000000001'; -- linked from S4, sequential relay
  o2_id uuid := 'b4000000-0000-0000-0000-000000000002'; -- linked from S5, chain relay
  o3_id uuid := 'b4000000-0000-0000-0000-000000000003'; -- Photo-Only Sprint Olympiad (v2 standalone)
  o4_id uuid := 'b4000000-0000-0000-0000-000000000004'; -- Live MCQ Blitz (v2 standalone)

  -- registration ids we need to reference from a second insert
  r_s2_paid   uuid;
  r_s2_failed uuid;
  r_s3_final  uuid;
  r_s3_draft  uuid;
  r_s4_relay  uuid;
  r_s5_relay  uuid;

  -- v2 form-graph scratch vars (S6, O1 questions node reuse pattern, O3, O4)
  g_s6 uuid; n_s6_root uuid; n_s6_picker uuid; n_s6_solo uuid; n_s6_team uuid;
  g_o3 uuid; n_o3_root uuid; n_o3_q uuid;
  g_o4 uuid; n_o4_root uuid; n_o4_q uuid;
begin

  -- ── 0. Shared activity type + version for this file's sessions ──
  insert into activity_types (id, name, slug, icon, description, display_order)
  values (s_type_id, 'Competitions', 'competitions', '🏆', 'Flagship competitive events across departments', 1)
  on conflict (id) do nothing;

  insert into activity_versions (id, activity_type_id, version_number, version_label, year_start, year_end, description, is_pinned, is_highlighted)
  values (s_version_id, s_type_id, 1, '2025 Season', 2025, 2025, 'The 2025 competition season — feature-showcase seed data.', true, true)
  on conflict (id) do nothing;

  -- ══════════════════════════════════════════════════════════════════════
  -- S1 — Brain Rain 4.0
  -- Simplest possible activity: ONE category directly under the session
  -- (no picker step at all — register lands straight on the field form).
  -- Demonstrates: dropdown / date / time / photo / file field types,
  -- unique_field duplicate-checking, notify_publicly site-wide popup,
  -- registration_note, event_dates (multi-day badge).
  -- ══════════════════════════════════════════════════════════════════════
  insert into activity_sessions (
    id, activity_version_id, activity_type_id, title, slug, session_date, location, description,
    is_published, is_upcoming, registration_enabled, registration_note, reg_status, reg_deadline,
    image_display_mode, notify_publicly, event_dates
  )
  values (
    s1_id, s_version_id, s_type_id,
    'Brain Rain 4.0', 'brain-rain-4-0',
    '2025-12-06', 'NDC Seminar Hall',
    'A single-round general knowledge quiz open to every HSC student — no team, no fee, just show up.',
    true, true, true, 'Seats are limited to 200 — register early.', 'Open', now() + interval '20 days',
    'cover', true, '["2025-12-06"]'::jsonb
  )
  on conflict (id) do nothing;

  insert into activity_reg_categories (
    id, activity_session_id, parent_id, name, description, display_order, registration_open,
    icon, is_segment, form_field_schema
  )
  values (
    c1_id, s1_id, null, 'General Registration', 'One round, 45 minutes, individual entry.', 0, true,
    '🧠', false,
    '[
      {"id":"tshirt","kind":"field","type":"dropdown","label":"T-shirt size","required":true,"options":["S","M","L","XL","XXL"],"key":"tshirt"},
      {"id":"preferred_date","kind":"field","type":"date","label":"Which day works if we add a second round?","required":false,"key":"preferred_date"},
      {"id":"preferred_slot","kind":"field","type":"time","label":"Preferred check-in time","required":false,"key":"preferred_slot"},
      {"id":"id_photo","kind":"field","type":"photo","label":"Upload a photo of your student ID","required":true,"key":"id_photo","max_files":1,"max_file_size_mb":5},
      {"id":"consent_form","kind":"field","type":"file","label":"Signed parental consent (if under 18)","required":false,"key":"consent_form","max_files":1,"max_file_size_mb":10}
    ]'::jsonb
  )
  on conflict (id) do nothing;

  insert into activity_updates (activity_session_id, title, body, link_url)
  select s1_id, 'Venue confirmed', 'Brain Rain 4.0 will be held in the NDC Seminar Hall, ground floor. Doors open 30 minutes before start.', null
  where not exists (select 1 from activity_updates where activity_session_id = s1_id and title = 'Venue confirmed');

  insert into activity_updates (activity_session_id, title, body, link_url)
  select s1_id, 'Round format finalized', 'Single round, 40 MCQs, 45 minutes, no negative marking. Full syllabus posted below.', 'https://example.com/brain-rain-syllabus.pdf'
  where not exists (select 1 from activity_updates where activity_session_id = s1_id and title = 'Round format finalized');

  if not exists (select 1 from activity_registrations where activity_session_id = s1_id and full_name = 'Nusrat Jahan') then
    insert into activity_registrations (activity_session_id, category_id, full_name, phone, email, college, college_roll, hsc_session, division, custom_answers, payment_status)
    values (s1_id, c1_id, 'Nusrat Jahan', '+8801711100001', 'nusrat@example.com', 'Notre Dame College', 'NDC-2025-101', '2025-26', 'Dhaka',
      '{"tshirt":"M","preferred_date":"2025-12-06","preferred_slot":"09:00","id_photo":"https://example.com/uploads/id-nusrat.jpg"}'::jsonb,
      'not_required');
  end if;

  -- ══════════════════════════════════════════════════════════════════════
  -- S2 — Robo Wars 2025
  -- Picker with TWO leaves: an open "Standard Division" and a CLOSED
  -- "Elite Division" (registration_open = false — the public picker hides
  -- it entirely; try it in the admin builder to see it flagged closed).
  -- Demonstrates: requires_team + team_optional, requires_payment,
  -- offline schedule_date/time/room, project_name, edit_window_hours,
  -- checkboxes/multiple_choice fields, payment_transactions (valid +
  -- failed), and a per-session form-appearance override.
  -- ══════════════════════════════════════════════════════════════════════
  insert into activity_sessions (
    id, activity_version_id, activity_type_id, title, slug, session_date, location, description,
    is_published, is_upcoming, registration_enabled, reg_status, reg_deadline, image_display_mode
  )
  values (
    s2_id, s_version_id, s_type_id,
    'Robo Wars 2025', 'robo-wars-2025',
    '2026-01-18', 'NDC Engineering Workshop',
    'Build-and-battle robotics competition. Standard division is open team or solo entry; Elite division is invite-only and currently closed to new registrants.',
    true, true, true, 'Open', now() + interval '35 days', 'cover'
  )
  on conflict (id) do nothing;

  insert into activity_reg_categories (id, activity_session_id, parent_id, name, description, display_order, registration_open, icon, is_segment)
  values (c2_picker_id, s2_id, null, 'Choose your division', 'Standard is open to everyone. Elite is by invitation only.', 0, true, '🤖', true)
  on conflict (id) do nothing;

  insert into activity_reg_categories (
    id, activity_session_id, parent_id, name, description, display_order, registration_open,
    requires_team, team_size_min, team_size_max, team_optional,
    requires_payment, payment_amount, payment_label,
    schedule_date, schedule_time, schedule_room,
    project_name_enabled, project_name_label, edit_window_hours,
    form_field_schema
  )
  values (
    c2_std_id, s2_id, c2_picker_id, 'Standard Division', 'Teams of 2-4, or register solo if you''ll form a team later.', 0, true,
    true, 2, 4, true,
    true, 500, 'Registration Fee (BDT)',
    '2026-01-18', '10:00', 'Workshop Bay 2',
    true, 'Robot Name', 48,
    '[
      {"id":"weight_class","kind":"field","type":"multiple_choice","label":"Weight class","required":true,"options":["Featherweight (<1.5kg)","Middleweight (<5kg)","Heavyweight (<15kg)"],"key":"weight_class"},
      {"id":"weapon_types","kind":"field","type":"checkboxes","label":"Weapon type(s) on your bot","required":false,"options":["Spinner","Flipper","Crusher","Ram","None (pusher only)"],"key":"weapon_types"},
      {"id":"advisor_name","kind":"field","type":"text","label":"Faculty advisor (if any)","required":false,"key":"advisor_name"}
    ]'::jsonb
  )
  on conflict (id) do nothing;

  insert into activity_reg_categories (
    id, activity_session_id, parent_id, name, description, display_order, registration_open,
    requires_team, team_size_min, team_size_max,
    requires_payment, payment_amount, payment_label,
    schedule_date, schedule_time, schedule_room, form_field_schema
  )
  values (
    c2_elite_id, s2_id, c2_picker_id, 'Elite Division', 'Invitation-only bracket for last year''s top 8 — closed to new registrants.', 1, false,
    true, 2, 4,
    true, 1000, 'Elite Registration Fee (BDT)',
    '2026-01-19', '10:00', 'Workshop Bay 1',
    '[{"id":"last_year_rank","kind":"field","type":"number","label":"Last year''s final rank","required":true,"key":"last_year_rank"}]'::jsonb
  )
  on conflict (id) do nothing;

  -- Per-session appearance override (activity_session_form_appearance —
  -- the 1:1 table the admin "Appearance" tab on
  -- /admin/activity-registration/[sessionId] reads/writes).
  insert into activity_session_form_appearance (
    session_id, form_title, form_subtitle, form_cover_photo_url, form_cover_aspect_ratio,
    form_bg_theme, form_bg_color, form_font_family,
    form_auto_pull_title, form_auto_pull_description, form_auto_pull_cover, form_contact_persons
  )
  values (
    s2_id, 'Robo Wars 2025 — Registration', 'Pick your division below. Payment is the last step, only for paid divisions.',
    'https://example.com/uploads/robowars-cover.jpg', '16/9',
    'custom', '#ff6a00', 'orbitron',
    false, false, false,
    '[{"name":"Tanvir Ahmed","post":"Robotics Club Lead","phone":"+8801811112222","email":"robowars@ndsc.local","whatsapp":"+8801811112222","facebook":""}]'::jsonb
  )
  on conflict (session_id) do nothing;

  -- Paid team registration (captures id so we can attach a payment_transactions row).
  if not exists (select 1 from activity_registrations where activity_session_id = s2_id and full_name = 'Fahim Rahman') then
    insert into activity_registrations (
      activity_session_id, category_id, full_name, phone, email, college, college_roll, hsc_session, division,
      custom_answers, team_members, payment_status, payment_tran_id, payment_amount, payment_validated_at, project_name
    )
    values (
      s2_id, c2_std_id, 'Fahim Rahman', '+8801711100002', 'fahim@example.com', 'Notre Dame College', 'NDC-2025-102', '2025-26', 'Dhaka',
      '{"weight_class":"Middleweight (<5kg)","weapon_types":["Spinner","Ram"],"advisor_name":"Mr. Kamal Hossain"}'::jsonb,
      '[{"full_name":"Rafiq Islam","email":"rafiq@example.com","college_roll":"NDC-2025-103"},{"full_name":"Sami Uddin","email":"sami@example.com","college_roll":"NDC-2025-104"}]'::jsonb,
      'paid', 'ROBOWARS-TX-0001', 500, now() - interval '2 days', 'Iron Wasp'
    )
    returning id into r_s2_paid;

    insert into payment_transactions (tran_id, activity_registration_id, amount, currency, status, raw_ipn, raw_validation, validated_at)
    values ('ROBOWARS-TX-0001', r_s2_paid, 500, 'BDT', 'valid',
      '{"tran_id":"ROBOWARS-TX-0001","status":"VALID","amount":"500.00"}'::jsonb,
      '{"status":"VALID","risk_level":"0","card_type":"bkash"}'::jsonb,
      now() - interval '2 days');
  end if;

  -- Solo entry (team_optional demo — 0 team members) with a pending payment.
  if not exists (select 1 from activity_registrations where activity_session_id = s2_id and full_name = 'Ishrat Zaman') then
    insert into activity_registrations (
      activity_session_id, category_id, full_name, phone, email, college, college_roll, hsc_session, division,
      custom_answers, team_members, payment_status, project_name
    )
    values (
      s2_id, c2_std_id, 'Ishrat Zaman', '+8801711100005', 'ishrat@example.com', 'Notre Dame College', 'NDC-2025-105', '2025-26', 'Dhaka',
      '{"weight_class":"Featherweight (<1.5kg)","weapon_types":["Flipper"]}'::jsonb,
      '[]'::jsonb,
      'pending', 'Solo Sparrow'
    );
  end if;

  -- Failed-payment + edit-locked demo.
  if not exists (select 1 from activity_registrations where activity_session_id = s2_id and full_name = 'Zubair Khan') then
    insert into activity_registrations (
      activity_session_id, category_id, full_name, phone, email, college, college_roll, hsc_session, division,
      custom_answers, team_members, payment_status, payment_tran_id, edit_locked_at, project_name
    )
    values (
      s2_id, c2_std_id, 'Zubair Khan', '+8801711100006', 'zubair@example.com', 'Notre Dame College', 'NDC-2025-106', '2025-26', 'Dhaka',
      '{"weight_class":"Heavyweight (<15kg)","weapon_types":["Crusher"]}'::jsonb,
      '[{"full_name":"Ovi Das","email":"ovi@example.com","college_roll":"NDC-2025-107"}]'::jsonb,
      'failed', 'ROBOWARS-TX-0002', now() - interval '1 hour', 'Titan Crush'
    )
    returning id into r_s2_failed;

    insert into payment_transactions (tran_id, activity_registration_id, amount, currency, status, raw_ipn)
    values ('ROBOWARS-TX-0002', r_s2_failed, 500, 'BDT', 'failed', '{"tran_id":"ROBOWARS-TX-0002","status":"FAILED"}'::jsonb);
  end if;

  -- ══════════════════════════════════════════════════════════════════════
  -- S3 — Code Sprint Hackathon
  -- is_online_submission = true but NO linked olympiad: this is the
  -- "offline submission" path (submission_config), not an exam. Teams
  -- upload a deliverable from their dashboard after registering.
  -- Demonstrates: submission_config (file + text fields), submission_who
  -- = 'any_member', activity_submissions rows in both a draft (is_final
  -- = false) and final (is_final = true) state.
  -- ══════════════════════════════════════════════════════════════════════
  insert into activity_sessions (
    id, activity_version_id, activity_type_id, title, slug, session_date, location, description,
    is_published, is_upcoming, registration_enabled, reg_status, reg_deadline, image_display_mode
  )
  values (
    s3_id, s_version_id, s_type_id,
    'Code Sprint Hackathon', 'code-sprint-hackathon',
    '2026-02-01', 'Online', '24-hour team hackathon. Submit your repo link and a short write-up from your dashboard before the deadline.',
    true, true, true, 'Open', now() + interval '40 days', 'cover'
  )
  on conflict (id) do nothing;

  insert into activity_reg_categories (
    id, activity_session_id, parent_id, name, description, display_order, registration_open,
    requires_team, team_size_min, team_size_max,
    is_online_submission, submission_who, submission_config,
    form_field_schema
  )
  values (
    c3_id, s3_id, null, 'Team Registration', 'Teams of 2-4. Submission opens once the sprint starts.', 0, true,
    true, 2, 4,
    true, 'any_member',
    '[
      {"id":"repo_link","title":"Repository link","description":"Public GitHub/GitLab URL","field_type":"text","required":true},
      {"id":"writeup","title":"Write-up / README","description":"Explain what you built and how to run it","field_type":"textarea","required":true},
      {"id":"demo_video","title":"Demo video or screenshots","description":"","field_type":"file","file_types":["mp4","zip","pdf"],"max_file_size_mb":50,"max_files":3,"required":false}
    ]'::jsonb,
    '[
      {"id":"track","kind":"field","type":"dropdown","label":"Track","required":true,"options":["Web","Mobile","AI/ML","Hardware"],"key":"track"},
      {"id":"idea_pitch","kind":"field","type":"textarea","label":"One-line idea pitch","required":false,"key":"idea_pitch"}
    ]'::jsonb
  )
  on conflict (id) do nothing;

  if not exists (select 1 from activity_registrations where activity_session_id = s3_id and full_name = 'Tania Afroz') then
    insert into activity_registrations (activity_session_id, category_id, full_name, phone, email, college, college_roll, hsc_session, custom_answers, team_members, payment_status)
    values (s3_id, c3_id, 'Tania Afroz', '+8801711100010', 'tania@example.com', 'Notre Dame College', 'NDC-2025-110', '2025-26',
      '{"track":"AI/ML","idea_pitch":"An offline-first study buddy app for HSC students."}'::jsonb,
      '[{"full_name":"Rakib Hasan","email":"rakib@example.com","college_roll":"NDC-2025-111"},{"full_name":"Farhan Kabir","email":"farhan@example.com","college_roll":"NDC-2025-112"}]'::jsonb,
      'not_required')
    returning id into r_s3_final;

    insert into activity_submissions (registration_id, category_id, activity_session_id, submitted_by, answers, is_final)
    values (r_s3_final, c3_id, s3_id, 'leader',
      '{"repo_link":"https://github.com/example/study-buddy","writeup":"A React Native app that caches HSC syllabus content offline and quizzes the user with spaced repetition.","demo_video":["https://example.com/uploads/study-buddy-demo.mp4"]}'::jsonb,
      true);
  end if;

  if not exists (select 1 from activity_registrations where activity_session_id = s3_id and full_name = 'Mahin Chowdhury') then
    insert into activity_registrations (activity_session_id, category_id, full_name, phone, email, college, college_roll, hsc_session, custom_answers, team_members, payment_status)
    values (s3_id, c3_id, 'Mahin Chowdhury', '+8801711100013', 'mahin@example.com', 'Notre Dame College', 'NDC-2025-113', '2025-26',
      '{"track":"Web","idea_pitch":"Real-time carpooling board for college commuters."}'::jsonb,
      '[{"full_name":"Nabila Sultana","email":"nabila@example.com","college_roll":"NDC-2025-114"}]'::jsonb,
      'not_required')
    returning id into r_s3_draft;

    -- Draft submission — team has saved progress but not marked it final yet.
    insert into activity_submissions (registration_id, category_id, activity_session_id, submitted_by, answers, is_final)
    values (r_s3_draft, c3_id, s3_id, 'leader',
      '{"repo_link":"https://github.com/example/carpool-board","writeup":"Work in progress — routing algorithm not finished yet."}'::jsonb,
      false);
  end if;

  -- ══════════════════════════════════════════════════════════════════════
  -- S4 — Physics Live Challenge 2025
  -- is_online_submission = true WITH a linked olympiad (o1): this is the
  -- "live exam" path. o1 has relay_mode = true, relay_type = sequential,
  -- and self-select subject assignment. We seed a registration that's
  -- mid-relay (leader has gone, member #1's turn is next) so the
  -- "waiting for your turn" / relay progress UI has something to show.
  -- ══════════════════════════════════════════════════════════════════════
  insert into olympiads (
    id, name, description, exam_type, exam_mode, question_display, timer_minutes,
    is_active, external_only, registration_deadline, exam_date, eligibility,
    registration_fields, questions,
    relay_mode, relay_type, subjects, subject_assignment_mode
  )
  values (
    o1_id, 'Physics Live Challenge 2025',
    'Team relay exam — Physics and Math rounds, one member at a time, sequential handoff.',
    'live_only', 'mixed', 'one_by_one', 20,
    true, true, now() + interval '35 days', now() + interval '35 days',
    'Open to all HSC students competing as a registered Robo... (n/a — see linked activity for team rules).',
    '[]'::jsonb,
    '[
      {"id":"pq1","type":"mcq","text":"A ball is thrown upward at 20 m/s. How long until it returns to the same height?","marks":2,"subject_id":"phy","options":[{"id":"a","text":"2s"},{"id":"b","text":"4s"},{"id":"c","text":"1s"}],"correct_option_id":"b"},
      {"id":"pq2","type":"short","text":"State Newton''s second law of motion.","marks":3,"subject_id":"phy"},
      {"id":"mq1","type":"mcq","text":"What is the value of \u222b\u2080\u00b9 2x dx?","marks":2,"subject_id":"math","options":[{"id":"a","text":"1"},{"id":"b","text":"2"},{"id":"c","text":"0.5"}],"correct_option_id":"a"},
      {"id":"mq2","type":"short","text":"Solve for x: 2x\u00b2 - 8 = 0","marks":2,"subject_id":"math"}
    ]'::jsonb,
    true, 'sequential',
    '[{"id":"phy","name":"Physics"},{"id":"math","name":"Mathematics"}]'::jsonb,
    'self_select'
  )
  on conflict (id) do nothing;

  insert into activity_sessions (
    id, activity_version_id, activity_type_id, title, slug, session_date, location, description,
    is_published, is_upcoming, registration_enabled, reg_status, reg_deadline, image_display_mode
  )
  values (
    s4_id, s_version_id, s_type_id,
    'Physics Live Challenge 2025', 'physics-live-challenge-2025',
    '2026-02-15', 'Online (live exam)', 'Register a team of 2-3, then take turns on the linked live relay exam from your dashboard.',
    true, true, true, 'Open', now() + interval '35 days', 'cover'
  )
  on conflict (id) do nothing;

  insert into activity_reg_categories (
    id, activity_session_id, parent_id, name, description, display_order, registration_open,
    requires_team, team_size_min, team_size_max,
    is_online_submission, linked_olympiad_id,
    form_field_schema
  )
  values (
    c4_id, s4_id, null, 'Team Entry', 'Teams of 2-3. Each member takes one turn on the relay exam, in order.', 0, true,
    true, 2, 3,
    true, o1_id,
    '[{"id":"school_year","kind":"field","type":"dropdown","label":"HSC Year","required":true,"options":["1st Year","2nd Year"],"key":"school_year"}]'::jsonb
  )
  on conflict (id) do nothing;

  if not exists (select 1 from activity_registrations where activity_session_id = s4_id and full_name = 'Arif Hossain') then
    insert into activity_registrations (activity_session_id, category_id, full_name, phone, email, college, college_roll, hsc_session, custom_answers, team_members, payment_status)
    values (s4_id, c4_id, 'Arif Hossain', '+8801711100020', 'arif@example.com', 'Notre Dame College', 'NDC-2025-120', '2025-26',
      '{"school_year":"2nd Year"}'::jsonb,
      '[{"id":"tm-1","full_name":"Junayed Alam","email":"junayed@example.com","college_roll":"NDC-2025-121"},{"id":"tm-2","full_name":"Shuvo Das","email":"shuvo@example.com","college_roll":"NDC-2025-122"}]'::jsonb,
      'not_required')
    returning id into r_s4_relay;

    -- Leader (self_select) picked Physics as their subject.
    insert into team_subject_assignments (registration_id, member_id, olympiad_id, subject_id)
    values (r_s4_relay, 'leader', o1_id, 'phy')
    on conflict (registration_id, member_id, olympiad_id) do nothing;

    -- Mid-relay: leader has submitted, it's tm-1's turn next.
    insert into relay_exam_state (registration_id, olympiad_id, current_member_index, member_submissions, chain_values, started_at)
    values (r_s4_relay, o1_id, 1,
      '[{"member_id":"leader","answers":{"pq1":"b","pq2":"F = ma"},"submitted_at":"2026-02-15T09:14:00Z","duration_seconds":612}]'::jsonb,
      '{}'::jsonb,
      now() - interval '12 minutes')
    on conflict (registration_id, olympiad_id) do nothing;
  end if;

  -- ══════════════════════════════════════════════════════════════════════
  -- S5 — Bio Quiz Relay
  -- Same shape as S4 but the linked olympiad (o2) uses CHAIN relay
  -- (relay_type = 'chain') and admin-assigned subjects instead of
  -- self-select. Chain questions reference the previous member's answer
  -- via {{chain.memberN.questionId}} — see resolveChainText() in
  -- app/activities/[slug]/relay-exam/page.tsx.
  -- ══════════════════════════════════════════════════════════════════════
  insert into olympiads (
    id, name, description, exam_type, exam_mode, question_display, timer_minutes,
    is_active, external_only, registration_deadline, exam_date,
    registration_fields, questions,
    relay_mode, relay_type, subjects, subject_assignment_mode
  )
  values (
    o2_id, 'Bio Quiz Relay',
    'Chain relay: each teammate answers using the previous teammate''s answer as an input.',
    'live_only', 'mixed', 'one_by_one', 15,
    true, true, now() + interval '40 days', now() + interval '40 days',
    '[]'::jsonb,
    '[
      {"id":"bq1","type":"short","text":"Name one organelle responsible for energy production in a cell.","marks":2,"subject_id":"bio"},
      {"id":"bq2","type":"short","text":"Member 1 named {{chain.member1.bq1}} as the energy organelle. What molecule does it primarily produce?","marks":3,"subject_id":"bio"}
    ]'::jsonb,
    true, 'chain',
    '[{"id":"bio","name":"Biology"}]'::jsonb,
    'admin_assign'
  )
  on conflict (id) do nothing;

  insert into activity_sessions (
    id, activity_version_id, activity_type_id, title, slug, session_date, location, description,
    is_published, is_upcoming, registration_enabled, reg_status, reg_deadline, image_display_mode
  )
  values (
    s5_id, s_version_id, s_type_id,
    'Bio Quiz Relay', 'bio-quiz-relay',
    '2026-02-20', 'Online (live exam)', 'Chain relay — your teammate''s answer feeds into your question. Teams of 2, admin-assigned subjects.',
    true, true, true, 'Open', now() + interval '40 days', 'cover'
  )
  on conflict (id) do nothing;

  insert into activity_reg_categories (
    id, activity_session_id, parent_id, name, description, display_order, registration_open,
    requires_team, team_size_min, team_size_max,
    is_online_submission, linked_olympiad_id, form_field_schema
  )
  values (
    c5_id, s5_id, null, 'Pair Entry', 'Teams of exactly 2.', 0, true,
    true, 2, 2,
    true, o2_id, '[]'::jsonb
  )
  on conflict (id) do nothing;

  if not exists (select 1 from activity_registrations where activity_session_id = s5_id and full_name = 'Rezwana Karim') then
    insert into activity_registrations (activity_session_id, category_id, full_name, phone, email, college, college_roll, hsc_session, custom_answers, team_members, payment_status)
    values (s5_id, c5_id, 'Rezwana Karim', '+8801711100030', 'rezwana@example.com', 'Notre Dame College', 'NDC-2025-130', '2025-26',
      '{}'::jsonb,
      '[{"id":"tm-1","full_name":"Ayesha Siddika","email":"ayesha@example.com","college_roll":"NDC-2025-131"}]'::jsonb,
      'not_required')
    returning id into r_s5_relay;

    -- Admin assigned both members to Biology (the only subject).
    insert into team_subject_assignments (registration_id, member_id, olympiad_id, subject_id)
    values (r_s5_relay, 'leader', o2_id, 'bio')
    on conflict (registration_id, member_id, olympiad_id) do nothing;
    insert into team_subject_assignments (registration_id, member_id, olympiad_id, subject_id)
    values (r_s5_relay, 'tm-1', o2_id, 'bio')
    on conflict (registration_id, member_id, olympiad_id) do nothing;

    -- Leader has answered bq1 ("mitochondria") — chain_values holds it so
    -- tm-1's question can substitute {{chain.member1.bq1}} with it.
    insert into relay_exam_state (registration_id, olympiad_id, current_member_index, member_submissions, chain_values, started_at)
    values (r_s5_relay, o2_id, 1,
      '[{"member_id":"leader","answers":{"bq1":"Mitochondria"},"submitted_at":"2026-02-20T10:05:00Z","duration_seconds":240}]'::jsonb,
      '{"member1.bq1":"Mitochondria"}'::jsonb,
      now() - interval '6 minutes')
    on conflict (registration_id, olympiad_id) do nothing;
  end if;

  -- ══════════════════════════════════════════════════════════════════════
  -- S6 — Debate Championship 2025 (v2 form-graph ONLY — no legacy
  -- activity_reg_categories at all). This session is registered through
  -- /register/activity/<id> — the activity page's own "Register Now"
  -- button won't find a v1 category tree for it, which is intentional:
  -- it's here to showcase the graph-only feature set. See
  -- docs/FEATURE_TOUR.md for the direct link.
  --
  -- Demonstrates: every content-block type (header, paragraph, image,
  -- link_button jump, video, divider, spacer), a link_button "skip ahead"
  -- that jumps straight to the Solo node from the root, a picker node,
  -- preset_team_info node kind, unique_field on email, show_progress_bar.
  -- ══════════════════════════════════════════════════════════════════════
  insert into activity_sessions (
    id, activity_version_id, activity_type_id, title, slug, session_date, location, description,
    is_published, is_upcoming, registration_enabled, reg_status, reg_deadline, image_display_mode
  )
  values (
    s6_id, s_version_id, s_type_id,
    'Debate Championship 2025', 'debate-championship-2025',
    '2026-03-01', 'NDC Auditorium', 'Solo or team (2-3) parliamentary debate. Registration is a form-graph — try the "already have a partner?" skip-ahead link on the first page.',
    true, true, true, 'Open', now() + interval '55 days', 'cover'
  )
  on conflict (id) do nothing;

  select id into g_s6 from form_graphs where owner_kind = 'activity' and owner_id = s6_id;
  if g_s6 is null then
    insert into form_graphs (owner_kind, owner_id, title, settings)
    values ('activity', s6_id, 'Debate Championship 2025', '{"default_appearance":{"bg_theme":"var(--accent2)"}}'::jsonb)
    returning id into g_s6;
  end if;

  -- Root: common details + every content-block type except link_button
  -- (that one gets added by an UPDATE below, once we know the Solo
  -- node's id to jump to).
  select id into n_s6_root from form_nodes where graph_id = g_s6 and parent_id is null;
  if n_s6_root is null then
    insert into form_nodes (graph_id, parent_id, label, kind, position, fields, appearance, behavior)
    values (g_s6, null, 'Common details', 'starter',
      '{"x":100,"y":100}'::jsonb,
      '[
        {"id":"hdr1","kind":"content","type":"header","text":"Debate Championship 2025","heading_size":"lg"},
        {"id":"para1","kind":"content","type":"paragraph","text":"British Parliamentary format. Read the rules below before registering."},
        {"id":"img1","kind":"content","type":"image","image_url":"https://example.com/uploads/debate-banner.jpg","image_alt":"Debate Championship banner"},
        {"id":"vid1","kind":"content","type":"video","video_url":"https://www.youtube.com/embed/dQw4w9WgXcQ"},
        {"id":"div1","kind":"content","type":"divider"},
        {"id":"full_name","kind":"field","type":"text","label":"Full Name","required":true,"is_builtin":"full_name","db_column":"top_level"},
        {"id":"phone","kind":"field","type":"text","label":"Phone Number","required":true,"is_builtin":"phone","db_column":"top_level"},
        {"id":"email","kind":"field","type":"text","label":"Email Address","required":true,"is_builtin":"email","db_column":"top_level","unique_field":true},
        {"id":"college","kind":"field","type":"text","label":"College","required":false,"is_builtin":"college","db_column":"top_level"},
        {"id":"college_roll","kind":"field","type":"text","label":"College Roll","required":true,"is_builtin":"college_roll","db_column":"top_level"},
        {"id":"spacer1","kind":"content","type":"spacer","height_px":8}
      ]'::jsonb,
      '{"title":"Debate Championship registration","subtitle":"Solo entries are auto-paired; teams register together.","theme":"var(--accent2)"}'::jsonb,
      '{"show_progress_bar":true}'::jsonb)
    returning id into n_s6_root;
  end if;

  -- Picker: "Choose your entry type"
  select id into n_s6_picker from form_nodes where graph_id = g_s6 and label = 'Choose your entry type';
  if n_s6_picker is null then
    insert into form_nodes (graph_id, parent_id, label, kind, position, fields, behavior, display_order)
    values (g_s6, n_s6_root, 'Choose your entry type', 'blank',
      '{"x":420,"y":100}'::jsonb, '[]'::jsonb,
      '{"note":"Picker. Solo vs Team.","show_progress_bar":true}'::jsonb, 0)
    returning id into n_s6_picker;
  end if;

  -- Leaf: Solo Debater (terminal)
  select id into n_s6_solo from form_nodes where graph_id = g_s6 and label = 'Solo Debater';
  if n_s6_solo is null then
    insert into form_nodes (graph_id, parent_id, label, kind, position, fields, behavior, display_order, is_terminal)
    values (g_s6, n_s6_picker, 'Solo Debater', 'blank',
      '{"x":740,"y":0}'::jsonb,
      '[
        {"id":"para2","kind":"content","type":"paragraph","text":"We''ll pair you with another solo debater closer to the event."},
        {"id":"prior_exp","kind":"field","type":"textarea","label":"Prior debate experience","required":false,"key":"prior_exp"}
      ]'::jsonb,
      '{"show_progress_bar":true}'::jsonb, 0, true)
    returning id into n_s6_solo;
  end if;

  -- Leaf: Team Debate — uses the preset_team_info node kind + require_team behavior.
  select id into n_s6_team from form_nodes where graph_id = g_s6 and label = 'Team Debate';
  if n_s6_team is null then
    insert into form_nodes (graph_id, parent_id, label, kind, position, fields, behavior, display_order, is_terminal)
    values (g_s6, n_s6_picker, 'Team Debate', 'preset_team_info',
      '{"x":740,"y":200}'::jsonb,
      '[
        {"id":"para3","kind":"content","type":"paragraph","text":"Add your 1-2 teammates below. Everyone needs a college roll on file."},
        {"id":"team_name","kind":"field","type":"text","label":"Team name","required":true,"key":"team_name"}
      ]'::jsonb,
      '{"require_team":{"min":2,"max":3,"optional":false,"fields":[],"password_required":true},"show_progress_bar":true}'::jsonb,
      1, true)
    returning id into n_s6_team;
  end if;

  -- Now patch the root to add the link_button "skip ahead" jump straight
  -- to Solo Debater, plus a trailing divider for symmetry.
  update form_nodes
     set fields = fields || jsonb_build_array(
       jsonb_build_object('id','lb1','kind','content','type','link_button','link_label','Already solo and just want to skip ahead?','target_node_id', n_s6_solo::text)
     )
   where id = n_s6_root
     and not exists (
       select 1 from jsonb_array_elements(fields) f where f->>'id' = 'lb1'
     );

  -- ══════════════════════════════════════════════════════════════════════
  -- O1 (as an olympiad row) is already inserted above for S4. Now the two
  -- fully-standalone v2 olympiads:
  --
  -- O3 — Photo-Only Sprint Olympiad
  -- exam_type = photo_only, one_by_one display, SCHEDULED in the future
  -- (tests the "exam opens at ..." gate), full theme override.
  -- ══════════════════════════════════════════════════════════════════════
  insert into olympiads (
    id, name, description, exam_type, exam_mode, question_display, timer_minutes,
    is_active, external_only, registration_deadline, exam_date,
    registration_fields, questions,
    scheduled_start_at, scheduled_end_at, auto_start,
    theme_bg_color, theme_bg_image_url, theme_accent_color, theme_header_title, theme_header_subtitle, theme_header_logo_url
  )
  values (
    o3_id, 'Photo-Only Sprint Olympiad',
    'Work the problems on paper, photograph each answer sheet, upload. No typing required.',
    'photo_only', 'mixed', 'one_by_one', 30,
    true, true, now() + interval '10 days', now() + interval '15 days',
    '[
      {"key":"full_name","type":"text","label":"Full Name","required":true},
      {"key":"phone","type":"text","label":"Phone","required":true},
      {"key":"email","type":"email","label":"Email","required":true},
      {"key":"college","type":"text","label":"College","required":true},
      {"key":"college_roll","type":"text","label":"College Roll","required":true}
    ]'::jsonb,
    '[
      {"id":"ps1","type":"photo","text":"Solve and photograph: integrate x^3 from 0 to 2.","marks":5,"max_files":1},
      {"id":"ps2","type":"photo","text":"Photograph your full working for the quadratic formula derivation.","marks":8,"max_files":2},
      {"id":"ps3","type":"photo","text":"Photograph your answer sheet for the geometry proof (see PDF).","marks":7,"max_files":1}
    ]'::jsonb,
    now() + interval '15 days', now() + interval '15 days' + interval '3 hours', true,
    '#0b0f1a', 'https://example.com/uploads/photo-sprint-bg.jpg', '#ffb703',
    'Photo-Only Sprint Olympiad', 'Paper first, camera second.', 'https://example.com/uploads/ndsc-logo.png'
  )
  on conflict (id) do nothing;

  select id into g_o3 from form_graphs where owner_kind = 'olympiad' and owner_id = o3_id;
  if g_o3 is null then
    insert into form_graphs (owner_kind, owner_id, title, settings)
    values ('olympiad', o3_id, 'Photo-Only Sprint Olympiad',
      '{"anti_cheat":"timer_no_copy","timer_minutes":30,"exam_type":"photo_only","default_appearance":{"bg_theme":"#ffb703"}}'::jsonb)
    returning id into g_o3;
  end if;

  select id into n_o3_root from form_nodes where graph_id = g_o3 and parent_id is null;
  if n_o3_root is null then
    insert into form_nodes (graph_id, parent_id, label, kind, position, fields, appearance)
    values (g_o3, null, 'Registration', 'starter', '{"x":100,"y":100}'::jsonb,
      '[
        {"id":"full_name","kind":"field","type":"text","label":"Full Name","required":true,"key":"full_name","is_builtin":"full_name","db_column":"top_level"},
        {"id":"email","kind":"field","type":"text","label":"Email","required":true,"key":"email","is_builtin":"email","db_column":"top_level"},
        {"id":"phone","kind":"field","type":"text","label":"Phone","required":true,"key":"phone","is_builtin":"phone","db_column":"top_level"},
        {"id":"college","kind":"field","type":"text","label":"College","required":true,"key":"college","is_builtin":"college","db_column":"top_level"},
        {"id":"college_roll","kind":"field","type":"text","label":"College Roll","required":true,"key":"college_roll","is_builtin":"college_roll","db_column":"top_level"}
      ]'::jsonb,
      '{"title":"Photo-Only Sprint Olympiad","subtitle":"Exam opens at the scheduled time — this page unlocks automatically.","bg_color":"#ffb703"}'::jsonb)
    returning id into n_o3_root;
  end if;

  select id into n_o3_q from form_nodes where graph_id = g_o3 and kind = 'preset_olympiad_questions';
  if n_o3_q is null then
    insert into form_nodes (graph_id, parent_id, label, kind, position, fields, behavior, is_terminal)
    values (g_o3, n_o3_root, 'Questions', 'preset_olympiad_questions', '{"x":420,"y":100}'::jsonb,
      '[
        {"id":"ps1","kind":"field","type":"photo","label":"Solve and photograph: integrate x^3 from 0 to 2.","required":true,"marks":5,"key":"ps1","max_files":1},
        {"id":"ps2","kind":"field","type":"photo","label":"Photograph your full working for the quadratic formula derivation.","required":true,"marks":8,"key":"ps2","max_files":2},
        {"id":"ps3","kind":"field","type":"photo","label":"Photograph your answer sheet for the geometry proof.","required":true,"marks":7,"key":"ps3","max_files":1}
      ]'::jsonb,
      '{"timer_override_minutes":30}'::jsonb, true)
    returning id into n_o3_q;
  end if;

  -- One registration mid-exam (scheduled start already passed for this
  -- particular row's exam_started_at, even though the olympiad's own
  -- scheduled_start_at is in the future relative to "now" — this row
  -- simulates a tester who started right as the gate opened).
  if not exists (select 1 from olympiad_registrations where olympiad_id = o3_id and full_name = 'Priyo Talukder') then
    insert into olympiad_registrations (olympiad_id, full_name, phone, email, college, college_roll, exam_started_at, photo_answers)
    values (o3_id, 'Priyo Talukder', '+8801711100040', 'priyo@example.com', 'Notre Dame College', 'NDC-2025-140',
      now() - interval '5 minutes',
      '[{"question_id":"ps1","url":"https://example.com/uploads/priyo-ps1.jpg"}]'::jsonb);
  end if;

  -- ══════════════════════════════════════════════════════════════════════
  -- O4 — Live MCQ Blitz (NDC students only)
  -- exam_type = live_only, all_at_once, external_only = false (i.e.
  -- restricted — see `eligibility`), result_published + annotations_
  -- published = true, organizer_password set. One FULLY graded
  -- registration so the results/annotation pipeline is visible without
  -- doing any marking yourself.
  -- ══════════════════════════════════════════════════════════════════════
  insert into olympiads (
    id, name, description, exam_type, exam_mode, question_display, timer_minutes,
    is_active, external_only, result_published, annotations_published,
    registration_deadline, exam_date, eligibility, organizer_password,
    registration_fields, questions
  )
  values (
    o4_id, 'Live MCQ Blitz', '30 rapid-fire MCQs, all on one screen, 15 minutes on the clock.',
    'live_only', 'mixed', 'all_at_once', 15,
    true, false, true, true,
    now() - interval '2 days', now() - interval '1 day',
    'Open to Notre Dame College students only — bring your college ID to the exam venue.',
    'demopass123',
    '[
      {"key":"full_name","type":"text","label":"Full Name","required":true},
      {"key":"phone","type":"text","label":"Phone","required":true},
      {"key":"email","type":"email","label":"Email","required":true},
      {"key":"college_roll","type":"text","label":"College Roll","required":true}
    ]'::jsonb,
    '[
      {"id":"mb1","type":"mcq","text":"What is the SI unit of force?","marks":1,"options":[{"id":"a","text":"Joule"},{"id":"b","text":"Newton"},{"id":"c","text":"Watt"}],"correct_option_id":"b"},
      {"id":"mb2","type":"mcq","text":"H2O is commonly known as?","marks":1,"options":[{"id":"a","text":"Salt"},{"id":"b","text":"Water"},{"id":"c","text":"Hydrogen peroxide"}],"correct_option_id":"b"},
      {"id":"mb3","type":"short","text":"Name the powerhouse of the cell.","marks":2}
    ]'::jsonb
  )
  on conflict (id) do nothing;

  select id into g_o4 from form_graphs where owner_kind = 'olympiad' and owner_id = o4_id;
  if g_o4 is null then
    insert into form_graphs (owner_kind, owner_id, title, settings)
    values ('olympiad', o4_id, 'Live MCQ Blitz',
      '{"anti_cheat":"timer_no_copy","timer_minutes":15,"exam_type":"live_only"}'::jsonb)
    returning id into g_o4;
  end if;

  select id into n_o4_root from form_nodes where graph_id = g_o4 and parent_id is null;
  if n_o4_root is null then
    insert into form_nodes (graph_id, parent_id, label, kind, position, fields)
    values (g_o4, null, 'Registration', 'starter', '{"x":100,"y":100}'::jsonb,
      '[
        {"id":"full_name","kind":"field","type":"text","label":"Full Name","required":true,"key":"full_name","is_builtin":"full_name","db_column":"top_level"},
        {"id":"phone","kind":"field","type":"text","label":"Phone","required":true,"key":"phone","is_builtin":"phone","db_column":"top_level"},
        {"id":"email","kind":"field","type":"text","label":"Email","required":true,"key":"email","is_builtin":"email","db_column":"top_level"},
        {"id":"college_roll","kind":"field","type":"text","label":"College Roll","required":true,"key":"college_roll","is_builtin":"college_roll","db_column":"top_level"}
      ]'::jsonb)
    returning id into n_o4_root;
  end if;

  select id into n_o4_q from form_nodes where graph_id = g_o4 and kind = 'preset_olympiad_questions';
  if n_o4_q is null then
    insert into form_nodes (graph_id, parent_id, label, kind, position, fields, behavior, is_terminal)
    values (g_o4, n_o4_root, 'Questions', 'preset_olympiad_questions', '{"x":420,"y":100}'::jsonb,
      '[
        {"id":"mb1","kind":"field","type":"mcq","label":"What is the SI unit of force?","required":true,"marks":1,"key":"mb1","mcq_options":[{"id":"a","text":"Joule"},{"id":"b","text":"Newton"},{"id":"c","text":"Watt"}],"correct_option_id":"b"},
        {"id":"mb2","kind":"field","type":"mcq","label":"H2O is commonly known as?","required":true,"marks":1,"key":"mb2","mcq_options":[{"id":"a","text":"Salt"},{"id":"b","text":"Water"},{"id":"c","text":"Hydrogen peroxide"}],"correct_option_id":"b"},
        {"id":"mb3","kind":"field","type":"short_answer","label":"Name the powerhouse of the cell.","required":true,"marks":2,"key":"mb3"}
      ]'::jsonb,
      '{"timer_override_minutes":15}'::jsonb, true)
    returning id into n_o4_q;
  end if;

  -- One fully graded + reviewed registration.
  if not exists (select 1 from olympiad_registrations where olympiad_id = o4_id and full_name = 'Sabrina Yasmin') then
    insert into olympiad_registrations (
      olympiad_id, full_name, phone, email, college, college_roll,
      mcq_answers, short_answers,
      exam_started_at, exam_submitted_at,
      mcq_score, final_score, result_score, result_feedback,
      question_results, annotations, organizer_note, review_status
    )
    values (
      o4_id, 'Sabrina Yasmin', '+8801711100050', 'sabrina@example.com', 'Notre Dame College', 'NDC-2025-150',
      '{"mb1":"b","mb2":"b"}'::jsonb,
      '{"mb3":"Mitochondria"}'::jsonb,
      now() - interval '1 day 20 minutes', now() - interval '1 day',
      2, 4, 4, 'Great work — clean sweep on the MCQs, spot-on short answer.',
      '[
        {"question_id":"mb1","question_text":"What is the SI unit of force?","type":"mcq","student_answer":"b","correct_answer":"b","is_correct":true,"marks_awarded":1,"marks_possible":1},
        {"question_id":"mb2","question_text":"H2O is commonly known as?","type":"mcq","student_answer":"b","correct_answer":"b","is_correct":true,"marks_awarded":1,"marks_possible":1},
        {"question_id":"mb3","question_text":"Name the powerhouse of the cell.","type":"short","student_answer":"Mitochondria","correct_answer":"Mitochondria","is_correct":true,"marks_awarded":2,"marks_possible":2,"organizer_note":"Accepted — exact match."}
      ]'::jsonb,
      '[{"id":"an1","x":42,"y":18,"type":"tick","text":"Correct"},{"id":"an2","x":42,"y":55,"type":"note","text":"Handwriting a little unclear but answer is unambiguous."}]'::jsonb,
      'Strong overall performance, no red flags.',
      'approved'
    );
  end if;

end $$;
