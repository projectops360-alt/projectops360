import { describe, expect, it } from "vitest";
import type { TrustControlView } from "@/lib/eki-trust-context/types";
import {
  assertSingleTenant,
  filterTrustLens,
  freshnessOf,
  projectTrustLens,
} from "../trust-lens-projection";

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "99999999-9999-4999-8999-999999999999";
const CONTROL = "22222222-2222-4222-8222-222222222222";
const BINDING = "33333333-3333-4333-8333-333333333333";
const OWNER = "44444444-4444-4444-8444-444444444444";

function view(over: Partial<TrustControlView> = {}): TrustControlView {
  return {
    controlObjectId: CONTROL,
    title: "Privileged access is attributable",
    ownerUserId: OWNER,
    ownerName: "Ada",
    knowledgeStatus: "active",
    controlState: "operating",
    gateReasons: [],
    bindings: [
      {
        bindingObjectId: BINDING,
        title: "Privileged access activity",
        resolverKey: "privileged_access_activity",
        freshnessInterval: "7 days",
        evaluationInterval: "1 day",
        evaluationEnabled: true,
        nextDueAt: "2026-07-28T00:00:00Z",
      },
    ],
    latestEvaluations: [
      {
        bindingObjectId: BINDING,
        evaluationId: "e1",
        sequenceNo: 1,
        evaluatedAt: "2026-07-27T10:00:00Z",
        outcome: "current",
        reasonCode: "fresh",
        evidenceCount: 31,
        latestEvidenceAt: "2026-07-26T00:00:00Z",
        contradictionCount: 0,
        sourceTable: "audit_logs",
      },
    ],
    openFindings: [],
    supportingRelations: [],
    contradictoryRelations: [],
    normativeRequirements: [],
    auditReferences: [],
    ...over,
  };
}

describe("freshness mapping", () => {
  it("maps every outcome, and never-measured is not stale", () => {
    expect(freshnessOf("current")).toBe("fresh");
    expect(freshnessOf("approaching_stale")).toBe("warning");
    expect(freshnessOf("stale")).toBe("stale");
    expect(freshnessOf("contradictory")).toBe("stale");
    expect(freshnessOf("unavailable")).toBe("unreadable");
    expect(freshnessOf("invalid")).toBe("unreadable");
    // A control that has never produced evidence needs different work from one
    // whose evidence lapsed, and a single "not fresh" badge would hide that.
    expect(freshnessOf(null)).toBe("never_measured");
  });
});

describe("projection", () => {
  it("emits canonical nodes for control, binding and owner", () => {
    const projection = projectTrustLens([view()], ORG);
    const kinds = projection.nodes.map((n) => n.kind).sort();
    expect(kinds).toEqual(["control", "evidence_binding", "owner"]);
    expect(projection.edges.map((e) => e.kind).sort()).toEqual(["owned_by", "supports"]);
  });

  it("carries the canonical object id so detail navigation resolves", () => {
    const projection = projectTrustLens([view()], ORG);
    const control = projection.nodes.find((n) => n.kind === "control")!;
    expect(control.canonicalObjectId).toBe(CONTROL);
    expect(control.id).toBe(`ctl:${CONTROL}`);
  });

  it("emits a finding node and the edge that explains it", () => {
    const projection = projectTrustLens(
      [
        view({
          openFindings: [
            { findingObjectId: "f1", targetObjectId: CONTROL, conditionCode: "evidence_missing", severity: null, openedAt: "", lastSeenAt: "", occurrenceCount: 3, ownerUserId: null },
          ],
        }),
      ],
      ORG,
    );
    const finding = projection.nodes.find((n) => n.kind === "finding")!;
    expect(finding.conditionCode).toBe("evidence_missing");
    expect(finding.severity).toBe("high");
    expect(finding.occurrenceCount).toBe(3);
    expect(projection.edges.some((e) => e.kind === "raises" && e.targetId === "fnd:f1")).toBe(true);
  });

  /**
   * A contradiction is one of the six conditions that stops a control operating.
   * Hiding the edge would show a degraded control with no visible cause.
   */
  it("shows contradictions rather than hiding them", () => {
    const projection = projectTrustLens(
      [
        view({
          contradictoryRelations: [
            { relationType: "contradicts", sourceObjectId: CONTROL, targetObjectId: "other", basis: "observed", resolutionStatus: "unresolved", contradictory: true },
          ],
        }),
      ],
      ORG,
    );
    const edge = projection.edges.find((e) => e.kind === "contradicts")!;
    expect(edge.contradictory).toBe(true);
    expect(edge.resolutionStatus).toBe("unresolved");
  });

  /** The worst binding decides. Showing the better of two would be the reassuring lie. */
  it("takes the worst binding freshness for the control", () => {
    const projection = projectTrustLens(
      [
        view({
          bindings: [
            { ...view().bindings[0] },
            { ...view().bindings[0], bindingObjectId: "b2", title: "Second" },
          ],
          latestEvaluations: [
            { ...view().latestEvaluations[0] },
            { ...view().latestEvaluations[0], bindingObjectId: "b2", evaluationId: "e2", outcome: "stale" },
          ],
        }),
      ],
      ORG,
    );
    expect(projection.nodes.find((n) => n.kind === "control")!.freshness).toBe("stale");
  });

  it("marks a control with no binding as never measured", () => {
    const projection = projectTrustLens([view({ bindings: [], latestEvaluations: [] })], ORG);
    expect(projection.nodes.find((n) => n.kind === "control")!.freshness).toBe("never_measured");
  });

  it("emits one owner node when several controls share an owner", () => {
    const projection = projectTrustLens(
      [view({ controlObjectId: "c1" }), view({ controlObjectId: "c2" })],
      ORG,
    );
    expect(projection.nodes.filter((n) => n.kind === "owner")).toHaveLength(1);
    expect(projection.edges.filter((e) => e.kind === "owned_by")).toHaveLength(2);
  });

  it("emits no owner node when the control is unowned", () => {
    const projection = projectTrustLens([view({ ownerUserId: null })], ORG);
    expect(projection.nodes.some((n) => n.kind === "owner")).toBe(false);
  });

  it("is deterministic", () => {
    expect(JSON.stringify(projectTrustLens([view()], ORG))).toBe(JSON.stringify(projectTrustLens([view()], ORG)));
  });
});

