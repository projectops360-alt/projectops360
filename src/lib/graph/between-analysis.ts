// ============================================================================
// Living Graph — "What happened between?" analysis (CAP-045 §C.2 / Part C)
// ============================================================================
// PURE module: no Supabase, no I/O, no side effects, no mutation of inputs.
// Mirrors the discipline of `event-relationship-projection.ts`.
//
// Given two endpoints (milestones / tasks / process nodes / canonical events)
// in ONE project, `analyzeBetween` answers "what happened between these two
// points?" by combining the two layers the Living Graph already holds:
//   * the OPERATIONAL layer (process_nodes / process_edges) → the recorded
//     dependency path between the endpoints;
//   * the CANONICAL layer (project_event_log + project_event_objects) → the
//     real, ordered history of events that occurred between them.
//
// Architectural contract (binding):
//   * Temporal order ≠ causality. `temporalRelationships` encode ORDER only.
//     `explicitCausalRelationships` are emitted ONLY from relationships whose
//     `relationshipClass === "causal"` (i.e. caused_by recorded explicitly). We
//     NEVER infer causality from proximity.
//   * Nothing is invented: no events, no actors, no causes, no confidence. If
//     an endpoint has no canonical history, that is declared as a limitation —
//     `updated_at` is NEVER substituted for `occurred_at`.
//   * Cross-project endpoints are REJECTED. A between-analysis is always
//     single-project coherent.
//   * occurred_at (business time) and recorded_at (recording time) are kept
//     SEPARATE. `elapsedBusinessMs` is the wall-clock span between the
//     occurred_at bounds; `recordedElapsedMs` is the span between the
//     recorded_at bounds. The wall-clock nature is declared in `limitations`.
//   * Inputs are never mutated. Output is deterministic (idempotent).
//   * This analysis READS both layers but never FEEDS the operational analyses
//     (critical path / bottleneck / cycles / milestone metrics). It is isolated
//     by construction: it only ever consumes the readonly inputs supplied.
// ============================================================================

import type {
  LivingGraphNode,
  LivingGraphEdge,
  LivingGraphCanonicalEvent,
  LivingGraphEventRelationship,
  CanonicalEventObjectRef,
} from "@/types/living-graph";

// ── Endpoints ──────────────────────────────────────────────────────────────────

/** Kind of endpoint the user picked. Drives how sequence bounds are resolved. */
export type BetweenEndpointKind =
  | "milestone"
  | "task"
  | "process_node"
  | "canonical_event";

/** One of the two endpoints of a between-analysis. */
export interface BetweenEndpoint {
  /** Operational node id (milestone/task/process node) OR `ev:<eventId>` for a
   *  canonical-event endpoint. */
  nodeId: string;
  /** Display label (resolved by the view; passed through for the panel). */
  label: string;
  kind: BetweenEndpointKind;
  /** For milestone/task endpoints: the source entity id (roadmap id). */
  sourceEntityId?: string | null;
  /** For canonical_event endpoints: the event id. */
  eventId?: string | null;
}

// ── Inputs / outputs ───────────────────────────────────────────────────────────

export interface BetweenAnalysisInput {
  /** The project this analysis is scoped to (the page's requestedProjectId). */
  requestedProjectId: string;
  startEndpoint: BetweenEndpoint;
  endEndpoint: BetweenEndpoint;
  /** Operational process_nodes, scoped to the project (the view's data.nodes). */
  nodes: LivingGraphNode[];
  /** Operational process_edges, scoped to the project (the view's data.edges). */
  edges: LivingGraphEdge[];
  /** Canonical events, scoped to the project (the view's data.canonicalEvents). */
  canonicalEvents: LivingGraphCanonicalEvent[];
  /** Canonical relationships, scoped to the project. */
  eventRelationships: LivingGraphEventRelationship[];
}

/** A status transition recorded by a canonical event. */
export interface BetweenStatusChange {
  eventId: string;
  sequenceNumber: number;
  fromState: string | null;
  toState: string | null;
  occurredAt: string | null;
}

