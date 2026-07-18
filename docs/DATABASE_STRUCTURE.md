# NDSC Platform — Database Structure

> **Note (2026-07-17 cleanup):** this hand-maintained tree was found to predate
> several live fields — `members.is_organizer`/`is_executive`, the
> `activity_updates` table, `activity_versions.is_pinned`/`is_highlighted`,
> `activity_sessions.image_display_mode`/`reg_status`/`reg_deadline`, and the
> `form_configs` appearance-pipeline columns (`bg_color`, `font_family`, etc.)
> — all confirmed in active use via grep across `app/` and `lib/`.
> **`db/schema.sql` is the verified, up-to-date source of truth going forward.**
> This file is kept as a more readable narrative companion, but treat any
> conflict between the two in `db/schema.sql`'s favor.

## Tree

```
public
│
├─ admins
│   ├─ id            uuid PK
│   ├─ email         text UNIQUE
│   └─ role          text                              e.g. "super_admin"
│
├─ members                                              (auth.users.id == members.id)
│   ├─ id                 uuid PK  (FK auth.users.id)
│   ├─ email              text
│   ├─ full_name          text
│   ├─ phone              text
│   ├─ ndsc_id            text
│   ├─ college_role       numeric                       legacy, unused
│   ├─ college_roll       text
│   ├─ batch              text
│   ├─ department         text                          Administration | Project | Publication | ICT | LWS | Quiz | R&D
│   ├─ wing               text                          legacy fallback
│   ├─ payment_slip_url   text
│   ├─ is_verified        boolean   default false
│   ├─ achievements       jsonb     default []           [{ id, title, description, image_url, status, created_at }]
│   │                                                     status: pending | approved
│   └─ created_at         timestamptz default now()
│   │
│   └─ member_shoutbox
│       ├─ id           uuid PK
│       ├─ member_id    uuid FK → members.id
│       ├─ full_name    text
│       ├─ message      text
│       └─ created_at   timestamptz default now()
│
├─ announcements
│   ├─ id           uuid PK
│   ├─ title        text
│   ├─ body         text
│   ├─ target       text                                all | members | non_members
│   └─ created_at   timestamptz default now()
│
├─ executives
│   ├─ id               uuid PK
│   ├─ full_name        text
│   ├─ position         text
│   ├─ panel            text        committee | moderators | former_moderators | founder
│   ├─ dept             text
│   ├─ photo_url        text
│   ├─ photo_position   text        default "50% 15%"    CSS object-position
│   ├─ facebook_url     text
│   ├─ linkedin_url     text
│   ├─ email            text
│   ├─ whatsapp         text
│   ├─ instagram_url    text
│   ├─ github_url       text
│   ├─ x_url            text
│   ├─ display_order    int         default 0
│   ├─ session_year     text        e.g. "2025-26"
│   └─ is_active        boolean     default true
│
├─ publications
│   ├─ id                uuid PK
│   ├─ title             text
│   ├─ description       text
│   ├─ category          text        annual_magazine | wall_magazine | trimatrik | abhishkar
│   ├─ published_year    int
│   ├─ cover_image_url   text
│   ├─ pdf_url           text
│   ├─ is_published      boolean     default false
│   └─ created_at        timestamptz default now()
│
├─ science_media
│   ├─ id              uuid PK
│   ├─ title           text
│   ├─ youtube_url     text
│   ├─ display_order   int         default 0
│   └─ is_active       boolean     default true
│
├─ homepage_settings                                     key-value store
│   ├─ key          text PK
│   ├─ value        text
│   └─ updated_at   timestamptz default now()
│
├─ activities                                            unused, no writer/reader in app
│   └─ (id, title, slug, type, date, status, ...)         column set unconfirmed
│
├─ activity_types
│   ├─ id              uuid PK
│   ├─ name            text
│   ├─ slug            text
│   ├─ icon             text        emoji
│   ├─ description      text
│   └─ display_order    int default 0
│   │
│   └─ activity_versions
│       ├─ id                   uuid PK
│       ├─ activity_type_id     uuid FK → activity_types.id
│       ├─ version_number       int
│       ├─ version_label        text
│       ├─ year_start           int
│       ├─ year_end             int  nullable
│       └─ description          text
│       │
│       └─ activity_sessions                              (also FK activity_type_id directly)
│           ├─ id                        uuid PK
│           ├─ activity_version_id       uuid FK → activity_versions.id  nullable
│           ├─ activity_type_id          uuid FK → activity_types.id     nullable
│           ├─ title                     text
│           ├─ slug                      text
│           ├─ session_date              date
│           ├─ location                  text
│           ├─ description               text
│           ├─ cover_image_url           text
│           ├─ youtube_url               text
│           ├─ pdf_url                   text
│           ├─ gallery_urls              jsonb  default []               array of urls
│           ├─ is_published              boolean
│           ├─ is_upcoming               boolean default false
│           ├─ registration_enabled      boolean default false
│           ├─ registration_note         text
│           └─ event_dates               jsonb  default []               ["YYYY-MM-DD", ...]
│           │
│           └─ activity_reg_categories                     self-referencing tree
│               ├─ id                     uuid PK
│               ├─ activity_session_id    uuid FK → activity_sessions.id
│               ├─ parent_id              uuid FK → activity_reg_categories.id  nullable
│               ├─ name                   text
│               ├─ description            text
│               ├─ display_order          int default 0
│               ├─ custom_fields          jsonb default []       [{ key, label, description, type, required }]
│               │                                                 type: text | number | textarea | photo
│               ├─ requires_team          boolean default false
│               ├─ team_size_min          int
│               ├─ team_size_max          int
│               ├─ team_member_fields     jsonb default []       same shape as custom_fields
│               ├─ requires_payment       boolean default false
│               ├─ payment_amount         numeric
│               ├─ payment_label          text
│               ├─ is_online_submission   boolean default false
│               ├─ linked_olympiad_id     uuid FK → olympiads.id  nullable
│               ├─ edit_window_hours      int      nullable       null = unlimited, 0 = immediately locked
│               ├─ schedule_date          date
│               ├─ schedule_time          text
│               ├─ schedule_room          text
│               ├─ submission_config      jsonb default []       [{ id, title, description, field_type,
│               │                                                   file_types, max_file_size_mb, max_files, required }]
│               │                                                 field_type: file | text | textarea
│               ├─ submission_who         text     default "leader"    leader | any_member
│               ├─ project_name_enabled   boolean  default false
│               ├─ project_name_label     text     default "Project Name"
│               ├─ registration_open      boolean  default true
│               └─ created_at             timestamptz default now()
│               │
│               └─ activity_registrations
│                   ├─ id                     uuid PK
│                   ├─ category_id             uuid FK → activity_reg_categories.id
│                   ├─ activity_session_id     uuid FK → activity_sessions.id
│                   ├─ full_name               text
│                   ├─ phone                   text
│                   ├─ email                   text
│                   ├─ college                 text
│                   ├─ college_roll            text
│                   ├─ hsc_session              text
│                   ├─ custom_answers          jsonb default {}
│                   ├─ team_members            jsonb default []       [{ id, full_name, phone, email,
│                   │                                                    college_roll, password_hash,
│                   │                                                    custom_answers, is_leader }]
│                   ├─ member_id                uuid FK → members.id  nullable
│                   ├─ payment_status           text default "not_required"
│                   │                                                  not_required | pending | paid | failed
│                   ├─ payment_tran_id          text
│                   ├─ payment_amount           numeric
│                   ├─ payment_validated_at     timestamptz
│                   ├─ edit_locked_at           timestamptz
│                   ├─ project_name             text
│                   ├─ division                 text
│                   └─ created_at               timestamptz default now()
│                   │
│                   ├─ payment_transactions
│                   │   ├─ id                          uuid PK
│                   │   ├─ tran_id                      text UNIQUE
│                   │   ├─ activity_registration_id     uuid FK → activity_registrations.id  nullable
│                   │   ├─ amount                       numeric
│                   │   ├─ currency                     text default "BDT"
│                   │   ├─ status                       text default "pending"
│                   │   │                                 pending | valid | failed | cancelled
│                   │   ├─ raw_ipn                      jsonb
│                   │   ├─ raw_validation               jsonb
│                   │   ├─ created_at                   timestamptz default now()
│                   │   └─ validated_at                 timestamptz
│                   │
│                   ├─ activity_submissions
│                   │   ├─ id                     uuid PK
│                   │   ├─ registration_id         uuid FK → activity_registrations.id
│                   │   ├─ category_id             uuid FK → activity_reg_categories.id
│                   │   ├─ activity_session_id     uuid FK → activity_sessions.id
│                   │   ├─ submitted_by             text default "leader"     "leader" | team_member.id
│                   │   ├─ answers                  jsonb default {}          { field_id: value|url[] }
│                   │   ├─ is_final                 boolean default false
│                   │   ├─ created_at               timestamptz default now()
│                   │   └─ updated_at               timestamptz default now()
│                   │
│                   ├─ relay_exam_state
│                   │   ├─ id                       uuid PK
│                   │   ├─ registration_id          uuid FK → activity_registrations.id
│                   │   ├─ olympiad_id              uuid FK → olympiads.id
│                   │   ├─ current_member_index     int default 0
│                   │   ├─ member_submissions       jsonb default []          [{ member_id, answers,
│                   │   │                                                        submitted_at, duration_seconds }]
│                   │   ├─ chain_values             jsonb default {}
│                   │   ├─ started_at               timestamptz
│                   │   ├─ completed_at             timestamptz
│                   │   └─ created_at               timestamptz default now()
│                   │   UNIQUE (registration_id, olympiad_id)
│                   │
│                   └─ team_subject_assignments
│                       ├─ registration_id   uuid FK → activity_registrations.id
│                       ├─ member_id         text                     "leader" | team_member.id
│                       ├─ olympiad_id       uuid FK → olympiads.id
│                       ├─ subject_id        text
│                       └─ assigned_at       timestamptz default now()
│                       PRIMARY KEY (registration_id, member_id, olympiad_id)
│
├─ olympiads
│   ├─ id                        uuid PK
│   ├─ name                      text
│   ├─ description                text
│   ├─ cover_image_url            text
│   ├─ pdf_url                    text
│   ├─ mode                       text                    legacy
│   ├─ exam_type                  text    default "mixed"  photo_only | live_only | mixed
│   ├─ exam_mode                  text    default "mixed"
│   ├─ question_display           text    default "all_at_once"   one_by_one | all_at_once
│   ├─ timer_minutes              int     default 60
│   ├─ is_active                  boolean
│   ├─ external_only              boolean
│   ├─ result_published           boolean default false
│   ├─ annotations_published      boolean default false
│   ├─ registration_deadline      timestamptz
│   ├─ exam_date                  timestamptz
│   ├─ eligibility                text
│   ├─ organizer_password         text                     plaintext
│   ├─ registration_fields        jsonb default []          [{ key, label, type, required, options }]
│   │                                                        type: text|textarea|email|tel|select
│   ├─ questions                  jsonb default []          [{ id, type, text, description, options,
│   │                                                           correct_option_id, marks, subject_id }]
│   │                                                        type: mcq | short | photo
│   ├─ relay_mode                 boolean default false
│   ├─ relay_type                 text    default "sequential"   sequential | chain
│   ├─ subjects                   jsonb default []          [{ id, name, description, question_ids }]
│   ├─ subject_assignment_mode    text    default "self_select"  self_select | admin_assign | auto
│   ├─ scheduled_start_at         timestamptz
│   ├─ scheduled_end_at           timestamptz
│   ├─ auto_start                 boolean default false
│   └─ created_at                 timestamptz
│   │
│   └─ olympiad_registrations
│       ├─ id                     uuid PK
│       ├─ olympiad_id            uuid FK → olympiads.id
│       ├─ full_name              text
│       ├─ phone                  text
│       ├─ email                  text
│       ├─ college                text
│       ├─ college_roll           text
│       ├─ hsc_session            text
│       ├─ batch                  text
│       ├─ group_name             text
│       ├─ custom_answers         jsonb default {}
│       ├─ short_answers          jsonb default {}
│       ├─ mcq_answers            jsonb default {}
│       ├─ photo_answers          jsonb default []           [{ question_id, url }]
│       ├─ answer_sheet_url       text
│       ├─ exam_started_at        timestamptz
│       ├─ exam_submitted_at      timestamptz
│       ├─ mcq_score              numeric
│       ├─ final_score            numeric
│       ├─ result_score           numeric                    legacy, mirrors final_score
│       ├─ result_feedback        text
│       ├─ question_results       jsonb default []           [{ question_id, question_text, type,
│       │                                                        student_answer, correct_answer, is_correct,
│       │                                                        marks_awarded, marks_possible, organizer_note }]
│       ├─ annotations            jsonb default []           [{ id, x, y, type, text }]
│       │                                                     type: tick | cross | note
│       ├─ organizer_note         text
│       ├─ review_status          text default "pending"
│       └─ created_at             timestamptz default now()
│
└─ form_configs
    ├─ id                 uuid PK
    ├─ form_key           text UNIQUE          "activity_register", "olympiad_register:<id>", ...
    ├─ title              text
    ├─ subtitle           text
    ├─ cover_photo_url    text
    ├─ bg_theme           text default "default"
    ├─ primary_fields     jsonb default []     [{ field_key, label, description, visible, required }]
    ├─ extra_fields       jsonb default []     same shape as activity_reg_categories.custom_fields
    ├─ contact_persons    jsonb default []     [{ name, post, phone, email, whatsapp, facebook }]
    │                                          or { use_ec_page, ec_ids }
    └─ updated_at         timestamptz default now()
```

## Relationship summary

```
activity_types ─┬─→ activity_versions ─→ activity_sessions ─→ activity_reg_categories ─┬─→ activity_registrations ─┬─→ payment_transactions
                └───────────────────────────────────────────────────────────────────┘                            ├─→ activity_submissions
                                                                                                                    ├─→ relay_exam_state ──→ olympiads
                                                                                                                    └─→ team_subject_assignments ──→ olympiads

activity_reg_categories.linked_olympiad_id ──→ olympiads

olympiads ──→ olympiad_registrations

members ──→ member_shoutbox
members ──→ activity_registrations.member_id  (optional)

auth.users.id == members.id
```