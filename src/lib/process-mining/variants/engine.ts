// ============================================================================
// ProjectOps360° — Project Intelligence Engine · Variant Analysis Engine
// ============================================================================
// CAP-046 / PD-019 — Feature 1. Pure + deterministic: no DB, no clock, no
// randomness. Discovers execution variants (unique activity sequences) from
// PEG business events, computes per-variant metrics (frequency, duration,
// rework, success), selects the reference (most successful) variant, and
// assigns each case with fitness + deviations vs the reference.
//
// Contract compliance (PD-018): only BUSINESS_EVENT lifecycle-class events are
// mined (§A.3); compensating events are excluded from sequences (§A.6);
// business order is occurred_at with the caller's stable ordering as tiebreak
// (§A.5). Missing outcome data yields successRate=null and no reference —
// never invented (guardrail: no invented transitions).
// ============================================================================

import type {
  ExecutionVariant,
  VariantAnalysis,
  VariantAnalysisQuality,
  VariantAssignment,
  VariantCaseInput,
  VariantEventRef,
} from "./types";

/** Stable FNV-1a 32-bit hash of a variant signature (deterministic id). */
export function variantIdFor(signature: readonly string[]): string {
  let hash = 0x811c9dc5;
  const text = signature.join("␟"); // unit-separator join, collision-safe vs "→"
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `v_${hash.toString(16).padStart(8, "0")}_${signature.length}`;
}

function isMinable(event: VariantEventRef): boolean {
  return event.lifecycleClass === "BUSINESS_EVENT" && !event.isCompensatingEvent;
}

/** Business-time ordering; caller order is the stable tiebreak (PD-018 §A.5). */
function inBusinessOrder(events: readonly VariantEventRef[]): VariantEventRef[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => {
      const at = Date.parse(a.event.occurredAt);
      const bt = Date.parse(b.event.occurredAt);
      if (at !== bt) return at - bt;
      return a.index - b.index;
    })
    .map((entry) => entry.event);
}

function median(sorted: readonly number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Longest-common-subsequence length between two activity sequences — basis of
 * the fitness score (2·LCS / (|a|+|b|), the classic similarity ratio).
 */
export function sequenceFitness(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const dp: number[] = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = 0;
    for (let j = 1; j <= b.length; j++) {
      const previous = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? diagonal + 1 : Math.max(dp[j], dp[j - 1]);
      diagonal = previous;
    }
  }
  return (2 * dp[b.length]) / (a.length + b.length);
}

interface CaseTrace {
  caseId: string;
  caseLabel?: string;
  signature: string[];
  durationMs: number | null;
  outcome: VariantCaseInput["outcome"];
}

/**
 * Discover execution variants across cases. Deterministic output ordering:
 * variants sorted by caseCount desc, then signature lexicographically.
 */
