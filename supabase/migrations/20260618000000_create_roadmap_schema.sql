-- ══════════════════════════════════════════════════════════════════════════════
-- ProjectOps360° MVP-0 — Roadmap Schema: Milestones & Tasks
-- Migration: 20260618000000
-- Task: 3.1 — Create roadmap database schema
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Milestones ────────────────────────────────────────────────────────────────

CREATE TABLE public.milestones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  status          text NOT NULL DEFAULT 'planned'
                  CHECK (status IN ('planned', 'in_progress', 'completed', 'blocked', 'deferred')),
  start_date      date,
  target_date     date,
  completed_date  date,
  progress_percent integer NOT NULL DEFAULT 0
                  CHECK (progress_percent >= 0 AND progress_percent <= 100),
  order_index     integer NOT NULL DEFAULT 0,
  icon_key        text,
  color_key       text,
  deleted_at      timestamptz,                    -- soft delete (project-wide pattern)
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Roadmap Tasks ──────────────────────────────────────────────────────────────

CREATE TABLE public.roadmap_tasks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id        uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_id      uuid REFERENCES public.milestones(id) ON DELETE SET NULL,
  title             text NOT NULL,
  description      text,
  status            text NOT NULL DEFAULT 'not_started'
                    CHECK (status IN ('not_started', 'in_progress', 'blocked', 'done', 'deferred')),
  priority          text NOT NULL DEFAULT 'p2'
                    CHECK (priority IN ('p1', 'p2', 'p3')),
  sprint_name       text,
  estimate_hours    numeric(6,2),
  actual_hours      numeric(6,2),
  dependency_notes  text,
  acceptance_criteria text,
  order_index       integer NOT NULL DEFAULT 0,
  deleted_at        timestamptz,                  -- soft delete (project-wide pattern)
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────────

-- Milestones
CREATE INDEX idx_milestones_org       ON public.milestones(organization_id);
CREATE INDEX idx_milestones_project   ON public.milestones(project_id);
CREATE INDEX idx_milestones_status    ON public.milestones(status)
  WHERE deleted_at IS NULL;                       -- partial: only active milestones
CREATE INDEX idx_milestones_order     ON public.milestones(project_id, order_index)
  WHERE deleted_at IS NULL;

-- Roadmap Tasks
CREATE INDEX idx_roadmap_tasks_org    ON public.roadmap_tasks(organization_id);
CREATE INDEX idx_roadmap_tasks_project ON public.roadmap_tasks(project_id);
CREATE INDEX idx_roadmap_tasks_milestone ON public.roadmap_tasks(milestone_id)
  WHERE deleted_at IS NULL;                       -- partial: only active tasks
CREATE INDEX idx_roadmap_tasks_status ON public.roadmap_tasks(status)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_roadmap_tasks_sprint ON public.roadmap_tasks(sprint_name)
  WHERE sprint_name IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_roadmap_tasks_priority ON public.roadmap_tasks(project_id, priority)
  WHERE deleted_at IS NULL;

-- ── updated_at Triggers (reuses existing update_updated_at() function) ─────────

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.roadmap_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_tasks ENABLE ROW LEVEL SECURITY;

-- Milestones policies
CREATE POLICY "Members can read milestones"
  ON public.milestones FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can insert milestones"
  ON public.milestones FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can update milestones"
  ON public.milestones FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can delete milestones"
  ON public.milestones FOR DELETE
  USING (public.is_org_member(organization_id));

CREATE POLICY "Service role has full access on milestones"
  ON public.milestones FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Roadmap tasks policies
CREATE POLICY "Members can read roadmap_tasks"
  ON public.roadmap_tasks FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "Members can insert roadmap_tasks"
  ON public.roadmap_tasks FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can update roadmap_tasks"
  ON public.roadmap_tasks FOR UPDATE
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Members can delete roadmap_tasks"
  ON public.roadmap_tasks FOR DELETE
  USING (public.is_org_member(organization_id));

CREATE POLICY "Service role has full access on roadmap_tasks"
  ON public.roadmap_tasks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');