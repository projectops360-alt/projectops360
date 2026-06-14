-- ============================================================================
-- ProjectOps360° — Rhythm Center: add "Closing Project" + "Other" meeting types
-- Migration: 20260718000000_rhythm_more_meeting_types.sql
-- ============================================================================

ALTER TABLE public.meetings DROP CONSTRAINT IF EXISTS meetings_meeting_type_check;
ALTER TABLE public.meetings ADD CONSTRAINT meetings_meeting_type_check
  CHECK (meeting_type IS NULL OR meeting_type IN (
    'kickoff','status_update','stakeholder_review','project_review','closing','other'
  ));

-- Closing maps to a distinct calendar event_type.
ALTER TABLE public.project_events DROP CONSTRAINT IF EXISTS project_events_event_type_check;
ALTER TABLE public.project_events ADD CONSTRAINT project_events_event_type_check
  CHECK (event_type IN (
    'kickoff_meeting','status_update','stakeholder_review','project_review','project_closing',
    'milestone','deliverable_deadline','risk_review','budget_review',
    'change_review','vendor_followup','resource_planning','action_followup','other'
  ));
