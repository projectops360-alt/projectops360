# Sprint 10 QA Checklist — Visual Roadmap Module

## Module Under Test
- Roadmap page (`/projects/[projectId]/roadmap`)
- Project overview snapshot
- Milestone Board view
- Task List by Milestone view
- Milestone/Task creation and edit forms
- Progress calculation logic

## Data Pre-conditions
- ProjectOps360° project exists with org `4f00f16b-96d8-4fd6-9375-20e2b11564a6`
- 10 milestones seeded (M1–M10)
- 42 tasks seeded across milestones
- Milestones M1 (completed, 9/9 tasks done) and M2 (in_progress, 5/7 tasks done)

---

## QA Checklist

| # | Step | Expected Result | Actual Result | Pass/Fail | Notes |
|---|------|----------------|---------------|-----------|-------|
| **1. Navigation** |
| 1.1 | Navigate to project detail page | Project overview loads with Roadmap card in navigation grid | — | — | Card shows Map icon + "Roadmap" label |
| 1.2 | Click "Roadmap" card | Navigates to `/projects/[projectId]/roadmap` | — | — | URL changes, page loads |
| **2. Roadmap Hero** |
| 2.1 | View the hero section | Shows current phase, current milestone card, overall progress bar | — | — | Current phase extracted from milestone title before "—" |
| 2.2 | Check overall progress | Shows `done_tasks / total_tasks * 100` as percentage (e.g. 72%) | — | — | NOT milestones completed/total |
| 2.3 | Check blockers count | Shows count of blocked milestones + blocked tasks | — | — | If none, shows "No blockers" |
| 2.4 | Check current milestone | Shows first `in_progress` milestone, or first `planned` if none | — | — | M2 should be current |
| 2.5 | Check next milestone | Shows first planned milestone after current by order_index | — | — | |
| **3. View Toggle** |
| 3.1 | See three view buttons | "Timeline", "Board", "Tasks" tabs visible | — | — | Icons: LayoutList, Columns3, ListTodo |
| 3.2 | Click "Board" | Switches to 5-column board view grouped by status | — | — | Columns: Completed, In Progress, Planned, Blocked, Deferred |
| 3.3 | Click "Tasks" | Switches to task list view with milestone selector | — | — | Shows milestone dropdown, status filter, progress bar |
| 3.4 | Click "Timeline" | Returns to vertical timeline view | — | — | |
| **4. Timeline View** |
| 4.1 | View M1 (Phase 0A) | Shows green completed badge, 100% progress bar, 9/9 tasks | — | — | |
| 4.2 | View M2 (Core Features) | Shows blue in_progress badge, 71% progress, expandable task list | — | — | |
| 4.3 | Expand M2 task list | Shows 7 tasks: 5 done (strikethrough), 1 in_progress (spinning), 1 not_started | — | — | |
| 4.4 | View M9/M10 (planned) | Shows gray planned badge, 0% progress | — | — | |
| **5. Board View** |
| 5.1 | M1 in "Completed" column | Green-bordered column, card shows title, progress, task count | — | — | |
| 5.2 | M2 in "In Progress" column | Brand-bordered column, card shows 71% progress | — | — | |
| 5.3 | M9/M10 in "Planned" column | Gray-bordered column, 0% progress | — | — | |
| 5.4 | Click a milestone card | Expands to show task list below card | — | — | |
| **6. Task List View** |
| 6.1 | Milestone selector | Dropdown shows all milestones with status dots and done/total counts | — | — | Defaults to first in_progress milestone |
| 6.2 | Progress bar | Shows percentage + done/total count for selected milestone | — | — | |
| 6.3 | Status filter pills | Shows "All" + 5 status pills (Not Started, In Progress, Blocked, Done, Deferred) | — | — | Active pill is highlighted |
| 6.4 | Click "Blocked" filter | Shows only blocked tasks (or empty state if none) | — | — | |
| 6.5 | Click "All" to reset | Shows all tasks again | — | — | |
| 6.6 | Task row fields | Each task shows: status icon, title, priority badge, status badge, sprint, estimate hours | — | — | |
| 6.7 | Task with dependency_notes | Shows "Dependencies" label + text below task | — | — | |
| 6.8 | Task with acceptance_criteria | Shows "Acceptance criteria" label + text below task | — | — | |
| **7. Task Status Update** |
| 7.1 | Click status icon on a task | Opens dropdown with 5 status options | — | — | |
| 7.2 | Change task status (e.g. not_started → in_progress) | Status updates optimistically, server action fires, router.refresh() confirms | — | — | |
| 7.3 | Verify status persists | Reload page — task shows new status | — | — | **Critical: verify audit log in DB** |
| 7.4 | Change back | Status reverts correctly | — | — | |
| **8. Milestone & Task Forms** |
| 8.1 | Click "Create Milestone" button | Modal opens with title, status, icon, dates, description fields | — | — | |
| 8.2 | Fill and submit milestone | Creates milestone, page refreshes, new milestone appears | — | — | |
| 8.3 | Click "Create Task" button | Modal opens with title, milestone, status, priority, sprint, estimate, description fields | — | — | |
| 8.4 | Fill and submit task | Creates task, page refreshes, task appears in timeline/board/task list | — | — | |
| 8.5 | Edit milestone (from any view) | Opens form pre-filled with milestone data | — | — | **Note: Edit triggers not yet wired to views** |
| 8.6 | Edit task (from task list) | Opens form pre-filled with task data | — | — | **Note: Edit triggers not yet wired** |
| **9. Progress Calculation** |
| 9.1 | M1 = 9/9 tasks done | M1 progress shows 100% | — | — | Computed from tasks, not stored value |
| 9.2 | M2 = 5/7 tasks done | M2 progress shows 71% (Math.round(5/7*100)) | — | — | |
| 9.3 | M3-M8 all tasks done | M3-M8 progress shows 100% | — | — | |
| 9.4 | M9-M10 no tasks done (or 0/0) | Falls back to stored progress_percent (0) | — | — | |
| 9.5 | Overall progress | 14+5=19 tasks done out of total. Percentage = Math.round(19/42*100) = 45% | — | — | **Verify actual count** |
| 9.6 | Change task status and refresh | Progress updates reflect new status | — | — | |
| **10. Project Overview Snapshot** |
| 10.1 | Navigate to project overview | RoadmapSnapshot appears between dashboard and metadata grid | — | — | |
| 10.2 | Overall progress shown | Percentage + bar + "X/Y tasks done" label | — | — | |
| 10.3 | Current milestone shown | Title + status badge + progress bar + next milestone | — | — | |
| 10.4 | Blocked tasks shown | Red banner if blockers > 0 | — | — | |
| 10.5 | Upcoming tasks shown | 3 non-done tasks sorted by priority, with priority badge and milestone label | — | — | |
| 10.6 | "View Full Roadmap" link | Navigates to `/projects/[projectId]/roadmap` | — | — | |
| 10.7 | Empty state (no milestones) | Shows "No milestones yet" message with create prompt | — | — | Only visible on project with no milestones |
| **11. i18n** |
| 11.1 | Switch to Spanish (es) | All labels show Spanish translations | — | — | |
| 11.2 | Status labels | "En progreso", "Completado", "Bloqueado", etc. | — | — | |
| 11.3 | Priority labels | "P1 — Crítico", "P2 — Importante", "P3 — Deseable" | — | — | |
| 11.4 | Form labels | "Crear hito", "Crear tarea", "Título", etc. | — | — | |
| **12. Edge Cases** |
| 12.1 | Milestone with no tasks | Falls back to stored progress_percent | — | — | |
| 12.2 | All milestones completed | Overall progress = 100%, no upcoming tasks, "All tasks completed!" message | — | — | |
| 12.3 | No in_progress milestone | Current = first planned, no "in_progress" badge shown | — | — | |

---

## Issues / Improvements Found

| # | Issue | Severity | Sprint |
|---|-------|----------|--------|
| I1 | Milestone edit triggers not wired from Timeline/Board/TaskList views — forms exist but no "Edit" button on milestone cards | Enhancement | Next sprint |
| I2 | Task edit trigger not wired from TaskList — forms exist but no "Edit" button on task rows | Enhancement | Next sprint |
| I3 | M1 progress: seeded as 100% but should verify 9/9 tasks are actually `done` in DB | Validation | This sprint |
| I4 | M2 progress: seeded as 71% — verify 5/7 tasks are `done`, 1 `in_progress`, 1 `not_started` | Validation | This sprint |

---

## Validation Results

- **Build**: ✅ `npx next build` passes with no errors
- **Progress calculation logic**: ✅ All 5 functions verified correct
- **Component imports**: ✅ All imports resolved correctly
- **i18n keys**: ✅ All keys present in en.json and es.json
- **Data fetching**: ✅ Server page fetches milestones + tasks for snapshot
- **Server actions**: ✅ Create/update milestone + create/update task + update task status all have Zod validation, org scoping, and audit logging