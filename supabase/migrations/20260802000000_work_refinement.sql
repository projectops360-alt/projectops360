-- ============================================================================
-- ProjectOps360° — Work Refinement Center (Phase 1 / MVP)
-- Migration: 20260802000000_work_refinement.sql
--
-- Adds the REFINEMENT layer between "capture work" (backlog) and "send to
-- execution" (Workboard). The Work Item IS project_backlog_items — we extend it
-- (additive only) with refinement status, readiness, estimation, completion
-- criteria, a materialized Definition of Ready checklist, AI fields and a target
-- planning destination. A small work_item_dependencies table records the
-- item↔item dependencies surfaced during refinement.
--
-- House conventions: ADD COLUMN IF NOT EXISTS, member RLS via is_org_member(),
-- update_updated_at() trigger, partial indexes. Nothing dropped destructively.
-- Reuse: project_backlog_items.{owner_id, acceptance_criteria,
-- definition_of_done, priority, business_value, source, linked_*}.
-- ============================================================================

-- ── 1. project_backlog_items — refinement columns ───────────────────────────

ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS refinement_status text NOT NULL DEFAULT 'new';

ALTER TABLE public.project_backlog_items
  DROP CONSTRAINT IF EXISTS project_backlog_items_refinement_status_check;
ALTER TABLE public.project_backlog_items
  ADD CONSTRAINT project_backlog_items_refinement_status_check
  CHECK (refinement_status IN (
    'new','needs_clarification','ready_for_refinement','in_refinement',
    'split_required','refined','ready_for_planning','planned',
    'in_execution','done','rejected','deferred'
  ));

ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS readiness_score integer;
ALTER TABLE public.project_backlog_items
  DROP CONSTRAINT IF EXISTS project_backlog_items_readiness_range;
ALTER TABLE public.project_backlog_items
  ADD CONSTRAINT project_backlog_items_readiness_range
  CHECK (readiness_score IS NULL OR (readiness_score >= 0 AND readiness_score <= 100))
  NOT VALID;

ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS estimation_method text;
ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS estimate_value numeric;
ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS estimate_unit text;
ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS estimate_optimistic numeric;
ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS estimate_most_likely numeric;
ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS estimate_pessimistic numeric;

ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS risk_level text;
ALTER TABLE public.project_backlog_items
  DROP CONSTRAINT IF EXISTS project_backlog_items_risk_level_check;
ALTER TABLE public.project_backlog_items
  ADD CONSTRAINT project_backlog_items_risk_level_check
  CHECK (risk_level IS NULL OR risk_level IN ('low','medium','high','critical'))
  NOT VALID;

ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS completion_criteria text;
ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS definition_of_ready jsonb NOT NULL DEFAULT '[]';

ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS customer_value integer;
ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS strategic_value integer;
ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS stakeholders text;
ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS source_reference text;
ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS target_planning_destination text;

ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS ai_summary text;
ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS ai_refinement_questions jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS ai_recommendations jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.project_backlog_items
  ADD COLUMN IF NOT EXISTS refined_at timestamptz;

COMMENT ON COLUMN public.project_backlog_items.definition_of_ready IS
  'Materialized Definition of Ready checklist from the refinement template: [{"key","label","checked"}]. Drives the readiness score.';
COMMENT ON COLUMN public.project_backlog_items.ai_recommendations IS
  'Last AI refinement output (suggested criteria, dependencies, risks, estimate, destination, readiness explanation, facts/assumptions).';

CREATE INDEX IF NOT EXISTS idx_backlog_refinement
  ON public.project_backlog_items (project_id, refinement_status)
  WHERE deleted_at IS NULL;

-- ── 2. work_item_dependencies ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.work_item_dependencies (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id         uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  backlog_item_id    uuid NOT NULL REFERENCES public.project_backlog_items(id) ON DELETE CASCADE,
  depends_on_item_id uuid NOT NULL REFERENCES public.project_backlog_items(id) ON DELETE CASCADE,
  dependency_type    text NOT NULL DEFAULT 'finish_to_start'
                     CHECK (dependency_type IN ('finish_to_start','start_to_start','finish_to_finish','start_to_finish','blocks','relates')),
  note               text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_item_dependencies_not_self CHECK (backlog_item_id <> depends_on_item_id),
  UNIQUE (backlog_item_id, depends_on_item_id, dependency_type)
);

CREATE INDEX IF NOT EXISTS idx_wid_item ON public.work_item_dependencies (backlog_item_id);
CREATE INDEX IF NOT EXISTS idx_wid_depends ON public.work_item_dependencies (depends_on_item_id);
CREATE INDEX IF NOT EXISTS idx_wid_project ON public.work_item_dependencies (project_id);

-- ── 3. RLS for the new table ──────────────────────────────────────────────────

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['work_item_dependencies'] LOOP
    EXECUTE format('ALTER TABLE public.%s ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Members read %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Members insert %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Members update %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Members delete %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Service role %1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "Members read %1$s" ON public.%1$s FOR SELECT USING (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "Members insert %1$s" ON public.%1$s FOR INSERT WITH CHECK (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "Members update %1$s" ON public.%1$s FOR UPDATE USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "Members delete %1$s" ON public.%1$s FOR DELETE USING (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "Service role %1$s" ON public.%1$s FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')', t);
  END LOOP;
END $$;
