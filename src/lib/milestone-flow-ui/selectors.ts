// ============================================================================
// ProjectOps360° — Milestone Process Flow · UI Selectors (Phase 3, Task 8)
// ============================================================================
// PURE, display-only selectors for the Living Graph UI consumer
// (PEG-MPF-LIVING-GRAPH-UI-CONSUMER). They FORMAT the MPF Engine projection —
// they NEVER rebuild transitions/segments, NEVER recalculate metrics, NEVER
// classify health, and NEVER detect delays/rework/bottlenecks/propagation.
// Every value in the view-model is read from engine output; the only additions
// are presentation labels (duration formatting, evidence counts, dedup).
//
// Causality guardrail (Task 6/7): a `dependency` bottleneck cause below high
// confidence is the engine's conservative FALLBACK, not a confirmed cause
// (see transition-health-classifier.ts → ambiguousBlockerCause). The selectors
// surface that exact engine rule as `isAmbiguousDependencyFallback` so the UI
// can never present it as confirmed fact. Uncertainty is surfaced, never hidden.
//
// Type-only imports from the engine — no engine algorithm runs here.
// ============================================================================

import type {
  MilestoneFlowProjection,
  MilestoneTransition,
  MilestoneTransitionHealthStatus,
  MilestoneFlowSegmentType,
  MilestoneFlowEvidenceRef,
  MilestoneFlowEvidenceConfidence,
  MilestoneFlowMetrics,
  MilestoneFlowTransitionMetrics,
  MilestoneFlowDetectionFinding,
  MilestoneFlowReworkFinding,
  MilestoneFlowBottleneckFinding,
  MilestoneConstraintPropagationFinding,
  MilestoneTransitionHealthSummaryResult,
  MilestoneFlowIsabellaEvidencePacket,
  MilestoneRecommendedActionCategory,
  MilestoneHealthReasonCode,
  MilestoneHealthUncertaintyNote,
} from "@/lib/milestone-flow";

// ── Evidence ref view (drill-down detail) ─────────────────────────────────────

export interface MilestoneFlowEvidenceRefVM {
  kind: MilestoneFlowEvidenceRef["kind"];
  eventId: string | null;
  metricRef: string | null;
  note: string | null;
  confidence: MilestoneFlowEvidenceConfidence;
}

function toEvidenceRefVM(ref: MilestoneFlowEvidenceRef): MilestoneFlowEvidenceRefVM {
  return {
    kind: ref.kind,
    eventId: ref.eventId ?? null,
    metricRef: ref.metricRef ?? null,
    note: ref.note ?? null,
    confidence: ref.confidence,
  };
}

function evidenceKey(ref: MilestoneFlowEvidenceRefVM): string {
  return `${ref.kind}|${ref.eventId ?? ""}|${ref.metricRef ?? ""}|${ref.note ?? ""}`;
}

function dedupeEvidence(refs: MilestoneFlowEvidenceRefVM[]): MilestoneFlowEvidenceRefVM[] {
  const seen = new Set<string>();
  const out: MilestoneFlowEvidenceRefVM[] = [];
  for (const r of refs) {
    const k = evidenceKey(r);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(r);
    }
  }
  return out;
}

// ── Duration FORMATTING (presentation of already-calculated values only) ──────

/**
 * Format an engine-calculated duration for display. Returns null for null —
 * missing durations are shown honestly as unknown, never fabricated.
 */
export function formatDurationMs(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (ms < minute) return "<1m";
  const days = Math.floor(ms / day);
  const hours = Math.floor((ms % day) / hour);
  const minutes = Math.floor((ms % hour) / minute);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (days === 0 && minutes > 0) parts.push(`${minutes}m`);
  return parts.length > 0 ? parts.join(" ") : "<1m";
}

/** Format an engine-calculated ratio (0..1) as a percent label; null stays null. */
export function formatRatioAsPercent(ratio: number | null | undefined): string | null {
  if (ratio == null || !Number.isFinite(ratio)) return null;
  return `${Math.round(ratio * 100)}%`;
}

// ── Segment VM ────────────────────────────────────────────────────────────────

