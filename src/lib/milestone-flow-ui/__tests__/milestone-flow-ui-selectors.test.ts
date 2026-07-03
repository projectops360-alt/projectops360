// ============================================================================
// Phase 3 · Task 8 — Milestone Process Flow Living Graph UI Consumer guards
// ============================================================================
// Protects PEG-MPF-LIVING-GRAPH-UI-CONSUMER (selector layer): the view-model is
// a pure FORMATTING of engine output — transitions/segments consumed (never
// rebuilt), metrics consumed (never recalculated), health consumed (never
// reclassified), findings consumed (never re-detected), Isabella packets
// consumed (never generated). Bottlenecks stay candidates, "possible" stays
// possible, the fallback dependency cause is never confirmed, facts require
// evidence refs, uncertainty stays visible, and filters never mutate input.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  createMilestoneProcessFlowEngine,
  MPF_CONFIG_VERSION,
  MPF_HEALTH_STATUSES,
} from "@/lib/milestone-flow";
import type {
  MilestoneFlowProjection,
  MilestoneFlowInputContract,
  MilestoneFlowAccessContext,
  MilestoneFlowEventRef,
  MilestoneFlowMilestoneRef,
  MilestoneFlowProjectScope,
  MilestoneTransition,
  MilestoneTransitionHealthStatus,
  MilestoneTransitionHealthSummaryResult,
  MilestoneFlowIsabellaEvidencePacket,
  MilestoneFlowBottleneckFinding,
  MilestoneConstraintPropagationFinding,
  MilestoneFlowEngineRunSummary,
} from "@/lib/milestone-flow";
import {
  buildMilestoneFlowViewModel,
  filterMilestoneFlowTransitions,
  formatDurationMs,
  formatRatioAsPercent,
} from "../selectors";

const ORG = "org-1";
const PROJ = "proj-1";
const SCOPE: MilestoneFlowProjectScope = { organizationId: ORG, projectId: PROJ };
const DAY = 24 * 60 * 60 * 1000;
const NAMES = { m1: "Design", m2: "Build" };

// ── Engine-driven fixture (the REAL consumption path) ─────────────────────────

const M1: MilestoneFlowMilestoneRef = { milestoneId: "m1", name: "Design", type: null, plannedDate: "2026-01-01T00:00:00.000Z", forecastDate: null, actualDate: "2026-01-10T00:00:00.000Z", ownerId: null, status: null };
const M2: MilestoneFlowMilestoneRef = { milestoneId: "m2", name: "Build", type: null, plannedDate: "2026-02-01T00:00:00.000Z", forecastDate: null, actualDate: null, ownerId: null, status: null };
const access = (): MilestoneFlowAccessContext => ({ userId: "u1", organizationId: ORG, scope: "pm", authorizedProjectIds: [PROJ] });
const evt = (id: string, type: string, at: string, milestoneId?: string, subjectType = "task", subjectId = "s"): MilestoneFlowEventRef =>
  ({ eventId: id, eventType: type, eventCategory: "t", occurredAt: at, subjectType, subjectId, fromState: null, toState: null, lifecycleClass: "BUSINESS_EVENT", confidence: 0.95, isCompensatingEvent: false, milestoneId: milestoneId ?? null });
const projInput = (ms: MilestoneFlowMilestoneRef[], ev: MilestoneFlowEventRef[]): MilestoneFlowInputContract =>
  ({ scope: SCOPE, milestones: ms, events: ev, config: { configVersion: MPF_CONFIG_VERSION }, access: access() });

function engineProjection(): MilestoneFlowProjection {
  const engine = createMilestoneProcessFlowEngine({ now: () => new Date("2026-07-02T10:00:00.000Z") });
  const events = [
    evt("e-start", "TaskStarted", "2026-01-12T00:00:00.000Z", "m2"),
    evt("e-block", "TaskBlocked", "2026-01-15T00:00:00.000Z", "m2"),
    evt("e-done", "MilestoneAchieved", "2026-01-30T00:00:00.000Z", undefined, "milestone", "m2"),
  ];
  return engine.buildMilestoneFlowProjection(projInput([M1, M2], events)).projection;
}

// ── Hand-built projection helpers (edge-case control) ─────────────────────────

