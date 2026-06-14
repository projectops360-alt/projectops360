-- ============================================================================
-- ProjectOps360° — Cost Library (unit-cost catalog for takeoff → budget)
-- Migration: 20260716000000_cost_library.sql
--
-- Pluggable cost source for the estimating layer. The drawing takeoff
-- (drawing_extractions) is promoted into material_requirements with quantities
-- and costs; unit costs are matched from this catalog. Rows with a NULL
-- organization_id are global seed defaults (visible to everyone); org rows
-- override/extend them. Live providers (1build, BigBox) write org rows with
-- the matching `source`.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cost_library_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = global seed default; otherwise org-scoped override/custom entry
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  category        text NOT NULL,
  -- Optional keyword matched (ILIKE) against the takeoff item/spec for a more
  -- specific price; NULL = the category-level default.
  keyword         text,
  unit            text NOT NULL,
  unit_cost       numeric(12,2) NOT NULL CHECK (unit_cost >= 0),
  currency        text NOT NULL DEFAULT 'USD',
  region          text,
  source          text NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('seed', 'manual', '1build', 'bigbox', 'rsmeans')),
  notes           text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_cost_library_lookup
  ON public.cost_library_items (organization_id, category)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cost_library_global
  ON public.cost_library_items (category)
  WHERE organization_id IS NULL AND deleted_at IS NULL;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.cost_library_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.cost_library_items IS
  'Unit-cost catalog for the takeoff→budget estimating layer. NULL organization_id = global seed default; org rows override. source identifies the provider (seed/manual/1build/bigbox/rsmeans).';

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.cost_library_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read cost library" ON public.cost_library_items;
DROP POLICY IF EXISTS "Members insert cost library" ON public.cost_library_items;
DROP POLICY IF EXISTS "Members update cost library" ON public.cost_library_items;
DROP POLICY IF EXISTS "Members delete cost library" ON public.cost_library_items;
DROP POLICY IF EXISTS "Service role cost library" ON public.cost_library_items;

-- Everyone authenticated reads global defaults; members also read their org rows.
CREATE POLICY "Read cost library"
  ON public.cost_library_items
  FOR SELECT
  USING (organization_id IS NULL OR public.is_org_member(organization_id));

CREATE POLICY "Members insert cost library"
  ON public.cost_library_items
  FOR INSERT
  WITH CHECK (organization_id IS NOT NULL AND public.is_org_member(organization_id));

CREATE POLICY "Members update cost library"
  ON public.cost_library_items
  FOR UPDATE
  USING (organization_id IS NOT NULL AND public.is_org_member(organization_id))
  WITH CHECK (organization_id IS NOT NULL AND public.is_org_member(organization_id));

CREATE POLICY "Members delete cost library"
  ON public.cost_library_items
  FOR DELETE
  USING (organization_id IS NOT NULL AND public.is_org_member(organization_id));

CREATE POLICY "Service role cost library"
  ON public.cost_library_items
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── Global seed defaults (rough US residential unit costs; org can override) ──
-- keyword NULL = category default. Specific keywords take precedence.

INSERT INTO public.cost_library_items (organization_id, category, keyword, unit, unit_cost, source, notes) VALUES
  -- Concrete & reinforcement
  (NULL, 'Concrete', NULL, 'SF', 8.00, 'seed', 'Slab on grade, placed & finished'),
  (NULL, 'Concrete', 'footing', 'LF', 28.00, 'seed', 'Continuous footing w/ rebar'),
  (NULL, 'Concrete', 'slab', 'SF', 8.00, 'seed', NULL),
  (NULL, 'Concrete', 'rebar', 'LB', 1.25, 'seed', 'Reinforcing bar grade 60'),
  (NULL, 'Concrete', 'reinforc', 'LB', 1.25, 'seed', NULL),
  (NULL, 'Masonry', NULL, 'EA', 3.75, 'seed', 'CMU block, installed'),
  -- Wood / framing
  (NULL, 'Structural lumber', NULL, 'EA', 8.00, 'seed', 'Dimensional lumber member'),
  (NULL, 'Structural lumber', 'stud', 'EA', 6.50, 'seed', '2x stud'),
  (NULL, 'Structural lumber', 'header', 'EA', 38.00, 'seed', NULL),
  (NULL, 'Structural lumber', 'microlam', 'EA', 125.00, 'seed', 'LVL header'),
  (NULL, 'Structural lumber', 'post', 'EA', 48.00, 'seed', NULL),
  (NULL, 'Structural lumber', 'nail', 'LB', 3.50, 'seed', NULL),
  (NULL, 'Plywood', NULL, 'SF', 1.85, 'seed', 'Wood structural panel / sheathing'),
  (NULL, 'Plywood', 'gypsum', 'SF', 1.30, 'seed', 'Gypsum sheathing'),
  -- Envelope
  (NULL, 'Roofing', NULL, 'SF', 4.75, 'seed', 'Architectural shingles, installed'),
  (NULL, 'Siding', NULL, 'SF', 7.25, 'seed', 'Vinyl siding, installed'),
  (NULL, 'Insulation', NULL, 'SF', 1.60, 'seed', 'Batt insulation'),
  (NULL, 'Insulation', 'rigid', 'SF', 2.60, 'seed', 'Rigid foam'),
  -- Steel
  (NULL, 'Steel', NULL, 'LB', 2.75, 'seed', 'Misc steel, fabricated & installed'),
  (NULL, 'Structural Steel', NULL, 'LB', 2.75, 'seed', NULL),
  (NULL, 'Connectors', NULL, 'EA', 4.50, 'seed', 'Bolts / connectors'),
  -- Openings
  (NULL, 'Doors', NULL, 'EA', 350.00, 'seed', 'Interior door, installed'),
  (NULL, 'Windows', NULL, 'EA', 600.00, 'seed', 'Vinyl window, installed'),
  (NULL, 'Windows', 'egress', 'EA', 950.00, 'seed', 'Egress window incl. well'),
  -- Finishes
  (NULL, 'Finishes', NULL, 'LF', 4.50, 'seed', 'Trim / moulding'),
  (NULL, 'Finishes', 'quartz', 'SF', 78.00, 'seed', 'Quartz countertop, installed'),
  (NULL, 'Finishes', 'tile', 'SF', 26.00, 'seed', 'Tile backsplash, installed'),
  (NULL, 'Finishes', 'azek', 'LF', 6.50, 'seed', 'PVC trim'),
  (NULL, 'Finishes', 'vinyl trim', 'LF', 2.75, 'seed', NULL),
  -- Site / misc
  (NULL, 'Decking', NULL, 'SF', 12.00, 'seed', 'Composite decking, installed'),
  (NULL, 'Railings', NULL, 'LF', 62.00, 'seed', 'Metal railing system'),
  (NULL, 'Electrical', NULL, 'EA', 120.00, 'seed', 'Device/fixture rough+trim'),
  (NULL, 'Plumbing', NULL, 'EA', 180.00, 'seed', 'Fixture/access, installed'),
  (NULL, 'HVAC', NULL, 'EA', 350.00, 'seed', 'HVAC component')
ON CONFLICT DO NOTHING;
