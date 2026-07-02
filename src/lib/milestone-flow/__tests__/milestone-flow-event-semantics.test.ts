// ============================================================================
// Phase 3 · Task 2 — Milestone Flow Event Semantics guards (PEG-MPF-EVENT-SEMANTICS)
// ============================================================================
// Protects the semantic interpretation layer: every canonical event has explicit
// semantics (or intentional unknown for unregistered types), signals are correct
// for the key families, provenance caps backfilled/inferred confidence below high,
// compensating events stay compensation-aware, unknown events never crash,
// evidence refs are built without mutating source events, classification is pure/
// deterministic, and no DB write-path / process_nodes / process_edges is used.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EVENT_REGISTRY } from "@/lib/events/registry";
import {
  getMilestoneFlowSemanticsForEventType,
  getMilestoneFlowEventSemantics,
  classifyMilestoneFlowEvent,
  normalizeMilestoneFlowEventProvenance,
  buildMilestoneFlowEvidenceRefFromEvent,
  isMilestoneTransitionOpeningEvent,
  isMilestoneTransitionClosingEvent,
  isMilestoneFlowBlockingEvent,
  isMilestoneFlowUnblockingEvent,
  isMilestoneFlowReworkEvent,
  isMilestoneFlowEvidenceBearingEvent,
  validateMilestoneFlowEventSemanticsMap,
  MILESTONE_FLOW_EVENT_SEMANTICS,
  type MilestoneFlowEventRef,
} from "@/lib/milestone-flow";

function ev(overrides: Partial<MilestoneFlowEventRef> & { eventType: string }): MilestoneFlowEventRef {
  return {
    eventId: "e-" + overrides.eventType,
    eventCategory: "test",
    occurredAt: "2026-06-01T00:00:00.000Z",
    subjectType: "task",
    subjectId: "s1",
    fromState: null,
    toState: null,
    lifecycleClass: "BUSINESS_EVENT",
    confidence: 0.95,
    isCompensatingEvent: false,
    ...overrides,
  };
}

describe("coverage — every canonical event has explicit semantics", () => {
  it("validateMilestoneFlowEventSemanticsMap() is ok (no missing/unexpected/ephemeral)", () => {
    const v = validateMilestoneFlowEventSemanticsMap();
    expect(v.missing).toEqual([]);
    expect(v.unexpected).toEqual([]);
    expect(v.ephemeralLeaks).toEqual([]);
    expect(v.ok).toBe(true);
    expect(v.mapped).toBe(v.total);
  });

  it("every registered event maps to a non-unknown semantic category", () => {
    for (const type of Object.keys(EVENT_REGISTRY)) {
      expect(MILESTONE_FLOW_EVENT_SEMANTICS[type], `${type} must be mapped`).toBeDefined();
      expect(getMilestoneFlowSemanticsForEventType(type).semanticCategory).not.toBe("unknown");
    }
  });

  it("static map never emits prediction/recommendation (reserved for future layers)", () => {
    for (const type of Object.keys(EVENT_REGISTRY)) {
      const kind = getMilestoneFlowSemanticsForEventType(type).evidenceKind;
      expect(["fact", "inference"]).toContain(kind);
    }
  });
});

describe("transition signals", () => {
  it("milestone/phase completion closes a transition", () => {
    expect(isMilestoneTransitionClosingEvent("MilestoneAchieved")).toBe(true);
    expect(isMilestoneTransitionClosingEvent("PhaseCompleted")).toBe(true);
  });

  it("milestone/phase start opens a transition; task start progresses it", () => {
    expect(isMilestoneTransitionOpeningEvent("MilestoneStarted")).toBe(true);
    expect(isMilestoneTransitionOpeningEvent("PhaseStarted")).toBe(true);
    expect(getMilestoneFlowSemanticsForEventType("TaskStarted").transitionSignal).toBe("progresses_transition");
  });

  it("task started/completed imply active_work", () => {
    expect(getMilestoneFlowSemanticsForEventType("TaskStarted").flowSegmentType).toBe("active_work");
    expect(getMilestoneFlowSemanticsForEventType("TaskCompleted").flowSegmentType).toBe("active_work");
  });
});

