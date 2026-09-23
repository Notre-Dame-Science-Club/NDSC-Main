# Legacy Olympiad Registration System - ARCHIVED

**Archived on:** 2026-09-10
**Reason:** Replaced by unified form-graph system

## What Was Removed

The legacy olympiad registration system (`olympiad_registrations` table) was a separate, parallel registration system that existed before the unified activity+olympiad registration approach was implemented.

### Legacy System Components (Now Removed):

1. **Database Table**: `olympiad_registrations`
   - Had its own registration flow separate from activities
   - Stored olympiad-specific registrations independently

2. **API Routes**:
   - `/api/olympiad-register` - Legacy registration endpoint
   - Used by the old standalone olympiad registration flow

3. **Legacy Columns on `olympiads` table**:
   - `registration_fields` - Form field definitions (now in form_nodes)
   - `questions` - Exam questions (now in form_nodes)

## Current System (Form-Graph Based)

The new unified system treats olympiads as "online activity registrations":
- All registrations go through `activity_registrations` table
- Form structure defined in `form_graphs` + `form_nodes` tables
- Olympiads are just activities with `is_online_submission=true`
- Single registration flow for both activities and olympiads
- Better flexibility with the form builder UI

## Migration Path

If you have data in the legacy `olympiad_registrations` table:
1. Export existing registrations
2. Convert to `activity_registrations` format
3. Link to appropriate form graphs
4. Run the cleanup migration (see db/XX_drop_legacy_olympiad.sql)

## Files Moved to Archive

- `/app/api/olympiad-register/route.ts` (parts that used olympiad_registrations)
- Database migration: `migration_phase6_drop_v1.sql.disabled`
- Documentation: All files in `archived/docs/update-notes/`
