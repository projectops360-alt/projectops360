// ============================================================================
// Living Graph — Canonical-event Relationship Projection (CAP-045 extension)
// ============================================================================
// PURE module: no Supabase, no I/O, no side effects, no mutation of inputs.
// Builds the read-only event-relationship layer the Living Graph "events" view
// renders, from two inputs the loader supplies:
//   - rows from project_event_log (normalized to CanonicalEventLogRow)
//   - rows from project_event_objects (normalized to CanonicalEventObjectRow)
//
// Architectural contract (binding — see docs/product-brain/capabilities/...):
//   * project_event_log is the CANONICAL, append-only event store. This module
//     never copies events into process_nodes/process_edges and never persists
//     derived relationships. The output is a PROJECTION consumed in-memory by
//     the view only.
//   * Temporal adjacency ≠ causality. Temporal relationships (project_sequence
//     _next / object_sequence_next) encode ORDER only. A causal edge is emitted
//     ONLY when the source explicitly recorded it (caused_by). We NEVER infer
//     causality from temporal proximity.
//   * Nothing is invented: no events, no actors, no causes, no confidence, no
//     data-quality flags are synthesized. Fields absent from the log stay
//     null/empty. The `late_recorded` flag is derived from the RECORDED
//     occurred_at/recorded_at values only (not recalculated).
//   * Cross-project relationships are REJECTED (events from different projects
//     never link), so a projection is always single-project coherent.
//   * Inputs are never mutated. Output ids are deterministic, so the same
//     inputs always yield the same projection (retry-safe / cache-friendly).
// ============================================================================

import type {
  LivingGraphCanonicalEvent,
  LivingGraphEventRelationship,
  EventRelationshipType,
  EventRelationshipClass,
  EventRelationshipEvidence,
  CanonicalEventObjectRef,
  CanonicalEventObjectRole,
  CanonicalEventLifecycleClass,
  CanonicalEventActorType,
  CanonicalEventImportance,
  CanonicalEventCaptureMethod,
} from "@/types/living-graph";

// ── Input shapes (camelCase mirrors of the DB rows the loader selects) ───────

/** A project_event_log row, normalized to camelCase by the loader. */
export interface CanonicalEventLogRow {
  event_id: string;
  organization_id: string;
  project_id: string;
  event_category: string;
  event_type: string;
  event_schema_version: number | null;
  event_importance: string | null;
  event_lifecycle_class: string | null;
  subject_type: string | null;
  subject_id: string | null;
  actor_type: string | null;
  actor_id: string | null;
  occurred_at: string | null;
  recorded_at: string | null;
  sequence_number: number;
  source_module: string | null;
  source_entity_type: string | null;
  source_entity_id: string | null;
  from_state: string | null;
  to_state: string | null;
  caused_by: string[] | null;
  is_compensating_event: boolean | null;
  compensates_event_id: string | null;
  event_hash: string | null;
  previous_event_hash: string | null;
  provenance: Record<string, unknown> | null;
  confidence: number | null;
  payload: Record<string, unknown> | null;
  visibility: string | null;
}

/** A project_event_objects row, normalized to camelCase by the loader. */
export interface CanonicalEventObjectRow {
  event_id: string;
  object_type: string;
  object_id: string;
  role: string | null;
}

// ── Public result of the projection ───────────────────────────────────────────

export interface EventRelationshipProjection {
  /** Canonical events, 1:1 with the input log rows, ordered by sequence_number. */
  canonicalEvents: LivingGraphCanonicalEvent[];
  /** Deterministic relationships (temporal / causal / compensation / object-ref). */
  eventRelationships: LivingGraphEventRelationship[];
}

// ── Discrimination helpers (used by the view + analysis guards) ───────────────

/** True for a LivingGraphEdge (the operational process_edges projection). */
export function isExecutionRelationship(edge: {
  edgeType?: unknown;
  relationshipClass?: unknown;
}): boolean {
  // Operational edges carry an `edgeType` (ProcessEdgeType) and never a
  // `relationshipClass`. Event relationships are the inverse. This keeps the
  // operational analyses (critical path, bottleneck, cycles…) isolated by
  // construction: they only ever see execution edges.
  return edge != null && "edgeType" in edge && !("relationshipClass" in edge);
}

