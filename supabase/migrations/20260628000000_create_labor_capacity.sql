-- ═══════════════════════════════════════════════════════════════════════════════
-- DCL-006: Labor Capacity Data Model
-- Creates labor_weekly_capacity table and compute_labor_capacity() function
-- for weekly required-vs-available labor gap analysis by trade, week, and zone.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Create Table ─────────────────────────────────────────────────────────

CREATE TABLE public.labor_weekly_capacity (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id            uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  trade_key             text NOT NULL,
  week_label            text NOT NULL,           -- e.g. '2026-W29'
  week_start            date NOT NULL,           -- Monday
  week_end              date NOT NULL,           -- Friday
  location_zone        text,                    -- NULL = aggregated across all zones
  required_headcount    integer NOT NULL DEFAULT 0,
  available_headcount   integer NOT NULL DEFAULT 0,
  required_hours        numeric(8,2) NOT NULL DEFAULT 0,
  available_hours       numeric(8,2) NOT NULL DEFAULT 0,
  gap_headcount         integer NOT NULL DEFAULT 0,    -- available - required (negative = shortage)
  gap_hours             numeric(8,2) NOT NULL DEFAULT 0,
  utilization_pct       numeric(5,2),                   -- required/available * 100 (NULL if available=0)
  shortage_risk         text NOT NULL DEFAULT 'none'
                        CHECK (shortage_risk IN ('none','low','medium','high','critical')),
  critical_path_impact   boolean NOT NULL DEFAULT false,
  affected_activity_keys jsonb NOT NULL DEFAULT '[]',
  affected_resource_keys jsonb NOT NULL DEFAULT '[]',
  metadata              jsonb NOT NULL DEFAULT '{}',
  computed_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.labor_weekly_capacity IS
  'Weekly labor capacity snapshot: required vs available headcount and hours by trade, week, and zone. Computed by compute_labor_capacity().';
COMMENT ON COLUMN public.labor_weekly_capacity.shortage_risk IS
  'none=0% gap, low=<10%, medium=10-25%, high=25-50%, critical=>50% headcount gap';
COMMENT ON COLUMN public.labor_weekly_capacity.critical_path_impact IS
  'true if at least one affected activity has downstream successors (on or near critical path)';

-- ── 2. Indexes ──────────────────────────────────────────────────────────────

CREATE INDEX idx_lwc_org
  ON public.labor_weekly_capacity (organization_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_lwc_project
  ON public.labor_weekly_capacity (project_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_lwc_trade
  ON public.labor_weekly_capacity (project_id, trade_key)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_lwc_week
  ON public.labor_weekly_capacity (project_id, week_label)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_lwc_risk
  ON public.labor_weekly_capacity (project_id, shortage_risk)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_lwc_zone
  ON public.labor_weekly_capacity (project_id, location_zone)
  WHERE deleted_at IS NULL AND location_zone IS NOT NULL;

CREATE INDEX idx_lwc_critical
  ON public.labor_weekly_capacity (project_id)
  WHERE deleted_at IS NULL AND critical_path_impact = true;

CREATE UNIQUE INDEX idx_lwc_unique
  ON public.labor_weekly_capacity (organization_id, project_id, trade_key, week_label, location_zone)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_lwc_metadata
  ON public.labor_weekly_capacity USING GIN (metadata)
  WHERE deleted_at IS NULL;

-- ── 3. Trigger ─────────────────────────────────────────────────────────────

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.labor_weekly_capacity
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 4. Row-Level Security ──────────────────────────────────────────────────

ALTER TABLE public.labor_weekly_capacity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read labor_weekly_capacity" ON public.labor_weekly_capacity;
DROP POLICY IF EXISTS "Members can insert labor_weekly_capacity" ON public.labor_weekly_capacity;
DROP POLICY IF EXISTS "Members can update labor_weekly_capacity" ON public.labor_weekly_capacity;
DROP POLICY IF EXISTS "Members can delete labor_weekly_capacity" ON public.labor_weekly_capacity;
DROP POLICY IF EXISTS "Service role has full access on labor_weekly_capacity" ON public.labor_weekly_capacity;

CREATE POLICY "Members can read labor_weekly_capacity"
  ON public.labor_weekly_capacity
  FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can insert labor_weekly_capacity"
  ON public.labor_weekly_capacity
  FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can update labor_weekly_capacity"
  ON public.labor_weekly_capacity
  FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can delete labor_weekly_capacity"
  ON public.labor_weekly_capacity
  FOR DELETE
  USING (public.is_org_member(organization_id));

CREATE POLICY "Service role has full access on labor_weekly_capacity"
  ON public.labor_weekly_capacity
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. Function: compute_labor_capacity(p_project_id uuid)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Recomputes all weekly capacity snapshots for a project.
-- Soft-deletes previous snapshots, then inserts new ones.
-- Uses LATERAL joins on labor_resources.availability JSONB.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.compute_labor_capacity(p_project_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_computed_count integer := 0;
BEGIN
  -- Get org_id for the project
  SELECT organization_id INTO v_org_id
  FROM projects WHERE id = p_project_id AND deleted_at IS NULL
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Project % not found or deleted', p_project_id;
  END IF;

  -- Soft-delete existing snapshots for this project
  UPDATE labor_weekly_capacity
  SET deleted_at = now()
  WHERE project_id = p_project_id
    AND deleted_at IS NULL;

  -- Insert fresh snapshots by joining activities (demand) with resources (supply)
  -- per trade_key and week.
  --
  -- DEMAND: For each activity, determine which weeks it spans.
  --   For each week an activity is active, its required_crew_count and
  --   estimated_hours (prorated by week) contribute to demand.
  --
  -- SUPPLY: For each labor_resource, expand the availability JSONB array
  --   to get weekly available_hours. Sum headcount and hours where status != 'unavailable'.
  --
  -- Then compute gap, utilization, shortage_risk, and critical_path_impact.

  WITH

  -- ── Weeks covered by project activities ──────────────────────────────────
  project_weeks AS (
    SELECT DISTINCT
      w.week_label,
      w.week_start,
      w.week_end
    FROM (
      SELECT generate_series(
        (SELECT MIN(planned_start_date) FROM construction_activities
         WHERE project_id = p_project_id AND deleted_at IS NULL),
        (SELECT MAX(planned_end_date) FROM construction_activities
         WHERE project_id = p_project_id AND deleted_at IS NULL),
        '1 week'
      )::date AS week_start
    ) ws
    CROSS JOIN LATERAL (
      SELECT
        to_char(ws.week_start, 'IYYY') || '-W' || lpad(to_char(ws.week_start, 'IW'), 2, '0') AS week_label,
        ws.week_start AS week_start,
        (ws.week_start + INTERVAL '4 days')::date AS week_end
    ) w
  ),

  -- ── Demand per (trade_key, week, zone) ────────────────────────────────────
  demand AS (
    SELECT
      a.required_trade_key AS trade_key,
      pw.week_label,
      pw.week_start,
      pw.week_end,
      a.location_zone,
      SUM(a.required_crew_count) AS required_headcount,
      -- Prorate estimated_hours across the weeks the activity spans
      SUM(
        ROUND(
          a.estimated_hours
          * (LEAST(a.planned_end_date, pw.week_end)::date - GREATEST(a.planned_start_date, pw.week_start)::date + 1)::numeric
          / (a.planned_end_date::date - a.planned_start_date::date + 1)::numeric,
          2
        )
      ) AS required_hours,
      -- Collect affected activity keys
      jsonb_agg(DISTINCT a.activity_key) AS affected_activity_keys,
      -- Check critical path: does this activity have any successor?
      BOOL_OR(EXISTS (
        SELECT 1 FROM activity_dependencies ad
        WHERE ad.predecessor_id = a.id
      )) AS has_successors
    FROM construction_activities a
    CROSS JOIN project_weeks pw
    WHERE a.project_id = p_project_id
      AND a.deleted_at IS NULL
      AND a.planned_start_date <= pw.week_end
      AND a.planned_end_date >= pw.week_start
    GROUP BY a.required_trade_key, pw.week_label, pw.week_start, pw.week_end, a.location_zone
  ),

  -- ── Supply per (trade_key, week) ─────────────────────────────────────────
  supply AS (
    SELECT
      lr.trade_key,
      aw.week_label,
      SUM(lr.headcount) FILTER (WHERE aw.status != 'unavailable') AS available_headcount,
      SUM((aw.available_hours)::numeric) FILTER (WHERE aw.status != 'unavailable') AS available_hours,
      jsonb_agg(DISTINCT lr.resource_key) FILTER (WHERE aw.status != 'unavailable') AS affected_resource_keys
    FROM labor_resources lr
    CROSS JOIN LATERAL jsonb_array_elements(lr.availability) AS wo(week_obj)
    CROSS JOIN LATERAL (
      SELECT
        wo.week_obj->>'week' AS week_label,
        (wo.week_obj->>'available_hours')::numeric AS available_hours,
        wo.week_obj->>'status' AS status
    ) aw
    WHERE lr.project_id = p_project_id
      AND lr.deleted_at IS NULL
    GROUP BY lr.trade_key, aw.week_label
  )

  -- ── Insert combined results ──────────────────────────────────────────────
  INSERT INTO labor_weekly_capacity (
    organization_id, project_id, trade_key, week_label, week_start, week_end,
    location_zone, required_headcount, available_headcount,
    required_hours, available_hours,
    gap_headcount, gap_hours,
    utilization_pct, shortage_risk, critical_path_impact,
    affected_activity_keys, affected_resource_keys
  )
  SELECT
    v_org_id,
    p_project_id,
    COALESCE(d.trade_key, s.trade_key) AS trade_key,
    COALESCE(d.week_label, s.week_label) AS week_label,
    COALESCE(d.week_start, to_date(replace(COALESCE(d.week_label, s.week_label), '-W', '-') || '-1', 'IYYY-IW-ID')) AS week_start,
    COALESCE(d.week_end, (to_date(replace(COALESCE(d.week_label, s.week_label), '-W', '-') || '-1', 'IYYY-IW-ID') + INTERVAL '4 days')::date) AS week_end,
    d.location_zone,
    COALESCE(d.required_headcount, 0),
    COALESCE(s.available_headcount, 0),
    COALESCE(d.required_hours, 0),
    COALESCE(s.available_hours, 0),
    -- gap = available - required (negative = shortage)
    COALESCE(s.available_headcount, 0) - COALESCE(d.required_headcount, 0),
    COALESCE(s.available_hours, 0) - COALESCE(d.required_hours, 0),
    -- utilization = required / available * 100
    CASE
      WHEN COALESCE(s.available_headcount, 0) > 0
      THEN ROUND(COALESCE(d.required_headcount, 0)::numeric / s.available_headcount * 100, 2)
      ELSE NULL
    END,
    -- shortage_risk classification
    CASE
      WHEN COALESCE(s.available_headcount, 0) = 0 AND COALESCE(d.required_headcount, 0) > 0 THEN 'critical'
      WHEN COALESCE(s.available_headcount, 0) = 0 THEN 'none'
      WHEN COALESCE(d.required_headcount, 0)::numeric / s.available_headcount > 1.5 THEN 'critical'
      WHEN COALESCE(d.required_headcount, 0)::numeric / s.available_headcount > 1.25 THEN 'high'
      WHEN COALESCE(d.required_headcount, 0)::numeric / s.available_headcount > 1.10 THEN 'medium'
      WHEN COALESCE(d.required_headcount, 0)::numeric / s.available_headcount > 1.0 THEN 'low'
      ELSE 'none'
    END,
    -- critical_path_impact
    COALESCE(d.has_successors, false),
    COALESCE(d.affected_activity_keys, '[]'::jsonb),
    COALESCE(s.affected_resource_keys, '[]'::jsonb)
  FROM demand d
  FULL OUTER JOIN supply s
    ON d.trade_key = s.trade_key AND d.week_label = s.week_label
  LEFT JOIN project_weeks pw
    ON COALESCE(d.week_label, s.week_label) = pw.week_label
  WHERE COALESCE(d.required_headcount, 0) > 0
     OR COALESCE(s.available_headcount, 0) > 0;

  -- Return count of rows inserted
  GET DIAGNOSTICS v_computed_count = ROW_COUNT;
  RETURN v_computed_count;
END;
$$;

COMMENT ON FUNCTION public.compute_labor_capacity(uuid) IS
  'Recomputes weekly labor capacity snapshots for a project. Soft-deletes previous snapshots then inserts fresh ones. Returns the number of new rows created.';