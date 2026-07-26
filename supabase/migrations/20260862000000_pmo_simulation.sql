-- ============================================================================
-- CAP-049 — PMO Simulation Foundation V1
-- ============================================================================
-- Two tables, and neither holds operational truth.
--
-- A scenario is a QUESTION about the portfolio ("what if we delay the permit
-- and add $50k?"), never an instruction to it. Saving one must not move a
-- single task, risk, budget line or allocation — the whole value of the feature
-- rests on a PMO being able to explore a bad idea without consequences.
--
-- That guarantee is structural, not procedural:
--   * nothing here references an operational row in a writable direction;
--   * interventions store their targets as ids inside JSONB, resolved read-only
--     by the engine, so no foreign key can cascade a change outward;
--   * there is no "apply to project" path in V1, in the schema or the code.
--
-- The assumed risk figures a user types (`assumedCostImpact`, `assumedDelayDays`)
-- live in the intervention payload and are NEVER written to public.risks. That
-- table has no cost or duration column and this migration deliberately adds
-- none: a simulation input is not a domain fact, and promoting it to one would
-- turn one person's guess into everyone else's data.
-- ============================================================================

-- ── Scenarios ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pmo_simulation_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  name text NOT NULL,
  description text,

  -- Empty array = the whole organization. Stored as ids rather than a join
  -- table because scope is a filter on a question, not a relationship.
  project_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],

  -- When the baseline was captured. Results are only comparable within one
  -- baseline, so it is recorded rather than inferred from created_at.
  baseline_at timestamptz NOT NULL DEFAULT now(),
  horizon_days integer CHECK (horizon_days IS NULL OR horizon_days > 0),

  state text NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft', 'simulated', 'saved')),

  -- Ordered intervention list. JSONB because the four kinds have genuinely
  -- different shapes and a shared table would be mostly nulls; the engine
  -- validates every entry against the typed contract before running.
  interventions jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Last run, stored so reopening a scenario shows what it produced without
  -- recomputing against a baseline that has since moved on.
  last_result jsonb,
  last_run_at timestamptz,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT pmo_simulation_scenarios_interventions_is_array
    CHECK (jsonb_typeof(interventions) = 'array')
);

