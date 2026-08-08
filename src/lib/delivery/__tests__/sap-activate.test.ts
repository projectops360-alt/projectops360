// ============================================================================
// SAP Activate as a delivery method the product can actually recommend
// ============================================================================
// Guard: SAP-ACTIVATE-METHOD
//
// An ERP programme run under formal governance was being recommended `hybrid`.
// That described the SHAPE correctly — phase control plus adaptive execution —
// but left the gates unnamed, so the methodology the client actually follows
// (and is audited against) had no representation anywhere in the product.
//
// Two things are protected here:
//
//   1. It is recommended ONLY when we know the platform is SAP. The first
//      attempt keyed the rule on `projectType === "erp"` — which reads "ERP /
//      System Implementation" and covers Oracle, Dynamics and Workday. That
//      would have told an Oracle customer, confidently, to follow SAP's
//      methodology. An UNANSWERED platform recommends nothing vendor-specific:
//      not knowing is not the same as knowing it is not SAP.
//   2. Nothing else moved. A method added to a rule engine changes every OTHER
//      answer's blast radius, so the untouched cases are pinned.
// ============================================================================

import { describe, it, expect } from "vitest";
import { recommendFramework, type FrameworkInputs } from "../recommend";
import { DELIVERY_METHODS, SAP_ACTIVATE_PHASES } from "../config";

function inputs(over: Partial<FrameworkInputs> = {}): FrameworkInputs {
  return {
    projectType: "software",
    uncertainty: "medium",
    governance: "moderate",
    documentation: "moderate",
    changeControl: "recommended",
    feedbackFreq: "weekly",
    vendorDep: "low",
    ...over,
  };
}

describe("when SAP Activate is recommended", () => {
  const sap = { projectType: "erp", platform: "sap" };

  it("recommends it for a SAP implementation", () => {
    const r = recommendFramework(inputs({ ...sap, governance: "high" }));
    expect(r.method).toBe("sap_activate");
    expect(r.confidence).toBeGreaterThan(80);
  });

  it("recommends it for a REGULATED SAP programme, its strongest case", () => {
    // Rule precedence put `regulatory` first, so the most obviously
    // gate-governed project in the whole rule set was the one that could never
    // reach the gate-based methodology.
    expect(recommendFramework(inputs({ ...sap, governance: "regulatory" })).method).toBe("sap_activate");
    expect(recommendFramework(inputs({ ...sap, governance: "high", documentation: "regulatory" })).method)
      .toBe("sap_activate");
  });

  it("recommends it for a lightly-governed SAP project too, less confidently", () => {
    // SAP Activate is what SAP implementations run on, whatever the ceremony
    // level. Governance raises confidence; it does not decide the answer.
    const light = recommendFramework(inputs({ ...sap, governance: "light" }));
    const heavy = recommendFramework(inputs({ ...sap, governance: "regulatory" }));
    expect(light.method).toBe("sap_activate");
    expect(heavy.confidence).toBeGreaterThan(light.confidence);
  });

  it("explains itself in both languages, naming the gates", () => {
    const r = recommendFramework(inputs({ ...sap, governance: "high" }));
    expect(r.reasonEs).toMatch(/gate/i);
    expect(r.reasonEn).toMatch(/gate/i);
    expect(r.reasonEs).not.toBe(r.reasonEn);
  });

  it("still gives an ERP a usable board and cadence", () => {
    // A recommendation that names a method but hands back no setup is half an
    // answer; the wizard writes these straight into the project.
    const r = recommendFramework(inputs({ ...sap, governance: "high" }));
    expect(r.boardColumns.length).toBeGreaterThan(0);
    expect(r.cadence).toBeTruthy();
    expect(r.meetingRhythm.length).toBeGreaterThan(0);
  });
});

