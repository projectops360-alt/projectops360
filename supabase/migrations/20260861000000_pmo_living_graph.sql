-- ============================================================================
-- CAP-048 — PMO Portfolio Living Graph
-- ============================================================================
-- Two tables, and neither holds operational truth.
--
-- The graph itself is a PROJECTION over canonical tables that already exist
-- (projects, milestones, roadmap_tasks, risks, task_dependencies,
-- project_resource_allocations, traceability_links). Nothing here duplicates
-- them — a second source of truth for operational data is exactly the failure
-- this design avoids.
--
-- What genuinely has nowhere else to live:
--   1. Presentation state — where a user placed a node, what they pinned.
--   2. Relationships a human asserts that the domain does not model yet.
-- ============================================================================

-- ── Saved views ─────────────────────────────────────────────────────────────
-- Positions and viewport ONLY. A stored position is never operational truth:
-- it applies on top of auto-layout when the node still exists, and orphaned
-- entries are dropped on load (see subgraph.pruneOrphanPositions).

CREATE TABLE IF NOT EXISTS public.pmo_graph_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Null owner = a view shared with the whole organization.
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,

  -- Presentation state.
  positions jsonb NOT NULL DEFAULT '{}'::jsonb,
  pinned_node_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  expanded_node_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  viewport jsonb,
  layout text NOT NULL DEFAULT 'hierarchical'
    CHECK (layout IN ('hierarchical', 'radial', 'clustered')),

  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS pmo_graph_views_org_owner_idx
  ON public.pmo_graph_views (organization_id, owner_user_id)
  WHERE deleted_at IS NULL;

-- One default per user per organization, so loading a view is unambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS pmo_graph_views_one_default_idx
  ON public.pmo_graph_views (organization_id, owner_user_id)
  WHERE is_default AND deleted_at IS NULL;

-- ── Declared edges ──────────────────────────────────────────────────────────
-- Relationships a person knows about but the domain has no table for. Kept
-- apart from projected edges precisely so the two can never be confused: these
-- carry provenance DECLARED and always name their author.

CREATE TABLE IF NOT EXISTS public.pmo_graph_declared_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Node ids are "<kind>:<canonical uuid>", resolved by the projection layer.
  source_node_id text NOT NULL,
  target_node_id text NOT NULL,
  -- Denormalised so cross-tenant checks and cleanup do not need the projection.
  source_project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  target_project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,

  edge_type text NOT NULL CHECK (edge_type IN (
    'contains', 'belongs_to', 'depends_on', 'blocks', 'assigned_to',
    'owned_by', 'impacts', 'mitigates', 'approves', 'contributes_to',
    'consumes_budget', 'triggered_by', 'shares_resource_with'
  )),
  direction text NOT NULL DEFAULT 'directed'
    CHECK (direction IN ('directed', 'undirected')),

  -- A declared edge starts DECLARED and may later be reviewed. It can never
  -- claim OBSERVED: nobody observed it, a person asserted it.
  provenance text NOT NULL DEFAULT 'DECLARED'
    CHECK (provenance IN ('DECLARED', 'DISPUTED', 'CONFIRMED', 'STALE')),
  confidence numeric(3,2) NOT NULL DEFAULT 0.80
    CHECK (confidence >= 0 AND confidence <= 1),
  rationale text,

  valid_from date,
  valid_to date,

  -- Audit trail. Who asserted this, and who last reviewed it.
  created_by uuid NOT NULL REFERENCES auth.users(id),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  -- A node cannot depend on itself.
  CONSTRAINT pmo_graph_declared_edges_no_self_loop
    CHECK (source_node_id <> target_node_id)
);

