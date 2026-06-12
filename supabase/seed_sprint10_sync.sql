-- ══════════════════════════════════════════════════════════════════════════════
-- ProjectOps360° MVP-0 — Sprint 10 Closeout: Sync milestone + tasks
-- Script: seed_sprint10_sync.sql
-- Purpose: Idempotent upsert of Sprint 10 milestone and 12 roadmap tasks
-- ══════════════════════════════════════════════════════════════════════════════
--
-- PREREQUISITES:
--   1. Run migration 20260619000000_add_roadmap_task_tracking_fields.sql FIRST
--      (adds external_key, execution_notes, completed_at columns + unique indexes)
--   2. Run this script in Supabase SQL Editor (service_role bypasses RLS)
--      or via a migration runner with elevated privileges.
--
-- IDEMPOTENCY:
--   - Milestone: upserts by (organization_id, project_id, title) WHERE deleted_at IS NULL
--   - Tasks: upserts by (project_id, external_key) WHERE deleted_at IS NULL
--   - Safe to run multiple times; updates existing rows if values change
--   - No duplicates on re-run
--
-- IMPORTANT: Replace the org_id and project_id constants below if they differ
-- from your actual database values.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Constants (replace if your IDs differ) ─────────────────────────────────────

-- org_id:     4f00f16b-96d8-4fd6-9375-20e2b11564a6
-- project_id: a30e3eb9-528e-46ce-b6d6-9ed80086b936

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 1: Upsert Sprint 10 milestone
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.milestones (
  organization_id, project_id, title, description,
  status, progress_percent, order_index,
  icon_key, color_key, start_date, target_date, completed_date
)
VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  'Sprint 10 — Visual Roadmap Module',
  'Build visual roadmap, milestones, tasks, progress calculation, roadmap snapshot, and validation.',
  'completed',
  100,
  (SELECT COALESCE(MAX(order_index), 0) + 1 FROM public.milestones
   WHERE project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND deleted_at IS NULL),
  'map',
  'green',
  '2026-05-25'::date,
  '2026-06-08'::date,
  CURRENT_DATE
)
ON CONFLICT (organization_id, project_id, title)
WHERE deleted_at IS NULL
DO UPDATE SET
  status           = EXCLUDED.status,
  progress_percent = EXCLUDED.progress_percent,
  description      = EXCLUDED.description,
  icon_key         = EXCLUDED.icon_key,
  color_key        = EXCLUDED.color_key,
  completed_date   = EXCLUDED.completed_date,
  updated_at       = now();

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 2: Upsert Sprint 10 tasks (3.1 – 3.12)
-- ══════════════════════════════════════════════════════════════════════════════

-- 3.1 — Create roadmap database schema
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, title, description,
  status, priority, sprint_name, external_key, order_index,
  estimate_hours, acceptance_criteria, execution_notes, completed_at
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones
   WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
     AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
     AND title = 'Sprint 10 — Visual Roadmap Module'
     AND deleted_at IS NULL LIMIT 1),
  'Create roadmap database schema',
  'Create milestones and roadmap_tasks tables with RLS policies, indexes, and triggers for the Visual Roadmap module.',
  'done', 'p1', 'Sprint 10', '3.1', 1,
  6.00,
  'Tables created with correct columns, constraints, indexes, and RLS enabled. RLS policies allow org-scoped CRUD.',
  'Created milestones (17 cols) and roadmap_tasks (18 cols) tables. Added indexes on org, project, milestone, status, sprint, priority. Added updated_at triggers. RLS policies for member and service_role access.',
  now()
)
ON CONFLICT (project_id, external_key)
WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  milestone_id       = EXCLUDED.milestone_id,
  status             = EXCLUDED.status,
  priority           = EXCLUDED.priority,
  sprint_name        = EXCLUDED.sprint_name,
  estimate_hours     = EXCLUDED.estimate_hours,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  execution_notes   = EXCLUDED.execution_notes,
  completed_at       = EXCLUDED.completed_at,
  updated_at         = now();