describe("blocking / unblocking", () => {
  it("blocked + dependency-added are blocking-flow signals", () => {
    expect(isMilestoneFlowBlockingEvent("TaskBlocked")).toBe(true);
    expect(getMilestoneFlowSemanticsForEventType("TaskBlocked").flowSegmentType).toBe("blocked");
    // dependency added creates a constraint (candidate) though not a hard block
    expect(getMilestoneFlowSemanticsForEventType("TaskDependencyAdded").constraintPropagationSignal).toBe(
      "creates_constraint",
    );
  });

  it("unblocked / dependency-removed / risk-closed are unblocking signals", () => {
    expect(isMilestoneFlowUnblockingEvent("TaskUnblocked")).toBe(true);
    expect(isMilestoneFlowUnblockingEvent("TaskDependencyRemoved")).toBe(true);
    expect(isMilestoneFlowUnblockingEvent("RiskClosed")).toBe(true);
  });
});

describe("decision semantics", () => {
  it("decision proposed/deferred imply decision_delay + decision friction", () => {
    for (const t of ["DecisionProposed", "DecisionDeferred"]) {
      const s = getMilestoneFlowSemanticsForEventType(t);
      expect(s.flowSegmentType).toBe("decision_delay");
      expect(s.frictionType).toBe("decision");
      expect(isMilestoneFlowBlockingEvent(t)).toBe(true);
    }
  });

  it("decision made progresses + unblocks; decision reversed is rework/regression", () => {
    expect(getMilestoneFlowSemanticsForEventType("DecisionMade").transitionSignal).toBe("progresses_transition");
    expect(isMilestoneFlowUnblockingEvent("DecisionMade")).toBe(true);
    expect(isMilestoneFlowReworkEvent("DecisionReversed")).toBe(true);
    expect(getMilestoneFlowSemanticsForEventType("DecisionReversed").healthSignal).toBe("indicates_regression");
  });
});

describe("approval semantics", () => {
  it("approval requested implies approval_delay; expired persists the delay", () => {
    expect(getMilestoneFlowSemanticsForEventType("ApprovalRequested").flowSegmentType).toBe("approval_delay");
    expect(isMilestoneFlowBlockingEvent("ApprovalRequested")).toBe(true);
    expect(getMilestoneFlowSemanticsForEventType("ApprovalExpired").flowSegmentType).toBe("approval_delay");
  });

  it("approval granted unblocks; approval rejected is rework/regression", () => {
    expect(isMilestoneFlowUnblockingEvent("ApprovalGranted")).toBe(true);
    expect(isMilestoneFlowReworkEvent("ApprovalRejected")).toBe(true);
    expect(getMilestoneFlowSemanticsForEventType("ApprovalRejected").flowSegmentType).toBe("rework");
  });
});

describe("scope / quality / deliverable semantics", () => {
  it("scope change carries scope_change friction + possible rework", () => {
    const s = getMilestoneFlowSemanticsForEventType("ScopeChanged");
    expect(s.frictionType).toBe("scope_change");
    expect(isMilestoneFlowReworkEvent("ScopeChanged")).toBe(true);
  });

  it("defect raised carries quality signals + possible rework", () => {
    const s = getMilestoneFlowSemanticsForEventType("DefectRaised");
    expect(s.frictionType).toBe("quality");
    expect(isMilestoneFlowReworkEvent("DefectRaised")).toBe(true);
  });

  it("document approved progresses (deliverable accepted)", () => {
    expect(getMilestoneFlowSemanticsForEventType("DocumentApproved").transitionSignal).toBe("progresses_transition");
  });
});

