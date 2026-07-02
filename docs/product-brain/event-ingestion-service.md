# Event Ingestion Service (Phase 2 — Event Log Foundation)

> The single, controlled, server-side gateway for writing canonical project events into
> `project_event_log` (the Project Event Graph ledger). **No module writes to the table directly.**
> Additive and non-breaking: `process_nodes` / `process_edges` and `emit-event` are untouched. See the
> [Product Constitution](00-product-constitution.md) §4/§16.

## Architecture
```
producers (server actions, emit-event dual-write, engines)
        │  emitProjectEvent(input)  /  emitProjectEventSafe(input)
        ▼
Event Ingestion Service  (src/lib/events/ingestion.ts)
  ├─ validateProjectEvent   → registry + payload + evidence + AI + compensation checks
  ├─ normalizeProjectEvent  → fills importance/lifecycle/schemaVersion/tags/dedupKey from registry
  ├─ generateProjectionInvalidationTags
  ├─ next_project_event_seq (RPC, atomic per project)
  ├─ computeEventHash / previous_event_hash  (tamper-evident chain, best-effort)
  └─ insert (admin/service_role only) → project_event_log   [append-only, immutable]
```
Registry (closed vocabulary): `src/lib/events/registry.ts`. Table + sequence + immutability + RLS:
migration `20260830000000_project_event_log.sql`.

## Producer guide
Call the service, never insert directly:
```ts
import { emitProjectEvent, emitProjectEventSafe } from "@/lib/events/ingestion";
emitProjectEventSafe({
  organizationId, projectId, eventType: "TaskStatusChanged",
  subjectId: taskId, actorType: "human", actorId: userId,
  sourceModule: "roadmap", sourceEntityType: "roadmap_tasks", sourceEntityId: taskId,
  fromState: "in_progress", toState: "done",
});
```
- `emitProjectEventSafe` = fire-and-forget (never throws; logs failures; HIGH/CRITICAL log at error level).
- `emitProjectEvent` = awaitable, returns `{ ok, eventId, deduped, error, errors }`.
- `emitProjectEvents(batch)` and `emitCompensatingEvent({..., compensatesEventId})`.

## Validation rules (enforced before write)
event_type ∈ registry · past-tense name · not EPHEMERAL_EXCLUDED · org/project/sourceModule present ·
actor_type valid · subject_id present when required · required payload fields present · payload never
duplicates envelope fields · visibility/permission_scope valid · **HIGH/CRITICAL require evidence**
(provenance.evidenceRefs | provenance.evidence | source_entity_id) · **AI events require provenance +
confidence** · compensating events must reference a prior event · invalidation tags always generated.

## Governance
No event outside the registry · names past-tense · `event_schema_version` on every event (breaking
payload change → new version; old events stay readable) · corrections = compensating events (never
edits; the DB blocks UPDATE/DELETE) · AI/derived/external events carry provenance (+ confidence for AI)
· importance comes from the registry unless an authorized producer overrides it (recorded in
`provenance.importanceOverride`) · no UI telemetry (EPHEMERAL_EXCLUDED) ever enters the log.

## Dual-write behavior
`emit-event.ts` (`emitAndAutoLink`) now **also** records a canonical event via the bridge
(`src/lib/events/dual-write.ts`, `mapProcessNodeToEvent`): task_transition→TaskStatusChanged,
milestone_gate→MilestoneStarted, decision_cascade→DecisionProposed, communication_flow→
CommunicationSent. This is best-effort and **fire-and-forget** — the existing Living Graph pipeline is
never affected. Unmapped node types are skipped.

## Failure behavior (early rollout)
If the event-log write fails, existing behavior continues. Failures are logged; HIGH/CRITICAL failures
log at error level so they are observable and not silently lost. The tamper-evident `previous_event_hash`
is best-effort: if unavailable it is `null` (documented fallback), never blocking ingestion.

## How to add a new event type
1. Add an entry to `EVENT_REGISTRY` in `src/lib/events/registry.ts` (past-tense name, category,
   subjectType, importance, retention, lifecycleClass, requiredPayload, invalidationScopes).
2. Ensure the name passes `isPastTenseName` (a test asserts this for every key).
3. Emit it through `emitProjectEvent` / `emitProjectEventSafe` from the owning module.
4. Breaking payload change → bump `event_schema_version` at emit; keep validators version-aware.

## Compensating events (corrections)
Never edit or delete an event. Emit a new event of the same type with
`emitCompensatingEvent({ ..., compensatesEventId })`. Compensating events are not deduped and must
reference a real prior event.

## Idempotency & ordering
`dedup_key` (stable hash of project + type + source + occurred_at + payload) + a unique index make
re-emission a no-op (returns the existing event). `sequence_number` is monotonic per project via
`next_project_event_seq` (counter + upsert); `global_seq` gives total ingestion order.
