// ============================================================================
// ProjectOps360° — MPF Engine · Delay Detector (Phase 3, Task 5)
// ============================================================================
// The first detection layer. Consumes Task 3 transitions/segments + Task 4
// metrics + the segment semantics already attached by Task 2/3, and emits
// structured findings for blockers, waiting time, decision delays, and approval
// delays. Pure + deterministic + replay-stable.
//
// It NEVER: rebuilds transitions/segments, recomputes durations (it READS Task 4
// segment metrics), re-interprets event semantics, calls Date.now(), classifies
// health or bottlenecks, mutates any input, or touches project_event_log /
// process_nodes / process_edges. `severity` is DETECTION severity, not health.
//
// Blocker detection lives in blocker-detector.ts (which imports the shared
// primitives below); it is re-exported through index.ts for discoverability.
// ============================================================================

import {
  MpfMissingProjectScopeError,
  MpfMissingOrganizationScopeError,
  MpfUnknownFailureError,
} from "./errors";
import { aggregateConfidence } from "./evidence";
import type {
  MilestoneFlowEvidenceRef,
  MilestoneFlowEvidenceConfidence,
  MilestoneFlowEngineWarning,
  MilestoneFlowProjectScope,
  MilestoneFlowSegment,
  MilestoneTransition,
} from "./types";
import type { MilestoneFlowSemanticCategory } from "./event-semantics-types";
import type { BuiltMilestoneTransition, BuiltMilestoneFlowSegment } from "./transition-builder-types";
import type { MilestoneFlowTransitionMetrics, MilestoneSegmentDurationResult } from "./metrics-calculator-types";
import {
  DEFAULT_MPF_SEVERITY_THRESHOLDS,
  type MilestoneFlowDetectionFinding,
  type MilestoneFlowFindingType,
  type MilestoneFlowFindingStatus,
  type MilestoneFlowFindingSeverity,
  type MilestoneFlowSeverityThresholds,
  type MilestoneFlowDelayDetectionInput,
  type MilestoneFlowDelayDetectionOptions,
  type MilestoneFlowDelayDetectionResult,
  type MilestoneFlowDelayDetectionStats,
} from "./delay-detector-types";

// A segment as consumed here (base + optional built fields).
export type SegmentForDetection = MilestoneFlowSegment &
  Partial<Pick<BuiltMilestoneFlowSegment, "isOpenEnded" | "confidence" | "sourceEventId" | "closingEventId" | "semanticCategories">>;

const CONFIDENCE_RANK: Record<MilestoneFlowEvidenceConfidence, number> = { unknown: 0, low: 1, medium: 2, high: 3 };
const weaker = (a: MilestoneFlowEvidenceConfidence, b: MilestoneFlowEvidenceConfidence) =>
  CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b;

function warn(code: string, message: string, transitionId?: string): MilestoneFlowEngineWarning {
  return { code, message, transitionId: transitionId ?? null };
}

// ── (11) Evidence merge (dedup) ───────────────────────────────────────────────

