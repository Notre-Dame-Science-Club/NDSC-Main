-- ARCHIVED (2026-07-17 cleanup) — historical only. Folded into db/schema.sql.
-- Do not run this file directly; it may conflict with or duplicate the merged schema.

-- ============================================================================
-- NDSC Platform - Registration Form Enhancements
-- SQL updates to add appearance customization and flexible form builder
-- ============================================================================

-- Add appearance customization fields to activity_sessions
ALTER TABLE activity_sessions
ADD COLUMN IF NOT EXISTS background_image_url TEXT,
ADD COLUMN IF NOT EXISTS font_family TEXT DEFAULT "'Orbitron',sans-serif",
ADD COLUMN IF NOT EXISTS title_text TEXT,
ADD COLUMN IF NOT EXISTS title_color TEXT DEFAULT 'var(--white)',
ADD COLUMN IF NOT EXISTS button_color TEXT DEFAULT 'var(--blue)',
ADD COLUMN IF NOT EXISTS button_text_color TEXT DEFAULT '#000',
ADD COLUMN IF NOT EXISTS custom_css TEXT;

-- Add flexible form definition to activity_sessions for Google Forms-like registration
ALTER TABLE activity_sessions
ADD COLUMN IF NOT EXISTS registration_form_definition JSONB DEFAULT '[]'::jsonb
COMMENT 'Defines the registration form structure: array of field objects with name, label, type, required, unique, validation rules, etc.';

-- Optional: Add index for faster lookup of sessions with registration forms
CREATE INDEX IF NOT EXISTS idx_activity_sessions_registration_form
ON activity_sessions(registration_form_definition)
WHERE registration_enabled = TRUE;

-- ============================================================================
-- Example registration_form_definition structure:
-- [
--   {
--     "name": "full_name",
--     "label": "Full Name",
--     "type": "text",
--     "required": true,
--     "unique": false,
--     "minLength": 2,
--     "maxLength": 100,
--     "defaultValue": "",
--     "description": "Enter your full name as it appears on official documents"
--   },
--   {
--     "name": "school_id",
--     "label": "School ID",
--     "type": "text",
--     "required": true,
--     "unique": true,  -- Prevents duplicate school IDs
--     "pattern": "^[A-Z]{2}[0-9]{4}$",
--     "description": "Format: XX1234 (e.g., AB1234)"
--   },
--   {
--     "name": "grade",
--     "label": "Grade Level",
--     "type": "select",
--     "required": true,
--     "options": [
--       {"label": "9th Grade", "value": "9"},
--       {"label": "10th Grade", "value": "10"},
--       {"label": "11th Grade", "value": "11"},
--       {"label": "12th Grade", "value": "12"}
--     ],
--     "defaultValue": "9"
--   }
-- ]
-- ============================================================================

-- ============================================================================
-- For unique field validation, implement in application layer:
-- 1. When saving a registration, retrieve the session's registration_form_definition
-- 2. For each field where unique = true:
--    - Extract the value from custom_answers using the field name
--    - Query activity_registrations for existing registrations with same session_id
--      and same custom_answers->>field_name value
-- 3. If any duplicates found, reject the submission with appropriate error message
-- ============================================================================

-- Note: The existing activity_reg_categories table can still be used for:
-- - Team-based registrations (requires_team, team_size settings)
-- - Payment configuration (requires_payment, payment_amount, etc.)
-- - Submission configuration (submission_config, submission_who, etc.)
-- - Category-specific settings (custom_fields for category-level fields)
--
-- The registration_form_definition on activity_sessions would define the
-- core participant information fields, while activity_reg_categories handles
-- team/payment/submission logistics.