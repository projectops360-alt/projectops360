// ============================================================================
// ProjectOps360° — MPF Engine · Bottleneck Detector (Phase 3, Task 6)
// ============================================================================
// Detects bottleneck CANDIDATES by consuming Task 5 delay findings + Task 4
// metrics (+ Task 6 rework findings). A bottleneck candidate REQUIRES evidence
// and must meet at least one conservative criterion — NOT every delay is a
// bottleneck. Durations are READ from Task 5 findings / Task 4 metrics (never
// recomputed; no Date.now()). `severity` is detection severity, not health.
// bottleneckType reuses the Task 1 vocabulary.
// ============================================================================

import {
  determineAdvancedFindingStatus,
  determineAdvancedFindingSeverity,
  determineAdvancedFindingConfidence,
  mergeAdvancedFindingEvidence,
  resolveBottleneckThresholds,
  advWarn,
} from "./advanced-detection-shared";
import type {
  MilestoneFlowEngineWarning,
  MilestoneFlowProjectScope,
  MilestoneFlowBottleneckType,
} from "./types";
import type { BuiltMilestoneTransition } from "./transition-builder-types";
import type { MilestoneFlowTransitionMetrics } from "./metrics-calculator-types";
import type { MilestoneFlowDetectionFinding, MilestoneFlowFindingType } from "./delay-detector-types";
import {
  type MilestoneFlowBottleneckFinding,
  type MilestoneFlowReworkFinding,
  type MilestoneFlowBottleneckThresholds,
  type MilestoneFlowAdvancedDetectionOptions,
} from "./advanced-detection-types";

const BOTTLENECK_TYPE_FOR_FINDING: Record<MilestoneFlowFindingType, MilestoneFlowBottleneckType> = {
  decision_delay: "decision",
  approval_delay: "approval",
  blocker: "dependency", // conservative default; specific blocker cause is deferred
  waiting_time: "unknown", // waiting cause is genuinely unknown here
};

/** (9) Determine bottleneck type from a Task 5 delay finding or a rework finding. */
export function determineMilestoneBottleneckType(
  source: MilestoneFlowDetectionFinding | MilestoneFlowReworkFinding,
): MilestoneFlowBottleneckType {
  if ("reworkType" in source) return "rework";
  return BOTTLENECK_TYPE_FOR_FINDING[source.findingType] ?? "unknown";
}

type CandidateSource = MilestoneFlowDetectionFinding | MilestoneFlowReworkFinding;

interface CandidateGroup {
  bottleneckType: MilestoneFlowBottleneckType;
  sources: CandidateSource[];
}

export interface BuildBottleneckFindingParams {
  scope: MilestoneFlowProjectScope;
  transitionId: string;
  group: CandidateGroup;
  metrics: MilestoneFlowTransitionMetrics | undefined;
  thresholds: MilestoneFlowBottleneckThresholds;
}

/** (6) Build a normalized bottleneck finding (only called for qualifying groups). */
export function buildMilestoneFlowBottleneckFinding(params: BuildBottleneckFindingParams): MilestoneFlowBottleneckFinding {
  const { scope, transitionId, group, metrics, thresholds } = params;
  const { bottleneckType, sources } = group;
  const warnings: MilestoneFlowEngineWarning[] = [];

  const occurrenceCount = sources.length;
  const durations = sources.map((s) => s.durationMs).filter((d): d is number => d != null);
  const durationMs = durations.length ? durations.reduce((a, b) => a + b, 0) : null;
  const totalKnown = metrics?.totalKnownSegmentTimeMs ?? 0;
  const pctOfKnownTime = durationMs != null && totalKnown > 0 ? Math.round((durationMs / totalKnown) * 10000) / 100 : null;
  const isOpen = sources.some((s) => (s as MilestoneFlowDetectionFinding).isOpen ?? (s as MilestoneFlowReworkFinding).isOpen);

  const evidenceRefs = mergeAdvancedFindingEvidence(...sources.map((s) => s.evidenceRefs));
  if (evidenceRefs.length === 0) warnings.push(advWarn("MISSING_BOTTLENECK_EVIDENCE", `no evidence for ${bottleneckType} bottleneck`, transitionId));
  if (bottleneckType === "unknown") warnings.push(advWarn("UNKNOWN_BOTTLENECK_SOURCE", `bottleneck type unknown in ${transitionId}`, transitionId));

  const sourceConfidences = sources.map((s) => s.confidence);
  const confidence = determineAdvancedFindingConfidence({ evidence: evidenceRefs, sourceConfidences, durationMs });

  // Which conservative criteria did this group meet?
  const reasons: string[] = [];
  if (durationMs != null && durationMs >= thresholds.longDurationMs) reasons.push("long_duration");
  if (occurrenceCount >= thresholds.repeatedOccurrenceCount) reasons.push("repeated_occurrence");
  if (sources.some((s) => s.severity === "high" || s.severity === "critical")) reasons.push("high_severity_source");
  if (isOpen && durationMs != null && durationMs >= thresholds.longDurationMs) reasons.push("open_long_unresolved");
  // Time-share only counts for a non-trivial delay (floor at mediumMs) so a short
  // single delay that happens to be 100% of a tiny corridor is not a bottleneck.
  if (pctOfKnownTime != null && pctOfKnownTime >= thresholds.significantPctOfKnownTime && durationMs != null && durationMs >= thresholds.mediumMs) {
    reasons.push("significant_time_share");
  }

  const isStructuralCandidate = occurrenceCount >= thresholds.repeatedOccurrenceCount || reasons.length >= 2;

  const severity = determineAdvancedFindingSeverity({ durationMs, occurrenceCount, isOpen, pctOfKnownTime, confidence }, thresholds);
  const status = determineAdvancedFindingStatus({
    hasEvidence: evidenceRefs.length > 0,
    isOpen,
    hasResolution: !isOpen,
    durationKnown: durationMs != null,
  });

  const affectedFindingIds = sources.map((s) => s.findingId);
  const affectedSegmentIds = [...new Set(sources.flatMap((s) => sourceSegmentIds(s)))];
  const sourceEventIds = [...new Set(sources.flatMap((s) => s.sourceEventIds))];

  return {
    findingId: `${transitionId}__bottleneck_${bottleneckType}`,
    transitionId,
    projectId: scope.projectId,
    organizationId: scope.organizationId,
    bottleneckType,
    status,
    severity,
    confidence,
    durationMs,
    occurrenceCount,
    affectedSegmentIds,
    affectedFindingIds,
    sourceEventIds,
    evidenceRefs,
    metricRefs: [`metrics.${metricRefForType(bottleneckType)}`, "metrics.totalKnownSegmentTimeMs"],
    candidateReason: reasons.join(", ") || "no_criteria",
    isStructuralCandidate,
    calculationNotes: [
      `bottleneck candidate=${bottleneckType} occurrences=${occurrenceCount} criteria=[${reasons.join(", ")}]`,
      `severity=${severity} (detection severity, not health); confidence=${confidence}`,
    ],
    warnings,
  };
}

