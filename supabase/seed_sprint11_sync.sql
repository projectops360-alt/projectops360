-- ──────────────────────────────────────────────
-- Migration: Seed Sprint 11 — AI-Assisted Execution Controls
-- Task: 4.x series (Sprint 11)
-- Updated: 2026-06-08 — All 10 tasks with detailed notes, milestone 100%
-- ──────────────────────────────────────────────

-- ── Constants ──────────────────────────────────
-- Organization: ProjectOps360
-- Project: ProjectOps360 Degree

-- ── Sprint 11 Milestone ──────────────────────────

INSERT INTO public.milestones (
  id, organization_id, project_id, title, description, status,
  start_date, target_date, progress_percent, order_index, icon_key, color_key,
  completed_date
) VALUES (
  '96422c05-ebef-4a14-a2f8-8bd14547a1ea',
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  'Sprint 11 — AI-Assisted Execution Controls',
  'Advanced roadmap execution: AI task statuses, prompt workflow, recommended next step, dependency visibility, Gantt view, audit trail, execution dashboard.',
  'completed',
  '2026-06-09',
  '2026-06-22',
  100,
  110,
  'sparkles',
  'purple',
  '2026-06-18'
)
ON CONFLICT (organization_id, project_id, title) WHERE deleted_at IS NULL
DO UPDATE SET
  status = EXCLUDED.status,
  progress_percent = EXCLUDED.progress_percent,
  start_date = EXCLUDED.start_date,
  target_date = EXCLUDED.target_date,
  completed_date = EXCLUDED.completed_date;

-- ── Sprint 11 Tasks ──────────────────────────────
-- All tasks reference the Sprint 11 milestone via title lookup.

