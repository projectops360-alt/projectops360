# Historical Backfill Service (Phase 2 — Event Log Foundation)

> Reconstructs historical project events from existing canonical owners and records them in
> `project_event_log` as **synthetic backfill events**, giving the Project Event Graph historical
> memory. Safe, idempotent, evidence- and confidence-aware. **Does not invent history**, does not touch
> `process_nodes` / `process_edges`, and does not replace the dual-write path. See the
> [Product Constitution](00-product-constitution.md) §4/§16 and the
> [Event Ingestion Service](event-ingestion-service.md).

## What it does
Owner rows → deterministic **mappers** → backfill events (`event_lifecycle_class =
SYNTHETIC_BACKFILL_EVENT`, `provenance.backfilled = true`, reduced confidence) → **Event Ingestion
Service** (validated + idempotent). Entry point: `backfillProject(projectId, organizationId, { dryRun })`
in `src/lib/events/backfill.ts`.

## Supported backfill sources (initial, safest high-value)
| Source | Events | Explicit / Inferred | Confidence |
|---|---|---|---|
| `projects` | ProjectCreated | explicit (created_at) | 0.9 |
| `milestones` | MilestoneCreated · MilestoneAchieved (if completed) | explicit · inferred | 0.9 · 0.6 |
| `roadmap_tasks` | TaskCreated · TaskAssigned (if assignee) · TaskCompleted (if terminal) | explicit · inferred · inferred | 0.9 · 0.6 · 0.6 |
| `task_dependencies` | TaskDependencyAdded | explicit (created_at) | 0.9 |
| `decisions` | DecisionProposed | explicit | 0.9 |
| `documents` | DocumentUploaded | explicit | 0.9 |
| `drawing_files` | DrawingUploaded | explicit | 0.9 |

Missing tables/columns (e.g. estrato C: risks/budget/issues owners) are reported as **unsupported**, not
fatal. Not backfilled by design: TaskStarted, TaskPaused, BlockerRaised, ApprovalDelayed and any
transition without evidence (**do not invent history**).

## Confidence rules
`EXPLICIT_AUDIT = 1.0` (explicit history record — not used yet) · `OWNER_TIMESTAMP = 0.9` (record
`created_at`) · `INFERRED_CURRENT_STATE = 0.6` (inferred from current status/assignee; exact time
unknown). Ambiguous reconstruction → not backfilled. AI-generated historical inference → not backfilled.

## Provenance (every backfilled event)
```json
{ "backfilled": true, "source_table": "...", "source_record_id": "...", "source_field": "...",
  "inference_method": "...", "confidence_reason": "...", "backfilled_at": "...", "backfill_batch_id": "..." }
```
The Ingestion Service **rejects** any `SYNTHETIC_BACKFILL_EVENT` missing `provenance.backfilled = true`
or `confidence`.

## Idempotency
The dedup key includes a **backfill marker** (distinct from live-captured events) and the source record
identity + `occurred_at` + payload hash — but NOT the batch id — so re-running maps the same record to the
same key. Re-runs create no duplicate events (existing rows returned, counted as *skipped*). The unique
dedup index enforces this at the DB level.

## Sequence & hash chain
Backfilled events are **appended**: `sequence_number` is assigned by `next_project_event_seq` in ingestion
order (they get higher sequence numbers than pre-existing live events). **Business time is preserved in
`occurred_at`** — chronological replay uses `occurred_at`; `sequence_number` is ingestion order. Within a
batch, events are emitted sorted by `occurred_at` → source → subject → type. `previous_event_hash` chains
to the current project tail (best-effort); this is documented, not a strict chronological chain for
backfilled history.

## Batch model & report
Each run returns a `BackfillReport` (`backfillBatchId`, started/completed, status, sourceModulesProcessed,
eventsCreated/Skipped/Failed, byType, confidenceDistribution {high/medium/low}, unsupportedSources,
warnings, errorSummary) and emits a real `BackfillCompleted` system event for audit. No new table is
required (lightweight in-memory report + the audit event).

## Error handling
Per-record validation + emit failures are counted and reported; the batch continues (a single bad record
never rolls back the batch). Missing source tables → warning + unsupported. The service only reads owners
and writes to `project_event_log`; existing data is never modified.

## How to run backfill safely
Call from a trusted server context (server action / script), e.g.:
```ts
import { backfillProject } from "@/lib/events/backfill";
const report = await backfillProject(projectId, organizationId, { dryRun: true }); // preview
const done   = await backfillProject(projectId, organizationId);                    // execute (idempotent)
```
Run `dryRun` first to preview counts; execute when satisfied. Re-running is safe (idempotent).

## How Isabella should treat backfilled events
Backfilled events are **synthetic reconstructions**, not live-captured facts. Isabella may say history was
reconstructed where evidence existed, that these events are marked synthetic, and that inferred events
carry reduced confidence. Isabella must **not** claim all history is complete, that all transitions are
known, that inferred events are certain, or that backfilled events equal real-time captured events. She
must surface `confidence` and the `backfilled` provenance when reasoning over them.