function sourceSegmentIds(s: CandidateSource): string[] {
  if ("sourceSegmentIds" in s) return s.sourceSegmentIds;
  return [];
}

function metricRefForType(t: MilestoneFlowBottleneckType): string {
  switch (t) {
    case "decision": return "decisionDelayTimeMs";
    case "approval": return "approvalDelayTimeMs";
    case "dependency": return "blockedTimeMs";
    case "rework": return "reworkTimeMs";
    default: return "totalKnownSegmentTimeMs";
  }
}

/** True when a candidate group meets at least one conservative criterion. */
function groupQualifies(group: CandidateGroup, metrics: MilestoneFlowTransitionMetrics | undefined, thresholds: MilestoneFlowBottleneckThresholds): boolean {
  const durations = group.sources.map((s) => s.durationMs).filter((d): d is number => d != null);
  const durationMs = durations.length ? durations.reduce((a, b) => a + b, 0) : null;
  const totalKnown = metrics?.totalKnownSegmentTimeMs ?? 0;
  const pct = durationMs != null && totalKnown > 0 ? (durationMs / totalKnown) * 100 : null;
  if (durationMs != null && durationMs >= thresholds.longDurationMs) return true;
  if (group.sources.length >= thresholds.repeatedOccurrenceCount) return true;
  if (group.sources.some((s) => s.severity === "high" || s.severity === "critical")) return true;
  // Time-share needs a non-trivial delay (floor at mediumMs) — a short single
  // delay that is 100% of a tiny corridor is not a bottleneck candidate.
  if (pct != null && pct >= thresholds.significantPctOfKnownTime && durationMs != null && durationMs >= thresholds.mediumMs) return true;
  return false;
}

/** (3) Detect bottleneck candidates for one transition (evidence-gated). */
export function detectMilestoneTransitionBottleneckFindings(
  transition: BuiltMilestoneTransition,
  metrics: MilestoneFlowTransitionMetrics | undefined,
  delayFindings: readonly MilestoneFlowDetectionFinding[],
  options: MilestoneFlowAdvancedDetectionOptions = {},
  reworkFindings: readonly MilestoneFlowReworkFinding[] = [],
): { findings: MilestoneFlowBottleneckFinding[]; warnings: MilestoneFlowEngineWarning[] } {
  const thresholds = resolveBottleneckThresholds(options.bottleneckThresholds);
  const warnings: MilestoneFlowEngineWarning[] = [];
  if (delayFindings.length === 0 && reworkFindings.length === 0) {
    warnings.push(advWarn("MISSING_DELAY_FINDINGS_FOR_BOTTLENECK_DETECTION", `no delay/rework findings for ${transition.transitionId}`, transition.transitionId));
    return { findings: [], warnings };
  }

  // Group sources by bottleneck type.
  const groups = new Map<MilestoneFlowBottleneckType, CandidateSource[]>();
  const add = (s: CandidateSource) => {
    const t = determineMilestoneBottleneckType(s);
    (groups.get(t) ?? groups.set(t, []).get(t)!).push(s);
  };
  for (const f of delayFindings) add(f);
  for (const r of reworkFindings) add(r);

  const findings: MilestoneFlowBottleneckFinding[] = [];
  for (const [bottleneckType, sources] of [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const group: CandidateGroup = { bottleneckType, sources };
    // Conservative gate: only qualifying groups become bottleneck candidates.
    if (!groupQualifies(group, metrics, thresholds)) continue;
    const finding = buildMilestoneFlowBottleneckFinding({ scope: transition.scope, transitionId: transition.transitionId, group, metrics, thresholds });
    findings.push(finding);
    warnings.push(...finding.warnings);
  }
  return { findings, warnings };
}