export interface MilestoneFlowSegmentVM {
  segmentId: string;
  type: MilestoneFlowSegmentType;
  startedAt: string | null;
  endedAt: string | null;
  /** Engine-calculated (Task 4 segmentDurations, falling back to the segment's own field). */
  durationMs: number | null;
  durationLabel: string | null;
  isOpenEnded: boolean;
  confidence: MilestoneFlowEvidenceConfidence;
  evidenceCount: number;
  hasWarnings: boolean;
  frictionType: string | null;
  evidence: MilestoneFlowEvidenceRefVM[];
}

// ── Metrics VM (values read from Task 4 output — no recalculation) ────────────

export interface MilestoneFlowMetricVM {
  /** Stable metric key (also the i18n label key under milestoneFlow.metrics). */
  key: string;
  valueMs: number | null;
  label: string | null;
}

export interface MilestoneFlowMetricsVM {
  transitionId: string;
  durations: MilestoneFlowMetricVM[];
  timeBuckets: MilestoneFlowMetricVM[];
  flowEfficiencyRatio: number | null;
  flowEfficiencyLabel: string | null;
  segmentCount: number;
  openSegmentCount: number;
  unknownSegmentCount: number;
  totalKnownSegmentTimeMs: number | null;
  totalKnownSegmentTimeLabel: string | null;
  completeness: string;
  confidence: MilestoneFlowEvidenceConfidence;
  warningCount: number;
}

function metricVM(key: string, valueMs: number | null | undefined): MilestoneFlowMetricVM {
  const v = valueMs ?? null;
  return { key, valueMs: v, label: formatDurationMs(v) };
}

/**
 * The projection's contract type is the Task 1 base metrics; the engine
 * populates the richer Task 4 shape additively. Narrow without assuming.
 */
function asRichMetrics(m: MilestoneFlowMetrics): MilestoneFlowTransitionMetrics | null {
  const rich = m as Partial<MilestoneFlowTransitionMetrics>;
  return rich.durationDetail != null && rich.timeBuckets != null && rich.counters != null
    ? (m as MilestoneFlowTransitionMetrics)
    : null;
}

function toMetricsVM(transitionId: string, metrics: MilestoneFlowMetrics): MilestoneFlowMetricsVM {
  const rich = asRichMetrics(metrics);
  const d = rich?.durationDetail ?? metrics.duration;
  const segmentCount = rich?.counters.segmentCount ?? 0;
  return {
    transitionId: rich?.transitionId ?? transitionId,
    durations: [
      metricVM("plannedDuration", d.plannedDurationMs),
      metricVM("actualDuration", d.actualDurationMs),
      metricVM("elapsedDuration", rich?.durationDetail.elapsedDurationMs ?? null),
    ],
    timeBuckets: [
      metricVM("activeWorkTime", metrics.activeWorkTimeMs),
      metricVM("waitingTime", metrics.waitingTimeMs),
      metricVM("blockedTime", metrics.blockedTimeMs),
      metricVM("decisionDelayTime", metrics.decisionDelayTimeMs),
      metricVM("approvalDelayTime", metrics.approvalDelayTimeMs),
      metricVM("reworkTime", metrics.reworkTimeMs),
      metricVM("unknownTime", rich?.timeBuckets.unknownTimeMs ?? null),
    ],
    flowEfficiencyRatio: metrics.efficiency.flowEfficiencyRatio,
    flowEfficiencyLabel: formatRatioAsPercent(metrics.efficiency.flowEfficiencyRatio),
    segmentCount,
    openSegmentCount: rich?.counters.openSegmentCount ?? 0,
    unknownSegmentCount: rich?.counters.unknownSegmentCount ?? 0,
    totalKnownSegmentTimeMs: rich?.totalKnownSegmentTimeMs ?? null,
    totalKnownSegmentTimeLabel: formatDurationMs(rich?.totalKnownSegmentTimeMs),
    completeness: rich?.durationDetail.durationCompleteness ?? "unknown",
    confidence: rich?.confidence ?? "unknown",
    warningCount: rich?.warnings.length ?? 0,
  };
}