function observability(): MilestoneFlowEngineRunSummary {
  return {
    runId: "run-1", engineVersion: "test-engine", configVersion: "test-config",
    organizationId: ORG, projectId: PROJ,
    inputEventCount: 0, includedEventCount: 0, excludedEventCount: 0, exclusionReasons: [],
    transitionCount: 1, segmentCount: 0, bottleneckCount: 0, healthAssessmentCount: 1,
    unassignedEventCount: 0, unknownSegmentCount: 0, openTransitionCount: 0, completedTransitionCount: 1,
    warningCount: 0, errorCount: 0,
    startedAt: "2026-07-01T00:00:00.000Z", completedAt: "2026-07-01T00:00:01.000Z", durationMs: 1000,
    warnings: [], errors: [],
  };
}

function transition(id: string): MilestoneTransition {
  return {
    transitionId: id, scope: SCOPE, sourceMilestoneId: "m1", targetMilestoneId: "m2",
    startedAt: "2026-01-01T00:00:00.000Z", completedAt: null,
    state: { status: "active", currentSegmentType: null, isBlocked: false, lastEventAt: null },
    segments: [], evidenceEventIds: [],
  };
}

function healthSummary(
  id: string,
  status: MilestoneTransitionHealthStatus,
  extra: Partial<MilestoneTransitionHealthSummaryResult> = {},
): MilestoneTransitionHealthSummaryResult {
  return {
    transitionId: id, projectId: PROJ, organizationId: ORG,
    healthStatus: status, confidence: "medium",
    reasonCodes: ["waiting"], reasons: [{ code: "waiting", detail: "detail", evidence: [] }],
    evidenceRefs: [{ kind: "fact", eventId: "e1", confidence: "high" }],
    supportingFindingIds: [], supportingSegmentIds: [], metricRefs: [],
    recommendedActionCategory: "monitor", uncertaintyNotes: [], warnings: [],
    engineVersion: "test-engine", configVersion: "test-config",
    ...extra,
  };
}

function isabellaPacket(id: string, extra: Partial<MilestoneFlowIsabellaEvidencePacket> = {}): MilestoneFlowIsabellaEvidencePacket {
  return {
    scope: SCOPE, transitionId: id, projectId: PROJ, organizationId: ORG,
    healthStatus: "watch", confidence: "medium",
    facts: [
      { kind: "fact", eventId: "e1", confidence: "high" },
      { kind: "fact", metricRef: "metrics.waitingTimeMs", confidence: "medium" },
      // A "fact" WITHOUT any evidence ref — the UI must drop it.
      { kind: "fact", note: "no evidence attached", confidence: "low" },
    ],
    inferences: [{ kind: "inference", note: "inference_note", confidence: "medium" }],
    predictions: [{ kind: "prediction", note: "may_slip", confidence: "low" }],
    recommendations: [{ kind: "recommendation", note: "monitor", confidence: "medium" }],
    uncertainties: [{ kind: "uncertainty", note: "ambiguous_blocker_cause", confidence: "unknown" }],
    evidenceRefs: [{ kind: "fact", eventId: "e1", confidence: "high" }],
    allowedClaims: ["transition_is_waiting"],
    disallowedClaims: ["blocker_cause_is_dependency_confirmed"],
    explanationFrame: { fact: [], inference: [], prediction: [], recommendation: [], uncertainty: [] },
    recommendedActionCategory: "monitor",
    engineVersion: "test-engine", configVersion: "test-config",
    ...extra,
  };
}

function bottleneck(id: string, extra: Partial<MilestoneFlowBottleneckFinding> = {}): MilestoneFlowBottleneckFinding {
  return {
    findingId: id, transitionId: "tr1", projectId: PROJ, organizationId: ORG,
    bottleneckType: "dependency", status: "possible", severity: "medium", confidence: "medium",
    durationMs: 8 * DAY, occurrenceCount: 1, affectedSegmentIds: [], affectedFindingIds: [],
    sourceEventIds: ["e1"], evidenceRefs: [{ kind: "fact", eventId: "e1", confidence: "medium" }],
    metricRefs: [], candidateReason: "long_duration", isStructuralCandidate: false,
    calculationNotes: [], warnings: [],
    ...extra,
  };
}