CREATE INDEX IF NOT EXISTS pmo_simulation_scenarios_org_idx
  ON public.pmo_simulation_scenarios (organization_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS pmo_simulation_scenarios_creator_idx
  ON public.pmo_simulation_scenarios (organization_id, created_by)
  WHERE deleted_at IS NULL;

-- ── Run history ─────────────────────────────────────────────────────────────
-- Kept separate from the scenario so re-running never overwrites the evidence
-- of what an earlier run said. A decision defended with "the simulation showed
-- X" needs X to still exist.

CREATE TABLE IF NOT EXISTS public.pmo_simulation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scenario_id uuid NOT NULL REFERENCES public.pmo_simulation_scenarios(id) ON DELETE CASCADE,

  -- The baseline this run measured against, and the interventions as they were
  -- at that moment. Both frozen: editing the scenario afterwards must not
  -- rewrite history.
  baseline_at timestamptz NOT NULL,
  interventions jsonb NOT NULL DEFAULT '[]'::jsonb,
  result jsonb NOT NULL,

  ran_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ran_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pmo_simulation_runs_scenario_idx
  ON public.pmo_simulation_runs (scenario_id, ran_at DESC);

-- ── Cross-organization prevention, enforced by the database ─────────────────
-- Application code scopes every query, but `project_ids` is supplied by the
-- client. Checking it here means a bug in a server action cannot produce a
-- scenario that reaches into another tenant's portfolio.

CREATE OR REPLACE FUNCTION public.pmo_simulation_scenario_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  foreign_count integer;
BEGIN
  IF array_length(NEW.project_ids, 1) IS NOT NULL THEN
    SELECT count(*) INTO foreign_count
    FROM unnest(NEW.project_ids) AS pid
    LEFT JOIN public.projects p ON p.id = pid
    WHERE p.id IS NULL OR p.organization_id IS DISTINCT FROM NEW.organization_id;

    IF foreign_count > 0 THEN
      RAISE EXCEPTION 'Simulation scope references a project outside the organization';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pmo_simulation_scenario_guard_trigger ON public.pmo_simulation_scenarios;
CREATE TRIGGER pmo_simulation_scenario_guard_trigger
  BEFORE INSERT OR UPDATE ON public.pmo_simulation_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.pmo_simulation_scenario_guard();

-- A run must belong to the same organization as its scenario.
CREATE OR REPLACE FUNCTION public.pmo_simulation_run_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  scenario_org uuid;
BEGIN
  SELECT organization_id INTO scenario_org
  FROM public.pmo_simulation_scenarios
  WHERE id = NEW.scenario_id;

  IF scenario_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'Simulation run organization does not match its scenario';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pmo_simulation_run_guard_trigger ON public.pmo_simulation_runs;
CREATE TRIGGER pmo_simulation_run_guard_trigger
  BEFORE INSERT OR UPDATE ON public.pmo_simulation_runs
  FOR EACH ROW EXECUTE FUNCTION public.pmo_simulation_run_guard();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Same pattern as every business table since 20260611000000: membership via
-- is_org_member(), plus a service_role escape hatch for server-side jobs.

ALTER TABLE public.pmo_simulation_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pmo_simulation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read pmo_simulation_scenarios" ON public.pmo_simulation_scenarios;
CREATE POLICY "Members read pmo_simulation_scenarios" ON public.pmo_simulation_scenarios
  FOR SELECT USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members insert pmo_simulation_scenarios" ON public.pmo_simulation_scenarios;
CREATE POLICY "Members insert pmo_simulation_scenarios" ON public.pmo_simulation_scenarios
  FOR INSERT WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members update pmo_simulation_scenarios" ON public.pmo_simulation_scenarios;
CREATE POLICY "Members update pmo_simulation_scenarios" ON public.pmo_simulation_scenarios
  FOR UPDATE USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members delete pmo_simulation_scenarios" ON public.pmo_simulation_scenarios;
CREATE POLICY "Members delete pmo_simulation_scenarios" ON public.pmo_simulation_scenarios
  FOR DELETE USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Service role full access on pmo_simulation_scenarios" ON public.pmo_simulation_scenarios;
CREATE POLICY "Service role full access on pmo_simulation_scenarios" ON public.pmo_simulation_scenarios
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Members read pmo_simulation_runs" ON public.pmo_simulation_runs;
CREATE POLICY "Members read pmo_simulation_runs" ON public.pmo_simulation_runs
  FOR SELECT USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members insert pmo_simulation_runs" ON public.pmo_simulation_runs;
CREATE POLICY "Members insert pmo_simulation_runs" ON public.pmo_simulation_runs
  FOR INSERT WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members delete pmo_simulation_runs" ON public.pmo_simulation_runs;
CREATE POLICY "Members delete pmo_simulation_runs" ON public.pmo_simulation_runs
  FOR DELETE USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Service role full access on pmo_simulation_runs" ON public.pmo_simulation_runs;
CREATE POLICY "Service role full access on pmo_simulation_runs" ON public.pmo_simulation_runs
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.pmo_simulation_scenarios IS
  'CAP-049 — what-if scenarios over the portfolio. A question, never an instruction: saving one never modifies projects, tasks, risks, resources or budgets.';
COMMENT ON TABLE public.pmo_simulation_runs IS
  'CAP-049 — frozen simulation results. Re-running a scenario adds a row; it never rewrites what an earlier run reported.';
COMMENT ON COLUMN public.pmo_simulation_scenarios.interventions IS
  'Ordered intervention list. Assumed risk cost/delay figures live here and are never written back to public.risks.';