// ── Finding VMs (Tasks 5/6 — displayed, never re-detected) ────────────────────

export interface MilestoneFlowDelayFindingVM {
  findingId: string;
  findingType: MilestoneFlowDetectionFinding["findingType"];
  status: string;
  severity: string;
  confidence: MilestoneFlowEvidenceConfidence;
  isOpen: boolean;
  durationMs: number | null;
  durationLabel: string | null;
  evidenceCount: number;
  sourceSegmentIds: string[];
  sourceEventIds: string[];
  metricRefs: string[];
  calculationNotes: string[];
  warningCount: number;
  evidence: MilestoneFlowEvidenceRefVM[];
}

export interface MilestoneFlowReworkFindingVM extends Omit<MilestoneFlowDelayFindingVM, "findingType"> {
  reworkType: string;
  triggerType: string;
}

export interface MilestoneFlowBottleneckFindingVM {
  findingId: string;
  bottleneckType: string;
  status: string;
  /** "possible" status must be shown as possible — never as confirmed. */
  isPossible: boolean;
  severity: string;
  confidence: MilestoneFlowEvidenceConfidence;
  durationMs: number | null;
  durationLabel: string | null;
  occurrenceCount: number;
  candidateReason: string;
  isStructuralCandidate: boolean;
  /**
   * Mirrors the ENGINE rule (transition-health-classifier.ts): a `dependency`
   * cause below high confidence is the Task 6 conservative fallback and must
   * be rendered as an unconfirmed/ambiguous cause — never as confirmed fact.
   */
  isAmbiguousDependencyFallback: boolean;
  evidenceCount: number;
  metricRefs: string[];
  calculationNotes: string[];
  warningCount: number;
  evidence: MilestoneFlowEvidenceRefVM[];
}

export interface MilestoneFlowPropagationFindingVM {
  findingId: string;
  originTransitionId: string;
  affectedTransitionId: string;
  propagationType: string;
  status: string;
  /** "possible" propagation must be labeled possible — never presented as fact. */
  isPossible: boolean;
  severity: string;
  confidence: MilestoneFlowEvidenceConfidence;
  delayImpactMs: number | null;
  delayImpactLabel: string | null;
  propagationPath: string[];
  propagationReason: string;
  evidenceCount: number;
  warningCount: number;
  evidence: MilestoneFlowEvidenceRefVM[];
}

function toDelayFindingVM(f: MilestoneFlowDetectionFinding): MilestoneFlowDelayFindingVM {
  return {
    findingId: f.findingId,
    findingType: f.findingType,
    status: f.status,
    severity: f.severity,
    confidence: f.confidence,
    isOpen: f.isOpen,
    durationMs: f.durationMs,
    durationLabel: formatDurationMs(f.durationMs),
    evidenceCount: f.evidenceRefs.length,
    sourceSegmentIds: [...f.sourceSegmentIds],
    sourceEventIds: [...f.sourceEventIds],
    metricRefs: [...f.metricRefs],
    calculationNotes: [...f.calculationNotes],
    warningCount: f.warnings.length,
    evidence: f.evidenceRefs.map(toEvidenceRefVM),
  };
}

function toReworkFindingVM(f: MilestoneFlowReworkFinding): MilestoneFlowReworkFindingVM {
  return {
    findingId: f.findingId,
    reworkType: f.reworkType,
    triggerType: f.triggerType,
    status: f.status,
    severity: f.severity,
    confidence: f.confidence,
    isOpen: f.isOpen,
    durationMs: f.durationMs,
    durationLabel: formatDurationMs(f.durationMs),
    evidenceCount: f.evidenceRefs.length,
    sourceSegmentIds: [...f.sourceSegmentIds],
    sourceEventIds: [...f.sourceEventIds],
    metricRefs: [...f.metricRefs],
    calculationNotes: [...f.calculationNotes],
    warningCount: f.warnings.length,
    evidence: f.evidenceRefs.map(toEvidenceRefVM),
  };
}

