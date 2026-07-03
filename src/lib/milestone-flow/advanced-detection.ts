// ============================================================================
// ProjectOps360° — MPF Engine · Advanced Detection Orchestrator (Phase 3, Task 6)
// ============================================================================
// Runs the second detection layer over the whole projection: rework (per
// transition), bottleneck candidates (per transition, consuming Task 5 delay
// findings + Task 6 rework), and constraint propagation (across transitions).
// Pure, deterministic, read-only. Consumes Task 3/4/5 outputs; never rebuilds or
// recomputes them, never calls Date.now(), never classifies health.
// ============================================================================

import { validateMilestoneFlowAdvancedDetectionInput, advWarn } from "./advanced-detection-shared";
import { detectMilestoneTransitionReworkFindings } from "./rework-detector";
import { detectMilestoneTransitionBottleneckFindings } from "./bottleneck-detector";
import { detectMilestoneConstraintPropagationFindings } from "./constraint-propagation-detector";
import type { MilestoneFlowEngineWarning } from "./types";
import type {
  MilestoneFlowAdvancedDetectionInput,
  MilestoneFlowAdvancedDetectionResult,
  MilestoneFlowReworkFinding,
  MilestoneFlowBottleneckFinding,
  MilestoneConstraintPropagationFinding,
  MilestoneFlowAdvancedDetectionStats,
} from "./advanced-detection-types";

/** (16) Consolidated advanced-detection warnings for a transition context. */
export function createMilestoneFlowAdvancedDetectionWarnings(
  transitionId: string,
  hasMetrics: boolean,
  hasDelayFindings: boolean,
): MilestoneFlowEngineWarning[] {
  const warnings: MilestoneFlowEngineWarning[] = [];
  if (!hasMetrics) warnings.push(advWarn("MISSING_METRICS_FOR_ADVANCED_DETECTION", `no metrics for ${transitionId}`, transitionId));
  if (!hasDelayFindings) warnings.push(advWarn("MISSING_DELAY_FINDINGS_FOR_BOTTLENECK_DETECTION", `no delay findings for ${transitionId}`, transitionId));
  return warnings;
}

/** (1) Detect rework, bottleneck candidates & constraint propagation for all transitions. */
export function detectMilestoneFlowAdvancedFindings(
  input: MilestoneFlowAdvancedDetectionInput,
): MilestoneFlowAdvancedDetectionResult {
  validateMilestoneFlowAdvancedDetectionInput(input);
  const options = input.options ?? {};

  const reworkFindingsByTransition: Record<string, MilestoneFlowReworkFinding[]> = {};
  const bottleneckFindingsByTransition: Record<string, MilestoneFlowBottleneckFinding[]> = {};
  const warnings: MilestoneFlowEngineWarning[] = [];

  for (const transition of input.transitions) {
    const metrics = input.metricsByTransition[transition.transitionId];
    const delayFindings = input.findingsByTransition[transition.transitionId] ?? [];

    warnings.push(...createMilestoneFlowAdvancedDetectionWarnings(transition.transitionId, !!metrics, delayFindings.length > 0));

    const rework = detectMilestoneTransitionReworkFindings(transition, metrics, options);
    reworkFindingsByTransition[transition.transitionId] = rework;
    warnings.push(...rework.flatMap((r) => r.warnings));

    const { findings: bottlenecks, warnings: bWarnings } = detectMilestoneTransitionBottleneckFindings(
      transition,
      metrics,
      delayFindings,
      options,
      rework,
    );
    bottleneckFindingsByTransition[transition.transitionId] = bottlenecks;
    warnings.push(...bWarnings);
  }

  const { findings: constraintPropagationFindings, warnings: pWarnings } = detectMilestoneConstraintPropagationFindings(
    input.transitions,
    input.metricsByTransition,
    input.findingsByTransition,
    input.scope,
  );
  warnings.push(...pWarnings);

  return {
    reworkFindingsByTransition,
    bottleneckFindingsByTransition,
    constraintPropagationFindings,
    warnings,
    stats: summarizeAdvancedFindings(
      Object.values(reworkFindingsByTransition).flat(),
      Object.values(bottleneckFindingsByTransition).flat(),
      constraintPropagationFindings,
    ),
  };
}

export function summarizeAdvancedFindings(
  rework: readonly MilestoneFlowReworkFinding[],
  bottlenecks: readonly MilestoneFlowBottleneckFinding[],
  propagation: readonly MilestoneConstraintPropagationFinding[],
): MilestoneFlowAdvancedDetectionStats {
  const all: { status: string; severity: string }[] = [...rework, ...bottlenecks, ...propagation];
  return {
    reworkFindingCount: rework.length,
    bottleneckFindingCount: bottlenecks.length,
    constraintPropagationFindingCount: propagation.length,
    structuralBottleneckCandidateCount: bottlenecks.filter((b) => b.isStructuralCandidate).length,
    possiblePropagationCount: propagation.filter((p) => p.status === "possible").length,
    openAdvancedFindingCount: all.filter((f) => f.status === "open").length,
    resolvedAdvancedFindingCount: all.filter((f) => f.status === "resolved").length,
    unknownAdvancedFindingCount: all.filter((f) => f.status === "unknown").length,
    highSeverityAdvancedFindingCount: all.filter((f) => f.severity === "high" || f.severity === "critical").length,
  };
}
