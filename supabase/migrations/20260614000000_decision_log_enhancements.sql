-- ============================================================================
-- ProjectOps360° — Decision Log Enhancements (Task 1.4)
-- Migration: 20260614000000_decision_log_enhancements.sql
--
-- Changes:
--   1. Add decision_maker (text) — free text for who made the decision
--   2. Add source_type (text) — CHECK: meeting, communication, document, manual, other
--   3. Add source_record_id (uuid) — optional link to source record
--   4. Add impact_area (text) — CHECK: scope, schedule, budget, risk, quality, communication, document, other
--   5. Add evidence_url (text) — optional URL for supporting evidence
--   6. Add indexes for filtering
-- ============================================================================

-- 1. Add decision_maker
ALTER TABLE public.decisions
  ADD COLUMN decision_maker text;

-- 2. Add source_type
ALTER TABLE public.decisions
  ADD COLUMN source_type text
  CHECK (source_type IN ('meeting', 'communication', 'document', 'manual', 'other'));

-- 3. Add source_record_id
ALTER TABLE public.decisions
  ADD COLUMN source_record_id uuid;

-- 4. Add impact_area
ALTER TABLE public.decisions
  ADD COLUMN impact_area text
  CHECK (impact_area IN ('scope', 'schedule', 'budget', 'risk', 'quality', 'communication', 'document', 'other'));

-- 5. Add evidence_url
ALTER TABLE public.decisions
  ADD COLUMN evidence_url text;

-- 6. Add indexes for filtering
CREATE INDEX idx_decisions_source_type
  ON public.decisions (organization_id, source_type)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_decisions_impact_area
  ON public.decisions (organization_id, impact_area)
  WHERE deleted_at IS NULL;

-- Comments
COMMENT ON COLUMN public.decisions.decision_maker IS
  'Free text field for who made the decision';
COMMENT ON COLUMN public.decisions.source_type IS
  'Type of source record: meeting | communication | document | manual | other';
COMMENT ON COLUMN public.decisions.source_record_id IS
  'Optional UUID linking to the source record (meeting or communication)';
COMMENT ON COLUMN public.decisions.impact_area IS
  'Primary impact area: scope | schedule | budget | risk | quality | communication | document | other';
COMMENT ON COLUMN public.decisions.evidence_url IS
  'Optional URL for supporting evidence';