describe("filters", () => {
  const views = [
    view({ controlObjectId: "op", title: "Operating", controlState: "operating" }),
    view({
      controlObjectId: "deg",
      title: "Degraded",
      controlState: "degraded",
      ownerUserId: null,
      latestEvaluations: [{ ...view().latestEvaluations[0], outcome: "stale" }],
      openFindings: [
        { findingObjectId: "f1", targetObjectId: "deg", conditionCode: "evidence_stale", severity: null, openedAt: "", lastSeenAt: "", occurrenceCount: 1, ownerUserId: null },
      ],
    }),
  ];

  it("filters by control state", () => {
    const filtered = filterTrustLens(projectTrustLens(views, ORG), { controlStates: ["degraded"] });
    expect(filtered.nodes.filter((n) => n.kind === "control").map((n) => n.label)).toEqual(["Degraded"]);
  });

  it("filters by evidence freshness", () => {
    const filtered = filterTrustLens(projectTrustLens(views, ORG), { freshness: ["stale"] });
    expect(filtered.nodes.filter((n) => n.kind === "control").map((n) => n.label)).toEqual(["Degraded"]);
  });

  it("filters by finding condition", () => {
    const filtered = filterTrustLens(projectTrustLens(views, ORG), { findingConditions: ["evidence_stale"] });
    expect(filtered.nodes.filter((n) => n.kind === "control").map((n) => n.label)).toEqual(["Degraded"]);
  });

  it("filters to unowned controls", () => {
    const filtered = filterTrustLens(projectTrustLens(views, ORG), { unownedOnly: true });
    expect(filtered.nodes.filter((n) => n.kind === "control").map((n) => n.label)).toEqual(["Degraded"]);
  });

  /** A finding with no visible control is an orphan nobody can explain. */
  it("keeps a hidden control's findings hidden with it", () => {
    const filtered = filterTrustLens(projectTrustLens(views, ORG), { controlStates: ["operating"] });
    expect(filtered.nodes.some((n) => n.kind === "finding")).toBe(false);
  });

  it("never leaves an edge whose endpoint was filtered out", () => {
    const filtered = filterTrustLens(projectTrustLens(views, ORG), { controlStates: ["operating"] });
    const ids = new Set(filtered.nodes.map((n) => n.id));
    for (const edge of filtered.edges) {
      expect(ids.has(edge.sourceId)).toBe(true);
      expect(ids.has(edge.targetId)).toBe(true);
    }
  });
});

describe("tenant isolation", () => {
  it("accepts a single-tenant projection", () => {
    expect(() => assertSingleTenant(projectTrustLens([view()], ORG))).not.toThrow();
  });

  /**
   * Defence in depth. The loader scopes its reads, but a projection that mixed
   * tenants would render a cross-tenant graph that looks entirely normal.
   */
  it("refuses a projection carrying a foreign node", () => {
    const projection = projectTrustLens([view()], ORG);
    projection.nodes[0] = { ...projection.nodes[0], organizationId: OTHER_ORG };
    expect(() => assertSingleTenant(projection)).toThrow(/cross_tenant/);
  });
});

describe("no second graph", () => {
  /**
   * The lens is a filtered semantic VIEW. If it ever gained its own table it
   * would start disagreeing with the canonical model the first time an evaluation
   * ran while nobody was looking at the screen.
   */
  it("is a pure projection with no persistence", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../trust-lens-projection.ts", import.meta.url), "utf8"),
    );
    expect(source).not.toMatch(/\bfrom\(["']/);
    expect(source).not.toMatch(/\.insert\(|\.upsert\(|\.update\(|\.delete\(/);
    expect(source).not.toMatch(/createClient|createAdminClient|supabase/i);
  });
});