function toBottleneckFindingVM(f: MilestoneFlowBottleneckFinding): MilestoneFlowBottleneckFindingVM {
  return {
    findingId: f.findingId,
    bottleneckType: f.bottleneckType,
    status: f.status,
    isPossible: f.status === "possible",
    severity: f.severity,
    confidence: f.confidence,
    durationMs: f.durationMs,
    durationLabel: formatDurationMs(f.durationMs),
    occurrenceCount: f.occurrenceCount,
    candidateReason: f.candidateReason,
    isStructuralCandidate: f.isStructuralCandidate,
    // Exact engine rule — see transition-health-classifier.ts (ambiguousBlockerCause).
    isAmbiguousDependencyFallback: f.bottleneckType === "dependency" && f.confidence !== "high",
    evidenceCount: f.evidenceRefs.length,
    metricRefs: [...f.metricRefs],
    calculationNotes: [...f.calculationNotes],
    warningCount: f.warnings.length,
    evidence: f.evidenceRefs.map(toEvidenceRefVM),
  };
}

function toPropagationFindingVM(f: MilestoneConstraintPropagationFinding): MilestoneFlowPropagationFindingVM {
  return {
    findingId: f.findingId,
    originTransitionId: f.originTransitionId,
    affectedTransitionId: f.affectedTransitionId,
    propagationType: f.propagationType,
    status: f.status,
    isPossible: f.status === "possible",
    severity: f.severity,
    confidence: f.confidence,
    delayImpactMs: f.delayImpactMs,
    delayImpactLabel: formatDurationMs(f.delayImpactMs),
    propagationPath: [...f.propagationPath],
    propagationReason: f.propagationReason,
    evidenceCount: f.evidenceRefs.length,
    warningCount: f.warnings.length,
    evidence: f.evidenceRefs.map(toEvidenceRefVM),
  };
}

// ── Health VM (Task 7 — displayed, never reclassified) ────────────────────────

export interface MilestoneFlowHealthVM {
  status: MilestoneTransitionHealthStatus;
  confidence: MilestoneFlowEvidenceConfidence;
  primaryReasonCode: MilestoneHealthReasonCode | null;
  secondaryReasonCodes: MilestoneHealthReasonCode[];
  reasons: { code: string; detail: string }[];
  recommendedActionCategory: MilestoneRecommendedActionCategory;
  uncertaintyNotes: MilestoneHealthUncertaintyNote[];
  evidenceCount: number;
  warningCount: number;
  evidence: MilestoneFlowEvidenceRefVM[];
}

function toHealthVM(s: MilestoneTransitionHealthSummaryResult): MilestoneFlowHealthVM {
  return {
    status: s.healthStatus,
    confidence: s.confidence,
    primaryReasonCode: s.reasonCodes[0] ?? null,
    secondaryReasonCodes: s.reasonCodes.slice(1),
    reasons: s.reasons.map((r) => ({ code: r.code, detail: r.detail })),
    recommendedActionCategory: s.recommendedActionCategory,
    uncertaintyNotes: [...s.uncertaintyNotes],
    evidenceCount: s.evidenceRefs.length,
    warningCount: s.warnings.length,
    evidence: s.evidenceRefs.map(toEvidenceRefVM),
  };
}

// ── Isabella packet VM (structured preview only — never prose, never LLM) ─────

export interface MilestoneFlowIsabellaVM {
  transitionId: string;
  healthStatus: MilestoneTransitionHealthStatus;
  confidence: MilestoneFlowEvidenceConfidence;
  /** Facts WITHOUT an eventId/metricRef are dropped — a fact requires evidence. */
  facts: MilestoneFlowEvidenceRefVM[];
  inferences: MilestoneFlowEvidenceRefVM[];
  /** Predictions are rendered in their own, visually distinct section. */
  predictions: MilestoneFlowEvidenceRefVM[];
  /** Recommendations are action categories only — no advice prose. */
  recommendations: MilestoneFlowEvidenceRefVM[];
  uncertainties: MilestoneFlowEvidenceRefVM[];
  allowedClaims: string[];
  disallowedClaims: string[];
  recommendedActionCategory: MilestoneRecommendedActionCategory;
}