-- 3.2 — Add RLS policies for roadmap tables
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, title, description,
  status, priority, sprint_name, external_key, order_index,
  estimate_hours, acceptance_criteria, execution_notes, completed_at
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones
   WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
     AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
     AND title = 'Sprint 10 — Visual Roadmap Module'
     AND deleted_at IS NULL LIMIT 1),
  'Add RLS policies for roadmap tables',
  'Add row-level security policies for milestones and roadmap_tasks tables.',
  'done', 'p1', 'Sprint 10', '3.2', 2,
  4.00,
  'RLS policies work correctly. Org-scoped queries return only the organization''s data. Cross-org access denied.',
  'Added SELECT, INSERT, UPDATE, DELETE policies for org members using is_org_member(). Added service_role full access policies. Verified RLS with smoke tests.',
  now()
)
ON CONFLICT (project_id, external_key)
WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  milestone_id       = EXCLUDED.milestone_id,
  status             = EXCLUDED.status,
  priority           = EXCLUDED.priority,
  sprint_name        = EXCLUDED.sprint_name,
  estimate_hours     = EXCLUDED.estimate_hours,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  execution_notes   = EXCLUDED.execution_notes,
  completed_at       = EXCLUDED.completed_at,
  updated_at         = now();

-- 3.3 — Seed ProjectOps360° roadmap milestones
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, title, description,
  status, priority, sprint_name, external_key, order_index,
  estimate_hours, acceptance_criteria, execution_notes, completed_at
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones
   WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
     AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
     AND title = 'Sprint 10 — Visual Roadmap Module'
     AND deleted_at IS NULL LIMIT 1),
  'Seed ProjectOps360° roadmap milestones',
  'Insert the 10 product milestones (M1–M10) representing the phases of the ProjectOps360° product.',
  'done', 'p1', 'Sprint 10', '3.3', 3,
  3.00,
  '10 milestones visible in roadmap, ordered correctly by phase. Each milestone has title, description, status, and order_index.',
  'Seeded 10 milestones M1–M10 covering Phase 0A through Phase 4. Each milestone has order_index, status, and icon_key set correctly.',
  now()
)
ON CONFLICT (project_id, external_key)
WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  milestone_id       = EXCLUDED.milestone_id,
  status             = EXCLUDED.status,
  priority           = EXCLUDED.priority,
  sprint_name        = EXCLUDED.sprint_name,
  estimate_hours     = EXCLUDED.estimate_hours,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  execution_notes   = EXCLUDED.execution_notes,
  completed_at       = EXCLUDED.completed_at,
  updated_at         = now();

-- 3.4 — Seed ProjectOps360° roadmap tasks
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, title, description,
  status, priority, sprint_name, external_key, order_index,
  estimate_hours, acceptance_criteria, execution_notes, completed_at
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones
   WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
     AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
     AND title = 'Sprint 10 — Visual Roadmap Module'
     AND deleted_at IS NULL LIMIT 1),
  'Seed ProjectOps360° roadmap tasks',
  'Insert the 42 product roadmap tasks across milestones M1–M10 with priorities and sprints.',
  'done', 'p1', 'Sprint 10', '3.4', 4,
  6.00,
  'Tasks appear under correct milestones with proper statuses. Task counts match milestone progress.',
  'Seeded 42 tasks across 10 milestones. M1 has 9 tasks (all done), M2 has 7 tasks (5 done, 1 in_progress, 1 not_started), M3–M8 have tasks with appropriate statuses.',
  now()
)
ON CONFLICT (project_id, external_key)
WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  milestone_id       = EXCLUDED.milestone_id,
  status             = EXCLUDED.status,
  priority           = EXCLUDED.priority,
  sprint_name        = EXCLUDED.sprint_name,
  estimate_hours     = EXCLUDED.estimate_hours,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  execution_notes   = EXCLUDED.execution_notes,
  completed_at       = EXCLUDED.completed_at,
  updated_at         = now();

-- 3.5 — Create Roadmap tab in project detail
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, title, description,
  status, priority, sprint_name, external_key, order_index,
  estimate_hours, acceptance_criteria, execution_notes, completed_at
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones
   WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
     AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
     AND title = 'Sprint 10 — Visual Roadmap Module'
     AND deleted_at IS NULL LIMIT 1),
  'Create Roadmap tab in project detail',
  'Add a Roadmap navigation card and page route under project detail with data fetching and client component shell.',
  'done', 'p1', 'Sprint 10', '3.5', 5,
  6.00,
  'Roadmap tab accessible from project detail page. Route loads milestones and tasks from Supabase.',
  'Created roadmap page at projects/[projectId]/roadmap. Added Map icon card to project navigation grid. Page fetches milestones and tasks with org-scoped queries.',
  now()
)
ON CONFLICT (project_id, external_key)
WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  milestone_id       = EXCLUDED.milestone_id,
  status             = EXCLUDED.status,
  priority           = EXCLUDED.priority,
  sprint_name        = EXCLUDED.sprint_name,
  estimate_hours     = EXCLUDED.estimate_hours,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  execution_notes   = EXCLUDED.execution_notes,
  completed_at       = EXCLUDED.completed_at,
  updated_at         = now();

