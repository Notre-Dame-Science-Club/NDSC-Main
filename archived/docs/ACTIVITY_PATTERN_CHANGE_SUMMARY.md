# Activity Display Pattern Change - Summary

## Overview
Activities are now displayed chronologically by default with version badges, except for specific activity types (like podcasts) that can be configured to group by version.

## Database Changes Required

### SQL Migration to Run on Supabase

Run the following SQL in your Supabase SQL Editor:

```sql
-- Add group_by_version field to activity_types table
ALTER TABLE activity_types
ADD COLUMN group_by_version BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN activity_types.group_by_version IS 'When true, activities are grouped by version. When false, activities are listed chronologically with version badges.';
```

### Optional: Set podcast activity to group by version
If you have a podcast activity type, you can set it to group by version:

```sql
-- Example: Set podcast activity type to group by version (update slug as needed)
UPDATE activity_types SET group_by_version = TRUE WHERE slug = 'podcast';
```

## Code Changes Made

### 1. Database Types (`types/database.ts`)
- Added `group_by_version: boolean` field to `ActivityTypeRow` interface

### 2. Public API Endpoints
- **Created**: `/api/activity-versions-public/route.ts` - Public endpoint for activity versions
- **Updated**: `/api/activity-sessions-public/route.ts` - Enhanced to support filtering by `type_id` and `version_id`

### 3. Activities Public Page (`app/activities/page.tsx`)
- Changed from admin endpoints to public endpoints
- Updated `ActivityType` type to include `group_by_version` field
- Modified `SessionCard` to accept and display optional `versionLabel` prop
- Updated `DynamicActivityTab` to implement two display modes:
  - **Grouped by version** (when `group_by_version = true`): Shows collapsible version sections
  - **Chronological** (default, when `group_by_version = false`): Shows all activities in date order with version badges

### 4. Admin Panel (`app/admin/activities/page.tsx`)
- Updated `ActivityType` type to include `group_by_version` field
- Added toggle in `TypeForm` to enable/disable grouping by version
- Added helpful description text for the toggle

## How It Works

### Default Behavior (group_by_version = false)
- Activities are displayed in a single chronological list, sorted by date (newest first)
- If an activity belongs to a version, a small version badge appears in the top-right of the card
- Clean, simple timeline view

### Grouped Behavior (group_by_version = true)
- Activities are grouped into collapsible sections by version
- Each version section shows its version number, label, and year range
- Sessions within each version are sorted by date
- Pinned versions appear at the top
- Useful for content types like podcasts where episodes naturally group into seasons/versions

## Testing Steps

1. **Run the SQL migration** in Supabase SQL Editor
2. **Restart your development server** to pick up the new API endpoints
3. **Test the default view**: Visit `/activities` and verify activities are shown chronologically
4. **Test the admin panel**: 
   - Go to `/admin/activities`
   - Create or edit an activity type
   - Toggle "Group by version" and save
5. **Test grouped view**: Visit the activity type you toggled and verify it now groups by version

## Migration File Location

The SQL migration has been saved to:
`MIGRATION_add_group_by_version_to_activity_types.sql`

You can either:
- Copy and paste the SQL into Supabase SQL Editor manually, or
- If you use Supabase CLI migrations, rename this file following your migration naming convention
