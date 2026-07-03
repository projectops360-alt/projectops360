// ============================================================================
// ProjectOps360° — MPF Engine · Advanced Detection Shared Helpers (Phase 3, Task 6)
// ============================================================================
// Shared, pure primitives for the rework / bottleneck / constraint-propagation
// detectors: status, DETECTION severity (never health), confidence capping,
// evidence dedup, input validation, and warnings. Leaf module — imports only
// types, so the three detectors + orchestrator can depend on it without cycles.
// No Date.now(): durations are read from Task 4 metrics by the callers.
// ============================================================================

import {
  MpfMissingProjectScopeError,
  MpfMissingOrganizationScopeError,
  MpfUnknownFailureError,
} from "./errors";
import { aggregateConfidence } from "./evidence";
import type { MilestoneFlowEvidenceRef, MilestoneFlowEvidenceConfidence, MilestoneFlowEngineWarning } from "./types";
import {
  DEFAULT_MPF_BOTTLENECK_THRESHOLDS,
  type MilestoneFlowBottleneckThresholds,
  type MilestoneFlowAdvancedFindingStatus,
  type MilestoneFlowAdvancedFindingSeverity,
  type MilestoneFlowAdvancedDetectionInput,
} from "./advanced-detection-types";

const CONFIDENCE_RANK: Record<MilestoneFlowEvidenceConfidence, number> = { unknown: 0, low: 1, medium: 2, high: 3 };
export const weaker = (a: MilestoneFlowEvidenceConfidence, b: MilestoneFlowEvidenceConfidence) =>
  CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b;

export function advWarn(code: string, message: string, transitionId?: string): MilestoneFlowEngineWarning {
  return { code, message, transitionId: transitionId ?? null };
}

export function resolveBottleneckThresholds(
  partial?: Partial<MilestoneFlowBottleneckThresholds>,
): MilestoneFlowBottleneckThresholds {
  return { ...DEFAULT_MPF_BOTTLENECK_THRESHOLDS, ...(partial ?? {}) };
}

// ── (11) Evidence merge (dedup) ───────────────────────────────────────────────

/** (14) Deduplicate evidence refs across sources. */
export function mergeAdvancedFindingEvidence(
  ...refGroups: (readonly MilestoneFlowEvidenceRef[])[]
): MilestoneFlowEvidenceRef[] {
  const seen = new Set<string>();
  const out: MilestoneFlowEvidenceRef[] = [];
  for (const group of refGroups) {
    for (const ref of group) {
      const key = `${ref.kind}|${ref.eventId ?? ""}|${ref.metricRef ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(ref);
    }
  }
  return out;
}

// ── (11) Status ───────────────────────────────────────────────────────────────

/** (11) open / resolved / partial / possible / unknown. */
export function determineAdvancedFindingStatus(input: {
  hasEvidence: boolean;
  isPossible?: boolean;
  isOpen?: boolean;
  hasResolution?: boolean;
  durationKnown?: boolean;
}): MilestoneFlowAdvancedFindingStatus {
  if (!input.hasEvidence) return "unknown";
  if (input.isPossible) return "possible";
  if (input.isOpen) return "open";
  if (input.hasResolution) return "resolved";
  if (input.durationKnown === false) return "partial";
  return "resolved";
}

// ── (12) Severity (DETECTION severity — not health) ───────────────────────────

const RANK_TO_SEV: Record<number, MilestoneFlowAdvancedFindingSeverity> = {
  0: "unknown",
  1: "low",
  2: "medium",
  3: "high",
  4: "critical",
};
const DOWNGRADE: Record<MilestoneFlowAdvancedFindingSeverity, MilestoneFlowAdvancedFindingSeverity> = {
  critical: "high",
  high: "medium",
  medium: "low",
  low: "low",
  unknown: "unknown",
};

/** (12) Severity from duration/occurrence/open/percentage. NOT transition health. */
export function determineAdvancedFindingSeverity(
  input: {
    durationMs: number | null;
    occurrenceCount?: number;
    isOpen?: boolean;
    pctOfKnownTime?: number | null;
    confidence: MilestoneFlowEvidenceConfidence;
  },
  thresholds: MilestoneFlowBottleneckThresholds = DEFAULT_MPF_BOTTLENECK_THRESHOLDS,
): MilestoneFlowAdvancedFindingSeverity {
  const d = input.durationMs;
  const occ = input.occurrenceCount ?? 1;
  const pct = input.pctOfKnownTime ?? null;

  // With no duration and no other signal, severity is honestly unknown.
  if (d == null && occ < thresholds.repeatedOccurrenceCount && (pct == null || pct < thresholds.significantPctOfKnownTime)) {
    return "unknown";
  }

  let rank = 0;
  if (d != null) {
    rank = d >= thresholds.criticalMs ? 4 : d >= thresholds.highMs ? 3 : d >= thresholds.mediumMs ? 2 : 1;
  }
  if (occ >= thresholds.repeatedOccurrenceCount) rank = Math.min(4, rank + 1);
  if (pct != null && pct >= thresholds.significantPctOfKnownTime) rank = Math.min(4, rank + 1);
  if (input.isOpen && d != null && d >= thresholds.highMs) rank = Math.min(4, rank + 1);

  let sev = RANK_TO_SEV[Math.max(1, rank)]; // any qualifying signal is at least "low"
  if (input.confidence === "unknown") sev = DOWNGRADE[sev];
  return sev;
}

// ── (13) Confidence ───────────────────────────────────────────────────────────

/** (13) Confidence from evidence + source confidences; capped, never inflated. */
export function determineAdvancedFindingConfidence(input: {
  evidence: readonly MilestoneFlowEvidenceRef[];
  sourceConfidences?: readonly MilestoneFlowEvidenceConfidence[];
  durationMs?: number | null;
  hasEntityLinkage?: boolean;
}): MilestoneFlowEvidenceConfidence {
  if (input.evidence.length === 0) return "unknown";
  let conf = aggregateConfidence(input.evidence);
  for (const c of input.sourceConfidences ?? []) conf = weaker(conf, c);
  if (input.durationMs === null) conf = weaker(conf, "low");
  if (input.hasEntityLinkage === false) conf = weaker(conf, "low");
  return conf;
}

// ── (15) Input validation ─────────────────────────────────────────────────────

/** (15) Validate advanced-detection input; hard-fails only on structural issues. */
export function validateMilestoneFlowAdvancedDetectionInput(input: MilestoneFlowAdvancedDetectionInput): void {
  if (!input.scope || !input.scope.organizationId) throw new MpfMissingOrganizationScopeError();
  if (!input.scope.projectId) throw new MpfMissingProjectScopeError();
  if (!Array.isArray(input.transitions)) throw new MpfUnknownFailureError("transitions must be an array");
  if (input.metricsByTransition == null || typeof input.metricsByTransition !== "object") {
    throw new MpfUnknownFailureError("metricsByTransition must be an object");
  }
  if (input.findingsByTransition == null || typeof input.findingsByTransition !== "object") {
    throw new MpfUnknownFailureError("findingsByTransition must be an object");
  }
  if (input.options?.bottleneckThresholds != null && typeof input.options.bottleneckThresholds !== "object") {
    throw new MpfUnknownFailureError("options.bottleneckThresholds must be an object");
  }
}
