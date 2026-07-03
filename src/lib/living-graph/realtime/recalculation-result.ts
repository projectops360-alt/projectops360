// ============================================================================
// ProjectOps360° — LGRE · Recalculation Result Builder (Phase 4, Task 3)
// ============================================================================
// Pure, deterministic diff between the previously materialized entities and
// the freshly recomputed ones (verbatim engine output supplied by the caller).
// Produces added/updated/removed entities with evidence/source refs from the
// attribution detail, provenance-derived confidence (weakest wins), and honest
// warnings for ambiguous data. Payload equality uses a stable sorted-key
// stringify so identical content always compares identical — replay-stable.
//
// Partial semantics: only entities inside the plan's affected sets participate
// in the diff; an unaffected entity missing from the recomputed set is NOT a
// removal. Recomputed entities OUTSIDE the plan are included with a warning —
// disclosed, never silently dropped and never silently trusted.
// ============================================================================

import { LGRE_ENGINE_VERSION, LGRE_CONFIG_VERSION } from "./constants";
import type {
  LivingGraphChangeNotice,
  LivingGraphRealtimeProjectScope,
  GraphRecalculationPlan,
} from "./types";
import type {
  LivingGraphAttributionDetail,
  LivingGraphChangedEntity,
  LivingGraphEntitySet,
  LivingGraphRecalculationConfidence,
  LivingGraphRecalculationMode,
  LivingGraphRecalculationResult,
} from "./recalculation-types";

// ── Deterministic payload equality ────────────────────────────────────────────

/** Stable stringify: object keys sorted recursively (arrays keep order). */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

// ── Provenance-derived confidence (weakest supporting notice wins) ────────────

export function confidenceFromNotices(
  notices: readonly LivingGraphChangeNotice[],
): LivingGraphRecalculationConfidence {
  if (notices.length === 0) return "unknown";
  let weakest: LivingGraphRecalculationConfidence = "high";
  const rank = { high: 3, medium: 2, low: 1, unknown: 0 } as const;
  for (const notice of notices) {
    let level: LivingGraphRecalculationConfidence;
    switch (notice.lifecycleClass) {
      case "BUSINESS_EVENT":
      case "SYSTEM_EVENT":
      case "EXTERNAL_EVENT":
        level = "high";
        break;
      case "DERIVED_EVENT":
      case "AI_EVENT":
      case "SYNTHETIC_BACKFILL_EVENT":
        // Backfilled/derived provenance can never be asserted at high confidence.
        level = "medium";
        break;
      default:
        level = notice.lifecycleClass === null ? "unknown" : "low";
    }
    if (rank[level] < rank[weakest]) weakest = level;
  }
  return weakest;
}

// ── Diff ──────────────────────────────────────────────────────────────────────

interface DiffableEntity {
  id: string;
  payload: Readonly<Record<string, unknown>>;
}

function diffEntities(args: {
  previous: readonly DiffableEntity[];
  next: readonly DiffableEntity[];
  mode: LivingGraphRecalculationMode;
  affectedIds: ReadonlySet<string>;
  sources: Readonly<Record<string, readonly string[]>>;
  noticeEventIds: Readonly<Record<string, string | null>>;
  entityLabel: "node" | "edge";
  warnings: string[];
}): LivingGraphChangedEntity[] {
  const prevById = new Map(args.previous.map((e) => [e.id, e]));
  const nextById = new Map(args.next.map((e) => [e.id, e]));
  const changes: LivingGraphChangedEntity[] = [];

  const sourcesFor = (id: string): { noticeIds: string[]; eventIds: string[] } => {
    const noticeIds = [...(args.sources[id] ?? [])];
    const eventIds = noticeIds
      .map((n) => args.noticeEventIds[n] ?? null)
      .filter((e): e is string => e !== null);
    return { noticeIds, eventIds: [...new Set(eventIds)].sort() };
  };

  const push = (
    id: string,
    change: LivingGraphChangedEntity["change"],
    payload: Readonly<Record<string, unknown>> | null,
  ) => {
    const { noticeIds, eventIds } = sourcesFor(id);
    changes.push(
      Object.freeze({
        id,
        change,
        payload,
        sourceNoticeIds: Object.freeze(noticeIds),
        sourceEventIds: Object.freeze(eventIds),
      }),
    );
  };

  // Candidate id space: full mode diffs everything; partial only affected ids.
  const candidateIds = new Set<string>();
  if (args.mode === "full") {
    for (const e of args.previous) candidateIds.add(e.id);
    for (const e of args.next) candidateIds.add(e.id);
  } else {
    for (const id of args.affectedIds) candidateIds.add(id);
    // Ambiguity guard: recomputed entities outside the plan are disclosed and
    // included (never silently dropped, never silently trusted).
    for (const e of args.next) {
      if (!args.affectedIds.has(e.id)) {
        args.warnings.push(
          `Recomputed ${args.entityLabel} "${e.id}" is outside the plan's affected set; included with a warning.`,
        );
        candidateIds.add(e.id);
      }
    }
  }

  for (const id of [...candidateIds].sort()) {
    const prev = prevById.get(id);
    const next = nextById.get(id);
    if (prev && !next) {
      push(id, "removed", null);
    } else if (!prev && next) {
      push(id, "added", next.payload);
    } else if (prev && next) {
      if (stableStringify(prev.payload) !== stableStringify(next.payload)) {
        push(id, "updated", next.payload);
      }
    }
    // !prev && !next: an affected id with no materialization on either side —
    // nothing to report (e.g. the change did not alter this entity's payload
    // and it never existed; honest silence, not an invented change).
  }

  return changes;
}

