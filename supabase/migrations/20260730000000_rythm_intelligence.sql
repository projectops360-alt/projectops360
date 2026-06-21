-- ============================================================================
-- ProjectOps360° — Rythm Meeting Intelligence Engine
-- Migration: 20260730000000_rythm_intelligence.sql
--
-- Structured project intelligence extracted from a meeting transcript (OpenAI).
-- One row per meeting (regeneration replaces it). Items can be promoted into the
-- real Task / Decision / Risk registers via traceability_links.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_rythm_intelligence (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id        uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  meeting_id        uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  executive_summary text,
  decisions         jsonb NOT NULL DEFAULT '[]',
  action_items      jsonb NOT NULL DEFAULT '[]',
  risks             jsonb NOT NULL DEFAULT '[]',
  blockers          jsonb NOT NULL DEFAULT '[]',
  assumptions       jsonb NOT NULL DEFAULT '[]',
  dependencies      jsonb NOT NULL DEFAULT '[]',
  milestones        jsonb NOT NULL DEFAULT '[]',
  commitments       jsonb NOT NULL DEFAULT '[]',
  confidence_score  numeric,
  model             text,
  generated_at      timestamptz NOT NULL DEFAULT now(),
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_rythm_intelligence_meeting UNIQUE (meeting_id)
);

CREATE INDEX IF NOT EXISTS idx_rythm_intelligence_org
  ON public.project_rythm_intelligence (organization_id);
CREATE INDEX IF NOT EXISTS idx_rythm_intelligence_project
  ON public.project_rythm_intelligence (project_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_rythm_intelligence
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.project_rythm_intelligence IS
  'Structured project intelligence extracted from a meeting transcript (decisions, action items, risks, blockers, assumptions, dependencies, milestones, commitments + executive summary).';

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.project_rythm_intelligence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read project_rythm_intelligence"   ON public.project_rythm_intelligence;
DROP POLICY IF EXISTS "Members insert project_rythm_intelligence" ON public.project_rythm_intelligence;
DROP POLICY IF EXISTS "Members update project_rythm_intelligence" ON public.project_rythm_intelligence;
DROP POLICY IF EXISTS "Members delete project_rythm_intelligence" ON public.project_rythm_intelligence;
DROP POLICY IF EXISTS "Service role project_rythm_intelligence"   ON public.project_rythm_intelligence;

CREATE POLICY "Members read project_rythm_intelligence"
  ON public.project_rythm_intelligence FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY "Members insert project_rythm_intelligence"
  ON public.project_rythm_intelligence FOR INSERT WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY "Members update project_rythm_intelligence"
  ON public.project_rythm_intelligence FOR UPDATE
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY "Members delete project_rythm_intelligence"
  ON public.project_rythm_intelligence FOR DELETE USING (public.is_org_member(organization_id));
CREATE POLICY "Service role project_rythm_intelligence"
  ON public.project_rythm_intelligence FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ── Activity log: intelligence + promotion actions ─────────────────────────
ALTER TABLE public.project_rythm_activity_log
  DROP CONSTRAINT IF EXISTS project_rythm_activity_log_action_check;
ALTER TABLE public.project_rythm_activity_log
  ADD CONSTRAINT project_rythm_activity_log_action_check
  CHECK (action IN (
    'meeting_created', 'recording_started', 'recording_stopped',
    'audio_uploaded', 'audio_prepared', 'transcription_queued',
    'transcription_started', 'transcription_completed', 'transcription_failed',
    'transcription_retried', 'job_retried', 'job_cancelled',
    'audio_deleted', 'validation_failed',
    'speaker_mapping_saved', 'speaker_mapping_reset',
    'meeting_intelligence_generated', 'meeting_intelligence_regenerated',
    'action_item_promoted', 'risk_promoted', 'decision_promoted'
  ));
