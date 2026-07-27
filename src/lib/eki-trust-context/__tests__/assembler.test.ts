import { describe, expect, it } from "vitest";
import {
  diffObserved,
  latestPerBinding,
  orderByUrgency,
  rankRemediation,
  summarize,
} from "../assembler";
import { deriveGateReasons } from "../loader";
import type {
  InstantiatedControl,
  ObservedControlState,
  ObservedEvaluation,
  TrustControlView,
} from "../types";

const CONTROL = "11111111-1111-4111-8111-111111111111";
const BINDING = "22222222-2222-4222-8222-222222222222";
const OWNER = "33333333-3333-4333-8333-333333333333";

function evaluation(over: Partial<ObservedEvaluation> = {}): ObservedEvaluation {
  return {
    bindingObjectId: BINDING,
    evaluationId: "e1",
    sequenceNo: 1,
    evaluatedAt: "2026-07-27T10:00:00Z",
    outcome: "current",
    reasonCode: "evidence_fresh",
    evidenceCount: 12,
    latestEvidenceAt: "2026-07-26T10:00:00Z",
    contradictionCount: 0,
    sourceTable: "audit_logs",
    ...over,
  };
}

function view(over: Partial<TrustControlView> = {}): TrustControlView {
  return {
    controlObjectId: CONTROL,
    title: "Privileged access is attributable",
    ownerUserId: OWNER,
    ownerName: "Ada",
    knowledgeStatus: "active",
    controlState: "operating",
    gateReasons: [],
    bindings: [],
    latestEvaluations: [evaluation()],
    openFindings: [],
    supportingRelations: [],
    contradictoryRelations: [],
    normativeRequirements: [],
    auditReferences: [],
    ...over,
  };
}

describe("latest evaluation resolution", () => {
  /**
   * REG-029. `now()` is the transaction clock, so two evaluations written in one
   * transaction share a timestamp. Resolving "latest" by time then returns an
   * arbitrary one of the two and a re-evidenced control keeps reporting stale.
   */
  it("resolves by sequence, not by timestamp", () => {
    const sameInstant = "2026-07-27T10:00:00Z";
    const latest = latestPerBinding([
      evaluation({ evaluationId: "old", sequenceNo: 7, outcome: "stale", evaluatedAt: sameInstant }),
      evaluation({ evaluationId: "new", sequenceNo: 8, outcome: "current", evaluatedAt: sameInstant }),
    ]);
    expect(latest).toHaveLength(1);
    expect(latest[0].evaluationId).toBe("new");
  });

  it("keeps one result per binding", () => {
    const latest = latestPerBinding([
      evaluation({ bindingObjectId: "b1", sequenceNo: 1 }),
      evaluation({ bindingObjectId: "b1", sequenceNo: 2 }),
      evaluation({ bindingObjectId: "b2", sequenceNo: 1 }),
    ]);
    expect(latest.map((e) => e.bindingObjectId).sort()).toEqual(["b1", "b2"]);
  });
});

describe("gate reasons", () => {
  const control: InstantiatedControl = {
    layer: "instantiated",
    controlObjectId: CONTROL,
    title: "c",
    summary: "s",
    knowledgeStatus: "active",
    ownerUserId: OWNER,
    ownerName: null,
    bindings: [
      {
        bindingObjectId: BINDING,
        title: "b",
        resolverKey: "privileged_access_activity",
        freshnessInterval: "7 days",
        evaluationInterval: "1 day",
        evaluationEnabled: true,
        nextDueAt: null,
      },
    ],
  };

  it("reports nothing when every condition holds", () => {
    expect(deriveGateReasons(CONTROL, control, [evaluation()], [])).toEqual([]);
  });

  it("names an unassigned owner", () => {
    expect(deriveGateReasons(CONTROL, { ...control, ownerUserId: null }, [evaluation()], [])).toContain(
      "owner_not_assigned",
    );
  });

  it("names an inactive specification", () => {
    expect(
      deriveGateReasons(CONTROL, { ...control, knowledgeStatus: "proposed" }, [evaluation()], []),
    ).toContain("control_specification_not_active");
  });

  it("names a control with no binding", () => {
    expect(deriveGateReasons(CONTROL, { ...control, bindings: [] }, [], [])).toContain("no_evidence_binding");
  });

  /** `unavailable` and `invalid` never count as fresh — the engine fails closed. */
  it("treats an unreadable source as no fresh evidence, never as a pass", () => {
    for (const outcome of ["stale", "unavailable", "invalid", "contradictory"] as const) {
      expect(deriveGateReasons(CONTROL, control, [evaluation({ outcome })], [])).toContain("no_fresh_evidence");
    }
    for (const outcome of ["current", "approaching_stale"] as const) {
      expect(deriveGateReasons(CONTROL, control, [evaluation({ outcome })], [])).not.toContain("no_fresh_evidence");
    }
  });

  it("names an unresolved contradiction", () => {
    const reasons = deriveGateReasons(CONTROL, control, [evaluation()], [
      { relationType: "contradicts", sourceObjectId: CONTROL, targetObjectId: "x", resolutionStatus: "unresolved" },
    ]);
    expect(reasons).toContain("unresolved_contradiction");
  });

  it("ignores a contradiction that was accepted or resolved", () => {
    for (const status of ["accepted", "resolved"]) {
      const reasons = deriveGateReasons(CONTROL, control, [evaluation()], [
        { relationType: "contradicts", sourceObjectId: CONTROL, targetObjectId: "x", resolutionStatus: status },
      ]);
      expect(reasons).not.toContain("unresolved_contradiction");
    }
  });
});