function toIsabellaVM(p: MilestoneFlowIsabellaEvidencePacket): MilestoneFlowIsabellaVM {
  return {
    transitionId: p.transitionId,
    healthStatus: p.healthStatus,
    confidence: p.confidence,
    facts: p.facts.filter((f) => f.eventId != null || f.metricRef != null).map(toEvidenceRefVM),
    inferences: p.inferences.map(toEvidenceRefVM),
    predictions: p.predictions.map(toEvidenceRefVM),
    recommendations: p.recommendations.map(toEvidenceRefVM),
    uncertainties: p.uncertainties.map(toEvidenceRefVM),
    allowedClaims: [...p.allowedClaims],
    disallowedClaims: [...p.disallowedClaims],
    recommendedActionCategory: p.recommendedActionCategory,
  };
}

// ── Transition VM ─────────────────────────────────────────────────────────────

export interface MilestoneFlowTransitionVM {
  transitionId: string;
  sourceMilestoneId: string | null;
  sourceMilestoneName: string | null;
  targetMilestoneId: string;
  targetMilestoneName: string;
  transitionStatus: string;
  isBlocked: boolean;
  startedAt: string | null;
  completedAt: string | null;
  lastEventAt: string | null;
  health: MilestoneFlowHealthVM | null;
  segments: MilestoneFlowSegmentVM[];
  metrics: MilestoneFlowMetricsVM | null;
  delayFindings: MilestoneFlowDelayFindingVM[];
  reworkFindings: MilestoneFlowReworkFindingVM[];
  bottleneckFindings: MilestoneFlowBottleneckFindingVM[];
  /** Propagation where this transition is the origin. */
  propagationsOut: MilestoneFlowPropagationFindingVM[];
  /** Propagation where this transition is affected downstream. */
  propagationsIn: MilestoneFlowPropagationFindingVM[];
  isabella: MilestoneFlowIsabellaVM | null;
  /** Deduped drill-down evidence across health + findings + segments. */
  evidence: MilestoneFlowEvidenceRefVM[];
  hasUncertainty: boolean;
  hasWarnings: boolean;
  findingCount: number;
  openFindingCount: number;
}

// ── Full view-model ───────────────────────────────────────────────────────────

export interface MilestoneFlowObservabilityVM {
  engineVersion: string;
  configVersion: string;
  generatedAt: string;
  transitionCount: number;
  segmentCount: number;
  delayFindingCount: number;
  reworkFindingCount: number;
  bottleneckFindingCount: number;
  constraintPropagationFindingCount: number;
  unknownHealthCount: number;
  isabellaPacketCount: number;
  warningCount: number;
  warnings: { code: string; message: string; transitionId: string | null }[];
}

export interface MilestoneFlowViewModel {
  projectId: string;
  generatedAt: string;
  engineVersion: string;
  configVersion: string;
  dataQualityFlags: string[];
  transitions: MilestoneFlowTransitionVM[];
  healthCounts: Partial<Record<MilestoneTransitionHealthStatus, number>>;
  observability: MilestoneFlowObservabilityVM;
}

function toSegmentVMs(
  transition: MilestoneTransition,
  metrics: MilestoneFlowMetrics | undefined,
): MilestoneFlowSegmentVM[] {
  const rich = metrics ? asRichMetrics(metrics) : null;
  const durationsBySegment = new Map(
    (rich?.segmentDurations ?? []).map((d) => [d.segmentId, d]),
  );
  return transition.segments.map((s) => {
    const d = durationsBySegment.get(s.segmentId);
    // Additive builder fields (confidence) — read when present, never derived.
    const builderConfidence = (s as { confidence?: MilestoneFlowEvidenceConfidence }).confidence;
    const durationMs = d ? d.segmentDurationMs : s.durationMs;
    return {
      segmentId: s.segmentId,
      type: s.type,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      durationMs,
      durationLabel: formatDurationMs(durationMs),
      isOpenEnded: d ? d.isOpenEnded : s.endedAt == null,
      confidence: d?.confidence ?? builderConfidence ?? "unknown",
      evidenceCount: s.evidence.length,
      hasWarnings: (d?.warnings.length ?? 0) > 0,
      frictionType: s.frictionType ?? null,
      evidence: s.evidence.map(toEvidenceRefVM),
    };
  });
}

