-- ═══════════════════════════════════════════════════════════════════════════════
-- Labor Resources — Data Center Labor Risk Intelligence Lab
-- Creates: labor_resources table with indexes, RLS policies, triggers, comments
-- Additive only — does not modify any existing table or data
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.labor_resources (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL
                           REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id             uuid
                           REFERENCES public.projects(id) ON DELETE CASCADE,
  resource_key           text NOT NULL,
  name                   text NOT NULL,
  trade_key              text NOT NULL,
  label_i18n             jsonb NOT NULL DEFAULT '{}',
  resource_type          text NOT NULL DEFAULT 'crew'
                           CHECK (resource_type IN (
                             'crew', 'specialist', 'inspector', 'vendor', 'witness'
                           )),
  skill_level            text NOT NULL DEFAULT 'journeyman'
                           CHECK (skill_level IN (
                             'apprentice', 'journeyman', 'senior', 'master'
                           )),
  headcount              integer NOT NULL DEFAULT 1,
  capacity_hours_per_week numeric(6,2) NOT NULL DEFAULT 40,
  availability            jsonb NOT NULL DEFAULT '[]',
  constraints            jsonb NOT NULL DEFAULT '{}',
  metadata               jsonb NOT NULL DEFAULT '{}',
  order_index            integer NOT NULL DEFAULT 0,
  deleted_at             timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_labor_resources_org
  ON public.labor_resources (organization_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_labor_resources_unique_key
  ON public.labor_resources (organization_id, project_id, resource_key)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_labor_resources_project
  ON public.labor_resources (project_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_labor_resources_trade
  ON public.labor_resources (project_id, trade_key)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_labor_resources_type
  ON public.labor_resources (project_id, resource_type)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_labor_resources_skill
  ON public.labor_resources (project_id, skill_level)
  WHERE deleted_at IS NULL;

-- GIN index for availability JSONB queries (week-based lookups)
CREATE INDEX IF NOT EXISTS idx_labor_resources_availability
  ON public.labor_resources USING gin (availability)
  WHERE deleted_at IS NULL;

-- GIN index for constraints JSONB queries
CREATE INDEX IF NOT EXISTS idx_labor_resources_constraints
  ON public.labor_resources USING gin (constraints)
  WHERE deleted_at IS NULL;

-- ── Triggers ────────────────────────────────────────────────────────────────

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.labor_resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Row-Level Security ──────────────────────────────────────────────────────

ALTER TABLE public.labor_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read labor_resources" ON public.labor_resources;
DROP POLICY IF EXISTS "Members can insert labor_resources" ON public.labor_resources;
DROP POLICY IF EXISTS "Members can update labor_resources" ON public.labor_resources;
DROP POLICY IF EXISTS "Members can delete labor_resources" ON public.labor_resources;
DROP POLICY IF EXISTS "Service role has full access on labor_resources" ON public.labor_resources;

CREATE POLICY "Members can read labor_resources"
  ON public.labor_resources
  FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can insert labor_resources"
  ON public.labor_resources
  FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can update labor_resources"
  ON public.labor_resources
  FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can delete labor_resources"
  ON public.labor_resources
  FOR DELETE
  USING (public.is_org_member(organization_id));

CREATE POLICY "Service role has full access on labor_resources"
  ON public.labor_resources
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── Column comments ──────────────────────────────────────────────────────────

COMMENT ON TABLE public.labor_resources IS
  'Crews, specialists, vendors, and inspectors assigned to a project with weekly availability windows and labor constraints.';
COMMENT ON COLUMN public.labor_resources.resource_key IS
  'Stable identifier for the resource: e.g. "electrical-crew-a". Used in queries and as display slug.';
COMMENT ON COLUMN public.labor_resources.trade_key IS
  'Reference to trade_taxonomy.trade_key for the primary trade of this resource.';
COMMENT ON COLUMN public.labor_resources.availability IS
  'Weekly availability windows: [{"week":"2026-W29","start":"2026-07-14","end":"2026-07-18","available_hours":40,"status":"available|partial|unavailable"}]';
COMMENT ON COLUMN public.labor_resources.constraints IS
  'Labor constraint metadata: type (over-allocated|partial_availability|vendor_unconfirmed|shortage|none), description_i18n, concurrent_projects, lead_time_weeks, confirmed.';