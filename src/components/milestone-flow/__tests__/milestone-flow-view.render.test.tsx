// ============================================================================
// Phase 3 · Task 8 — Milestone Process Flow UI render guards
// ============================================================================
// Protects PEG-MPF-LIVING-GRAPH-UI-CONSUMER (component layer): the view renders
// engine-derived health/segments/metrics/findings/Isabella sections, keeps
// predictions visually distinct from facts, always labels bottlenecks as
// candidates, renders the ambiguous dependency fallback warning, keeps
// allowed/disallowed claims inspectable, shows honest empty states, and never
// hides uncertainty. Rendered with react-dom/server (node env, no DOM needed).
// ============================================================================

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../../../messages/en.json";
import type {
  MilestoneFlowViewModel,
  MilestoneFlowTransitionVM,
  MilestoneFlowHealthVM,
  MilestoneFlowIsabellaVM,
  MilestoneFlowBottleneckFindingVM,
} from "@/lib/milestone-flow-ui/selectors";
import { MilestoneFlowView } from "../milestone-flow-view";
import { TransitionDetailPanel } from "../transition-detail-panel";

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {node}
    </NextIntlClientProvider>,
  );
}

// ── View-model fixtures (display shapes only — no engine import needed) ───────

function health(overrides: Partial<MilestoneFlowHealthVM> = {}): MilestoneFlowHealthVM {
  return {
    status: "watch",
    confidence: "medium",
    primaryReasonCode: "waiting",
    secondaryReasonCodes: [],
    reasons: [{ code: "waiting", detail: "waiting detected" }],
    recommendedActionCategory: "monitor",
    uncertaintyNotes: [],
    evidenceCount: 2,
    warningCount: 0,
    evidence: [{ kind: "fact", eventId: "e1", metricRef: null, note: null, confidence: "high" }],
    ...overrides,
  };
}

function isabella(overrides: Partial<MilestoneFlowIsabellaVM> = {}): MilestoneFlowIsabellaVM {
  return {
    transitionId: "tr1",
    healthStatus: "watch",
    confidence: "medium",
    facts: [{ kind: "fact", eventId: "e1", metricRef: null, note: null, confidence: "high" }],
    inferences: [{ kind: "inference", eventId: null, metricRef: null, note: "waiting_inferred", confidence: "medium" }],
    predictions: [{ kind: "prediction", eventId: null, metricRef: null, note: "may_slip", confidence: "low" }],
    recommendations: [{ kind: "recommendation", eventId: null, metricRef: null, note: "monitor", confidence: "medium" }],
    uncertainties: [{ kind: "uncertainty", eventId: null, metricRef: null, note: "unknown_duration", confidence: "unknown" }],
    allowedClaims: ["transition_is_waiting"],
    disallowedClaims: ["blocker_cause_is_dependency_confirmed"],
    recommendedActionCategory: "monitor",
    ...overrides,
  };
}

function bottleneckVM(overrides: Partial<MilestoneFlowBottleneckFindingVM> = {}): MilestoneFlowBottleneckFindingVM {
  return {
    findingId: "b1",
    bottleneckType: "dependency",
    status: "possible",
    isPossible: true,
    severity: "medium",
    confidence: "medium",
    durationMs: 8 * 24 * 60 * 60 * 1000,
    durationLabel: "8d",
    occurrenceCount: 1,
    candidateReason: "long_duration",
    isStructuralCandidate: false,
    isAmbiguousDependencyFallback: true,
    evidenceCount: 1,
    metricRefs: [],
    calculationNotes: [],
    warningCount: 0,
    evidence: [{ kind: "fact", eventId: "e1", metricRef: null, note: null, confidence: "medium" }],
    ...overrides,
  };
}