/** (11) Deduplicate evidence refs across sources. */
export function mergeMilestoneFlowFindingEvidence(
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

// ── (8) Status ────────────────────────────────────────────────────────────────

/** (8) open / resolved / partial / unknown from segment + segment metrics. */
export function determineMilestoneFlowFindingStatus(
  segment: SegmentForDetection,
  durationResult: MilestoneSegmentDurationResult | undefined,
): MilestoneFlowFindingStatus {
  if (!segment.evidence || segment.evidence.length === 0) return "unknown";
  const isOpen = segment.isOpenEnded ?? segment.endedAt == null;
  if (isOpen) return "open";
  if (segment.closingEventId != null) return "resolved";
  if (segment.endedAt != null) return "resolved";
  if (durationResult?.segmentDurationMs == null) return "partial";
  return "resolved";
}

// ── (10) Confidence ───────────────────────────────────────────────────────────

/** (10) Finding confidence — never above the weakest evidence; capped when the
 *  duration is unknown or evidence is missing. */
export function determineMilestoneFlowFindingConfidence(input: {
  evidence: readonly MilestoneFlowEvidenceRef[];
  segmentConfidence?: MilestoneFlowEvidenceConfidence;
  metricConfidence?: MilestoneFlowEvidenceConfidence;
  durationMs: number | null;
}): MilestoneFlowEvidenceConfidence {
  if (input.evidence.length === 0) return "unknown";
  let conf = input.segmentConfidence ?? aggregateConfidence(input.evidence);
  if (input.metricConfidence) conf = weaker(conf, input.metricConfidence);
  if (input.durationMs == null) conf = weaker(conf, "low"); // can't size the delay
  return conf;
}

// ── (9) Severity (DETECTION severity — not health) ────────────────────────────

const DOWNGRADE: Record<MilestoneFlowFindingSeverity, MilestoneFlowFindingSeverity> = {
  critical: "high",
  high: "medium",
  medium: "low",
  low: "low",
  unknown: "unknown",
};

/** (9) Detection severity from duration/type/confidence. NOT transition health. */
export function determineMilestoneFlowFindingSeverity(
  finding: { durationMs: number | null; findingType: MilestoneFlowFindingType; confidence: MilestoneFlowEvidenceConfidence },
  thresholds: MilestoneFlowSeverityThresholds = DEFAULT_MPF_SEVERITY_THRESHOLDS,
): MilestoneFlowFindingSeverity {
  const d = finding.durationMs;
  if (d == null) return "unknown"; // conservative: unsized delays are not escalated
  let sev: MilestoneFlowFindingSeverity;
  if (finding.findingType === "waiting_time") {
    sev = d >= thresholds.waitingHighMs ? "high" : d >= thresholds.waitingMediumMs ? "medium" : "low";
  } else {
    // Progress-blocking: blocker / decision_delay / approval_delay.
    sev =
      d >= thresholds.blockingCriticalMs ? "critical" :
      d >= thresholds.blockingHighMs ? "high" :
      d >= thresholds.blockingMediumMs ? "medium" : "low";
  }
  // Low-confidence detections are not screamed as critical.
  if (finding.confidence === "unknown") sev = DOWNGRADE[sev];
  return sev;
}

// ── (7) Normalized finding builder ────────────────────────────────────────────

export interface BuildFindingParams {
  scope: MilestoneFlowProjectScope;
  transitionId: string;
  findingType: MilestoneFlowFindingType;
  segment: SegmentForDetection;
  durationResult: MilestoneSegmentDurationResult | undefined;
  metricConfidence?: MilestoneFlowEvidenceConfidence;
  metricRefs: string[];
  thresholds: MilestoneFlowSeverityThresholds;
}

/** (7) Build a normalized finding with evidence, status, duration, confidence, severity. */
export function buildMilestoneFlowDetectionFinding(params: BuildFindingParams): MilestoneFlowDetectionFinding {
  const { scope, transitionId, findingType, segment, durationResult, metricRefs, thresholds } = params;
  const warnings: MilestoneFlowEngineWarning[] = [];

  const evidenceRefs = mergeMilestoneFlowFindingEvidence(segment.evidence, durationResult?.evidenceRefs ?? []);
  if (evidenceRefs.length === 0) {
    warnings.push(warn("MISSING_SEGMENT_EVIDENCE", `finding for ${segment.segmentId} has no evidence`, transitionId));
  }

  // Duration comes ONLY from Task 4 metrics — never recomputed here.
  const durationMs = durationResult?.segmentDurationMs ?? null;
  if (durationMs == null) {
    warnings.push(warn("MISSING_FINDING_DURATION", `finding for ${segment.segmentId} has unknown duration`, transitionId));
  }

  const status = determineMilestoneFlowFindingStatus(segment, durationResult);
  const isOpen = segment.isOpenEnded ?? segment.endedAt == null;

  const confidence = determineMilestoneFlowFindingConfidence({
    evidence: evidenceRefs,
    segmentConfidence: segment.confidence,
    metricConfidence: params.metricConfidence,
    durationMs,
  });
  if (confidence === "unknown") {
    warnings.push(warn("UNKNOWN_FINDING_CONFIDENCE", `finding for ${segment.segmentId} has unknown confidence`, transitionId));
  }
  if (status === "partial") {
    warnings.push(warn("DETECTION_WITH_PARTIAL_EVIDENCE", `finding for ${segment.segmentId} is partial`, transitionId));
  }

  const severity = determineMilestoneFlowFindingSeverity({ durationMs, findingType, confidence }, thresholds);

  const sourceEventIds = mergeEventIds(segment, evidenceRefs);
  const semanticCategories: MilestoneFlowSemanticCategory[] = segment.semanticCategories ?? [];

  return {
    findingId: `${transitionId}__finding_${findingType}_${segment.segmentId}`,
    transitionId,
    projectId: scope.projectId,
    organizationId: scope.organizationId,
    findingType,
    status,
    severity,
    confidence,
    startedAt: segment.startedAt,
    endedAt: segment.endedAt,
    durationMs,
    isOpen,
    sourceSegmentIds: [segment.segmentId],
    sourceEventIds,
    evidenceRefs,
    metricRefs,
    semanticCategories,
    calculationNotes: [
      `${findingType} from ${segment.type} segment; duration read from Task 4 metrics (${durationMs == null ? "unknown" : durationMs + "ms"})`,
      `status=${status}; severity=${severity} (detection severity, not health)`,
    ],
    warnings,
  };
}

function mergeEventIds(segment: SegmentForDetection, evidence: readonly MilestoneFlowEvidenceRef[]): string[] {
  const ids = new Set<string>();
  if (segment.sourceEventId) ids.add(segment.sourceEventId);
  if (segment.closingEventId) ids.add(segment.closingEventId);
  for (const e of evidence) if (e.eventId) ids.add(e.eventId);
  return [...ids];
}

// ── Per-type detectors (share the builder above) ──────────────────────────────

function segmentDurationMap(
  metrics: MilestoneFlowTransitionMetrics | undefined,
): Map<string, MilestoneSegmentDurationResult> {
  const m = new Map<string, MilestoneSegmentDurationResult>();
  for (const d of metrics?.segmentDurations ?? []) m.set(d.segmentId, d);
  return m;
}

function detectByType(
  findingType: MilestoneFlowFindingType,
  segmentType: MilestoneFlowSegment["type"],
  metricRefKey: keyof MilestoneFlowTransitionMetrics,
  transition: BuiltMilestoneTransition,
  metrics: MilestoneFlowTransitionMetrics | undefined,
  options: MilestoneFlowDelayDetectionOptions,
): MilestoneFlowDetectionFinding[] {
  const thresholds = { ...DEFAULT_MPF_SEVERITY_THRESHOLDS, ...(options.thresholds ?? {}) };
  const durations = segmentDurationMap(metrics);
  const out: MilestoneFlowDetectionFinding[] = [];
  for (const segment of transition.segments) {
    if (segment.type !== segmentType) continue;
    out.push(
      buildMilestoneFlowDetectionFinding({
        scope: transition.scope,
        transitionId: transition.transitionId,
        findingType,
        segment,
        durationResult: durations.get(segment.segmentId),
        metricConfidence: metrics?.confidence,
        metricRefs: [`metrics.${String(metricRefKey)}`, `metrics.segmentDurations.${segment.segmentId}`],
        thresholds,
      }),
    );
  }
  return out;
}

/** (3) Blocker findings from blocked segments (open when open-ended, resolved on
 *  the unblocking event that closed the segment in Task 3). Blocking, not bottleneck. */
export function detectBlockerFindings(
  transition: BuiltMilestoneTransition,
  metrics: MilestoneFlowTransitionMetrics | undefined,
  options: MilestoneFlowDelayDetectionOptions = {},
): MilestoneFlowDetectionFinding[] {
  return detectByType("blocker", "blocked", "blockedTimeMs", transition, metrics, options);
}

/** (4) Waiting time findings from waiting segments. */
export function detectWaitingTimeFindings(
  transition: BuiltMilestoneTransition,
  metrics: MilestoneFlowTransitionMetrics | undefined,
  options: MilestoneFlowDelayDetectionOptions = {},
): MilestoneFlowDetectionFinding[] {
  return detectByType("waiting_time", "waiting", "waitingTimeMs", transition, metrics, options);
}

/** (5) Decision delay findings from decision_delay segments. */
export function detectDecisionDelayFindings(
  transition: BuiltMilestoneTransition,
  metrics: MilestoneFlowTransitionMetrics | undefined,
  options: MilestoneFlowDelayDetectionOptions = {},
): MilestoneFlowDetectionFinding[] {
  return detectByType("decision_delay", "decision_delay", "decisionDelayTimeMs", transition, metrics, options);
}

/** (6) Approval delay findings from approval_delay segments. */
export function detectApprovalDelayFindings(
  transition: BuiltMilestoneTransition,
  metrics: MilestoneFlowTransitionMetrics | undefined,
  options: MilestoneFlowDelayDetectionOptions = {},
): MilestoneFlowDetectionFinding[] {
  return detectByType("approval_delay", "approval_delay", "approvalDelayTimeMs", transition, metrics, options);
}

// Shared builder used by blocker-detector.ts (avoids a re-export cycle).
export function detectFindingsForSegmentType(
  findingType: MilestoneFlowFindingType,
  segmentType: MilestoneFlowSegment["type"],
  metricRefKey: keyof MilestoneFlowTransitionMetrics,
  transition: BuiltMilestoneTransition,
  metrics: MilestoneFlowTransitionMetrics | undefined,
  options: MilestoneFlowDelayDetectionOptions,
): MilestoneFlowDetectionFinding[] {
  return detectByType(findingType, segmentType, metricRefKey, transition, metrics, options);
}

// ── (13) Warnings ─────────────────────────────────────────────────────────────

/** (13) Transition-level detection warnings (missing metrics, unknown segments skipped). */
export function createMilestoneFlowDelayDetectionWarnings(
  transition: BuiltMilestoneTransition,
  metrics: MilestoneFlowTransitionMetrics | undefined,
): MilestoneFlowEngineWarning[] {
  const warnings: MilestoneFlowEngineWarning[] = [];
  if (!metrics) {
    warnings.push(warn("MISSING_METRICS_FOR_TRANSITION", `no metrics for transition ${transition.transitionId}`, transition.transitionId));
  }
  const unknownSkipped = transition.segments.filter((s) => s.type === "unknown").length;
  if (unknownSkipped > 0) {
    warnings.push(warn("UNKNOWN_SEGMENT_SKIPPED", `${unknownSkipped} unknown segment(s) skipped (no specific delay finding)`, transition.transitionId));
  }
  return warnings;
}

// ── (2) Per-transition detection ──────────────────────────────────────────────

/** (2) All delay/blocker findings for one transition. */
export function detectMilestoneTransitionDelays(
  transition: BuiltMilestoneTransition,
  metrics: MilestoneFlowTransitionMetrics | undefined,
  options: MilestoneFlowDelayDetectionOptions = {},
): { findings: MilestoneFlowDetectionFinding[]; warnings: MilestoneFlowEngineWarning[] } {
  const findings = [
    ...detectBlockerFindings(transition, metrics, options),
    ...detectWaitingTimeFindings(transition, metrics, options),
    ...detectDecisionDelayFindings(transition, metrics, options),
    ...detectApprovalDelayFindings(transition, metrics, options),
  ];
  const warnings = [
    ...createMilestoneFlowDelayDetectionWarnings(transition, metrics),
    ...findings.flatMap((f) => f.warnings),
  ];
  return { findings, warnings };
}

// ── (12) Input validation ─────────────────────────────────────────────────────

/** (12) Validate detection input; hard-fails only on structurally invalid input. */
export function validateMilestoneFlowDelayDetectionInput(input: MilestoneFlowDelayDetectionInput): void {
  if (!input.scope || !input.scope.organizationId) throw new MpfMissingOrganizationScopeError();
  if (!input.scope.projectId) throw new MpfMissingProjectScopeError();
  if (!Array.isArray(input.transitions)) throw new MpfUnknownFailureError("transitions must be an array");
  if (input.metricsByTransition == null || typeof input.metricsByTransition !== "object") {
    throw new MpfUnknownFailureError("metricsByTransition must be an object");
  }
  if (input.options?.thresholds != null && typeof input.options.thresholds !== "object") {
    throw new MpfUnknownFailureError("options.thresholds must be an object");
  }
}

// ── (1) All transitions ───────────────────────────────────────────────────────

/** (1) Detect blockers, waiting time, decision delays & approval delays. */
export function detectMilestoneFlowDelays(
  input: MilestoneFlowDelayDetectionInput,
): MilestoneFlowDelayDetectionResult {
  validateMilestoneFlowDelayDetectionInput(input);

  const findingsByTransition: Record<string, MilestoneFlowDetectionFinding[]> = {};
  const allFindings: MilestoneFlowDetectionFinding[] = [];
  const warnings: MilestoneFlowEngineWarning[] = [];

  for (const transition of input.transitions) {
    const metrics = input.metricsByTransition[transition.transitionId];
    const { findings, warnings: tWarnings } = detectMilestoneTransitionDelays(transition, metrics, input.options ?? {});
    findingsByTransition[transition.transitionId] = findings;
    allFindings.push(...findings);
    warnings.push(...tWarnings);
  }

  return {
    findingsByTransition,
    findings: allFindings,
    warnings,
    stats: summarizeFindings(allFindings),
  };
}

export function summarizeFindings(findings: readonly MilestoneFlowDetectionFinding[]): MilestoneFlowDelayDetectionStats {
  const has = (t: MilestoneFlowFindingType) => findings.filter((f) => f.findingType === t).length;
  return {
    delayFindingCount: findings.length,
    blockerFindingCount: has("blocker"),
    waitingFindingCount: has("waiting_time"),
    decisionDelayFindingCount: has("decision_delay"),
    approvalDelayFindingCount: has("approval_delay"),
    openFindingCount: findings.filter((f) => f.status === "open").length,
    resolvedFindingCount: findings.filter((f) => f.status === "resolved").length,
    unknownFindingCount: findings.filter((f) => f.status === "unknown").length,
    highSeverityFindingCount: findings.filter((f) => f.severity === "high" || f.severity === "critical").length,
  };
}

// Re-export so `MilestoneTransition` base-typed callers can use the detector too.
export type { MilestoneTransition };
