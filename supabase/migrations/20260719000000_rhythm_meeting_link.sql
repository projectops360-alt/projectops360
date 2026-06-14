-- ============================================================================
-- ProjectOps360° — Rhythm Center: meeting join link (Zoom/Meet/Teams/any URL)
-- Migration: 20260719000000_rhythm_meeting_link.sql
-- Manual link the organizer pastes — no external integration.
-- ============================================================================

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS meeting_link text;

COMMENT ON COLUMN public.meetings.meeting_link IS
  'Manual join link for the meeting (Zoom/Meet/Teams/Webex/etc. URL). No external API integration.';