export function analyzeVariants(
  processType: string,
  cases: readonly VariantCaseInput[],
): VariantAnalysis {
  const quality: VariantAnalysisQuality = {
    totalEventsSeen: 0,
    businessEventsUsed: 0,
    excludedEvents: 0,
    casesWithoutEvents: 0,
    casesWithKnownOutcome: 0,
  };

  const traces: CaseTrace[] = [];
  for (const input of cases) {
    quality.totalEventsSeen += input.events.length;
    const minable = inBusinessOrder(input.events.filter(isMinable));
    quality.excludedEvents += input.events.length - minable.length;
    if (input.outcome !== "open") quality.casesWithKnownOutcome += 1;
    if (minable.length === 0) {
      quality.casesWithoutEvents += 1;
      continue;
    }
    quality.businessEventsUsed += minable.length;
    const first = Date.parse(minable[0].occurredAt);
    const last = Date.parse(minable[minable.length - 1].occurredAt);
    traces.push({
      caseId: input.caseId,
      caseLabel: input.caseLabel,
      signature: minable.map((event) => event.eventType),
      durationMs: Number.isFinite(first) && Number.isFinite(last) ? last - first : null,
      outcome: input.outcome,
    });
  }

  // Group identical signatures into variants.
  const groups = new Map<string, CaseTrace[]>();
  for (const trace of traces) {
    const id = variantIdFor(trace.signature);
    const group = groups.get(id);
    if (group) group.push(trace);
    else groups.set(id, [trace]);
  }

  const variants: ExecutionVariant[] = [];
  for (const [variantId, group] of groups) {
    const signature = group[0].signature;
    const durations = group
      .map((trace) => trace.durationMs)
      .filter((duration): duration is number => duration !== null)
      .sort((x, y) => x - y);
    const decided = group.filter((trace) => trace.outcome !== "open");
    const successes = decided.filter((trace) => trace.outcome === "success").length;
    const uniqueActivities = new Set(signature).size;
    variants.push({
      variantId,
      signature,
      caseIds: group.map((trace) => trace.caseId).sort(),
      caseCount: group.length,
      frequencyPct: traces.length > 0 ? round((group.length / traces.length) * 100, 2) : 0,
      avgDurationMs:
        durations.length > 0
          ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
          : null,
      medianDurationMs: median(durations) !== null ? Math.round(median(durations) as number) : null,
      reworkRate: round((signature.length - uniqueActivities) / signature.length, 4),
      successRate: decided.length > 0 ? round(successes / decided.length, 4) : null,
      decidedCaseCount: decided.length,
      isReference: false,
    });
  }

  variants.sort((a, b) => {
    if (a.caseCount !== b.caseCount) return b.caseCount - a.caseCount;
    return a.signature.join("␟") < b.signature.join("␟") ? -1 : 1;
  });

  // Reference = most successful variant, only when real outcome data exists:
  // highest successRate, then more decided cases, then more cases, then the
  // shorter median duration. Without outcomes there is NO reference (honest).
  let referenceVariantId: string | null = null;
  const candidates = variants.filter((variant) => variant.successRate !== null);
  if (candidates.length > 0) {
    const best = [...candidates].sort((a, b) => {
      if (a.successRate !== b.successRate) return (b.successRate ?? 0) - (a.successRate ?? 0);
      if (a.decidedCaseCount !== b.decidedCaseCount) return b.decidedCaseCount - a.decidedCaseCount;
      if (a.caseCount !== b.caseCount) return b.caseCount - a.caseCount;
      return (a.medianDurationMs ?? Infinity) - (b.medianDurationMs ?? Infinity);
    })[0];
    referenceVariantId = best.variantId;
    const reference = variants.find((variant) => variant.variantId === referenceVariantId);
    if (reference) reference.isReference = true;
  }

  const referenceSignature =
    referenceVariantId !== null
      ? (variants.find((variant) => variant.variantId === referenceVariantId)?.signature ?? null)
      : null;

  const assignments: VariantAssignment[] = traces.map((trace) => {
    const variantId = variantIdFor(trace.signature);
    if (!referenceSignature) {
      return {
        caseId: trace.caseId,
        caseLabel: trace.caseLabel,
        variantId,
        fitnessVsReference: null,
        skippedActivities: [],
        insertedActivities: [],
      };
    }
    const caseSet = new Set(trace.signature);
    const referenceSet = new Set(referenceSignature);
    return {
      caseId: trace.caseId,
      caseLabel: trace.caseLabel,
      variantId,
      fitnessVsReference: round(sequenceFitness(trace.signature, referenceSignature), 4),
      skippedActivities: [...referenceSet].filter((activity) => !caseSet.has(activity)).sort(),
      insertedActivities: [...caseSet].filter((activity) => !referenceSet.has(activity)).sort(),
    };
  });
  assignments.sort((a, b) => (a.caseId < b.caseId ? -1 : 1));

  return {
    processType,
    totalCases: cases.length,
    analyzedCases: traces.length,
    variants,
    assignments,
    referenceVariantId,
    quality,
  };
}