function propagation(id: string, extra: Partial<MilestoneConstraintPropagationFinding> = {}): MilestoneConstraintPropagationFinding {
  return {
    findingId: id, originTransitionId: "tr1", affectedTransitionId: "tr2",
    projectId: PROJ, organizationId: ORG, propagationType: "direct_dependency",
    status: "possible", severity: "medium", confidence: "low",
    originEventIds: [], affectedEventIds: [], originSegmentIds: [], affectedSegmentIds: [],
    originFindingIds: [], affectedFindingIds: [],
    evidenceRefs: [{ kind: "inference", note: "possible propagation", confidence: "low" }],
    metricRefs: [], propagationPath: ["tr1", "tr2"], propagationReason: "shared dependency",
    delayImpactMs: null, riskImpact: null, calculationNotes: [], warnings: [],
    ...extra,
  };
}

function handProjection(overrides: Partial<MilestoneFlowProjection> = {}): MilestoneFlowProjection {
  return {
    runId: "run-1", scope: SCOPE, engineVersion: "test-engine", configVersion: "test-config",
    generatedAt: "2026-07-01T00:00:00.000Z",
    transitions: [transition("tr1")],
    metricsByTransition: {}, healthByTransition: {},
    bottlenecks: [], constraintPropagations: [], dataQualityFlags: [],
    observability: observability(),
    ...overrides,
  };
}

// ── 1. Engine output is consumed, not rebuilt ─────────────────────────────────

describe("view-model consumes engine projection (no rebuild, no recalc)", () => {
  it("renders exactly the engine's transitions with the engine's ids and milestone anchors", () => {
    const projection = engineProjection();
    const vm = buildMilestoneFlowViewModel(projection, NAMES);
    expect(vm.transitions.map((t) => t.transitionId)).toEqual(
      projection.transitions.map((t) => t.transitionId),
    );
    expect(vm.transitions[0].sourceMilestoneName).toBe("Design");
    expect(vm.transitions[0].targetMilestoneName).toBe("Build");
    expect(vm.observability.transitionCount).toBe(projection.observability.transitionCount);
  });

  it("renders the engine's segment types and engine-calculated durations verbatim", () => {
    const projection = engineProjection();
    const vm = buildMilestoneFlowViewModel(projection, NAMES);
    const tr = projection.transitions[0];
    const vmTr = vm.transitions.find((t) => t.transitionId === tr.transitionId)!;
    expect(vmTr.segments.map((s) => s.type)).toEqual(tr.segments.map((s) => s.type));
    for (const s of vmTr.segments) {
      const engineSeg = tr.segments.find((es) => es.segmentId === s.segmentId)!;
      // Duration comes from Task 4 segmentDurations or the segment itself — never recomputed.
      const metrics = projection.metricsByTransition[tr.transitionId] as unknown as {
        segmentDurations?: { segmentId: string; segmentDurationMs: number | null }[];
      };
      const fromMetrics = metrics.segmentDurations?.find((d) => d.segmentId === s.segmentId)?.segmentDurationMs;
      expect(s.durationMs).toBe(fromMetrics !== undefined ? fromMetrics : engineSeg.durationMs);
    }
  });

  it("renders health from healthSummariesByTransition (never reclassified)", () => {
    const projection = engineProjection();
    const vm = buildMilestoneFlowViewModel(projection, NAMES);
    for (const t of vm.transitions) {
      const summary = projection.healthSummariesByTransition![t.transitionId];
      expect(t.health!.status).toBe(summary.healthStatus);
      expect(t.health!.confidence).toBe(summary.confidence);
      expect(t.health!.recommendedActionCategory).toBe(summary.recommendedActionCategory);
    }
  });

  it("renders metrics from metricsByTransition verbatim (never recalculated)", () => {
    const projection = engineProjection();
    const vm = buildMilestoneFlowViewModel(projection, NAMES);
    const trId = projection.transitions[0].transitionId;
    const m = projection.metricsByTransition[trId];
    const vmM = vm.transitions[0].metrics!;
    expect(vmM.timeBuckets.find((b) => b.key === "activeWorkTime")!.valueMs).toBe(m.activeWorkTimeMs);
    expect(vmM.timeBuckets.find((b) => b.key === "blockedTime")!.valueMs).toBe(m.blockedTimeMs);
    expect(vmM.flowEfficiencyRatio).toBe(m.efficiency.flowEfficiencyRatio);
  });

  it("renders the engine's delay findings without re-detecting", () => {
    const projection = engineProjection();
    const vm = buildMilestoneFlowViewModel(projection, NAMES);
    const trId = projection.transitions[0].transitionId;
    const engineFindings = projection.findingsByTransition?.[trId] ?? [];
    const vmFindings = vm.transitions[0].delayFindings;
    expect(vmFindings.map((f) => f.findingId)).toEqual(engineFindings.map((f) => f.findingId));
    for (const f of vmFindings) {
      const ef = engineFindings.find((x) => x.findingId === f.findingId)!;
      expect(f.severity).toBe(ef.severity);
      expect(f.status).toBe(ef.status);
      expect(f.durationMs).toBe(ef.durationMs);
    }
  });

  it("renders Isabella packets from the engine (never generated in UI)", () => {
    const projection = engineProjection();
    const vm = buildMilestoneFlowViewModel(projection, NAMES);
    const trId = projection.transitions[0].transitionId;
    const packet = projection.isabellaEvidencePacketsByTransition![trId];
    const vmP = vm.transitions[0].isabella!;
    expect(vmP.healthStatus).toBe(packet.healthStatus);
    expect(vmP.allowedClaims).toEqual(packet.allowedClaims);
    expect(vmP.disallowedClaims).toEqual(packet.disallowedClaims);
    expect(vmP.recommendedActionCategory).toBe(packet.recommendedActionCategory);
  });

  it("an empty engine projection yields an empty view-model (no fabricated flow)", () => {
    const engine = createMilestoneProcessFlowEngine();
    const projection = engine.buildMilestoneFlowProjection(projInput([], [])).projection;
    const vm = buildMilestoneFlowViewModel(projection, {});
    expect(vm.transitions).toEqual([]);
    expect(vm.dataQualityFlags).toContain("insufficient_event_density");
  });

  it("does not mutate the engine projection", () => {
    const projection = engineProjection();
    const before = JSON.stringify(projection);
    buildMilestoneFlowViewModel(projection, NAMES);
    expect(JSON.stringify(projection)).toBe(before);
  });
});

