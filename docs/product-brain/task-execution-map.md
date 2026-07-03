# Task Execution Map / Mapa de Ejecución de la Tarea (Subtasks)

> **Module doc.** Granular execution control inside ONE task: structured
> subtasks with **calculated parent progress**, visualized as an execution
> mind map (not a checklist, not only a table). The Living Graph remains the
> project-level visualization; this map is the task-level drill-down.
> Guards: **SUBTASK-PROGRESS** + **TASK-EXECUTION-MAP** (regression-test-map).

## 1. Purpose

PMs/PMOs must understand not only *what* subtasks exist but *why* a task is
moving, blocked, delayed, or at risk — explainable, auditable, visual, and
connected to Isabella and the event pipeline. Progress must be justifiable in
daily meetings from records, never from vibes.

## 2. Data model

`public.task_subtasks` (migration `20260834000000_task_subtasks.sql`):
id · task_id → roadmap_tasks · project_id · organization_id (tenant/workspace
scope) · title · description · status · priority · owner_id · start_date ·
due_date · completed_at · estimated_hours · actual_hours · weight · progress ·
is_critical · blocked_reason · blocked_at · sort_order · created_by ·
updated_by · created_at · updated_at · deleted_at (soft delete). RLS: org
members read; writes only through the audited server actions (service role).

Additive columns on `roadmap_tasks`: `subtask_progress_mode`
(auto|count|weighted|hours), `progress_overridden`, `progress_override_reason`.

**Statuses:** `not_started · in_progress · blocked · in_review · completed ·
cancelled`.

## 3. Parent progress rules (engine: `src/lib/subtasks/progress.ts`)

- **count**: completed / total_active. **weighted**: Σ(weight·progress)/Σweight.
  **hours**: Σ(est_hours·progress)/Σest_hours. **auto** = hours → weighted → count.
- Fallbacks: weighted without valid weights → count; hours without valid
  estimates → weighted → count (reason disclosed in the breakdown panel).
- **Cancelled subtasks never count**; **completed always = 100%**;
  **not_started = 0%**.
- **A task with no (active) subtasks returns `null`** — the existing manual
  task progress behavior is preserved, never overwritten.
- With subtasks, the parent's `roadmap_tasks.progress` is recalculated after
  every subtask mutation and the change is recorded
  (`ParentTaskProgressRecalculated`, old→new + mode).
- **Manual override** requires an authorized role + reason, pauses auto-recalc
  (`progress_overridden`), and is audited (`ParentTaskProgressOverride`).
- **Close gate**: a parent cannot close while active subtasks are incomplete
  unless an authorized user confirms with a reason (audited).
- Parent signals: blocked count, overdue count, `criticalAtRisk` (a
  critical-path subtask blocked or overdue — the map shouts it).

## 4. Events (Canonical Event Taxonomy — additive)

`SubtaskCreated/Updated/Started/Completed/Blocked/Unblocked/Reassigned/
DueDateChanged/EstimateChanged/ProgressChanged/Deleted` +
`ParentTaskProgressRecalculated` + `ParentTaskProgressOverride`, registered in
`events/registry.ts` and emitted via the Event Ingestion Service
(`emitProjectEventSafe`) with actor, org, project, task_id, subtask_id,
old/new values and reason. They land in `project_event_log`, which feeds the
Living Graph Realtime Engine pipeline (LGRE) and Isabella. `SubtaskBlocked`
carries the required `impediment` payload. All mutations also write the audit
log (`logAudit`).

## 5. Execution Map UX (`src/components/task-execution-map/`)

- Parent task = central node (title, calculated %, bar, status badge, owner,
  done/blocked/overdue counters, est/actual/variance hours, critical badge).
- Subtasks branch out (title, %, status badge with text+icon, owner initials,
  due date, weight/hours, critical/overdue indicators; completed/cancelled
  render muted; cancelled excluded from active math).
- Blockers = red alert nodes attached to the affected subtask (reason, age,
  owner, impact, affects-critical-path). Dependencies = dotted-edge nodes.
- Interactions: zoom/pan/fit (React Flow), center selected, search, filters
  (status/owner/blocked/overdue/critical), grouping (status/owner/priority;
  phase-ready), three layouts (radial/hierarchical/left-to-right), automatic
  status-grouping above 24 visible nodes (clutter/performance control), click
  → right detail panel with operational actions (edit/complete/block-with-
  required-reason/unblock/reassign/due date/progress) and Ask Isabella.
- **Views:** Execution Map (primary) + Table/List (fast editing fallback) at
  `/projects/[projectId]/tasks/[taskId]`. Entry points: Workboard card link +
  card subtask badges + board header blocked/overdue chips (additive — never
  changes Workboard status semantics, counts, or layout; UX-013 respected).
- Accessibility: every status has text + icon (never color alone); inputs are
  labeled; the table fallback remains.

## 6. Isabella (PD-012 pattern)

`buildTaskExecutionFacts` (pure, EN/ES) produces DETERMINISTIC record-backed
facts — calculated progress + mode, blocked list (reason/age/owner/critical),
overdue list, cancelled exclusions, hour variance, recorded progress movement
(why 40%→60%), per-subtask one-liners, and a deterministic recommended focus
(blocked+critical → oldest blocker → most overdue). `askLivingGuideAction`
stamps them server-side into `context.executionFacts` when the ask is about a
task/subtask (client-supplied ids are lookup keys only; ownership re-validated
in `src/lib/subtasks/service.ts`). Isabella must use these verbatim.

## 7. RBAC

`authorizeSubtaskAction` (pure, deny-by-default): owner/admin = everything;
member = create + own work only (subtask owner or task assignee); viewer =
read-only. **Restricted** (owner/admin only, always audited): delete, parent
progress override, close parent with incomplete subtasks. Server actions
re-check on every call; org/project scoping on every query.

## 8. Guardrails

- Not a checklist; not decorative — every visual flag maps to a record.
- The current task system is untouched: tasks without subtasks behave exactly
  as before (engine returns null; guarded by test).
- No canonical-truth bypass: writes go through audited actions; events through
  the ingestion service; `process_nodes`/`process_edges` untouched.
- i18n EN/ES complete (`taskExecutionMap` + `workboard.subtasks` namespaces —
  UX-012 parity).

## 9. Known limitations (honest)

- Migration `20260834000000` pending prod application (UI degrades safely:
  empty subtask lists, no crashes).
- Timeline/recent-events/linked meetings/files sections in the detail panel
  are represented by the audit/event trail and Isabella facts; dedicated panel
  sections are a follow-up.
- `phase` grouping is wired in the model (sprintOf hook) but the page does not
  yet supply sprint data.
- Keyboard navigation inside the canvas is limited to React Flow defaults;
  the table view is the fully keyboard-accessible path.