describe("remediation ranking", () => {
  it("ranks by how many stated reasons a control has", () => {
    const ranked = rankRemediation([
      view({ controlObjectId: "a", title: "A", controlState: "degraded" }),
      view({
        controlObjectId: "b",
        title: "B",
        controlState: "degraded",
        ownerUserId: null,
        bindings: [],
        openFindings: [
          { findingObjectId: "f", targetObjectId: "b", conditionCode: "evidence_missing", severity: null, openedAt: "", lastSeenAt: "", occurrenceCount: 1, ownerUserId: null },
        ],
      }),
    ]);
    expect(ranked[0].controlObjectId).toBe("b");
    expect(ranked[0].reasons).toEqual(expect.arrayContaining(["lost_operating", "owner_not_assigned", "no_evidence_binding", "never_evidenced"]));
  });

  /**
   * An entry nobody can justify is omitted, not ranked last. An unexplained item
   * on a remediation list gets actioned anyway and nobody can say why.
   */
  it("omits a control it cannot state a reason for", () => {
    expect(rankRemediation([view()])).toEqual([]);
  });

  it("marks a blocking candidate", () => {
    const ranked = rankRemediation([
      view({
        controlState: "degraded",
        contradictoryRelations: [
          { relationType: "contradicts", sourceObjectId: CONTROL, targetObjectId: "x", basis: "observed", resolutionStatus: "unresolved", contradictory: true },
        ],
      }),
    ]);
    expect(ranked[0].blocking).toBe(true);
  });

  it("is deterministic for equal candidates", () => {
    const a = view({ controlObjectId: "a", title: "Alpha", controlState: "degraded" });
    const b = view({ controlObjectId: "b", title: "Beta", controlState: "degraded" });
    expect(rankRemediation([b, a]).map((r) => r.title)).toEqual(["Alpha", "Beta"]);
  });
});

describe("ordering and summary", () => {
  it("puts the worst controls first", () => {
    const ordered = orderByUrgency([
      view({ controlObjectId: "op", title: "Op", controlState: "operating" }),
      view({ controlObjectId: "deg", title: "Deg", controlState: "degraded" }),
      view({ controlObjectId: "inf", title: "Inf", controlState: "ineffective" }),
    ]);
    expect(ordered.map((v) => v.controlObjectId)).toEqual(["inf", "deg", "op"]);
  });

  /** Counts only. No score, no percentage, no readiness figure — by design. */
  it("summarises with counts and never a score", () => {
    const summary = summarize([
      view({ controlState: "operating" }),
      view({ controlState: "degraded", openFindings: [
        { findingObjectId: "f", targetObjectId: CONTROL, conditionCode: "evidence_stale", severity: null, openedAt: "", lastSeenAt: "", occurrenceCount: 2, ownerUserId: null },
      ] }),
      view({ controlState: null }),
    ]);
    expect(summary).toMatchObject({ total: 3, openFindings: 1, neverMeasured: 1 });
    expect(summary.byState.operating).toBe(1);
    expect(Object.keys(summary)).not.toContain("score");
    expect(Object.keys(summary)).not.toContain("readiness");
  });
});

describe("what changed", () => {
  const observed = (over: Partial<ObservedControlState> = {}): ObservedControlState => ({
    layer: "observed",
    controlObjectId: CONTROL,
    controlState: "operating",
    lastStateChangeAt: "2026-07-27T10:00:00Z",
    lastEvaluatedAt: "2026-07-27T10:00:00Z",
    gateReasons: [],
    evaluations: [evaluation()],
    findings: [],
    ...over,
  });

  it("reports a control state change", () => {
    const changes = diffObserved([observed()], [observed({ controlState: "degraded" })]);
    expect(changes).toContainEqual({ controlObjectId: CONTROL, kind: "control_state", from: "operating", to: "degraded" });
  });

  it("reports an evidence outcome change", () => {
    const changes = diffObserved(
      [observed()],
      [observed({ evaluations: [evaluation({ sequenceNo: 2, outcome: "stale" })] })],
    );
    expect(changes.some((c) => c.kind === "evidence_outcome" && c.from === "current" && c.to === "stale")).toBe(true);
  });

  it("reports findings opening and closing", () => {
    const withFinding = observed({
      findings: [
        { findingObjectId: "f", targetObjectId: CONTROL, conditionCode: "evidence_stale", severity: null, openedAt: "", lastSeenAt: "", occurrenceCount: 1, ownerUserId: null },
      ],
    });
    expect(diffObserved([observed()], [withFinding]).some((c) => c.kind === "finding_opened")).toBe(true);
    expect(diffObserved([withFinding], [observed()]).some((c) => c.kind === "finding_closed")).toBe(true);
  });

  /** "Nothing changed" has to be a real answer, not the absence of one. */
  it("reports no change when the same rows are read twice", () => {
    expect(diffObserved([observed()], [observed()])).toEqual([]);
  });
});