// ── 2. Every health status renders ────────────────────────────────────────────

describe("all supported health statuses render", () => {
  it.each([...MPF_HEALTH_STATUSES])("renders %s from the engine summary", (status) => {
    const p = handProjection({
      healthSummariesByTransition: { tr1: healthSummary("tr1", status) },
    });
    const vm = buildMilestoneFlowViewModel(p, NAMES);
    expect(vm.transitions[0].health!.status).toBe(status);
    expect(vm.healthCounts[status]).toBe(1);
  });

  it("a transition without a health summary stays unknown (never invented)", () => {
    const vm = buildMilestoneFlowViewModel(handProjection(), NAMES);
    expect(vm.transitions[0].health).toBeNull();
    expect(vm.healthCounts.unknown).toBe(1);
  });
});

// ── 3. Honest nulls / unknown metrics ─────────────────────────────────────────

describe("unknown values stay honest", () => {
  it("null durations format to null (rendered as Unknown), never fabricated", () => {
    expect(formatDurationMs(null)).toBeNull();
    expect(formatDurationMs(undefined)).toBeNull();
    expect(formatDurationMs(-5)).toBeNull();
    expect(formatRatioAsPercent(null)).toBeNull();
  });

  it("formats engine-calculated durations for display only", () => {
    expect(formatDurationMs(2 * DAY + 3 * 60 * 60 * 1000)).toBe("2d 3h");
    expect(formatDurationMs(90 * 60 * 1000)).toBe("1h 30m");
    expect(formatDurationMs(30 * 1000)).toBe("<1m");
    expect(formatRatioAsPercent(0.421)).toBe("42%");
  });

  it("a transition with no metrics entry renders metrics as null (not zeroed)", () => {
    const vm = buildMilestoneFlowViewModel(handProjection(), NAMES);
    expect(vm.transitions[0].metrics).toBeNull();
  });
});

// ── 4. Causality guardrail — candidates / possible / fallback dependency ──────