-- 3.6 — Build Roadmap Hero + Timeline view
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, title, description,
  status, priority, sprint_name, external_key, order_index,
  estimate_hours, acceptance_criteria, execution_notes, completed_at
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones
   WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
     AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
     AND title = 'Sprint 10 — Visual Roadmap Module'
     AND deleted_at IS NULL LIMIT 1),
  'Build Roadmap Hero + Timeline view',
  'Create the Roadmap Hero section showing overall progress, current/next milestone, blockers. Build vertical timeline with milestone cards and expandable task lists.',
  'done', 'p1', 'Sprint 10', '3.6', 6,
  8.00,
  'Hero shows overall progress percentage, current milestone name and progress, next milestone, blockers count. Timeline displays milestones vertically with status icons and expandable task lists.',
  'Built roadmap-hero.tsx with progress bar, current/next milestone cards, blockers count. Built visual-roadmap-timeline.tsx with vertical timeline, status-colored milestone nodes, and expandable task sections. Both components use RoadmapProgress type from progress.ts.',
  now()
)
ON CONFLICT (project_id, external_key)
WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  milestone_id       = EXCLUDED.milestone_id,
  status             = EXCLUDED.status,
  priority           = EXCLUDED.priority,
  sprint_name        = EXCLUDED.sprint_name,
  estimate_hours     = EXCLUDED.estimate_hours,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  execution_notes   = EXCLUDED.execution_notes,
  completed_at       = EXCLUDED.completed_at,
  updated_at         = now();

-- 3.7 — Build Milestone Board view
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, title, description,
  status, priority, sprint_name, external_key, order_index,
  estimate_hours, acceptance_criteria, execution_notes, completed_at
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones
   WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
     AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
     AND title = 'Sprint 10 — Visual Roadmap Module'
     AND deleted_at IS NULL LIMIT 1),
  'Build Milestone Board view',
  'Create a 5-column board (Completed, In Progress, Planned, Blocked, Deferred) grouping milestones by status with clickable cards.',
  'done', 'p1', 'Sprint 10', '3.7', 7,
  6.00,
  'Milestones display in the correct status columns. Clicking a milestone card expands to show its tasks. Board complements the timeline view.',
  'Built milestone-board.tsx with 5 status columns. MilestoneCard shows title, progress bar, task count, target date, status badge, icon. Cards expand to show task list. Responsive layout with grid-cols-1 sm:grid-cols-2 lg:grid-cols-5.',
  now()
)
ON CONFLICT (project_id, external_key)
WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  milestone_id       = EXCLUDED.milestone_id,
  status             = EXCLUDED.status,
  priority           = EXCLUDED.priority,
  sprint_name        = EXCLUDED.sprint_name,
  estimate_hours     = EXCLUDED.estimate_hours,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  execution_notes   = EXCLUDED.execution_notes,
  completed_at       = EXCLUDED.completed_at,
  updated_at         = now();

-- 3.8 — Build Task List by Milestone
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, title, description,
  status, priority, sprint_name, external_key, order_index,
  estimate_hours, acceptance_criteria, execution_notes, completed_at
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones
   WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
     AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
     AND title = 'Sprint 10 — Visual Roadmap Module'
     AND deleted_at IS NULL LIMIT 1),
  'Build Task List by Milestone',
  'Create milestone selector, status filter pills, progress summary, and task rows with inline status update dropdown.',
  'done', 'p1', 'Sprint 10', '3.8', 8,
  8.00,
  'User can see tasks for a milestone. Status and priority are clear. Completed tasks contribute to milestone progress. User can update task status inline.',
  'Built task-list-by-milestone.tsx with MilestoneSelector, StatusFilter pills, ProgressSummary bar, TaskStatusDropdown, and TaskRow components. Uses useTransition + updateTaskStatusAction for optimistic status updates with router.refresh().',
  now()
)
ON CONFLICT (project_id, external_key)
WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  milestone_id       = EXCLUDED.milestone_id,
  status             = EXCLUDED.status,
  priority           = EXCLUDED.priority,
  sprint_name        = EXCLUDED.sprint_name,
  estimate_hours     = EXCLUDED.estimate_hours,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  execution_notes   = EXCLUDED.execution_notes,
  completed_at       = EXCLUDED.completed_at,
  updated_at         = now();