describe("when it is NOT — the vendor guess this exists to prevent", () => {
  it("NEVER recommends SAP's methodology to an Oracle customer", () => {
    // The whole reason the rule moved off `projectType`. "ERP / System
    // Implementation" covers every vendor.
    for (const platform of ["oracle", "dynamics", "salesforce", "workday", "other"]) {
      const r = recommendFramework(inputs({ projectType: "erp", platform, governance: "regulatory" }));
      expect(r.method, platform).not.toBe("sap_activate");
    }
  });

  it("stays silent when the platform was never asked", () => {
    // Not knowing is not the same as knowing it is SAP. An unanswered platform
    // must fall through to the generic rules, not guess a vendor.
    expect(recommendFramework(inputs({ projectType: "erp", governance: "high" })).method)
      .not.toBe("sap_activate");
    expect(recommendFramework(inputs({ projectType: "erp", governance: "high", platform: "" })).method)
      .not.toBe("sap_activate");
  });

  it("does not recommend it for SAP work that is not an implementation", () => {
    // A BI project on SAP data is not an SAP implementation programme.
    expect(recommendFramework(inputs({ projectType: "data_bi", platform: "sap", uncertainty: "high" })).method)
      .not.toBe("sap_activate");
  });

  it("does not leak into construction", () => {
    const r = recommendFramework(inputs({ projectType: "construction", governance: "high" }));
    expect(r.method).not.toBe("sap_activate");
  });

  it("keeps the old answer for a governed ERP whose platform is unknown", () => {
    // Behaviour before this feature, deliberately preserved: no project silently
    // changes methodology because a new option appeared.
    expect(recommendFramework(inputs({ projectType: "erp", governance: "high" })).method).toBe("hybrid");
  });

  it("does not leak into a regulated non-ERP project", () => {
    const r = recommendFramework(inputs({ projectType: "compliance", governance: "regulatory" }));
    expect(r.method).not.toBe("sap_activate");
    expect(["hybrid", "predictive"]).toContain(r.method);
  });

  it("leaves the agile answers untouched", () => {
    expect(recommendFramework(inputs({ uncertainty: "high", projectType: "software" })).method).toBe("scrum");
    expect(recommendFramework(inputs({ uncertainty: "high", projectType: "marketing" })).method).toBe("agile");
  });

  it("leaves the kanban answer untouched", () => {
    const r = recommendFramework(inputs({ projectType: "operations", feedbackFreq: "continuous" }));
    expect(r.method).toBe("kanban");
  });

  it("never returns a method the picker cannot render", () => {
    // The wizard maps over DELIVERY_METHODS; a recommendation outside it would
    // crash the screen rather than showing an unknown option.
    for (const projectType of ["software", "erp", "construction", "operations", "data_bi", "compliance", "marketing"]) {
      for (const governance of ["light", "moderate", "high", "regulatory"]) {
        for (const platform of ["", "sap", "oracle", "other"]) {
          const r = recommendFramework(inputs({ projectType, governance, platform }));
          expect(DELIVERY_METHODS[r.method], `${projectType}/${governance}/${platform}`).toBeDefined();
        }
      }
    }
  });
});

describe("the methodology's own structure", () => {
  it("carries the six SAP Activate phases in order", () => {
    expect(SAP_ACTIVATE_PHASES.map((p) => p.key)).toEqual([
      "discover", "prepare", "explore", "realize", "deploy", "run",
    ]);
  });

  it("closes every phase with a numbered quality gate", () => {
    // The gates are the point. A phase without one is just a stage name.
    expect(SAP_ACTIVATE_PHASES.map((p) => p.gate.key)).toEqual(["q0", "q1", "q2", "q3", "q4", "q5"]);
  });

  it("says what each phase must produce before its gate can be assessed", () => {
    for (const phase of SAP_ACTIVATE_PHASES) {
      expect(phase.exitCriteriaEs.trim().length, phase.key).toBeGreaterThan(20);
      expect(phase.exitCriteriaEn.trim().length, phase.key).toBeGreaterThan(20);
    }
  });

  it("is fully bilingual — no phase, gate or criterion in one language only", () => {
    for (const phase of SAP_ACTIVATE_PHASES) {
      expect(phase.es, phase.key).not.toBe(phase.en);
      expect(phase.gate.es, phase.key).not.toBe(phase.gate.en);
      expect(phase.exitCriteriaEs, phase.key).not.toBe(phase.exitCriteriaEn);
    }
  });

  it("is registered as a selectable method, or the wizard would never show it", () => {
    expect(DELIVERY_METHODS.sap_activate).toBeDefined();
    expect(DELIVERY_METHODS.sap_activate.es).toBeTruthy();
    expect(DELIVERY_METHODS.sap_activate.en).toBeTruthy();
  });
});