/** A canonical event in the analysis chronology (rendered in the panel). */
export interface BetweenChronologyEntry {
  eventId: string;
  sequenceNumber: number;
  eventType: string;
  eventCategory: string;
  occurredAt: string | null;
  recordedAt: string | null;
  actorId: string | null;
  actorType: string | null;
  sourceModule: string | null;
  fromState: string | null;
  toState: string | null;
  importance: string | null;
  objectRefs: CanonicalEventObjectRef[];
  confidence: number | null;
  lateRecorded: boolean;
}

export interface BetweenAnalysisResult {
  projectId: string;
  startEndpoint: BetweenEndpoint;
  endEndpoint: BetweenEndpoint;
  /** Recorded operational path (process_edges) between the endpoint nodes.
   *  Empty when no path exists — never invented. */
  operationalPath: { nodeId: string; label: string }[];
  /** Canonical event ids that fall within the interval [seqStart, seqEnd]. */
  canonicalEventIds: string[];
  /** Object ids referenced by the interval's events (evidence + others). */
  relatedObjectIds: { objectType: string; objectId: string; role: string | null }[];
  /** Inclusive sequence bounds. Null when no canonical history is available. */
  sequenceStart: number | null;
  sequenceEnd: number | null;
  /** Business-time (occurred_at) bounds of the interval. Null when absent. */
  occurredStart: string | null;
  occurredEnd: string | null;
  /** Wall-clock span between the occurred_at bounds (ms). Null when uncomputable.
   *  Wall-clock (not business-hour pruned) — declared in `limitations`. */
  elapsedBusinessMs: number | null;
  /** Wall-clock span between the recorded_at bounds (ms), kept separate. */
  recordedElapsedMs: number | null;
  eventCount: number;
  transitionCount: number;
  /** Largest gap between consecutive occurred_at timestamps in the interval. */
  largestWaitingGap: number | null;
  statusChanges: BetweenStatusChange[];
  blockers: string[];
  risks: string[];
  decisions: string[];
  approvals: string[];
  reworkSignals: string[];
  actors: string[];
  sourceModules: string[];
  evidenceRefs: { objectType: string; objectId: string }[];
  dataQualityFlags: string[];
  /** Causal links ONLY from relationships with relationshipClass === "causal"
   *  (caused_by recorded explicitly). Never inferred from temporal order. */
  explicitCausalRelationships: {
    relationshipId: string;
    sourceEventId: string;
    targetEventId: string;
    relationshipType: string;
  }[];
  /** Temporal-order relationships within the interval. ORDER ONLY — not causal. */
  temporalRelationships: {
    relationshipId: string;
    sourceEventId: string;
    targetEventId: string;
    relationshipType: string;
  }[];
  limitations: string[];
  /** Deterministic, data-derived summary lines (no LLM). */
  summaryFacts: string[];
  /** Ordered chronology of the interval's events (for the panel). */
  chronology: BetweenChronologyEntry[];
}

// ── Deterministic keyword mapping (NO LLM) ─────────────────────────────────────
// Maps an event_type / event_category to the deterministic buckets the panel
// surfaces. Keyword-based, case-insensitive, never invents categories.

function classifyEventType(
  eventType: string,
  eventCategory: string,
): { blocker?: boolean; risk?: boolean; decision?: boolean; approval?: boolean; rework?: boolean } {
  const et = eventType.toLowerCase();
  const ec = eventCategory.toLowerCase();
  return {
    blocker: et.includes("block") || ec.includes("block"),
    risk: ec.includes("risk") || et.includes("risk"),
    decision: et.includes("decision") || et.includes("gate") || et.includes("review"),
    approval: et.includes("approval") || et.includes("approve") || et.includes("signoff") || et.includes("sign_off"),
    rework: et.includes("rework") || et.includes("revision") || et.includes("reject"),
  };
}

// ── Endpoint resolution ───────────────────────────────────────────────────────

/** Resolve an endpoint to the operational node id it refers to (or null when
 *  the endpoint is a canonical event with no operational counterpart). */