-- 3.9 — Implement progress calculation
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, title, description,
  status, priority, sprint_name, external_key, order_index,
  estimate_hours, acceptance_criteria, execution_notes, completed_at
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones
   WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
     AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
     AND title = 'Sprint 10 — Visual Roadmap Module'
     AND deleted_at IS NULL LIMIT 1),
  'Implement progress calculation',
  'Create pure utility functions to compute milestone progress, overall progress, blockers count, current/next milestone from task data.',
  'done', 'p1', 'Sprint 10', '3.9', 9,
  5.00,
  'Progress updates when task statuses change. Roadmap Hero shows meaningful progress. Milestone cards show correct progress. M1 shows 100% when all its tasks are done.',
  'Created progress.ts with 5 pure functions: computeMilestoneProgress, computeOverallProgress, countBlockers, findCurrentMilestone, findNextMilestone. Main entry computeRoadmapProgress returns RoadmapProgress type used by Hero, Timeline, Board, and Snapshot. Fallback to stored progress_percent when milestone has no tasks.',
  now()
)
ON CONFLICT (project_id, external_key)
WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  milestone_id       = EXCLUDED.milestone_id,
  status             = EXCLUDED.status,
  priority           = EXCLUDED.priority,
  sprint_name        = EXCLUDED.sprint_name,
  estimate_hours     = EXCLUDED.estimate_hours,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  execution_notes   = EXCLUDED.execution_notes,
  completed_at       = EXCLUDED.completed_at,
  updated_at         = now();

-- 3.10 — Add milestone and task creation forms
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, title, description,
  status, priority, sprint_name, external_key, order_index,
  estimate_hours, acceptance_criteria, execution_notes, completed_at
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones
   WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
     AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
     AND title = 'Sprint 10 — Visual Roadmap Module'
     AND deleted_at IS NULL LIMIT 1),
  'Add milestone and task creation forms',
  'Create Zod-validated modal dialogs for creating and editing milestones and tasks with server actions.',
  'done', 'p2', 'Sprint 10', '3.10', 10,
  8.00,
  'User can create and edit milestones. User can create and edit tasks. New records appear without full reload. Records are project-scoped.',
  'Built milestone-form-dialog.tsx and task-form-dialog.tsx with useActionState pattern. Added createMilestoneAction, updateMilestoneAction, createTaskAction, updateTaskAction in actions.ts with Zod schemas. Forms use modal overlay with backdrop blur.',
  now()
)
ON CONFLICT (project_id, external_key)
WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  milestone_id       = EXCLUDED.milestone_id,
  status             = EXCLUDED.status,
  priority           = EXCLUDED.priority,
  sprint_name        = EXCLUDED.sprint_name,
  estimate_hours     = EXCLUDED.estimate_hours,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  execution_notes   = EXCLUDED.execution_notes,
  completed_at       = EXCLUDED.completed_at,
  updated_at         = now();

-- 3.11 — Add Roadmap Snapshot to project overview
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, title, description,
  status, priority, sprint_name, external_key, order_index,
  estimate_hours, acceptance_criteria, execution_notes, completed_at
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones
   WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
     AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
     AND title = 'Sprint 10 — Visual Roadmap Module'
     AND deleted_at IS NULL LIMIT 1),
  'Add Roadmap Snapshot to project overview',
  'Create a compact RoadmapSnapshot component showing overall progress, current milestone, blockers, upcoming tasks, and link to full roadmap.',
  'done', 'p1', 'Sprint 10', '3.11', 11,
  5.00,
  'Project overview shows roadmap status. User can navigate to full roadmap. Snapshot updates based on milestone/task data.',
  'Built roadmap-snapshot.tsx with overall progress bar, current milestone card with progress, next milestone label, blockers count, 3 upcoming tasks sorted by priority, and View Full Roadmap link. Added to project overview page between dashboard and metadata grid.',
  now()
)
ON CONFLICT (project_id, external_key)
WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  milestone_id       = EXCLUDED.milestone_id,
  status             = EXCLUDED.status,
  priority           = EXCLUDED.priority,
  sprint_name        = EXCLUDED.sprint_name,
  estimate_hours     = EXCLUDED.estimate_hours,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  execution_notes   = EXCLUDED.execution_notes,
  completed_at       = EXCLUDED.completed_at,
  updated_at         = now();

