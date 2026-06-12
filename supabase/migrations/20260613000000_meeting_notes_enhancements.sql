-- ============================================================================
-- ProjectOps360° — Meeting Notes Enhancements (Task 1.3)
-- Migration: 20260613000000_meeting_notes_enhancements.sql
--
-- Changes:
--   1. Add attendees (text) — free text for who attended
--   2. Add linked_stakeholder_ids (jsonb) — array of stakeholder UUIDs
--   3. Add summary_i18n (jsonb) — i18n summary field for AI extraction
-- ============================================================================

-- 1. Add attendees
ALTER TABLE public.meetings
  ADD COLUMN attendees text;

-- 2. Add linked_stakeholder_ids
ALTER TABLE public.meetings
  ADD COLUMN linked_stakeholder_ids jsonb NOT NULL DEFAULT '[]';

-- 3. Add summary_i18n
ALTER TABLE public.meetings
  ADD COLUMN summary_i18n jsonb NOT NULL DEFAULT '{}';

-- Comments
COMMENT ON COLUMN public.meetings.attendees IS
  'Free text listing who attended the meeting (comma-separated names)';
COMMENT ON COLUMN public.meetings.linked_stakeholder_ids IS
  'Array of stakeholder UUIDs linked to this meeting';
COMMENT ON COLUMN public.meetings.summary_i18n IS
  'i18n summary of the meeting: {"en": "...", "es": "..."}';