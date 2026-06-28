import { describe, it, expect } from "vitest";
import {
  isOpenRiskStatus,
  riskExclusionReason,
  reconcileRecordCount,
  isabellaCloseoutRiskExplanation,
  type CloseoutRiskContext,
} from "../closeout-criteria";

// REG-017 — Closeout Risk Count Does Not Match Resolve Target.
// A blocking count must be traceable to the EXACT records counted.

describe("REG-017 — open-risk status semantics", () => {
  it("counts active/unresolved statuses as open", () => {
    expect(isOpenRiskStatus("open")).toBe(true);
    expect(isOpenRiskStatus("mitigating")).toBe(true);
    expect(isOpenRiskStatus("identified")).toBe(true); // legacy/imported
  });
  it("does NOT count resolved, closed, accepted, or unknown as open", () => {
    expect(isOpenRiskStatus("resolved")).toBe(false);
    expect(isOpenRiskStatus("closed")).toBe(false);
    expect(isOpenRiskStatus("accepted")).toBe(false);
    expect(isOpenRiskStatus("")).toBe(false);
    expect(isOpenRiskStatus(null)).toBe(false);
    expect(isOpenRiskStatus(undefined)).toBe(false);
  });
  it("explains why a record is excluded", () => {
    expect(riskExclusionReason("resolved")).toContain("resolved");
    expect(riskExclusionReason("closed")).toContain("resolved");
    expect(riskExclusionReason("open")).toBe(""); // not excluded
    expect(riskExclusionReason("weird")).toContain("not an open status");
  });
});

describe("REG-017 — count ↔ record reconciliation", () => {
  it("count must equal recordIds.length", () => {
    expect(reconcileRecordCount(2, ["r1", "r2"])).toBe(true);
    expect(reconcileRecordCount(0, [])).toBe(true);
  });
  it("flags a mismatch (count without records)", () => {
    expect(reconcileRecordCount(2, [])).toBe(false);
    expect(reconcileRecordCount(2, ["r1"])).toBe(false);
  });
});

describe("REG-017 — Isabella closeout risk explanation", () => {
  const base = (p: Partial<CloseoutRiskContext>): CloseoutRiskContext => ({
    count: 2, recordIds: ["r1", "r2"], records: [{ title: "Permit delay", status: "open" }, { title: "Crane access", status: "mitigating" }], canSeeRecords: true, ...p,
  });

  it("explains the open-risk blocker and where to resolve it (record-backed)", () => {
    const en = isabellaCloseoutRiskExplanation(base({}), "en");
    expect(en).toContain("2 open risk");
    expect(en).toContain("Risks resolved");
    expect(en).toContain("Permit delay");
    const es = isabellaCloseoutRiskExplanation(base({}), "es");
    expect(es).toContain("2 riesgo");
    expect(es).toContain("Riesgos resueltos");
  });

  it("flags a DATA INCONSISTENCY when count and records disagree (acceptance #8)", () => {
    const ctx = base({ count: 2, recordIds: [], records: [] });
    const en = isabellaCloseoutRiskExplanation(ctx, "en");
    expect(en.toLowerCase()).toContain("data consistency");
    expect(en).toContain("cannot find the matching risk records");
    const es = isabellaCloseoutRiskExplanation(ctx, "es");
    expect(es.toLowerCase()).toContain("inconsistencia de datos");
  });

  it("says there are no blockers when count is 0", () => {
    const en = isabellaCloseoutRiskExplanation(base({ count: 0, recordIds: [], records: [] }), "en");
    expect(en).toContain("no open risks");
  });

  it("gives a permission-safe answer when records are not visible", () => {
    const en = isabellaCloseoutRiskExplanation(base({ canSeeRecords: false }), "en");
    expect(en).toContain("do not have permission");
    expect(en).not.toContain("Permit delay");
  });
});
