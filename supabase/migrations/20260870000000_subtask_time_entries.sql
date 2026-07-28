-- ============================================================================
-- ProjectOps360° — Time Tracking Engine · subtask_time_entries
-- ============================================================================
-- The single source of truth for ACTUAL effort. Every logged interval is one
-- immutable-by-intent row; actual hours are always SUM(duration_hours) over
-- this table, never a number somebody typed. task_subtasks.actual_hours stays
-- as a DERIVED CACHE written only by the time-tracking engine (guard
-- SUBTASK-ACTUAL-HOURS-DERIVED) so existing readers keep working without a
-- join, but it is no longer user-editable.
--
-- Designed as the Actual Cost (AC) spine for what comes next — EVM (CPI/SPI/
-- ETC/EAC/VAC), burn rate, resource utilisation, capacity planning, timesheets,
-- hourly cost and billing, Process Mining and Isabella's learning engine. The
-- grain is deliberately the smallest useful one: one person, one day, one
-- interval, one piece of work. Every one of those metrics is an aggregation
-- over this grain, so nothing above needs to store hours again.
--
-- subtask_id is NULLABLE on purpose: time is anchored to a task ALWAYS, and to
-- a subtask WHEN there is one. That lets the same table absorb task-level and
-- (later) activity-level logging without a second table or a migration.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subtask_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.roadmap_tasks(id) ON DELETE CASCADE,
  subtask_id uuid REFERENCES public.task_subtasks(id) ON DELETE CASCADE,

  -- Who the effort belongs to (not necessarily who typed it in: a PM may log
  -- on behalf of a team member, and created_by keeps that distinction).
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  work_date date NOT NULL,
  start_time time,
  end_time time,
  duration_hours numeric(6,2) NOT NULL,

  comment text,

  -- How the entry got here. Manual today; timer/import/api keep the door open
  -- for a stopwatch, timesheet import or integrations without a schema change.
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'timer', 'import', 'api')),

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  -- A day cannot hold more than a day, and a zero-hour entry is not effort.
  CONSTRAINT subtask_time_entries_duration_range
    CHECK (duration_hours > 0 AND duration_hours <= 24),
  -- Start and end travel together or not at all; duration alone is valid.
  CONSTRAINT subtask_time_entries_interval_pair
    CHECK ((start_time IS NULL) = (end_time IS NULL)),
  -- When an interval IS given it must move forward in time.
  CONSTRAINT subtask_time_entries_interval_order
    CHECK (start_time IS NULL OR end_time > start_time)
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
-- Sum-by-subtask is the hot path (every subtask card and modal).
CREATE INDEX IF NOT EXISTS idx_subtask_time_entries_subtask
  ON public.subtask_time_entries (subtask_id)
  WHERE subtask_id IS NOT NULL AND deleted_at IS NULL;
-- Sum-by-task powers the task report column and parent rollups.
CREATE INDEX IF NOT EXISTS idx_subtask_time_entries_task
  ON public.subtask_time_entries (task_id)
  WHERE deleted_at IS NULL;
-- Project + date drives dashboards, burn rate and any period report.
CREATE INDEX IF NOT EXISTS idx_subtask_time_entries_project_date
  ON public.subtask_time_entries (project_id, work_date)
  WHERE deleted_at IS NULL;
-- Person + date drives utilisation, capacity planning and timesheets.
CREATE INDEX IF NOT EXISTS idx_subtask_time_entries_user_date
  ON public.subtask_time_entries (user_id, work_date)
  WHERE deleted_at IS NULL;

-- ── updated_at trigger ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.subtask_time_entries_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subtask_time_entries_updated_at ON public.subtask_time_entries;
CREATE TRIGGER trg_subtask_time_entries_updated_at
  BEFORE UPDATE ON public.subtask_time_entries
  FOR EACH ROW EXECUTE FUNCTION public.subtask_time_entries_touch_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.subtask_time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read subtask time entries" ON public.subtask_time_entries;
CREATE POLICY "Members read subtask time entries"
  ON public.subtask_time_entries FOR SELECT
  USING (public.is_org_member(organization_id));

-- Writes go exclusively through server actions on the admin client, which is
-- where the role checks live (log = admin/PM/assignee, edit = author/PM/admin,
-- delete = PM/admin). No direct client write path exists.
DROP POLICY IF EXISTS "Service role full access on subtask time entries" ON public.subtask_time_entries;
CREATE POLICY "Service role full access on subtask time entries"
  ON public.subtask_time_entries FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.subtask_time_entries IS
  'Time Tracking Engine: one row per logged interval. Actual hours are always SUM(duration_hours) over this table — task_subtasks.actual_hours is a derived cache, never user input. Grain (person, day, interval, work item) is the Actual Cost spine for EVM, burn rate, utilisation, timesheets and billing.';
COMMENT ON COLUMN public.subtask_time_entries.subtask_id IS
  'NULL means the time was logged against the task itself. Time is always anchored to task_id.';
COMMENT ON COLUMN public.subtask_time_entries.user_id IS
  'Whose effort this is. created_by records who entered it (a PM may log on behalf of someone else).';