-- 3.12 — Validate roadmap with ProjectOps360° real data
INSERT INTO public.roadmap_tasks (
  organization_id, project_id, milestone_id, title, description,
  status, priority, sprint_name, external_key, order_index,
  estimate_hours, acceptance_criteria, execution_notes, completed_at
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones
   WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
     AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
     AND title = 'Sprint 10 — Visual Roadmap Module'
     AND deleted_at IS NULL LIMIT 1),
  'Validate roadmap with ProjectOps360° real data',
  'Create and execute a QA checklist validating navigation, hero, views, progress, forms, snapshot, i18n, and edge cases.',
  'done', 'p1', 'Sprint 10', '3.12', 12,
  4.00,
  'Roadmap works with real ProjectOps360° milestones and tasks. At least one milestone progress update is validated. Any issues are captured for the next sprint.',
  'Created qa-checklist-sprint10.md with 12 sections, 32 validation steps, 4 improvement items. Build verified passing. Progress calculation logic verified correct. All component imports and i18n keys verified. Two enhancements identified: edit triggers not wired from views (I1, I2).',
  now()
)
ON CONFLICT (project_id, external_key)
WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  milestone_id       = EXCLUDED.milestone_id,
  status             = EXCLUDED.status,
  priority           = EXCLUDED.priority,
  sprint_name        = EXCLUDED.sprint_name,
  estimate_hours     = EXCLUDED.estimate_hours,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  execution_notes   = EXCLUDED.execution_notes,
  completed_at       = EXCLUDED.completed_at,
  updated_at         = now();

-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ══════════════════════════════════════════════════════════════════════════════
-- Run these after executing the script to confirm everything is correct.

-- V1: Verify Sprint 10 milestone exists and is completed
-- Expected: 1 row, status='completed', progress_percent=100, completed_date=today
SELECT id, title, status, progress_percent, completed_date, icon_key, color_key, order_index
FROM public.milestones
WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
  AND project_id     = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
  AND title          = 'Sprint 10 — Visual Roadmap Module'
  AND deleted_at IS NULL;

-- V2: Verify all 12 Sprint 10 tasks
-- Expected: 12 rows, all status='done', all sprint_name='Sprint 10', all completed_at IS NOT NULL
SELECT external_key, title, status, priority, sprint_name, estimate_hours, completed_at
FROM public.roadmap_tasks
WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
  AND project_id     = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
  AND external_key   LIKE '3.%'
  AND deleted_at IS NULL
ORDER BY order_index;

-- V3: Verify no duplicates
-- Expected: 0 rows
SELECT external_key, COUNT(*) AS cnt
FROM public.roadmap_tasks
WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
  AND project_id     = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
  AND external_key   LIKE '3.%'
  AND deleted_at IS NULL
GROUP BY external_key
HAVING COUNT(*) > 1;

-- V4: Verify all tasks linked to the Sprint 10 milestone
-- Expected: 12 rows, all milestone_title = 'Sprint 10 — Visual Roadmap Module'
SELECT rt.external_key, rt.title, m.title AS milestone_title
FROM public.roadmap_tasks rt
JOIN public.milestones m ON rt.milestone_id = m.id
WHERE rt.organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
  AND rt.project_id     = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
  AND rt.external_key   LIKE '3.%'
  AND rt.deleted_at IS NULL
ORDER BY rt.order_index;

-- V5: Sprint 10 completion summary
-- Expected: total_tasks=12, done_tasks=12, total_estimate_hours=69.00, completion_pct=100
SELECT
  COUNT(*) AS total_tasks,
  COUNT(*) FILTER (WHERE status = 'done') AS done_tasks,
  SUM(estimate_hours)::numeric(6,2) AS total_estimate_hours,
  ROUND(AVG(CASE WHEN status = 'done' THEN 100 ELSE 0 END)) AS completion_pct
FROM public.roadmap_tasks
WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
  AND project_id     = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
  AND external_key   LIKE '3.%'
  AND deleted_at IS NULL;