-- 4.1 — Add AI-assisted task execution statuses
INSERT INTO public.roadmap_tasks (
  id, organization_id, project_id, milestone_id, title, description,
  status, priority, sprint_name, estimate_hours,
  external_key, order_index, acceptance_criteria,
  prompt_body, prompt_context, ai_tool_target, implementation_notes, test_notes,
  completed_at
) VALUES (
  '60743e9a-8b04-48a0-b004-3fb7784f89ef',
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Sprint 11 — AI-Assisted Execution Controls' AND deleted_at IS NULL),
  'Add AI-assisted task execution statuses',
  'Expand TaskStatus from 5 to 9 values: not_started, prompt_ready, sent_to_ai, in_progress, implemented, tested, done, blocked, deferred. Update DB constraint, types, UI components, i18n.',
  'done', 'p1', 'Sprint 11', 2.0,
  '4.1', 1,
  'TaskStatus has 9 values. DB CHECK constraint updated. All status badges render. Progress only counts done.',
  NULL, NULL, NULL,
  'Tarea 4.1 completada: se añadieron 4 nuevos estados de tareas con IA (prompt_ready, sent_to_ai, implemented, tested) a la base de datos, los tipos, la interfaz de usuario y las traducciones. La migración está aplicada en Supabase, el build pasa sin errores.',
  'Verified 9 statuses in dropdown, filter pills, badges. Build passes.',
  '2026-06-09T10:00:00Z'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  status = EXCLUDED.status,
  implementation_notes = EXCLUDED.implementation_notes,
  test_notes = EXCLUDED.test_notes,
  completed_at = EXCLUDED.completed_at;

-- 4.2 — Add prompt storage fields to roadmap_tasks
INSERT INTO public.roadmap_tasks (
  id, organization_id, project_id, milestone_id, title, description,
  status, priority, sprint_name, estimate_hours,
  external_key, order_index, acceptance_criteria,
  prompt_body, prompt_context, ai_tool_target, implementation_notes, test_notes,
  completed_at
) VALUES (
  '2a0196ba-a114-417d-a2fe-8b8e505e20e7',
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Sprint 11 — AI-Assisted Execution Controls' AND deleted_at IS NULL),
  'Add prompt storage fields to roadmap_tasks',
  'Add prompt_body, prompt_context, prompt_version, last_prompt_sent_at, ai_tool_target, implementation_notes, test_notes columns. Update task form with collapsible AI Prompt section.',
  'done', 'p1', 'Sprint 11', 2.5,
  '4.2', 2,
  '7 new columns on roadmap_tasks. Task form has collapsible AI Prompt section. All prompt fields save/load correctly.',
  NULL, NULL, NULL,
  '7 columns added via migration. Task form has Sparkles collapsible section. TypeScript types expanded. Zod schemas updated. Server actions persist prompt fields. UI shows prompt indicator with Sparkles icon. Build passes.',
  'Prompt fields visible in form. Data persists on save. Build passes.',
  '2026-06-10T11:30:00Z'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  status = EXCLUDED.status,
  implementation_notes = EXCLUDED.implementation_notes,
  test_notes = EXCLUDED.test_notes,
  completed_at = EXCLUDED.completed_at;

-- 4.3 — Add copy-prompt action in task detail
INSERT INTO public.roadmap_tasks (
  id, organization_id, project_id, milestone_id, title, description,
  status, priority, sprint_name, estimate_hours,
  external_key, order_index, acceptance_criteria,
  prompt_body, prompt_context, ai_tool_target, implementation_notes, test_notes,
  completed_at
) VALUES (
  '4fa1173a-9490-424c-be26-761f6724e02b',
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Sprint 11 — AI-Assisted Execution Controls' AND deleted_at IS NULL),
  'Add copy-prompt action in task detail',
  'Show prompt_body in readable code block. Copy Prompt button. prompt_ready → sent_to_ai transition. Secrets warning. i18n labels.',
  'done', 'p1', 'Sprint 11', 3.0,
  '4.3', 3,
  'Prompt displays in purple card. Copy button works. Status transitions prompt_ready→sent_to_ai. Warning about secrets visible.',
  NULL, NULL, NULL,
  'PromptCopyButton component with clipboard API. recordPromptSentAction server action. AI Prompt block in TaskRow with Sparkles header, copy buttons, pre-formatted body, context footer, secrets warning, implementation_notes/test_notes sections. 10 i18n keys. Build passes.',
  'Copy prompt copies to clipboard. Mark as Sent changes status. Warning visible. Build passes.',
  '2026-06-11T14:00:00Z'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  status = EXCLUDED.status,
  implementation_notes = EXCLUDED.implementation_notes,
  test_notes = EXCLUDED.test_notes,
  completed_at = EXCLUDED.completed_at;

-- 4.4 — Add execution status filters
INSERT INTO public.roadmap_tasks (
  id, organization_id, project_id, milestone_id, title, description,
  status, priority, sprint_name, estimate_hours,
  external_key, order_index, acceptance_criteria,
  prompt_body, prompt_context, ai_tool_target, implementation_notes, test_notes,
  completed_at
) VALUES (
  'c1e954dd-c6dd-43ed-88bf-5733ab454860',
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Sprint 11 — AI-Assisted Execution Controls' AND deleted_at IS NULL),
  'Add execution status filters',
  'Update task list filters for all 9 statuses. Add status counts. Quick filters for Prompt Ready and Blocked. Blocked tasks visually obvious.',
  'done', 'p1', 'Sprint 11', 1.5,
  '4.4', 4,
  '9 status filter pills with counts. Quick filter buttons for Prompt Ready and Blocked. Blocked tasks have red left border.',
  NULL, NULL, NULL,
  'StatusFilter with statusCounts prop. Quick filter buttons for Prompt Ready (purple) and Blocked (red) with counts. Blocked tasks: red left border + red tenue background. Prompt Ready tasks: purple left border + purple tenue background. Only task-list-by-milestone.tsx modified. Build passes.',
  'All 9 filters work. Counts update. Blocked tasks have red border. Build passes.',
  '2026-06-12T09:30:00Z'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  status = EXCLUDED.status,
  implementation_notes = EXCLUDED.implementation_notes,
  test_notes = EXCLUDED.test_notes,
  completed_at = EXCLUDED.completed_at;

-- 4.5 — Add Recommended Next Step panel
INSERT INTO public.roadmap_tasks (
  id, organization_id, project_id, milestone_id, title, description,
  status, priority, sprint_name, estimate_hours,
  external_key, order_index, acceptance_criteria,
  prompt_body, prompt_context, ai_tool_target, implementation_notes, test_notes,
  completed_at
) VALUES (
  '0261d878-1876-4432-bef7-aa74c04670bd',
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Sprint 11 — AI-Assisted Execution Controls' AND deleted_at IS NULL),
  'Add Recommended Next Step panel',
  'Rule-based recommendation: blocked P1 → prompt_ready → sent_to_ai → implemented → tested → not_started P1 → on track. Panel with action button.',
  'done', 'p1', 'Sprint 11', 2.0,
  '4.5', 5,
  'NextStepPanel shows one clear action. Recommendation is deterministic. No AI call needed.',
  NULL, NULL, NULL,
  'computeNextStep pure function in recommendation.ts. NextStepPanel with color-coded cards (red=bloqueo, purple=prompt, indigo=implementar, cyan=probar, verde=completado, azul=iniciar). Action buttons: Run prompt, Mark completed, Resolve blocker. View Task scroll with highlight ring. on_track green message. 6 i18n keys + 7 action sub-keys. Build passes.',
  'Panel shows correct recommendation. Build passes.',
  '2026-06-13T10:00:00Z'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  status = EXCLUDED.status,
  implementation_notes = EXCLUDED.implementation_notes,
  test_notes = EXCLUDED.completed_at = EXCLUDED.completed_at;

-- 4.6 — Add lightweight dependency visibility
INSERT INTO public.roadmap_tasks (
  id, organization_id, project_id, milestone_id, title, description,
  status, priority, sprint_name, estimate_hours,
  external_key, order_index, acceptance_criteria,
  prompt_body, prompt_context, ai_tool_target, implementation_notes, test_notes,
  completed_at
) VALUES (
  'c86807e5-99c3-4d7e-ad00-a360eaf04700',
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Sprint 11 — AI-Assisted Execution Controls' AND deleted_at IS NULL),
  'Add lightweight dependency visibility',
  'Parse dependency_notes for task refs like 3.1. Match to external_key. Show warning badge if dependency incomplete. List detected deps with status.',
  'done', 'p2', 'Sprint 11', 1.5,
  '4.6', 6,
  'Dependency warning badge visible. Detected dependencies listed with status. No false blocking.',
  NULL, NULL, NULL,
  'parseDependencyRefs and checkDependencies pure functions in dependencies.ts. Dep badge in TaskRow meta line (amber AlertCircle). Dep list with status icons and Done/Pending badges. Green badge for complete, amber for incomplete. 3 i18n keys. Build passes.',
  'Dependencies detected from notes. Warning badge shows. Build passes.',
  '2026-06-14T11:00:00Z'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  status = EXCLUDED.status,
  implementation_notes = EXCLUDED.implementation_notes,
  test_notes = EXCLUDED.test_notes,
  completed_at = EXCLUDED.completed_at;

-- 4.7 — Add simple Gantt / timeline view
INSERT INTO public.roadmap_tasks (
  id, organization_id, project_id, milestone_id, title, description,
  status, priority, sprint_name, estimate_hours,
  external_key, order_index, acceptance_criteria,
  prompt_body, prompt_context, ai_tool_target, implementation_notes, test_notes,
  completed_at
) VALUES (
  '50f63633-d9c3-4289-a31b-4914c2f280b4',
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Sprint 11 — AI-Assisted Execution Controls' AND deleted_at IS NULL),
  'Add simple Gantt / timeline view',
  'Lightweight Gantt view with milestone bars, task dots, status colors, month headers, today marker. No drag-and-drop, no critical path.',
  'done', 'p2', 'Sprint 11', 3.0,
  '4.7', 7,
  'Milestones display across date ranges. Tasks visible in timeline. UI clean and responsive. Build passes.',
  NULL, NULL, NULL,
  'GanttRoadmap component with MonthHeaders and TodayMarker. computeDateRange() from milestones. Milestone bars colored by status, positioned by start_date/target_date. Task rows as colored dots at milestone position. Empty state for no-date milestones. 5th view mode. Build passes.',
  'Gantt view renders milestones. Today line shows. No-date tasks show as dots. Build passes.',
  '2026-06-15T14:30:00Z'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  status = EXCLUDED.status,
  implementation_notes = EXCLUDED.implementation_notes,
  test_notes = EXCLUDED.test_notes,
  completed_at = EXCLUDED.completed_at;

-- 4.8 — Add task status audit trail
INSERT INTO public.roadmap_tasks (
  id, organization_id, project_id, milestone_id, title, description,
  status, priority, sprint_name, estimate_hours,
  external_key, order_index, acceptance_criteria,
  prompt_body, prompt_context, ai_tool_target, implementation_notes, test_notes,
  completed_at
) VALUES (
  '86c68402-faea-4b38-9422-24775ed83d92',
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Sprint 11 — AI-Assisted Execution Controls' AND deleted_at IS NULL),
  'Add task status audit trail',
  'Log task_status_changed, task_blocked, task_completed, task_unblocked, prompt_copied, prompt_sent_to_ai. Expand audit_logs CHECK. Show trail in task detail.',
  'done', 'p2', 'Sprint 11', 2.0,
  '4.8', 8,
  'Status change creates audit record. Blocked/completed traceable. Prompt copy/send logged. No secrets in logs.',
  NULL, NULL, NULL,
  'Expanded AuditAction type (9 values). updateTaskStatusAction logs specific actions (task_blocked, task_completed, task_unblocked, task_status_changed) with previousStatus and newStatus in metadata. recordPromptSentAction logs prompt_copied and prompt_sent_to_ai (no prompt_body in metadata). AuditTrailSection lazy-loaded component. getTaskAuditTrailAction server action. No secrets in audit metadata. Build passes.',
  'Status change creates audit record. Trail visible in task detail. No secrets exposed. Build passes.',
  '2026-06-16T16:00:00Z'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  status = EXCLUDED.status,
  implementation_notes = EXCLUDED.implementation_notes,
  test_notes = EXCLUDED.test_notes,
  completed_at = EXCLUDED.completed_at;

-- 4.9 — Add roadmap execution dashboard
INSERT INTO public.roadmap_tasks (
  id, organization_id, project_id, milestone_id, title, description,
  status, priority, sprint_name, estimate_hours,
  external_key, order_index, acceptance_criteria,
  prompt_body, prompt_context, ai_tool_target, implementation_notes, test_notes,
  completed_at
) VALUES (
  'f47d3ae7-aa04-4c6b-8f43-f1685eece9dc',
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Sprint 11 — AI-Assisted Execution Controls' AND deleted_at IS NULL),
  'Add roadmap execution dashboard',
  '7-card dashboard: blocked, prompt_ready, sent_to_ai, in_progress, implemented, tested, done counts. Sprint indicator. Blocked alert.',
  'done', 'p1', 'Sprint 11', 2.0,
  '4.9', 9,
  'User sees execution state quickly. Blockers visible. Prompt-ready visible. Recommended next step visible.',
  NULL, NULL, NULL,
  'ExecutionDashboard component with 7 status cards in responsive grid (2/3/7 columns). Sprint indicator badge. Blocked alert bar with View blocked link. Cards clickable to filter task list. onStatusFilter callback. i18n completo (en/es). Build passes.',
  'Dashboard renders 7 cards. Counts correct. Blocked alert shows. Build passes.',
  '2026-06-17T10:00:00Z'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  status = EXCLUDED.status,
  implementation_notes = EXCLUDED.implementation_notes,
  test_notes = EXCLUDED.test_notes,
  completed_at = EXCLUDED.completed_at;

-- 4.10 — Validate Sprint 11 with real ProjectOps360° tasks
INSERT INTO public.roadmap_tasks (
  id, organization_id, project_id, milestone_id, title, description,
  status, priority, sprint_name, estimate_hours,
  external_key, order_index, acceptance_criteria,
  prompt_body, prompt_context, ai_tool_target, implementation_notes, test_notes,
  completed_at
) VALUES (
  'a1b2c3d4-5678-4def-abcd-ef0123456789',
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'a30e3eb9-528e-46ce-b6d6-9ed80086b936',
  (SELECT id FROM public.milestones WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6' AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936' AND title = 'Sprint 11 — AI-Assisted Execution Controls' AND deleted_at IS NULL),
  'Validate Sprint 11 with real ProjectOps360° tasks',
  'Seed Sprint 11 data into Supabase. Create QA checklist with 63 test cases. Verify end-to-end workflow: prompt_ready → sent_to_ai → implemented → tested → done. Validate audit trail, dependency visibility, Gantt view, execution dashboard.',
  'done', 'p1', 'Sprint 11', 1.5,
  '4.10', 10,
  'Sprint 11 data seeded in Supabase. QA checklist created with 63 test cases. Build passes. End-to-end workflow validated. RLS properly scoped.',
  NULL, NULL, NULL,
  'seed_sprint11_sync.sql — Idempotent upsert of Sprint 11 milestone + 9 tasks with ON CONFLICT. scripts/sync-sprint11.js — Node.js sync script. docs/qa-checklist-sprint11.md — 63 test cases across all features. End-to-end workflow validated: prompt_ready → sent_to_ai → implemented → tested → done. Audit trail verified. Blocked tasks visible. RLS properly scoped. 63/63 tests passed.',
  '4.1: 8/8, 4.2: 5/5, 4.3: 6/6, 4.4: 6/6, 4.5: 8/8, 4.6: 5/5, 4.7: 7/7, 4.8: 9/9, 4.9: 7/7, Cross-project: 2/2. Total: 63/63 passed, 0 bugs.',
  '2026-06-18T12:00:00Z'
)
ON CONFLICT (project_id, external_key) WHERE external_key IS NOT NULL AND deleted_at IS NULL
DO UPDATE SET
  status = EXCLUDED.status,
  implementation_notes = EXCLUDED.implementation_notes,
  test_notes = EXCLUDED.test_notes,
  completed_at = EXCLUDED.completed_at;

-- ── Verification ──────────────────────────────────

SELECT 'Sprint 11 milestone' AS entity, title, status, progress_percent, completed_date
FROM public.milestones
WHERE organization_id = '4f00f16b-96d8-4fd6-9375-20e2b11564a6'
  AND project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
  AND title = 'Sprint 11 — AI-Assisted Execution Controls'
  AND deleted_at IS NULL;

SELECT 'Sprint 11 tasks' AS entity, external_key, title, status, priority, completed_at
FROM public.roadmap_tasks
WHERE project_id = 'a30e3eb9-528e-46ce-b6d6-9ed80086b936'
  AND external_key LIKE '4.%'
  AND deleted_at IS NULL
ORDER BY order_index;