function transitionVM(overrides: Partial<MilestoneFlowTransitionVM> = {}): MilestoneFlowTransitionVM {
  return {
    transitionId: "tr1",
    sourceMilestoneId: "m1",
    sourceMilestoneName: "Design",
    targetMilestoneId: "m2",
    targetMilestoneName: "Build",
    transitionStatus: "active",
    isBlocked: false,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    lastEventAt: "2026-01-20T00:00:00.000Z",
    health: health(),
    segments: [
      {
        segmentId: "s1", type: "active_work", startedAt: "2026-01-01T00:00:00.000Z", endedAt: "2026-01-05T00:00:00.000Z",
        durationMs: 4 * 24 * 60 * 60 * 1000, durationLabel: "4d", isOpenEnded: false, confidence: "high",
        evidenceCount: 1, hasWarnings: false, frictionType: null,
        evidence: [{ kind: "fact", eventId: "e1", metricRef: null, note: null, confidence: "high" }],
      },
      {
        segmentId: "s2", type: "blocked", startedAt: "2026-01-05T00:00:00.000Z", endedAt: null,
        durationMs: null, durationLabel: null, isOpenEnded: true, confidence: "medium",
        evidenceCount: 1, hasWarnings: false, frictionType: "dependency",
        evidence: [{ kind: "fact", eventId: "e2", metricRef: null, note: null, confidence: "medium" }],
      },
    ],
    metrics: {
      transitionId: "tr1",
      durations: [
        { key: "plannedDuration", valueMs: 31 * 24 * 60 * 60 * 1000, label: "31d" },
        { key: "actualDuration", valueMs: null, label: null },
        { key: "elapsedDuration", valueMs: null, label: null },
      ],
      timeBuckets: [
        { key: "activeWorkTime", valueMs: 4 * 24 * 60 * 60 * 1000, label: "4d" },
        { key: "waitingTime", valueMs: null, label: null },
        { key: "blockedTime", valueMs: null, label: null },
        { key: "decisionDelayTime", valueMs: null, label: null },
        { key: "approvalDelayTime", valueMs: null, label: null },
        { key: "reworkTime", valueMs: null, label: null },
        { key: "unknownTime", valueMs: 0, label: "<1m" },
      ],
      flowEfficiencyRatio: null,
      flowEfficiencyLabel: null,
      segmentCount: 2,
      openSegmentCount: 1,
      unknownSegmentCount: 0,
      totalKnownSegmentTimeMs: 4 * 24 * 60 * 60 * 1000,
      totalKnownSegmentTimeLabel: "4d",
      completeness: "partial",
      confidence: "medium",
      warningCount: 1,
    },
    delayFindings: [
      {
        findingId: "f1", findingType: "blocker", status: "open", severity: "high", confidence: "high",
        isOpen: true, durationMs: null, durationLabel: null, evidenceCount: 1,
        sourceSegmentIds: ["s2"], sourceEventIds: ["e2"], metricRefs: [], calculationNotes: [], warningCount: 0,
        evidence: [{ kind: "fact", eventId: "e2", metricRef: null, note: null, confidence: "high" }],
      },
    ],
    reworkFindings: [],
    bottleneckFindings: [bottleneckVM()],
    propagationsOut: [
      {
        findingId: "cp1", originTransitionId: "tr1", affectedTransitionId: "tr2",
        propagationType: "direct_dependency", status: "possible", isPossible: true,
        severity: "medium", confidence: "low", delayImpactMs: null, delayImpactLabel: null,
        propagationPath: ["tr1", "tr2"], propagationReason: "shared dependency",
        evidenceCount: 1, warningCount: 0,
        evidence: [{ kind: "inference", eventId: null, metricRef: null, note: "possible", confidence: "low" }],
      },
    ],
    propagationsIn: [],
    isabella: isabella(),
    evidence: [
      { kind: "fact", eventId: "e1", metricRef: null, note: null, confidence: "high" },
      { kind: "inference", eventId: null, metricRef: "metrics.blockedTimeMs", note: null, confidence: "medium" },
    ],
    hasUncertainty: true,
    hasWarnings: true,
    findingCount: 3,
    openFindingCount: 1,
    ...overrides,
  };
}

function viewModel(overrides: Partial<MilestoneFlowViewModel> = {}): MilestoneFlowViewModel {
  const transitions = overrides.transitions ?? [transitionVM()];
  return {
    projectId: "proj-1",
    generatedAt: "2026-07-01T00:00:00.000Z",
    engineVersion: "test-engine",
    configVersion: "test-config",
    dataQualityFlags: [],
    transitions,
    healthCounts: { watch: transitions.length },
    observability: {
      engineVersion: "test-engine", configVersion: "test-config", generatedAt: "2026-07-01T00:00:00.000Z",
      transitionCount: transitions.length, segmentCount: 2, delayFindingCount: 1, reworkFindingCount: 0,
      bottleneckFindingCount: 1, constraintPropagationFindingCount: 1, unknownHealthCount: 0,
      isabellaPacketCount: 1, warningCount: 0, warnings: [],
    },
    ...overrides,
  };
}

// ── Main view ─────────────────────────────────────────────────────────────────