/**
 * Build the display view-model from an ENGINE projection. Pure and read-only:
 * the projection is never mutated and no intelligence is derived here.
 */
export function buildMilestoneFlowViewModel(
  projection: MilestoneFlowProjection,
  milestoneNamesById: Record<string, string>,
): MilestoneFlowViewModel {
  const propagations = projection.constraintPropagationFindings ?? [];
  const healthCounts: Partial<Record<MilestoneTransitionHealthStatus, number>> = {};

  const transitions = projection.transitions.map((t): MilestoneFlowTransitionVM => {
    const metrics = projection.metricsByTransition[t.transitionId];
    const healthSummary = projection.healthSummariesByTransition?.[t.transitionId];
    const packet = projection.isabellaEvidencePacketsByTransition?.[t.transitionId];
    const delayFindings = (projection.findingsByTransition?.[t.transitionId] ?? []).map(toDelayFindingVM);
    const reworkFindings = (projection.reworkFindingsByTransition?.[t.transitionId] ?? []).map(toReworkFindingVM);
    const bottleneckFindings = (projection.bottleneckFindingsByTransition?.[t.transitionId] ?? []).map(toBottleneckFindingVM);
    const propagationsOut = propagations.filter((p) => p.originTransitionId === t.transitionId).map(toPropagationFindingVM);
    const propagationsIn = propagations.filter((p) => p.affectedTransitionId === t.transitionId).map(toPropagationFindingVM);

    const health = healthSummary ? toHealthVM(healthSummary) : null;
    const status = health?.status ?? "unknown";
    healthCounts[status] = (healthCounts[status] ?? 0) + 1;

    const segments = toSegmentVMs(t, metrics);
    const allFindingEvidence = [
      ...delayFindings,
      ...reworkFindings,
      ...bottleneckFindings,
      ...propagationsOut,
      ...propagationsIn,
    ].flatMap((f) => f.evidence);
    const evidence = dedupeEvidence([
      ...(health?.evidence ?? []),
      ...allFindingEvidence,
      ...segments.flatMap((s) => s.evidence),
    ]);

    const findingCount =
      delayFindings.length + reworkFindings.length + bottleneckFindings.length + propagationsOut.length + propagationsIn.length;
    const openFindingCount =
      delayFindings.filter((f) => f.isOpen).length + reworkFindings.filter((f) => f.isOpen).length;

    const hasUncertainty =
      (health?.uncertaintyNotes.length ?? 0) > 0 ||
      health?.confidence === "unknown" ||
      health?.confidence === "low" ||
      bottleneckFindings.some((b) => b.isPossible || b.isAmbiguousDependencyFallback) ||
      [...propagationsOut, ...propagationsIn].some((p) => p.isPossible);

    const richMetrics = metrics ? asRichMetrics(metrics) : null;
    const hasWarnings =
      (health?.warningCount ?? 0) > 0 ||
      (richMetrics?.warnings.length ?? 0) > 0 ||
      [...delayFindings, ...reworkFindings, ...bottleneckFindings].some((f) => f.warningCount > 0);

    return {
      transitionId: t.transitionId,
      sourceMilestoneId: t.sourceMilestoneId,
      sourceMilestoneName: t.sourceMilestoneId ? (milestoneNamesById[t.sourceMilestoneId] ?? null) : null,
      targetMilestoneId: t.targetMilestoneId,
      targetMilestoneName: milestoneNamesById[t.targetMilestoneId] ?? t.targetMilestoneId,
      transitionStatus: t.state.status,
      isBlocked: t.state.isBlocked,
      startedAt: t.startedAt,
      completedAt: t.completedAt,
      lastEventAt: t.state.lastEventAt,
      health,
      segments,
      metrics: metrics ? toMetricsVM(t.transitionId, metrics) : null,
      delayFindings,
      reworkFindings,
      bottleneckFindings,
      propagationsOut,
      propagationsIn,
      isabella: packet ? toIsabellaVM(packet) : null,
      evidence,
      hasUncertainty,
      hasWarnings,
      findingCount,
      openFindingCount,
    };
  });

  const o = projection.observability;
  return {
    projectId: projection.scope.projectId,
    generatedAt: projection.generatedAt,
    engineVersion: projection.engineVersion,
    configVersion: projection.configVersion,
    dataQualityFlags: [...projection.dataQualityFlags],
    transitions,
    healthCounts,
    observability: {
      engineVersion: o.engineVersion,
      configVersion: o.configVersion,
      generatedAt: projection.generatedAt,
      transitionCount: o.transitionCount,
      segmentCount: o.segmentCount,
      delayFindingCount: o.delayFindingCount ?? 0,
      reworkFindingCount: o.reworkFindingCount ?? 0,
      bottleneckFindingCount: o.bottleneckFindingCount ?? 0,
      constraintPropagationFindingCount: o.constraintPropagationFindingCount ?? 0,
      unknownHealthCount: o.unknownHealthCount ?? 0,
      isabellaPacketCount: o.isabellaPacketCount ?? 0,
      warningCount: o.warningCount,
      warnings: o.warnings.map((w) => ({ code: w.code, message: w.message, transitionId: w.transitionId ?? null })),
    },
  };
}

