# Activity CSV import (bulk-register participants)

**Where:** Admin → Activities → *Manage* an activity → **Registrants** tab → **Import CSV**.
**Code:** `lib/activityImport.ts` (parsing/planning, unit-tested in `tests/activityImport.test.ts`),
`app/api/admin/activity-registrations-import/route.ts` (writes), `lib/server/ensureWebsiteAccount.ts`,
`components/admin/ActivityImportModal.tsx` (UI).

## Column convention

One row per participant, one column per form field, named after where the field sits in the activity's
Form Builder tree. Names are matched case-insensitively with spaces/punctuation → `_`
(segment *"Math Olympiad"* → `Math_Olympiad`).

| Column | Meaning |
|---|---|
| `email` | **Required.** Website login + identity. Lower-cased. |
| `full_name`, `phone`, `college`, `college_roll`, `hsc_session`, `division` | Common details. Missing → stored as `<not set>`. |
| `password` | Optional. Used **only** if the account has to be created; otherwise the default password typed in the dialog. Existing accounts are never touched. |
| `team_name`, `project_name` | Optional registration columns. |
| `<segment>_<field>` | A custom field on a segment. |
| `<segment>_<subsegment>_<field>` | A custom field on a sub-segment (any depth). |
| `segment` | Optional explicit target, e.g. `Quiz_Junior`, `Quiz > Junior`, or several: `Debate; Math Olympiad`. Needed for segments that have no fields. |

The segment(s) a row registers into are **inferred from which `<segment>_…` columns have a value**
(or from `segment`). A row may fill several segments → one registration each. If a segment has
sub-segments, the row must say which (a `<segment>_<sub>_<field>` value or `segment`).
Multiple-choice answers: separate with `;` (`Physics; Chemistry`). Dropdown/choice values are matched
case-insensitively to the form's options. Use **Download template** in the dialog for the exact
headers of an activity.

```csv
email,full_name,phone,college_roll,Math_Olympiad_school_rank,Quiz_Junior_shift,segment
ann@example.com,Ann Rahman,01711111111,12345678,3,,
bob@example.com,Bob Khan,,,,Evening,
cy@example.com,Cy Das,01733333333,87654321,,,Debate
```

## What an import does

1. **Preview** (dry run, writes nothing): shows how each column was understood, and per row: new/existing
   account, target segments, errors, warnings, and clashes with existing registrations.
2. **Import** (10 rows per request, progress bar, results CSV):
   - finds the website account by email (`members`, case-insensitive) or **creates** it (Supabase Auth user + `members`
     row in production; salted hash in `SUPABASE_ENV=local`), same as `/api/auth/register`;
   - creates one **complete** registration per target segment (`member_id`, `submitted_node_ids` = root → leaf,
     `custom_answers`), links it to the account (`team_member_links`, role `leader`) so it shows on their dashboard,
     and claims `registration_slots` through `complete_registration()` (db/36).

Because slots are claimed the same way as the public form, **an imported person can't be double-registered**
(same segment, same segment group, or "disable multiple segment enroll"), whether the clash comes from an earlier
import or a web sign-up. Re-importing a corrected file is safe: rows already registered are reported and skipped.

## Rules worth knowing

- Missing common info → `<not set>`; required custom fields left empty → `<not set>` (warning). Slot/duplicate checks ignore
  `<not set>`, so blank phones/rolls never collide.
- Field format rules from the Form Builder (digits-only, lengths…) and the NDC 8-digit roll rule are enforced, as on the
  public form. Bad rows are reported, others still import.
- Team-required segments (non-optional `require_team`) are rejected for now — a flat CSV row can't carry team members.
- Admin imports ignore the registration deadline / "registration open" flag.
- Fees: choose *waived*, *paid* or *pending* in the dialog; it applies to segments that have a fee.
- Needs db migrations 36–37 (`complete_registration`) — the import reports a clear error if they're missing.
- File/photo upload fields can't be imported and are skipped.
- Limits: 1000 rows per file.