function resolveOperationalNodeId(
  endpoint: BetweenEndpoint,
  nodes: LivingGraphNode[],
): string | null {
  if (endpoint.kind === "canonical_event") {
    // A canonical-event endpoint maps to the operational node of its source
    // entity, if any is recorded on the event (resolved by the caller via the
    // event's source_entity_type/source_entity_id). Here we only have nodes, so
    // match by sourceEntityId when provided.
    if (!endpoint.sourceEntityId) return null;
    const n = nodes.find(
      (x) => x.sourceEntityId === endpoint.sourceEntityId,
    );
    return n ? n.id : null;
  }
  if (endpoint.kind === "milestone") {
    // Prefer the milestone NODE itself (sourceEntityType === "milestones").
    // Do NOT match plain `milestoneId` — that field is set on TASK nodes (the
    // milestone they belong to), so it would resolve a milestone endpoint to a
    // task, breaking the operational path.
    const bySource = nodes.find(
      (x) => x.sourceEntityType === "milestones" && x.sourceEntityId === endpoint.sourceEntityId,
    );
    if (bySource) return bySource.id;
    const byGate = nodes.find(
      (x) => x.nodeType === "milestone_gate" && x.milestoneId === endpoint.sourceEntityId,
    );
    return byGate ? byGate.id : null;
  }
  if (endpoint.kind === "task") {
    const bySource = nodes.find(
      (x) => x.sourceEntityType === "roadmap_tasks" && x.sourceEntityId === endpoint.sourceEntityId,
    );
    return bySource ? bySource.id : null;
  }
  // process_node: the nodeId itself, if it exists in the project's nodes.
  return nodes.some((x) => x.id === endpoint.nodeId) ? endpoint.nodeId : null;
}

/** Sequence numbers of canonical events tied to an endpoint. Tied = the event's
 *  source_entity_id matches the endpoint's sourceEntityId, OR an object ref on
 *  the event references the endpoint's entity. Never uses updated_at. */
function endpointSequenceNumbers(
  endpoint: BetweenEndpoint,
  events: LivingGraphCanonicalEvent[],
): number[] {
  if (endpoint.kind === "canonical_event" && endpoint.eventId) {
    const ev = events.find((e) => e.eventId === endpoint.eventId);
    return ev ? [ev.sequenceNumber] : [];
  }
  const entityId = endpoint.sourceEntityId;
  if (!entityId) return [];
  const seqs: number[] = [];
  for (const ev of events) {
    if (ev.sourceEntityId === entityId) {
      seqs.push(ev.sequenceNumber);
      continue;
    }
    if (ev.objectRefs.some((r) => r.object_id === entityId)) {
      seqs.push(ev.sequenceNumber);
    }
  }
  return seqs;
}

// ── BFS over operational edges ─────────────────────────────────────────────────

/** BFS shortest path (by hop count) over operational process_edges between two
 *  node ids. Returns the list of node ids from start to end inclusive, or null
 *  when no path exists. Pure, deterministic (stable neighbour order). */
function bfsPath(
  edges: LivingGraphEdge[],
  startId: string,
  endId: string,
): string[] | null {
  if (startId === endId) return [startId];
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.sourceNodeId) ?? [];
    list.push(e.targetNodeId);
    adj.set(e.sourceNodeId, list);
  }
  const prev = new Map<string, string>();
  const visited = new Set<string>([startId]);
  const queue: string[] = [startId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const neighbors = adj.get(cur) ?? [];
    for (const nb of neighbors) {
      if (visited.has(nb)) continue;
      visited.add(nb);
      prev.set(nb, cur);
      if (nb === endId) {
        // reconstruct
        const path: string[] = [endId];
        let p = cur;
        while (p !== startId) {
          path.unshift(p);
          p = prev.get(p) ?? startId;
        }
        path.unshift(startId);
        return path;
      }
      queue.push(nb);
    }
  }
  return null;
}

// ── Layout key (UX-007/PD-008 — saved arrangements must not collide) ──────────

/** Deterministic localStorage key for a between-analysis arrangement. The two
 *  endpoints are sorted so START/END and END/START share one saved arrangement. */
export function getBetweenAnalysisLayoutKey(
  projectId: string,
  a: string,
  b: string,
): string {
  const sorted = [a, b].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  return `between:v1:${projectId}:${sorted[0]}:${sorted[1]}`;
}

