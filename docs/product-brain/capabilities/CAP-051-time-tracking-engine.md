# CAP-051 — Time Tracking Engine

**Status:** Implemented in DEV (2026-07-28) — not merged, not deployed
**Migration:** `20260870000000_subtask_time_entries.sql` (applied to Stage `gcxcljfzleasrleyyyda`)
**Surfaces:** subtask modal (Time log tab) · subtask card · Task Execution report · project dashboard
**Guards:** `SUBTASK-ACTUAL-HOURS-DERIVED` · `TIME-TRACKING-RBAC` · `TIME-TRACKING-REPORT-ACTUAL-HOURS`

Records what work actually cost, so every downstream number stops being a guess.

---

## 1. The one decision everything else follows from

**Actual hours are never a field. They are a SUM.**

`subtask_time_entries` holds one row per logged interval, and actual effort is
always `SUM(duration_hours)` over it. There is no input anywhere in the product
that writes an actual-hours total — the field that used to exist in the subtask
modal was removed.

That is the whole capability. Everything below is a consequence:

- an actual-hours number can always be traced to *who* logged it, *when*, and
  *what they say they did*;
- Actual Cost cannot be edited after the fact to make a report look better;
- utilisation, burn rate, CPI/SPI and billing all read the same rows instead of
  each maintaining their own idea of effort.

### The derived cache, and why it is not duplication

`task_subtasks.actual_hours` still exists, but it is now a **derived cache**
written only by this engine after every change. It stays because the parent
progress engine, the execution map and the report already read it, and forcing a
join into each of those paths would have bought nothing.

The distinction that matters: the cache can always be rebuilt from the entries;
the entries can never be rebuilt from the cache. One is the record, the other is
a convenience. Nothing outside `src/lib/time-tracking/service.ts` may write it.

---

## 2. Data model

```
subtask_time_entries
  organization_id, project_id, task_id      -- always present
  subtask_id                                -- NULL = logged on the task itself
  user_id                                   -- whose effort this is
  created_by                                -- who typed it in (a PM may log for someone)
  work_date, start_time, end_time, duration_hours
  comment, source (manual|timer|import|api)
  deleted_at                                -- soft delete: AC history stays auditable
```

Three deliberate choices:

- **`subtask_id` is nullable.** Time is anchored to a task *always*, to a subtask
  *when there is one*. Task-level and (later) activity-level logging need no
  second table and no migration.
- **`user_id` ≠ `created_by`.** A PM logging on behalf of a team member must not
  silently become the person who did the work — attribution is what makes
  utilisation and billing mean anything.
- **The grain is (person, day, interval, work item).** Every metric in section 6
  is an aggregation over that grain, so nothing above ever needs to store hours
  again.

Constraints are enforced in the database, not just the form: `0 < duration ≤ 24`,
start and end travel together or not at all, and an interval must move forward in
time.

---

## 3. Duration: two ways in, one number out

The user either gives an interval (09:00 → 12:30) or a duration (3.5). If both
are present the **interval wins**, because it is the more specific claim.

`09:00 → 08:00` is **rejected**, not wrapped past midnight. A backwards interval
is a typo far more often than a 23-hour night shift, and guessing would quietly
corrupt Actual Cost.

---

## 4. Permissions

| Action | Who |
|---|---|
| Log | Admin/PM (org manager), or whoever is responsible for the work (subtask owner, or assignee of the parent task) |
| Log **for someone else** | Managers only |
| Edit | The author of the entry, or a manager |
| Delete | Managers only |
| Read | Any org member — logged time is team information |

Deleting effort erases Actual Cost history, which is why it is never a
contributor-level action. Deletes are soft, so the trail survives.

---

## 5. Two alert scales, on purpose

The product asked for two different colour rules, and they are genuinely
different questions:

| Scale | Warning | Over | Critical | Why |
|---|---|---|---|---|
| **Subtask** | 90% | >100% | >120% | Catch the overrun *while the work is still in flight* |
| **Project / aggregate** | 100% | >100% | >120% | Across a whole project, 95% of budget is normal, not news |

A subtask at 95% is amber; a project at 95% is green. That is not an
inconsistency — a single item warns early so somebody can act, an aggregate
warns only once the estimate is actually passed.

When a subtask's total **crosses** its estimate, the engine emits
`EffortBudgetExceeded` and writes a project memory item (where Isabella reads).
It fires on the transition only: logging more time on an already-over subtask
does not re-alert on every entry.

---

## 6. What this is the spine for

Everything below is an aggregation over `subtask_time_entries`, with no new
storage of hours:

| Next capability | Reads |
|---|---|
| **AC (Actual Cost)** | `SUM(duration_hours)` per work item |
| **CPI / SPI / ETC / EAC / VAC** | AC + the existing estimates and progress |
| **Burn rate** | `SUM` grouped by `work_date` |
| **Resource utilisation / capacity** | `SUM` grouped by `user_id` × `work_date` |
| **Timesheets** | The rows themselves, filtered by person and period |
| **Hourly cost / billing** | `duration_hours` × a rate resolved per person or role |
| **Process Mining** | `TimeLogged` events in the canonical Project Event Graph |
| **Isabella's learning engine** | Estimate vs actual per trade/discipline over time |

Hourly rates are deliberately **not** in this table: a rate belongs to a person
or a role over a period, not to an interval. Storing it per entry would freeze
one number into thousands of rows and make a rate correction a data migration.

---

## 7. Canonical events

`TimeLogged` · `TimeEntryUpdated` · `TimeEntryDeleted` (AUDIT retention — these
rows *are* the Actual Cost record) and `EffortBudgetExceeded` (derived).

Milestone Flow semantics: logged time carries **no transition signal**. Hours can
pile up on a subtask that is going nowhere, so effort is evidence that work
*happened*, not that it *advanced*. Only the budget overrun speaks to health.

---

## 8. Where the numbers surface

| Surface | Shows |
|---|---|
| Subtask modal → **Time log** tab | Estimated / Actual / Remaining (read-only), effort bar, full history with edit + delete |
| Subtask modal → Details | Actual hours as read-only text, plus a shortcut to the time log |
| Subtask card | `Estimated 40 h · Actual 26 h`, coloured once at risk |
| Task Execution report | `Actual Hours` (log, falling back to the legacy manual value only when nothing is logged) and `Logged Hours` (the log alone) |
| Project dashboard | Estimated · Actual · Remaining · Variance |

**Report fallback (recorded decision).** A task *with* logged time never reads
`roadmap_tasks.actual_hours`. A task *without* any logged time keeps showing the
value captured before this engine existed, so no historical report silently
drops to zero. `Logged Hours` always shows the log alone, with no fallback, for
anyone who wants the unmixed number.

Project estimated hours prefer **subtask** estimates when a task has subtasks —
counting both would double-count the same work.

---

## 9. Known limits

1. **No stopwatch.** `source` already distinguishes `timer`, but nothing writes it.
2. **No approval workflow.** Entries are live the moment they are saved; there is
   no submit/approve cycle, which a formal timesheet product would need.
3. **No per-entry cost.** By design (section 6) — rates arrive with the billing
   capability.
4. **Task-level logging is modelled but not exposed.** `subtask_id` may be NULL
   and the report already sums those rows into the task, but no UI writes them yet.
5. **Overlapping entries are allowed.** Two entries covering 09:00–12:00 on the
   same day are not detected; catching that needs a per-person daily view.