// ── Result builder ────────────────────────────────────────────────────────────

export interface BuildRecalculationResultInput {
  resultId: string;
  scope: LivingGraphRealtimeProjectScope;
  mode: LivingGraphRecalculationMode;
  plan: GraphRecalculationPlan;
  attribution: LivingGraphAttributionDetail | null;
  basedOnSnapshotVersion: number | null;
  previous: LivingGraphEntitySet | null;
  recomputed: LivingGraphEntitySet | null;
  acceptedNotices: readonly LivingGraphChangeNotice[];
  now: () => Date;
}

export function buildLivingGraphRecalculationResult(
  input: BuildRecalculationResultInput,
): LivingGraphRecalculationResult {
  const warnings: string[] = [...input.plan.warnings];
  const nodeSources = input.attribution?.nodeSources ?? {};
  const edgeSources = input.attribution?.edgeSources ?? {};
  const noticeEventIds = input.attribution?.noticeEventIds ?? {};

  const previous = input.previous ?? { nodes: [], edges: [] };
  const recomputed = input.recomputed ?? { nodes: [], edges: [] };
  if (input.previous === null && input.mode !== "noop") {
    warnings.push("No previous entity set supplied; every recomputed entity reports as added.");
  }

  const nodeChanges =
    input.mode === "noop"
      ? []
      : diffEntities({
          previous: previous.nodes.map((n) => ({ id: n.nodeId, payload: n.payload })),
          next: recomputed.nodes.map((n) => ({ id: n.nodeId, payload: n.payload })),
          mode: input.mode,
          affectedIds: new Set(input.plan.affectedNodeIds),
          sources: nodeSources,
          noticeEventIds,
          entityLabel: "node",
          warnings,
        });

  const edgeChanges =
    input.mode === "noop"
      ? []
      : diffEntities({
          previous: previous.edges.map((e) => ({ id: e.edgeId, payload: e.payload })),
          next: recomputed.edges.map((e) => ({ id: e.edgeId, payload: e.payload })),
          mode: input.mode,
          affectedIds: new Set(input.plan.affectedEdgeIds),
          sources: edgeSources,
          noticeEventIds,
          entityLabel: "edge",
          warnings,
        });

  return Object.freeze({
    resultId: input.resultId,
    scope: input.scope,
    mode: input.mode,
    basedOnSnapshotVersion: input.basedOnSnapshotVersion,
    affectedNodeIds: [...input.plan.affectedNodeIds],
    affectedEdgeIds: [...input.plan.affectedEdgeIds],
    nodeChanges,
    edgeChanges,
    reasons: [...input.plan.reasons],
    confidence: confidenceFromNotices(input.acceptedNotices),
    warnings,
    engineVersion: LGRE_ENGINE_VERSION,
    configVersion: LGRE_CONFIG_VERSION,
    generatedAt: input.now().toISOString(),
  });
}
