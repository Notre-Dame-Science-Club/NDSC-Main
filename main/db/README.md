# Database Migration Files - Numbering Guide

All migration files in the `db/` folder follow a numbered prefix system for clear execution order.

## File Naming Convention

Format: `XX_descriptive_name.sql`

- `XX` = Two-digit number (01, 02, 03, etc.)
- Use sequential numbers based on chronological order
- Files should be run in numerical order

## Current Migration Files (Organized)

### Core Schema
- `01_schema.sql` - Base database schema (all tables, core structure)
- `02_init_roles.sql` - Initialize database roles and permissions

### Feature Migrations (in chronological order)
- `03_migration_member_password.sql` - Member password authentication
- `04_migration_team_optional.sql` - Optional team registration
- `05_migration_segments.sql` - Activity registration segments
- `06_migration_team_name.sql` - Team name field
- `07_migration_team_member_links.sql` - Team member relationships
- `08_migration_notify_publicly.sql` - Public notification system for activities
- `09_migration_per_session_appearance.sql` - Per-session appearance customization
- `10_migration_per_session_appearance_combined.sql` - Combined appearance settings
- `11_migration_form_graphs.sql` - Form graph system (new registration engine)
- `12_migration_form_graphs_02_backrefs.sql` - Form graph backreferences
- `13_migration_phase6_1_backfill_graphs.sql` - Backfill form graphs from old data
- `14_migration_chat_system.sql` - Real-time chat system
- `15_migration_user_types_refactor.sql` - User type system refactor
- `16_migration_users_table.sql` - Users table structure
- `17_migration_unified_stage_system.sql` - Unified stage/level system
- `18_migration_achievements_stage.sql` - Member achievements and stages
- `19_migration_tasks_system.sql` - Task/project management system
- `20_migration_event_start_end.sql` - Event date range (start/end dates)
- `21_migration_publication_flipbook_url.sql` - Per-publication flip-book link
- `22_migration_organizer_username.sql` - Organizer login username (paired with organizer_password, set from Admin → Olympiads)

### Data Seeds
- `98_seed_local.sql` - Local development seed data
- `98_update_08_07_2026.sql` - Specific data update from Aug 2026

### Cleanup Migrations (run last)
- `99_drop_legacy_olympiad_system.sql` - Remove old olympiad registration system

## When Adding New Migrations

1. Determine the next available number (currently 21)
2. Name file: `21_your_feature_name.sql`
3. Update this README
4. Add comments in the SQL file explaining what it does
5. Make migrations idempotent when possible (use IF EXISTS/IF NOT EXISTS)

## Special Files

- `UNIFIED_MASTER_SCHEMA.sql` - Complete schema snapshot (not a migration, kept for reference)
- Files in `archived/` - Old/deprecated migrations, kept for history

## Running Migrations

In Supabase SQL Editor:
1. Run files in numerical order
2. Check for errors after each file
3. Verify schema changes in Table Editor
4. Test application after migration

## Notes

- Never modify existing migration files after they've been run in production
- Create new migrations to fix issues
- Keep migrations small and focused on one feature
- Document breaking changes clearly