// ── Main entry ─────────────────────────────────────────────────────────────────

/**
 * Analyze "what happened between" two endpoints in ONE project. PURE: no I/O,
 * no mutation, deterministic. Returns a complete `BetweenAnalysisResult`.
 */
export function analyzeBetween(input: BetweenAnalysisInput): BetweenAnalysisResult {
  const {
    requestedProjectId,
    startEndpoint,
    endEndpoint,
    nodes,
    edges,
    canonicalEvents,
    eventRelationships,
  } = input;

  const limitations: string[] = [];

  // 1. Cross-project rejection: endpoints must belong to the requested project.
  const startNode = nodes.find((n) => n.id === startEndpoint.nodeId);
  const endNode = nodes.find((n) => n.id === endEndpoint.nodeId);
  const startEvent =
    startEndpoint.kind === "canonical_event" && startEndpoint.eventId
      ? canonicalEvents.find((e) => e.eventId === startEndpoint.eventId)
      : undefined;
  const endEvent =
    endEndpoint.kind === "canonical_event" && endEndpoint.eventId
      ? canonicalEvents.find((e) => e.eventId === endEndpoint.eventId)
      : undefined;
  const startProjectId =
    startNode?.projectId ?? startEvent?.projectId ?? null;
  const endProjectId = endNode?.projectId ?? endEvent?.projectId ?? null;
  // An endpoint may be a process node or a canonical event; if we cannot even
  // resolve a projectId for it, treat it as cross-project-incoherent.
  if (
    (startProjectId != null && startProjectId !== requestedProjectId) ||
    (endProjectId != null && endProjectId !== requestedProjectId) ||
    (startEndpoint.kind !== "canonical_event" && startNode == null) ||
    (endEndpoint.kind !== "canonical_event" && endNode == null)
  ) {
    limitations.push("cross_project_rejected");
  }

  // 2. Resolve endpoints → operational node ids.
  const startOpId = resolveOperationalNodeId(startEndpoint, nodes);
  const endOpId = resolveOperationalNodeId(endEndpoint, nodes);

  // 3. Operational path (BFS over process_edges). Never invented.
  let operationalPath: { nodeId: string; label: string }[] = [];
  if (startOpId && endOpId) {
    const path = bfsPath(edges, startOpId, endOpId);
    if (path) {
      operationalPath = path.map((id) => {
        const n = nodes.find((x) => x.id === id);
        return { nodeId: id, label: n?.label ?? id };
      });
    } else {
      limitations.push("No recorded operational path");
    }
  } else if (!limitations.includes("cross_project_rejected")) {
    limitations.push("No recorded operational path");
  }

  // 4. Historical interval: canonical events of the SAME project, ordered by
  //    sequence_number (authoritative), bounded inclusively [seqStart, seqEnd].
  const projectEvents = canonicalEvents
    .filter((e) => e.projectId === requestedProjectId)
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  const startSeqs = endpointSequenceNumbers(startEndpoint, projectEvents);
  const endSeqs = endpointSequenceNumbers(endEndpoint, projectEvents);
  if (startSeqs.length === 0) limitations.push("No canonical history available for this endpoint");
  if (endSeqs.length === 0 && endEndpoint.nodeId !== startEndpoint.nodeId) {
    limitations.push("No canonical history available for this endpoint");
  }

  let sequenceStart: number | null = null;
  let sequenceEnd: number | null = null;
  if (startSeqs.length > 0 || endSeqs.length > 0) {
    const startMin = startSeqs.length ? Math.min(...startSeqs) : null;
    const startMax = startSeqs.length ? Math.max(...startSeqs) : null;
    const endMin = endSeqs.length ? Math.min(...endSeqs) : null;
    const endMax = endSeqs.length ? Math.max(...endSeqs) : null;
    let lower: number | null;
    let upper: number | null;
    if (startMin != null && endMax != null) {
      lower = startMin;
      upper = endMax;
    } else if (startMin != null) {
      lower = startMin;
      upper = startMax;
    } else if (endMin != null) {
      lower = endMin;
      upper = endMax;
    } else {
      lower = null;
      upper = null;
    }
    if (lower != null && upper != null) {
      if (lower > upper) {
        const tmp = lower;
        lower = upper;
        upper = tmp;
        limitations.push("endpoints_out_of_order");
      }
      sequenceStart = lower;
      sequenceEnd = upper;
    }
  }

  // Interval events: same project, sequence within [seqStart, seqEnd] inclusive.
  const intervalEvents =
    sequenceStart != null && sequenceEnd != null
      ? projectEvents.filter(
          (e) => e.sequenceNumber >= sequenceStart! && e.sequenceNumber <= sequenceEnd!,
        )
      : [];

  // 5. Metrics (deterministic, no LLM).
  const occurredTimes = intervalEvents
    .map((e) => (e.occurredAt ? new Date(e.occurredAt).getTime() : null))
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);
  const recordedTimes = intervalEvents
    .map((e) => (e.recordedAt ? new Date(e.recordedAt).getTime() : null))
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);

  const occurredStart =
    occurredTimes.length > 0 ? new Date(occurredTimes[0]).toISOString() : null;
  const occurredEnd =
    occurredTimes.length > 0 ? new Date(occurredTimes[occurredTimes.length - 1]).toISOString() : null;
  const elapsedBusinessMs =
    occurredTimes.length >= 2
      ? occurredTimes[occurredTimes.length - 1] - occurredTimes[0]
      : occurredTimes.length === 1
        ? 0
        : null;
  if (elapsedBusinessMs != null) {
    // Honest declaration: this is wall-clock elapsed, not business-hour pruned.
    limitations.push("elapsed_is_wall_clock_not_business_hours");
  }
  const recordedElapsedMs =
    recordedTimes.length >= 2
      ? recordedTimes[recordedTimes.length - 1] - recordedTimes[0]
      : recordedTimes.length === 1
        ? 0
        : null;

  // Largest waiting gap between consecutive occurred_at in the interval.
  let largestWaitingGap: number | null = null;
  if (occurredTimes.length >= 2) {
    for (let i = 1; i < occurredTimes.length; i++) {
      const gap = occurredTimes[i] - occurredTimes[i - 1];
      if (largestWaitingGap == null || gap > largestWaitingGap) largestWaitingGap = gap;
    }
  }

  // Status changes (events carrying a from_state or to_state).
  const statusChanges: BetweenStatusChange[] = intervalEvents
    .filter((e) => e.fromState != null || e.toState != null)
    .map((e) => ({
      eventId: e.eventId,
      sequenceNumber: e.sequenceNumber,
      fromState: e.fromState,
      toState: e.toState,
      occurredAt: e.occurredAt,
    }));
  const transitionCount = statusChanges.length;

  // Deterministic keyword buckets.
  const blockers: string[] = [];
  const risks: string[] = [];
  const decisions: string[] = [];
  const approvals: string[] = [];
  const reworkSignals: string[] = [];
  for (const e of intervalEvents) {
    const c = classifyEventType(e.eventType, e.eventCategory);
    if (c.blocker) blockers.push(e.eventId);
    if (c.risk) risks.push(e.eventId);
    if (c.decision) decisions.push(e.eventId);
    if (c.approval) approvals.push(e.eventId);
    if (c.rework) reworkSignals.push(e.eventId);
  }

  // Actors / source modules.
  const actors = unique(
    intervalEvents.map((e) => e.actorId).filter((a): a is string => a != null),
  );
  const sourceModules = unique(
    intervalEvents.map((e) => e.sourceModule).filter((m): m is string => m != null),
  );

  // Evidence refs (object refs with role === "evidence") + all related objects.
  const evidenceRefs: { objectType: string; objectId: string }[] = [];
  const relatedObjectIds: { objectType: string; objectId: string; role: string | null }[] = [];
  for (const e of intervalEvents) {
    for (const r of e.objectRefs) {
      relatedObjectIds.push({ objectType: r.object_type, objectId: r.object_id, role: r.role });
      if (r.role === "evidence") evidenceRefs.push({ objectType: r.object_type, objectId: r.object_id });
    }
  }

  // Data quality flags union.
  const dataQualityFlags = unique(
    intervalEvents.flatMap((e) => e.dataQualityFlags ?? []),
  );

  // Explicit causal + temporal relationships within the interval (by event id).
  const intervalIds = new Set(intervalEvents.map((e) => e.eventId));
  const explicitCausalRelationships = eventRelationships
    .filter(
      (r) =>
        r.relationshipClass === "causal" &&
        intervalIds.has(r.sourceEventId) &&
        (r.targetEventId == null || intervalIds.has(r.targetEventId)),
    )
    .map((r) => ({
      relationshipId: r.id,
      sourceEventId: r.sourceEventId,
      targetEventId: r.targetEventId ?? r.sourceEventId,
      relationshipType: r.relationshipType,
    }));
  const temporalRelationships = eventRelationships
    .filter(
      (r) =>
        r.relationshipClass === "temporal" &&
        intervalIds.has(r.sourceEventId) &&
        (r.targetEventId == null || intervalIds.has(r.targetEventId)),
    )
    .map((r) => ({
      relationshipId: r.id,
      sourceEventId: r.sourceEventId,
      targetEventId: r.targetEventId ?? r.sourceEventId,
      relationshipType: r.relationshipType,
    }));

  // Chronology (ordered by sequence_number — authoritative).
  const chronology: BetweenChronologyEntry[] = intervalEvents.map((e) => ({
    eventId: e.eventId,
    sequenceNumber: e.sequenceNumber,
    eventType: e.eventType,
    eventCategory: e.eventCategory,
    occurredAt: e.occurredAt,
    recordedAt: e.recordedAt,
    actorId: e.actorId,
    actorType: e.actorType,
    sourceModule: e.sourceModule,
    fromState: e.fromState,
    toState: e.toState,
    importance: e.eventImportance,
    objectRefs: e.objectRefs,
    confidence: e.confidence,
    lateRecorded: e.lateRecorded,
  }));

  // Summary facts (deterministic, data-derived — no LLM).
  const summaryFacts: string[] = [];
  summaryFacts.push(
    `interval: sequences ${sequenceStart ?? "?"}..${sequenceEnd ?? "?"} (${intervalEvents.length} events)`,
  );
  if (operationalPath.length > 0) {
    summaryFacts.push(`operational path: ${operationalPath.length} node(s)`);
  }
  if (elapsedBusinessMs != null) {
    summaryFacts.push(`elapsed (occurred_at): ${elapsedBusinessMs} ms wall-clock`);
  }
  if (recordedElapsedMs != null) {
    summaryFacts.push(`recording span (recorded_at): ${recordedElapsedMs} ms`);
  }
  if (largestWaitingGap != null) {
    summaryFacts.push(`largest waiting gap: ${largestWaitingGap} ms`);
  }
  summaryFacts.push(
    `transitions: ${transitionCount} · blockers: ${blockers.length} · risks: ${risks.length} · decisions: ${decisions.length} · approvals: ${approvals.length} · rework: ${reworkSignals.length}`,
  );
  if (explicitCausalRelationships.length > 0) {
    summaryFacts.push(`explicit causal links: ${explicitCausalRelationships.length}`);
  } else {
    summaryFacts.push("explicit causal links: 0 (temporal order is not causality)");
  }

  return {
    projectId: requestedProjectId,
    startEndpoint,
    endEndpoint,
    operationalPath,
    canonicalEventIds: intervalEvents.map((e) => e.eventId),
    relatedObjectIds,
    sequenceStart,
    sequenceEnd,
    occurredStart,
    occurredEnd,
    elapsedBusinessMs,
    recordedElapsedMs,
    eventCount: intervalEvents.length,
    transitionCount,
    largestWaitingGap,
    statusChanges,
    blockers,
    risks,
    decisions,
    approvals,
    reworkSignals,
    actors,
    sourceModules,
    evidenceRefs,
    dataQualityFlags,
    explicitCausalRelationships,
    temporalRelationships,
    limitations,
    summaryFacts,
    chronology,
  };
}

// ── helpers ────────────────────────────────────────────────────────────────────

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}