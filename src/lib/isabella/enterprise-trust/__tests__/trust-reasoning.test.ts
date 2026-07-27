import { describe, expect, it } from "vitest";
import type { TrustControlView } from "@/lib/eki-trust-context/types";
import { rankRemediation, summarize } from "@/lib/eki-trust-context/assembler";
import {
  ISABELLA_TRUST_FORBIDDEN,
  IsabellaTrustAuthorityError,
  assertIsabellaMay,
  containsProhibitedAssurance,
  draftProvenance,
  isabellaMay,
} from "../authorization";
import { answerTrustQuestion, classifyTrustQuestion } from "../engine";
import { isEnterpriseTrustReasoningEnabled } from "../flag";
import { formatTrustAnswer } from "../formatter";
import { routeIsabellaQuestion } from "@/lib/isabella/process-intelligence-runtime/router";

const CONTROL = "11111111-1111-4111-8111-111111111111";
const OWNER = "22222222-2222-4222-8222-222222222222";

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
    latestEvaluations: [
      {
        bindingObjectId: "b1",
        evaluationId: "e1",
        sequenceNo: 4,
        evaluatedAt: "2026-07-27T10:00:00Z",
        outcome: "current",
        reasonCode: "privileged_access_evidence_fresh",
        evidenceCount: 31,
        latestEvidenceAt: "2026-07-26T19:03:07Z",
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

function ask(question: Parameters<typeof answerTrustQuestion>[0]["question"], views: TrustControlView[], extra = {}) {
  return answerTrustQuestion({
    question,
    views,
    summary: summarize(views),
    remediation: rankRemediation(views),
    ...extra,
  });
}

describe("authorization boundaries", () => {
  it("permits explaining, comparing and proposing", () => {
    for (const action of ["explain_state", "compare_evidence", "rank_remediation_candidates", "draft_remediation_proposal"]) {
      expect(isabellaMay(action)).toBe(true);
    }
  });

  it("refuses every authoritative governance action", () => {
    for (const action of ISABELLA_TRUST_FORBIDDEN) {
      expect(isabellaMay(action)).toBe(false);
      expect(() => assertIsabellaMay(action)).toThrow(IsabellaTrustAuthorityError);
    }
  });

  /**
   * Deny by default. Allowing anything not explicitly forbidden would grant the
   * AI every capability added later, which is exactly backwards.
   */
  it("refuses an action nobody thought about", () => {
    expect(isabellaMay("recalculate_control_state")).toBe(false);
    expect(isabellaMay("")).toBe(false);
  });

  it("marks every generated proposal as a draft that does not count", () => {
    const provenance = draftProvenance([CONTROL]);
    expect(provenance).toMatchObject({
      generatedBy: "isabella",
      actorType: "ai",
      status: "draft",
      requiresHumanApproval: true,
      countsTowardCoverage: false,
    });
  });
});

describe("prohibited compliance assertions", () => {
  it("catches the assurances this system cannot make", () => {
    for (const text of [
      "ProjectOps360 is SOC 2 compliant.",
      "We are certified.",
      "This control is certified.",
      "The audit will pass.",
      "We are fully compliant with the framework.",
      "The platform is audit-ready.",
      "Estamos certificados.",
      "La auditoría va a pasar.",
    ]) {
      expect(containsProhibitedAssurance(text), text).toBe(true);
    }
  });

  it("permits honest statements about state and evidence", () => {
    for (const text of [
      "Two controls are operating and one is degraded.",
      "The evidence for this control lapsed 3 days ago.",
      "There is an open finding: evidence_missing.",
      "Dos controles están operando; uno está degradado.",
    ]) {
      expect(containsProhibitedAssurance(text), text).toBe(false);
    }
  });
});

describe("question classification", () => {
  it("routes the questions this macrophase must answer", () => {
    const cases: Array<[string, string]> = [
      ["What Enterprise Trust controls are currently operating?", "operating_controls"],
      ["Which controls are degraded?", "degraded_controls"],
      ["What evidence caused this control to become operating?", "why_operating"],
      ["Which findings are open?", "open_findings"],
      ["Which evidence is approaching stale?", "approaching_stale"],
      ["Why did this control degrade?", "why_degraded"],
      ["Who owns this control?", "control_owner"],
      ["What governance action produced this evidence?", "evidence_provenance"],
      ["Which controls have contradictory evidence?", "contradictions"],
      ["What should be remediated first in our controls?", "remediation_priority"],
      ["What changed in the controls since the previous evaluation?", "what_changed"],
    ];
    for (const [question, expected] of cases) {
      expect(classifyTrustQuestion(question), question).toBe(expected);
    }
  });

  it("routes the Spanish equivalents", () => {
    expect(classifyTrustQuestion("¿Qué controles están degradados?")).toBe("degraded_controls");
    expect(classifyTrustQuestion("¿Quién es el responsable de este control?")).toBe("control_owner");
    expect(classifyTrustQuestion("¿Qué hallazgos de gobernanza hay abiertos?")).toBe("open_findings");
  });

  /** An unrelated question must fall through, not be guessed at. */
  it("declines questions that are not about trust", () => {
    expect(classifyTrustQuestion("Which tasks are late?")).toBeNull();
    expect(classifyTrustQuestion("¿Cuál es el presupuesto del proyecto?")).toBeNull();
    expect(classifyTrustQuestion("")).toBeNull();
  });
});

describe("grounded answers", () => {
  it("cites the evaluation behind an operating control", () => {
    const answer = ask("why_operating", [view()], { controlObjectId: CONTROL });
    expect(answer.claims[0].kind).toBe("verified_current");
    expect(answer.claims[0].references.some((r) => r.kind === "evaluation" && r.id === "e1")).toBe(true);
    expect(answer.claims[0].statement).toContain("audit_logs");
  });

  it("explains a degraded control from its recorded reasons and findings", () => {
    const degraded = view({
      controlState: "degraded",
      gateReasons: ["no_fresh_evidence"],
      openFindings: [
        { findingObjectId: "f1", targetObjectId: CONTROL, conditionCode: "evidence_stale", severity: null, openedAt: "2026-07-20T00:00:00Z", lastSeenAt: "2026-07-27T00:00:00Z", occurrenceCount: 4, ownerUserId: OWNER },
      ],
    });
    const answer = ask("why_degraded", [degraded], { controlObjectId: CONTROL });
    expect(answer.claims.some((c) => c.statement.includes("no_fresh_evidence"))).toBe(true);
    expect(answer.claims.some((c) => c.references.some((r) => r.kind === "finding" && r.id === "f1"))).toBe(true);
  });

  it("explains stale evidence without inventing a cause", () => {
    const ageing = view({
      latestEvaluations: [{ ...view().latestEvaluations[0], outcome: "approaching_stale", reasonCode: "privileged_access_evidence_ageing" }],
    });
    const answer = ask("approaching_stale", [ageing]);
    expect(answer.claims).toHaveLength(1);
    expect(answer.claims[0].statement).toContain("warning window");
  });

  /**
   * Absence is reported as absence. A cheerful "everything is fine" would be a
   * claim, and this branch has no evidence for one.
   */
  it("records what it could not establish instead of guessing", () => {
    const answer = ask("open_findings", [view()]);
    expect(answer.claims).toEqual([]);
    expect(answer.unsupported).toContain("no_open_findings");
  });

  it("names a layer it could not read", () => {
    const answer = ask("overview", [view()], { unavailableLayers: ["normative"] });
    expect(answer.unsupported).toContain("layer_unavailable:normative");
  });

  it("refuses to answer why_operating for a control that is not operating", () => {
    const answer = ask("why_operating", [view({ controlState: "degraded" })], { controlObjectId: CONTROL });
    expect(answer.claims).toEqual([]);
    expect(answer.unsupported).toContain("control_is_not_operating");
  });

  it("reports a control outside the caller's context as not found", () => {
    const answer = ask("why_degraded", [view()], { controlObjectId: "99999999-9999-4999-8999-999999999999" });
    expect(answer.unsupported).toContain("control_not_found");
  });
});

describe("recommendation without mutation", () => {
  it("labels a ranking as inferred and its proposals as drafts", () => {
    const degraded = view({
      controlState: "degraded",
      ownerUserId: null,
      openFindings: [
        { findingObjectId: "f1", targetObjectId: CONTROL, conditionCode: "evidence_missing", severity: null, openedAt: "", lastSeenAt: "", occurrenceCount: 1, ownerUserId: null },
      ],
    });
    const answer = ask("remediation_priority", [degraded]);
    expect(answer.claims.every((c) => c.kind === "inferred")).toBe(true);
    expect(answer.proposals.length).toBeGreaterThan(0);
    for (const proposal of answer.proposals) {
      expect(proposal.provenance.status).toBe("draft");
      expect(proposal.provenance.countsTowardCoverage).toBe(false);
      expect(proposal.provenance.requiresHumanApproval).toBe(true);
    }
  });

  it("states in the rendered answer that it cannot resolve anything", () => {
    const degraded = view({ controlState: "degraded", ownerUserId: null });
    const answer = ask("control_owner", [degraded], { controlObjectId: CONTROL });
    const en = formatTrustAnswer(answer, "en");
    const es = formatTrustAnswer(answer, "es");
    expect(en).toContain("cannot resolve findings");
    expect(es).toContain("No puedo resolver hallazgos");
  });

  /** The engine must never emit a compliance assurance, even indirectly. */
  it("refuses an answer containing a prohibited assurance", () => {
    const tampered = view({ title: "ProjectOps360 is SOC 2 compliant" });
    expect(() => ask("operating_controls", [tampered])).toThrow(IsabellaTrustAuthorityError);
  });
});

describe("rendering", () => {
  it("prints the claim kind so verified is never confused with inferred", () => {
    const rendered = formatTrustAnswer(ask("operating_controls", [view()]), "en");
    expect(rendered).toContain("**Verified now**");
    const es = formatTrustAnswer(ask("operating_controls", [view()]), "es");
    expect(es).toContain("**Verificado ahora**");
  });

  it("renders references for every material claim", () => {
    const rendered = formatTrustAnswer(ask("why_operating", [view()], { controlObjectId: CONTROL }), "en");
    expect(rendered).toContain("References");
    expect(rendered).toContain("evaluation:");
  });

  it("says so plainly when there is nothing to report", () => {
    const empty = answerTrustQuestion({ question: "what_changed", views: [], summary: summarize([]), remediation: [] });
    expect(formatTrustAnswer(empty, "en")).toContain("Nothing changed");
    expect(formatTrustAnswer(empty, "es")).toContain("No cambió nada");
  });
});

describe("routing is gated, and default OFF", () => {
  const original = process.env.EKI_TRUST_REASONING_ENABLED;
  const restore = () => {
    if (original === undefined) delete process.env.EKI_TRUST_REASONING_ENABLED;
    else process.env.EKI_TRUST_REASONING_ENABLED = original;
  };

  it("is off unless explicitly enabled", () => {
    delete process.env.EKI_TRUST_REASONING_ENABLED;
    expect(isEnterpriseTrustReasoningEnabled()).toBe(false);
    process.env.EKI_TRUST_REASONING_ENABLED = "1";
    expect(isEnterpriseTrustReasoningEnabled()).toBe(false);
    process.env.EKI_TRUST_REASONING_ENABLED = "true";
    expect(isEnterpriseTrustReasoningEnabled()).toBe(true);
    restore();
  });

  /**
   * The reason the gate exists. The subject regex matches "controls" wherever it
   * appears, including product questions that have nothing to do with governance.
   * Ungated, those would be pulled away from retrieval and answered from a
   * context that is empty wherever the EKI migrations have not been applied —
   * a silent degradation, not an error.
   */
  it("leaves ordinary product questions with retrieval when off", () => {
    delete process.env.EKI_TRUST_REASONING_ENABLED;
    for (const question of [
      "How do I add quality controls to my project?",
      "¿Dónde configuro los controles de calidad?",
      "Where can I see the findings from my last import?",
    ]) {
      const decision = routeIsabellaQuestion(question, { hasProject: true });
      expect(decision.route, question).not.toBe("enterprise_trust");
    }
    restore();
  });

  it("routes trust questions only when on", () => {
    delete process.env.EKI_TRUST_REASONING_ENABLED;
    expect(routeIsabellaQuestion("Which controls are degraded?", { hasProject: true }).route)
      .not.toBe("enterprise_trust");

    process.env.EKI_TRUST_REASONING_ENABLED = "true";
    expect(routeIsabellaQuestion("Which controls are degraded?", { hasProject: true }).route)
      .toBe("enterprise_trust");
    restore();
  });

  /** A governance question must never require a project to be answerable. */
  it("does not demand a project scope for a trust question", () => {
    process.env.EKI_TRUST_REASONING_ENABLED = "true";
    const decision = routeIsabellaQuestion("Which controls are operating?", { hasProject: false });
    expect(decision.route).toBe("enterprise_trust");
    expect(decision.needsClarification).toBe(false);
    restore();
  });
});