describe("provenance & confidence", () => {
  it("native event is eligible for high confidence", () => {
    const p = normalizeMilestoneFlowEventProvenance(ev({ eventType: "TaskCompleted" }));
    expect(p.provenanceClass).toBe("native");
    expect(p.maxConfidence).toBe("high");
    expect(classifyMilestoneFlowEvent(ev({ eventType: "TaskCompleted" })).confidence).toBe("high");
  });

  it("backfilled event caps confidence below high", () => {
    const strong = ev({ eventType: "TaskCompleted", lifecycleClass: "SYNTHETIC_BACKFILL_EVENT", confidence: 0.9 });
    const p = normalizeMilestoneFlowEventProvenance(strong);
    expect(p.provenanceClass).toBe("backfilled");
    expect(p.replaySensitive).toBe(true);
    const conf = classifyMilestoneFlowEvent(strong).confidence;
    expect(conf).not.toBe("high");
    expect(["medium", "low", "unknown"]).toContain(conf);
  });

  it("weak/low-confidence backfill is classified inferred and capped low", () => {
    const weak = ev({ eventType: "TaskCompleted", lifecycleClass: "SYNTHETIC_BACKFILL_EVENT", confidence: 0.6 });
    const p = normalizeMilestoneFlowEventProvenance(weak);
    expect(p.provenanceClass).toBe("inferred");
    expect(p.maxConfidence).toBe("low");
  });

  it("derived events (inference) are capped at medium even when native", () => {
    const conf = classifyMilestoneFlowEvent(ev({ eventType: "CostVarianceDetected" })).confidence;
    expect(conf).not.toBe("high");
  });

  it("compensating events are compensation-aware and preserve original evidence", () => {
    const comp = ev({ eventType: "TaskCompleted", isCompensatingEvent: true });
    const p = normalizeMilestoneFlowEventProvenance(comp);
    expect(p.provenanceClass).toBe("compensating");
    expect(p.compensationAware).toBe(true);
    expect(p.preservesOriginalEvidence).toBe(true);
    const ref = buildMilestoneFlowEvidenceRefFromEvent(comp);
    expect(ref?.note).toMatch(/correction/i);
  });
});

describe("evidence refs", () => {
  it("evidence-bearing events yield a ref anchored to the event id", () => {
    const e = ev({ eventType: "MilestoneAchieved" });
    expect(isMilestoneFlowEvidenceBearingEvent(e)).toBe(true);
    const ref = buildMilestoneFlowEvidenceRefFromEvent(e);
    expect(ref).not.toBeNull();
    expect(ref?.eventId).toBe(e.eventId);
    expect(["fact", "inference"]).toContain(ref?.kind);
  });

  it("building an evidence ref does not mutate the source event", () => {
    const e = ev({ eventType: "ApprovalGranted", confidence: 0.9 });
    const snapshot = JSON.parse(JSON.stringify(e));
    buildMilestoneFlowEvidenceRefFromEvent(e);
    classifyMilestoneFlowEvent(e);
    expect(e).toEqual(snapshot);
  });
});

describe("unknown events are safe", () => {
  it("unknown event type does not crash and returns unknown semantics", () => {
    const s = getMilestoneFlowSemanticsForEventType("SomethingNeverRegistered");
    expect(s.semanticCategory).toBe("unknown");
    expect(s.transitionSignal).toBe("unknown");
    expect(s.evidenceKind).toBe("uncertainty");
    expect(isMilestoneFlowEvidenceBearingEvent("SomethingNeverRegistered")).toBe(false);
    expect(buildMilestoneFlowEvidenceRefFromEvent(ev({ eventType: "SomethingNeverRegistered" }))).toBeNull();
  });

  it("ephemeral-excluded telemetry is never treated as a flow signal", () => {
    const s = getMilestoneFlowSemanticsForEventType("MouseMoved");
    expect(s.semanticCategory).toBe("unknown");
    expect(isMilestoneFlowEvidenceBearingEvent("MouseMoved")).toBe(false);
  });
});

describe("purity & determinism", () => {
  it("same input yields deeply-equal output every call", () => {
    const e = ev({ eventType: "TaskReopened" });
    expect(classifyMilestoneFlowEvent(e)).toEqual(classifyMilestoneFlowEvent(e));
    expect(getMilestoneFlowEventSemantics(e)).toEqual(getMilestoneFlowEventSemantics("TaskReopened"));
  });
});

describe("canonical protection — read-only, no write path", () => {
  it("semantic layer code never imports the event write path or references process graph tables", () => {
    const dir = join(process.cwd(), "src/lib/milestone-flow");
    const files = ["event-semantics.ts", "event-semantics-map.ts", "event-semantics-types.ts"];
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8");
      const code = src
        .split("\n")
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
        .join("\n");
      expect(code).not.toMatch(/emitProjectEvent|from\s+["']@\/lib\/events\/ingestion["']/);
      expect(code).not.toMatch(/process_nodes|process_edges/);
      expect(code).not.toMatch(/createAdminClient|service_role/);
    }
  });
});