describe("causality guardrail (bottlenecks & propagation)", () => {
  it("a 'possible' bottleneck is flagged possible — never confirmed", () => {
    const p = handProjection({ bottleneckFindingsByTransition: { tr1: [bottleneck("b1", { status: "possible" })] } });
    const vm = buildMilestoneFlowViewModel(p, NAMES);
    expect(vm.transitions[0].bottleneckFindings[0].isPossible).toBe(true);
  });

  it("a dependency bottleneck below high confidence is the ambiguous fallback — never confirmed fact", () => {
    const p = handProjection({
      bottleneckFindingsByTransition: {
        tr1: [
          bottleneck("b-med", { bottleneckType: "dependency", confidence: "medium" }),
          bottleneck("b-high", { bottleneckType: "dependency", confidence: "high", status: "open" }),
          bottleneck("b-dec", { bottleneckType: "decision", confidence: "medium" }),
        ],
      },
    });
    const vm = buildMilestoneFlowViewModel(p, NAMES);
    const [med, high, dec] = vm.transitions[0].bottleneckFindings;
    // Mirrors transition-health-classifier.ts: dependency + confidence !== high → ambiguous.
    expect(med.isAmbiguousDependencyFallback).toBe(true);
    expect(high.isAmbiguousDependencyFallback).toBe(false);
    expect(dec.isAmbiguousDependencyFallback).toBe(false);
  });

  it("ambiguous fallback marks the transition as having uncertainty (never hidden)", () => {
    const p = handProjection({
      bottleneckFindingsByTransition: { tr1: [bottleneck("b1", { confidence: "medium" })] },
    });
    const vm = buildMilestoneFlowViewModel(p, NAMES);
    expect(vm.transitions[0].hasUncertainty).toBe(true);
  });

  it("'possible' propagation stays possible and is attached to origin AND affected transitions", () => {
    const p = handProjection({
      transitions: [transition("tr1"), { ...transition("tr2"), transitionId: "tr2" }],
      constraintPropagationFindings: [propagation("cp1")],
    });
    const vm = buildMilestoneFlowViewModel(p, NAMES);
    const tr1 = vm.transitions.find((t) => t.transitionId === "tr1")!;
    const tr2 = vm.transitions.find((t) => t.transitionId === "tr2")!;
    expect(tr1.propagationsOut[0].isPossible).toBe(true);
    expect(tr2.propagationsIn[0].isPossible).toBe(true);
    expect(tr1.hasUncertainty).toBe(true);
  });

  it("engine uncertainty notes pass through verbatim", () => {
    const p = handProjection({
      healthSummariesByTransition: {
        tr1: healthSummary("tr1", "watch", { uncertaintyNotes: ["ambiguous_blocker_cause", "unknown_duration"] }),
      },
    });
    const vm = buildMilestoneFlowViewModel(p, NAMES);
    expect(vm.transitions[0].health!.uncertaintyNotes).toEqual(["ambiguous_blocker_cause", "unknown_duration"]);
    expect(vm.transitions[0].hasUncertainty).toBe(true);
  });
});

// ── 5. Isabella packet preview rules ──────────────────────────────────────────