/** True for a LivingGraphEventRelationship (temporal/causal/compensation/object). */
export function isTemporalRelationship(rel: {
  relationshipClass?: unknown;
}): rel is LivingGraphEventRelationship {
  return (
    rel != null &&
    "relationshipClass" in rel &&
    (rel as { relationshipClass: unknown }).relationshipClass !== undefined
  );
}

/** True for a node that represents a canonical event (vs a process node). */
export function isCanonicalEventNode(node: {
  nodeType?: unknown;
  eventId?: unknown;
}): boolean {
  // Canonical-event nodes carry an `eventId` and use the dedicated `canonical_event`
  // node type. Process nodes carry a `nodeType` from ProcessNodeType and no `eventId`.
  return (
    node != null &&
    "eventId" in node &&
    (node as { eventId: unknown }).eventId != null
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** A recording is "late" when recorded_at lags occurred_at by more than this.
 *  Derived from the RECORDED values only — never recalculated. */
const LATE_RECORDED_THRESHOLD_MS = 60_000; // 60 s

const ALLOWED_LIFECYCLE_CLASSES: ReadonlySet<string> = new Set([
  "BUSINESS_EVENT",
  "SYSTEM_EVENT",
  "AI_EVENT",
  "DERIVED_EVENT",
  "EXTERNAL_EVENT",
  "SYNTHETIC_BACKFILL_EVENT",
]);

const ALLOWED_ACTOR_TYPES: ReadonlySet<string> = new Set([
  "human",
  "system",
  "ai",
  "external",
]);

const ALLOWED_IMPORTANCE: ReadonlySet<string> = new Set([
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
]);

const ALLOWED_OBJECT_ROLES: ReadonlySet<string> = new Set([
  "focal",
  "context",
  "evidence",
  "actor",
  "other",
]);

// ── Internal helpers (pure) ───────────────────────────────────────────────────

/** Deterministic id for a projected relationship. Same inputs ⇒ same id ⇒
 *  retry-safe and dedup-friendly. */
function relationshipId(
  projectId: string,
  type: EventRelationshipType,
  parts: string[],
): string {
  return [`evrel`, projectId, type, ...parts].join("::");
}

/** Stable hash (djb2, non-cryptographic) for deterministic dedup keys. */
function djb2(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0; // keep 32-bit
  }
  return (h >>> 0).toString(16);
}

function coerceLifecycleClass(
  v: string | null,
): CanonicalEventLifecycleClass | null {
  return v && ALLOWED_LIFECYCLE_CLASSES.has(v)
    ? (v as CanonicalEventLifecycleClass)
    : null;
}

function coerceActorType(v: string | null): CanonicalEventActorType | null {
  return v && ALLOWED_ACTOR_TYPES.has(v) ? (v as CanonicalEventActorType) : null;
}

function coerceImportance(v: string | null): CanonicalEventImportance | null {
  return v && ALLOWED_IMPORTANCE.has(v) ? (v as CanonicalEventImportance) : null;
}

function coerceObjectRole(v: string | null): CanonicalEventObjectRole | null {
  if (!v) return null;
  const lowered = v.toLowerCase();
  if (!ALLOWED_OBJECT_ROLES.has(lowered)) return null;
  // Unknown-but-present roles collapse to "other" rather than being dropped, so
  // the ref is still reachable; we never invent a role not in the contract.
  return (lowered as CanonicalEventObjectRole) ?? "other";
}

function coerceObjectRef(row: CanonicalEventObjectRow): CanonicalEventObjectRef | null {
  const role = coerceObjectRole(row.role);
  if (!row.object_type || !row.object_id) return null;
  return {
    object_type: row.object_type,
    object_id: row.object_id,
    role: role ?? "other",
  };
}

function captureMethodFromProvenance(
  provenance: Record<string, unknown> | null,
): CanonicalEventCaptureMethod | null {
  if (!provenance) return null;
  const v = provenance.capture_method;
  return typeof v === "string" && v.length > 0 ? v : null;
}

function dataQualityFlagsFromProvenance(
  provenance: Record<string, unknown> | null,
): string[] {
  if (!provenance) return [];
  const v = provenance.data_quality_flags;
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function parseTimeMs(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function lagMs(a: string | null, b: string | null): number | null {
  const ta = parseTimeMs(a);
  const tb = parseTimeMs(b);
  if (ta == null || tb == null) return null;
  return tb - ta;
}

// ── 1. Normalize project_event_log rows → canonical event view-models ─────────

function normalizeEvents(
  rows: readonly CanonicalEventLogRow[],
  objectsByEvent: Map<string, CanonicalEventObjectRef[]>,
): LivingGraphCanonicalEvent[] {
  return rows.map((row) => {
    const provenance = row.provenance ?? null;
    const occurred = row.occurred_at ?? null;
    const recorded = row.recorded_at ?? null;
    const lag = lagMs(occurred, recorded);
    const lateRecorded = lag != null && lag > LATE_RECORDED_THRESHOLD_MS;
    return {
      eventId: row.event_id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      eventType: row.event_type,
      eventCategory: row.event_category,
      eventSchemaVersion: row.event_schema_version ?? null,
      eventImportance: coerceImportance(row.event_importance ?? null),
      lifecycleClass: coerceLifecycleClass(row.event_lifecycle_class ?? null),
      subjectType: row.subject_type ?? null,
      subjectId: row.subject_id ?? null,
      actorType: coerceActorType(row.actor_type ?? null),
      actorId: row.actor_id ?? null,
      occurredAt: occurred,
      recordedAt: recorded,
      sequenceNumber: row.sequence_number,
      sourceModule: row.source_module ?? null,
      sourceEntityType: row.source_entity_type ?? null,
      sourceEntityId: row.source_entity_id ?? null,
      fromState: row.from_state ?? null,
      toState: row.to_state ?? null,
      causedBy: Array.isArray(row.caused_by) ? [...row.caused_by] : [],
      isCompensatingEvent: row.is_compensating_event === true,
      compensatesEventId: row.compensates_event_id ?? null,
      eventHash: row.event_hash ?? null,
      previousEventHash: row.previous_event_hash ?? null,
      provenance,
      confidence: row.confidence ?? null,
      payload: row.payload ?? null,
      visibility: row.visibility ?? null,
      objectRefs: objectsByEvent.get(row.event_id) ?? [],
      dataQualityFlags: dataQualityFlagsFromProvenance(provenance),
      captureMethod: captureMethodFromProvenance(provenance),
      lateRecorded,
    };
  });
}

// ── 2. Group project_event_objects by event_id (no mutation of input) ─────────

function groupObjectsByEvent(
  rows: readonly CanonicalEventObjectRow[],
): Map<string, CanonicalEventObjectRef[]> {
  const map = new Map<string, CanonicalEventObjectRef[]>();
  for (const row of rows) {
    const ref = coerceObjectRef(row);
    if (!ref) continue;
    const list = map.get(row.event_id);
    if (list) list.push(ref);
    else map.set(row.event_id, [ref]);
  }
  return map;
}

// ── 3-7. Build the five relationship types ───────────────────────────────────

interface BuildContext {
  projectId: string;
  events: LivingGraphCanonicalEvent[];
  byEventId: Map<string, LivingGraphCanonicalEvent>;
  bySequence: LivingGraphCanonicalEvent[]; // ordered by sequence_number asc
  seen: Set<string>; // deterministic dedup
  out: LivingGraphEventRelationship[];
}

function addRel(ctx: BuildContext, rel: LivingGraphEventRelationship): void {
  if (ctx.seen.has(rel.id)) return; // deterministic dedup
  ctx.seen.add(rel.id);
  ctx.out.push(rel);
}

/** 3. project_sequence_next — adjacent events in the project's authoritative
 *     sequence (order ONLY, never causality). */
function buildProjectSequenceNext(ctx: BuildContext): void {
  const { projectId, bySequence, seen, out } = ctx;
  for (let i = 0; i < bySequence.length - 1; i++) {
    const a = bySequence[i];
    const b = bySequence[i + 1];
    // Cross-project guard (defensive — the loader already scopes by project).
    if (a.projectId !== projectId || b.projectId !== projectId) continue;
    addRel(ctx, {
      id: relationshipId(projectId, "project_sequence_next", [a.eventId, b.eventId]),
      projectId,
      sourceEventId: a.eventId,
      targetEventId: b.eventId,
      objectId: null,
      relationshipType: "project_sequence_next",
      relationshipClass: "temporal",
      objectType: null,
      objectRole: null,
      sequenceDistance: b.sequenceNumber - a.sequenceNumber,
      occurredLagMs: lagMs(a.occurredAt, b.occurredAt),
      evidence: "deterministic_projection",
      metadata: {},
    });
  }
  void seen; void out;
}

/** 4. object_sequence_next — adjacent events that share the SAME focal object
 *     (by object_type+object_id), again ORDER ONLY. Events touching DIFFERENT
 *     objects are never connected by object sequence. */
function buildObjectSequenceNext(ctx: BuildContext): void {
  const { projectId, events, byEventId } = ctx;
  // Index: object_key -> events touching it (preserving sequence order).
  const byObject = new Map<string, LivingGraphCanonicalEvent[]>();
  for (const e of events) {
    for (const ref of e.objectRefs) {
      // Only FOCAL refs define an object's own timeline; context/evidence refs
      // are secondary and must not create object-sequence edges (spec: object
      // sequence is per object identity, visualized as secondary).
      if (ref.role !== "focal") continue;
      const key = `${ref.object_type}::${ref.object_id}`;
      const list = byObject.get(key);
      if (list) list.push(e);
      else byObject.set(key, [e]);
    }
  }
  for (const [, list] of byObject) {
    // Already in sequence order (events are pre-sorted); sort defensively.
    list.sort((x, y) => x.sequenceNumber - y.sequenceNumber);
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i];
      const b = list[i + 1];
      if (a.projectId !== projectId || b.projectId !== projectId) continue;
      addRel(ctx, {
        id: relationshipId(projectId, "object_sequence_next", [
          a.eventId,
          b.eventId,
          djb2(`${a.objectRefs.find((r) => r.role === "focal")?.object_type ?? ""}:${a.objectRefs.find((r) => r.role === "focal")?.object_id ?? ""}`),
        ]),
        projectId,
        sourceEventId: a.eventId,
        targetEventId: b.eventId,
        objectId: null,
        relationshipType: "object_sequence_next",
        relationshipClass: "temporal",
        objectType: a.objectRefs.find((r) => r.role === "focal")?.object_type ?? null,
        objectRole: "focal",
        sequenceDistance: b.sequenceNumber - a.sequenceNumber,
        occurredLagMs: lagMs(a.occurredAt, b.occurredAt),
        evidence: "deterministic_projection",
        metadata: {},
      });
    }
  }
  void byEventId;
}

/** 5. caused_by — a causal edge ONLY when the source explicitly recorded it.
 *     Never inferred from temporal proximity. */
function buildCausedBy(ctx: BuildContext): void {
  const { projectId, events, byEventId } = ctx;
  for (const e of events) {
    if (!e.causedBy || e.causedBy.length === 0) continue;
    for (const causeId of e.causedBy) {
      const cause = byEventId.get(causeId);
      if (!cause) continue; // cause not in the recovered set → no edge (no invention)
      if (cause.projectId !== projectId || e.projectId !== projectId) continue; // cross-project rejected
      addRel(ctx, {
        id: relationshipId(projectId, "caused_by", [causeId, e.eventId]),
        projectId,
        sourceEventId: causeId,
        targetEventId: e.eventId,
        objectId: null,
        relationshipType: "caused_by",
        relationshipClass: "causal",
        objectType: null,
        objectRole: null,
        sequenceDistance: e.sequenceNumber - cause.sequenceNumber,
        occurredLagMs: lagMs(cause.occurredAt, e.occurredAt),
        evidence: "explicit",
        metadata: { recorded_cause: true },
      });
    }
  }
}

/** 6. compensates — a compensation edge from compensates_event_id. */
function buildCompensates(ctx: BuildContext): void {
  const { projectId, events, byEventId } = ctx;
  for (const e of events) {
    if (!e.isCompensatingEvent || !e.compensatesEventId) continue;
    const original = byEventId.get(e.compensatesEventId);
    if (!original) continue;
    if (original.projectId !== projectId || e.projectId !== projectId) continue;
    addRel(ctx, {
      id: relationshipId(projectId, "compensates", [e.eventId, e.compensatesEventId]),
      projectId,
      sourceEventId: e.eventId,
      targetEventId: e.compensatesEventId,
      objectId: null,
      relationshipType: "compensates",
      relationshipClass: "compensation",
      objectType: null,
      objectRole: null,
      sequenceDistance: e.sequenceNumber - original.sequenceNumber,
      occurredLagMs: lagMs(original.occurredAt, e.occurredAt),
      evidence: "explicit",
      metadata: { recorded_compensation: true },
    });
  }
}

/** 7. relates_to_object — event↔object reference edges (secondary). Conserves
 *     object_type/object_id/role straight from project_event_objects. */
function buildRelatesToObject(ctx: BuildContext): void {
  const { projectId, events } = ctx;
  for (const e of events) {
    if (e.projectId !== projectId) continue;
    for (const ref of e.objectRefs) {
      addRel(ctx, {
        id: relationshipId(projectId, "relates_to_object", [
          e.eventId,
          ref.object_type,
          ref.object_id,
          ref.role,
        ]),
        projectId,
        sourceEventId: e.eventId,
        targetEventId: null,
        objectId: ref.object_id,
        relationshipType: "relates_to_object",
        relationshipClass: "object_reference",
        objectType: ref.object_type,
        objectRole: ref.role,
        sequenceDistance: 0,
        occurredLagMs: null,
        evidence: "deterministic_projection",
        metadata: {},
      });
    }
  }
}

// ── 9-11. Dedup, cross-project rejection, no-mutation are structural ──────────
// 9.  Dedup is structural: every relationship id is deterministic and `addRel`
//     refuses duplicates via `seen`. The same inputs always produce the same
//     set (retry-safe).
// 10. Cross-project rejection is structural: every builder guards
//     `a.projectId !== projectId` and skips. The projection is single-project.
// 11. No mutation is structural: inputs are `readonly` and only spread/copied
//     (e.g. `[...row.caused_by]`); no input row is written to.

// ── Public entry point ─────────────────────────────────────────────────────────

/**
 * Build the canonical-event relationship projection from normalized log + object
 * rows. PURE: deterministic, no I/O, no mutation of inputs.
 *
 * @param logRows  project_event_log rows (any order; re-sorted by sequence).
 * @param objectRows project_event_objects rows (any order; grouped by event_id).
 * @param projectId the project this projection is scoped to. Rows belonging to
 *                  other projects are REJECTED (cross-project links never form).
 */
export function projectEventRelationships(
  logRows: readonly CanonicalEventLogRow[],
  objectRows: readonly CanonicalEventObjectRow[],
  projectId: string,
): EventRelationshipProjection {
  if (!projectId) {
    return { canonicalEvents: [], eventRelationships: [] };
  }

  // Defensive copy + scope + sort by the authoritative sequence_number.
  const scoped = logRows.filter((r) => r.project_id === projectId);
  const sorted = [...scoped].sort(
    (a, b) => a.sequence_number - b.sequence_number,
  );

  const objectsByEvent = groupObjectsByEvent(objectRows);
  const events = normalizeEvents(sorted, objectsByEvent);
  const byEventId = new Map<string, LivingGraphCanonicalEvent>(
    events.map((e) => [e.eventId, e]),
  );

  const ctx: BuildContext = {
    projectId,
    events,
    byEventId,
    bySequence: events, // already sorted ascending
    seen: new Set<string>(),
    out: [],
  };

  buildProjectSequenceNext(ctx);
  buildObjectSequenceNext(ctx);
  buildCausedBy(ctx);
  buildCompensates(ctx);
  buildRelatesToObject(ctx);

  return { canonicalEvents: events, eventRelationships: ctx.out };
}