// ── Presentation filters (pure — never mutate, never change engine output) ────

export interface MilestoneFlowFilters {
  healthStatuses?: MilestoneTransitionHealthStatus[];
  segmentTypes?: MilestoneFlowSegmentType[];
  findingTypes?: string[];
  severities?: string[];
  milestoneId?: string | null;
  onlyWithUncertainty?: boolean;
  onlyWithWarnings?: boolean;
  onlyWithOpenFindings?: boolean;
}

function transitionFindingTypes(t: MilestoneFlowTransitionVM): Set<string> {
  const types = new Set<string>();
  for (const f of t.delayFindings) types.add(f.findingType);
  if (t.reworkFindings.length > 0) types.add("rework");
  if (t.bottleneckFindings.length > 0) types.add("bottleneck");
  if (t.propagationsOut.length > 0 || t.propagationsIn.length > 0) types.add("propagation");
  return types;
}

function transitionSeverities(t: MilestoneFlowTransitionVM): Set<string> {
  const sev = new Set<string>();
  for (const f of t.delayFindings) sev.add(f.severity);
  for (const f of t.reworkFindings) sev.add(f.severity);
  for (const f of t.bottleneckFindings) sev.add(f.severity);
  for (const f of [...t.propagationsOut, ...t.propagationsIn]) sev.add(f.severity);
  return sev;
}

/**
 * Filter transitions for PRESENTATION. Returns a new array; the input view-model
 * and the underlying engine output are never mutated or altered.
 */
export function filterMilestoneFlowTransitions(
  transitions: readonly MilestoneFlowTransitionVM[],
  filters: MilestoneFlowFilters,
): MilestoneFlowTransitionVM[] {
  return transitions.filter((t) => {
    if (filters.healthStatuses && filters.healthStatuses.length > 0) {
      const status = t.health?.status ?? "unknown";
      if (!filters.healthStatuses.includes(status)) return false;
    }
    if (filters.segmentTypes && filters.segmentTypes.length > 0) {
      if (!t.segments.some((s) => filters.segmentTypes!.includes(s.type))) return false;
    }
    if (filters.findingTypes && filters.findingTypes.length > 0) {
      const types = transitionFindingTypes(t);
      if (!filters.findingTypes.some((ft) => types.has(ft))) return false;
    }
    if (filters.severities && filters.severities.length > 0) {
      const sev = transitionSeverities(t);
      if (!filters.severities.some((s) => sev.has(s))) return false;
    }
    if (filters.milestoneId) {
      if (t.sourceMilestoneId !== filters.milestoneId && t.targetMilestoneId !== filters.milestoneId) return false;
    }
    if (filters.onlyWithUncertainty && !t.hasUncertainty) return false;
    if (filters.onlyWithWarnings && !t.hasWarnings) return false;
    if (filters.onlyWithOpenFindings && t.openFindingCount === 0) return false;
    return true;
  });
}