describe("Isabella evidence packet preview", () => {
  it("facts without an eventId/metricRef are dropped — facts require evidence", () => {
    const p = handProjection({ isabellaEvidencePacketsByTransition: { tr1: isabellaPacket("tr1") } });
    const vm = buildMilestoneFlowViewModel(p, NAMES);
    const facts = vm.transitions[0].isabella!.facts;
    expect(facts).toHaveLength(2);
    expect(facts.every((f) => f.eventId != null || f.metricRef != null)).toBe(true);
  });

  it("predictions are kept in their own section (never merged into facts)", () => {
    const p = handProjection({ isabellaEvidencePacketsByTransition: { tr1: isabellaPacket("tr1") } });
    const vm = buildMilestoneFlowViewModel(p, NAMES);
    const packet = vm.transitions[0].isabella!;
    expect(packet.predictions).toHaveLength(1);
    expect(packet.predictions[0].kind).toBe("prediction");
    expect(packet.facts.some((f) => f.kind === "prediction")).toBe(false);
  });

  it("recommendations expose the action CATEGORY only (no generated prose field)", () => {
    const p = handProjection({ isabellaEvidencePacketsByTransition: { tr1: isabellaPacket("tr1") } });
    const vm = buildMilestoneFlowViewModel(p, NAMES);
    const packet = vm.transitions[0].isabella!;
    expect(packet.recommendedActionCategory).toBe("monitor");
    expect(Object.keys(packet)).not.toContain("adviceText");
    expect(Object.keys(packet)).not.toContain("narrative");
  });

  it("allowedClaims and disallowedClaims stay inspectable", () => {
    const p = handProjection({ isabellaEvidencePacketsByTransition: { tr1: isabellaPacket("tr1") } });
    const vm = buildMilestoneFlowViewModel(p, NAMES);
    const packet = vm.transitions[0].isabella!;
    expect(packet.allowedClaims).toEqual(["transition_is_waiting"]);
    expect(packet.disallowedClaims).toEqual(["blocker_cause_is_dependency_confirmed"]);
  });

  it("no packet → null (never fabricated)", () => {
    const vm = buildMilestoneFlowViewModel(handProjection(), NAMES);
    expect(vm.transitions[0].isabella).toBeNull();
  });
});

// ── 6. Evidence drill-down ────────────────────────────────────────────────────

describe("evidence drill-down", () => {
  it("collects health + finding evidence refs with confidence, deduped", () => {
    const p = handProjection({
      healthSummariesByTransition: { tr1: healthSummary("tr1", "watch") },
      bottleneckFindingsByTransition: {
        tr1: [bottleneck("b1", { evidenceRefs: [{ kind: "fact", eventId: "e1", confidence: "high" }] })],
      },
    });
    const vm = buildMilestoneFlowViewModel(p, NAMES);
    const evidence = vm.transitions[0].evidence;
    // healthSummary + bottleneck both reference e1 (fact/high) → deduped to one.
    expect(evidence.filter((e) => e.eventId === "e1")).toHaveLength(1);
    expect(evidence[0].confidence).toBeDefined();
  });
});

// ── 7. Filters — presentation only, never mutating ────────────────────────────

describe("filters", () => {
  function vmWithStatuses() {
    const p = handProjection({
      transitions: [transition("tr1"), { ...transition("tr2"), transitionId: "tr2" }],
      healthSummariesByTransition: {
        tr1: healthSummary("tr1", "blocked"),
        tr2: healthSummary("tr2", "healthy"),
      },
    });
    return buildMilestoneFlowViewModel(p, NAMES);
  }

  it("filters by health status without mutating the source array", () => {
    const vm = vmWithStatuses();
    const before = JSON.stringify(vm.transitions);
    const out = filterMilestoneFlowTransitions(vm.transitions, { healthStatuses: ["blocked"] });
    expect(out.map((t) => t.transitionId)).toEqual(["tr1"]);
    expect(JSON.stringify(vm.transitions)).toBe(before);
    expect(vm.transitions).toHaveLength(2);
  });

  it("filter output objects ARE the same objects (no cloning/altering of engine data)", () => {
    const vm = vmWithStatuses();
    const out = filterMilestoneFlowTransitions(vm.transitions, { healthStatuses: ["healthy"] });
    expect(out[0]).toBe(vm.transitions[1]);
  });

  it("filters by uncertainty / warnings / open findings", () => {
    const p = handProjection({
      transitions: [transition("tr1"), { ...transition("tr2"), transitionId: "tr2" }],
      healthSummariesByTransition: {
        tr1: healthSummary("tr1", "watch", { uncertaintyNotes: ["missing_metrics"] }),
        tr2: healthSummary("tr2", "healthy", { confidence: "high" }),
      },
    });
    const vm = buildMilestoneFlowViewModel(p, NAMES);
    expect(filterMilestoneFlowTransitions(vm.transitions, { onlyWithUncertainty: true }).map((t) => t.transitionId)).toEqual(["tr1"]);
    expect(filterMilestoneFlowTransitions(vm.transitions, { onlyWithOpenFindings: true })).toHaveLength(0);
  });

  it("empty filters return all transitions unchanged", () => {
    const vm = vmWithStatuses();
    expect(filterMilestoneFlowTransitions(vm.transitions, {})).toHaveLength(2);
  });
});