describe("MilestoneFlowView", () => {
  it("renders milestone anchors, transitions and health from the view-model", () => {
    const html = render(<MilestoneFlowView vm={viewModel()} milestoneCount={2} eventCount={5} />);
    expect(html).toContain("Design");
    expect(html).toContain("Build");
    expect(html).toContain("Watch"); // health status label
    expect(html).toContain("mpf-corridor-tr1");
  });

  it("renders the observability strip (engine version + counts, no invention)", () => {
    const html = render(<MilestoneFlowView vm={viewModel()} milestoneCount={2} eventCount={5} />);
    expect(html).toContain("test-engine");
    expect(html).toContain("test-config");
  });

  it("renders the loading-free empty state for no transitions", () => {
    const html = render(
      <MilestoneFlowView vm={viewModel({ transitions: [], healthCounts: {} })} milestoneCount={3} eventCount={9} />,
    );
    expect(html).toContain("No milestone transitions are available for this project yet");
  });

  it("renders the no-milestones empty state", () => {
    const html = render(
      <MilestoneFlowView vm={viewModel({ transitions: [], healthCounts: {} })} milestoneCount={0} eventCount={0} />,
    );
    expect(html).toContain("No milestones yet");
  });

  it("renders the insufficient-evidence empty state when there are no events", () => {
    const html = render(
      <MilestoneFlowView vm={viewModel({ transitions: [], healthCounts: {} })} milestoneCount={4} eventCount={0} />,
    );
    expect(html).toContain("Insufficient evidence");
  });

  it("renders filter controls without altering the transitions rendered by default", () => {
    const html = render(<MilestoneFlowView vm={viewModel()} milestoneCount={2} eventCount={5} />);
    expect(html).toContain("Only with uncertainty");
    expect(html).toContain("Showing 1 of 1");
  });
});

// ── Detail panel ──────────────────────────────────────────────────────────────

describe("TransitionDetailPanel", () => {
  const html = render(<TransitionDetailPanel transition={transitionVM()} />);

  it("renders engine segment types without recalculating them", () => {
    expect(html).toContain("Active work");
    expect(html).toContain("Blocked");
    expect(html).toContain("4d");
  });

  it("renders unknown metric values honestly as Unknown", () => {
    expect(html).toContain("Unknown");
    expect(html).toContain("Planned duration");
    expect(html).toContain("31d");
  });

  it("renders delay findings with severity/status/confidence chips", () => {
    expect(html).toContain("Blocker");
    expect(html).toContain("Open");
    expect(html).toContain("High");
  });

  it("labels bottlenecks as candidates and 'possible' as possible", () => {
    expect(html).toContain("Candidate");
    expect(html).toContain("Possible");
  });

  it("renders the fallback dependency cause as ambiguous — never as confirmed fact", () => {
    expect(html).toContain("mpf-ambiguous-dependency");
    expect(html).toContain("NOT a confirmed dependency bottleneck");
  });

  it("renders constraint propagation as possible", () => {
    expect(html).toContain("mpf-propagation-cp1");
    expect(html).toContain("Direct dependency");
  });

  it("renders the transition health panel from engine output", () => {
    expect(html).toContain("Transition health");
    expect(html).toContain("Recommended action");
    expect(html).toContain("Monitor");
  });

  it("renders Isabella sections: facts / inferences / predictions / recommendation / uncertainty", () => {
    expect(html).toContain("mpf-isabella-facts");
    expect(html).toContain("mpf-isabella-inferences");
    expect(html).toContain("mpf-isabella-predictions");
    expect(html).toContain("mpf-isabella-recommendation");
    expect(html).toContain("mpf-isabella-uncertainties");
  });

  it("keeps predictions visually distinct from facts (explicit badge)", () => {
    expect(html).toContain("Prediction — not a fact");
  });

  it("shows the recommendation as an action category only", () => {
    expect(html).toContain("action category only");
  });

  it("keeps allowed and disallowed claims inspectable", () => {
    expect(html).toContain("mpf-isabella-claims");
    expect(html).toContain("transition_is_waiting");
    expect(html).toContain("blocker_cause_is_dependency_confirmed");
    expect(html).toContain("Disallowed claims");
  });

  it("renders uncertainty when the engine reports it", () => {
    const withNotes = render(
      <TransitionDetailPanel
        transition={transitionVM({ health: health({ uncertaintyNotes: ["ambiguous_blocker_cause"] }) })}
      />,
    );
    expect(withNotes).toContain("mpf-health-uncertainty");
    expect(withNotes).toContain("not a confirmed cause");
  });

  it("renders the evidence drill-down with refs and confidence", () => {
    expect(html).toContain("mpf-evidence");
    expect(html).toContain("Show 2 evidence references");
    expect(html).toContain("e1");
    expect(html).toContain("metrics.blockedTimeMs");
  });

  it("renders honest empty findings / packet states", () => {
    const empty = render(
      <TransitionDetailPanel
        transition={transitionVM({
          delayFindings: [], reworkFindings: [], bottleneckFindings: [],
          propagationsOut: [], propagationsIn: [], isabella: null, evidence: [],
        })}
      />,
    );
    expect(empty).toContain("No blockers or delays were detected for this transition.");
    expect(empty).toContain("No Isabella evidence packet exists for this transition.");
    expect(empty).toContain("No evidence references exist for this transition yet.");
  });
});