CREATE INDEX IF NOT EXISTS pmo_graph_declared_edges_org_idx
  ON public.pmo_graph_declared_edges (organization_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pmo_graph_declared_edges_unique_idx
  ON public.pmo_graph_declared_edges (organization_id, source_node_id, target_node_id, edge_type)
  WHERE deleted_at IS NULL;

-- ── Cross-organization prevention, enforced by the database ─────────────────
-- Application code already scopes every query, but a declared edge is the one
-- place a client supplies both endpoints. Enforcing it here means a bug in the
-- server action cannot produce an edge that joins two tenants.

CREATE OR REPLACE FUNCTION public.pmo_graph_declared_edge_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_org uuid;
  target_org uuid;
BEGIN
  IF NEW.source_project_id IS NOT NULL THEN
    SELECT organization_id INTO source_org FROM public.projects WHERE id = NEW.source_project_id;
    IF source_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'Declared edge source project belongs to a different organization';
    END IF;
  END IF;

  IF NEW.target_project_id IS NOT NULL THEN
    SELECT organization_id INTO target_org FROM public.projects WHERE id = NEW.target_project_id;
    IF target_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'Declared edge target project belongs to a different organization';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pmo_graph_declared_edge_guard_trigger ON public.pmo_graph_declared_edges;
CREATE TRIGGER pmo_graph_declared_edge_guard_trigger
  BEFORE INSERT OR UPDATE ON public.pmo_graph_declared_edges
  FOR EACH ROW EXECUTE FUNCTION public.pmo_graph_declared_edge_guard();

CREATE OR REPLACE FUNCTION public.pmo_graph_views_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pmo_graph_views_touch_trigger ON public.pmo_graph_views;
CREATE TRIGGER pmo_graph_views_touch_trigger
  BEFORE UPDATE ON public.pmo_graph_views
  FOR EACH ROW EXECUTE FUNCTION public.pmo_graph_views_touch();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Same pattern as every business table since 20260611000000: membership via
-- is_org_member(), plus a service_role escape hatch for server-side jobs.

ALTER TABLE public.pmo_graph_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pmo_graph_declared_edges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read pmo_graph_views" ON public.pmo_graph_views;
CREATE POLICY "Members read pmo_graph_views" ON public.pmo_graph_views
  FOR SELECT USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members insert pmo_graph_views" ON public.pmo_graph_views;
CREATE POLICY "Members insert pmo_graph_views" ON public.pmo_graph_views
  FOR INSERT WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members update pmo_graph_views" ON public.pmo_graph_views;
CREATE POLICY "Members update pmo_graph_views" ON public.pmo_graph_views
  FOR UPDATE USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members delete pmo_graph_views" ON public.pmo_graph_views;
CREATE POLICY "Members delete pmo_graph_views" ON public.pmo_graph_views
  FOR DELETE USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Service role full access on pmo_graph_views" ON public.pmo_graph_views;
CREATE POLICY "Service role full access on pmo_graph_views" ON public.pmo_graph_views
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Members read pmo_graph_declared_edges" ON public.pmo_graph_declared_edges;
CREATE POLICY "Members read pmo_graph_declared_edges" ON public.pmo_graph_declared_edges
  FOR SELECT USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members insert pmo_graph_declared_edges" ON public.pmo_graph_declared_edges;
CREATE POLICY "Members insert pmo_graph_declared_edges" ON public.pmo_graph_declared_edges
  FOR INSERT WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members update pmo_graph_declared_edges" ON public.pmo_graph_declared_edges;
CREATE POLICY "Members update pmo_graph_declared_edges" ON public.pmo_graph_declared_edges
  FOR UPDATE USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members delete pmo_graph_declared_edges" ON public.pmo_graph_declared_edges;
CREATE POLICY "Members delete pmo_graph_declared_edges" ON public.pmo_graph_declared_edges
  FOR DELETE USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Service role full access on pmo_graph_declared_edges" ON public.pmo_graph_declared_edges;
CREATE POLICY "Service role full access on pmo_graph_declared_edges" ON public.pmo_graph_declared_edges
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.pmo_graph_views IS
  'CAP-048 — saved presentation state for the PMO Portfolio Living Graph. Positions and viewport only; never operational truth.';
COMMENT ON TABLE public.pmo_graph_declared_edges IS
  'CAP-048 — human-asserted relationships the domain does not model yet. Always provenance DECLARED or a reviewed successor; never OBSERVED.';
