-- ═══════════════════════════════════════════════════════════════════════════════
-- Construction Activities & Dependencies — Data Center Labor Risk Intelligence Lab
-- Creates: construction_activities, activity_dependencies tables with indexes,
--          RLS policies, triggers, comments
-- Additive only — does not modify any existing table or data
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Construction Activities ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.construction_activities (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL
                           REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id             uuid
                           REFERENCES public.projects(id) ON DELETE CASCADE,
  activity_key           text NOT NULL,
  name                   text NOT NULL,
  label_i18n             jsonb NOT NULL DEFAULT '{}',
  description_i18n       jsonb NOT NULL DEFAULT '{}',
  required_trade_key     text NOT NULL,
  required_crew_count    integer NOT NULL DEFAULT 1,
  estimated_hours        numeric(6,2) NOT NULL,
  planned_start_date     date NOT NULL,
  planned_end_date       date NOT NULL,
  location_zone          text NOT NULL,
  commissioning_level    text
                           CHECK (commissioning_level IN (
                             'L2', 'L3', 'L4', 'L5', 'L6'
                           )),
  assigned_resource_keys jsonb NOT NULL DEFAULT '[]',
  status                 text NOT NULL DEFAULT 'not_started'
                           CHECK (status IN (
                             'not_started', 'in_progress', 'completed', 'blocked', 'deferred'
                           )),
  progress               integer NOT NULL DEFAULT 0
                           CHECK (progress >= 0 AND progress <= 100),
  metadata               jsonb NOT NULL DEFAULT '{}',
  order_index            integer NOT NULL DEFAULT 0,
  deleted_at             timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes: construction_activities ──────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_construction_activities_org
  ON public.construction_activities (organization_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_construction_activities_unique_key
  ON public.construction_activities (organization_id, project_id, activity_key)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_construction_activities_project
  ON public.construction_activities (project_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_construction_activities_trade
  ON public.construction_activities (project_id, required_trade_key)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_construction_activities_location
  ON public.construction_activities (project_id, location_zone)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_construction_activities_status
  ON public.construction_activities (project_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_construction_activities_dates
  ON public.construction_activities (project_id, planned_start_date, planned_end_date)
  WHERE deleted_at IS NULL;

-- GIN index for assigned_resource_keys JSONB queries (resource assignment lookups)
CREATE INDEX IF NOT EXISTS idx_construction_activities_resources
  ON public.construction_activities USING gin (assigned_resource_keys)
  WHERE deleted_at IS NULL;

-- GIN index for metadata JSONB queries
CREATE INDEX IF NOT EXISTS idx_construction_activities_metadata
  ON public.construction_activities USING gin (metadata)
  WHERE deleted_at IS NULL;

-- ── Activity Dependencies ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.activity_dependencies (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL
                      REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id        uuid
                      REFERENCES public.projects(id) ON DELETE CASCADE,
  predecessor_id    uuid NOT NULL
                      REFERENCES public.construction_activities(id) ON DELETE CASCADE,
  successor_id      uuid NOT NULL
                      REFERENCES public.construction_activities(id) ON DELETE CASCADE,
  dependency_type   text NOT NULL DEFAULT 'finish_to_start'
                      CHECK (dependency_type IN (
                        'finish_to_start', 'start_to_start',
                        'start_to_finish', 'finish_to_finish'
                      )),
  lag_days          integer NOT NULL DEFAULT 0
                      CHECK (lag_days BETWEEN -365 AND 365),
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT no_self_dependency CHECK (predecessor_id != successor_id),
  CONSTRAINT unique_activity_dependency UNIQUE (predecessor_id, successor_id, dependency_type)
);

-- ── Indexes: activity_dependencies ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_activity_dependencies_org
  ON public.activity_dependencies (organization_id);

CREATE INDEX IF NOT EXISTS idx_activity_dependencies_project
  ON public.activity_dependencies (project_id);

CREATE INDEX IF NOT EXISTS idx_activity_dependencies_predecessor
  ON public.activity_dependencies (predecessor_id);

CREATE INDEX IF NOT EXISTS idx_activity_dependencies_successor
  ON public.activity_dependencies (successor_id);

-- ── Triggers ────────────────────────────────────────────────────────────────

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.construction_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Row-Level Security ──────────────────────────────────────────────────────

ALTER TABLE public.construction_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read construction_activities" ON public.construction_activities;
DROP POLICY IF EXISTS "Members can insert construction_activities" ON public.construction_activities;
DROP POLICY IF EXISTS "Members can update construction_activities" ON public.construction_activities;
DROP POLICY IF EXISTS "Members can delete construction_activities" ON public.construction_activities;
DROP POLICY IF EXISTS "Service role has full access on construction_activities" ON public.construction_activities;

CREATE POLICY "Members can read construction_activities"
  ON public.construction_activities
  FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can insert construction_activities"
  ON public.construction_activities
  FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can update construction_activities"
  ON public.construction_activities
  FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can delete construction_activities"
  ON public.construction_activities
  FOR DELETE
  USING (public.is_org_member(organization_id));

CREATE POLICY "Service role has full access on construction_activities"
  ON public.construction_activities
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.activity_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read activity_dependencies" ON public.activity_dependencies;
DROP POLICY IF EXISTS "Members can insert activity_dependencies" ON public.activity_dependencies;
DROP POLICY IF EXISTS "Members can update activity_dependencies" ON public.activity_dependencies;
DROP POLICY IF EXISTS "Members can delete activity_dependencies" ON public.activity_dependencies;
DROP POLICY IF EXISTS "Service role has full access on activity_dependencies" ON public.activity_dependencies;

CREATE POLICY "Members can read activity_dependencies"
  ON public.activity_dependencies
  FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can insert activity_dependencies"
  ON public.activity_dependencies
  FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can update activity_dependencies"
  ON public.activity_dependencies
  FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can delete activity_dependencies"
  ON public.activity_dependencies
  FOR DELETE
  USING (public.is_org_member(organization_id));

CREATE POLICY "Service role has full access on activity_dependencies"
  ON public.activity_dependencies
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── Column comments ──────────────────────────────────────────────────────────

COMMENT ON TABLE public.construction_activities IS
  'Critical-path construction activities for data center projects. Links to trade_taxonomy via required_trade_key and to labor_resources via assigned_resource_keys.';
COMMENT ON COLUMN public.construction_activities.activity_key IS
  'Stable identifier for the activity: e.g. "switchgear-install". Used in queries and as display slug.';
COMMENT ON COLUMN public.construction_activities.required_trade_key IS
  'Reference to trade_taxonomy.trade_key for the primary trade required by this activity.';
COMMENT ON COLUMN public.construction_activities.required_crew_count IS
  'Minimum number of crews/specialists needed to execute this activity on schedule.';
COMMENT ON COLUMN public.construction_activities.estimated_hours IS
  'Total estimated labor hours for the activity across all assigned resources.';
COMMENT ON COLUMN public.construction_activities.location_zone IS
  'Physical location or zone where the activity takes place: e.g. "Electrical Room", "Data Hall", "All Zones".';
COMMENT ON COLUMN public.construction_activities.commissioning_level IS
  'Commissioning test level: L2 (construction verification), L3 (pre-functional), L4 (functional), L5 (integrated systems), L6 (owner handover). Null for non-commissioning activities.';
COMMENT ON COLUMN public.construction_activities.assigned_resource_keys IS
  'Array of labor_resources.resource_key values assigned to this activity. Used for labor demand vs. availability matching.';
COMMENT ON COLUMN public.construction_activities.metadata IS
  'Structured JSONB with additional activity context: risk_flags, notes_i18n, predecessor_summary, etc.';

COMMENT ON TABLE public.activity_dependencies IS
  'Predecessor-successor relationships between construction activities. Mirrors task_dependencies pattern for the construction domain.';