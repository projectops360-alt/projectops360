// ============================================================================
// REG-023 — composite executive tools registered in the tool registry
// ============================================================================
// Guards hypothesis #6/#7 of the P0: the LLM tool loop (and therefore Isabella
// Voice, which consumes the same pipeline) must ALWAYS see the composite
// project-brief and risk-outlook tools — regardless of the PI flag — and the
// risk tool must keep registered records separate from detected signals.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { executiveDataFixture } from "@/lib/isabella/executive-brief/__tests__/fixtures";
import type { ExecutiveBriefResult } from "@/lib/isabella/executive-brief/types";

const loadBrief = vi.fn(async (): Promise<ExecutiveBriefResult> => ({ ok: true, data: executiveDataFixture() }));
vi.mock("@/lib/isabella/executive-brief/service", () => ({
  getExecutiveBriefData: (...args: unknown[]) => loadBrief(...(args as [])),
}));

const ORG = {
  userId: "user-1",
  email: "pm@example.com",
  displayName: "PM",
  avatarUrl: null,
  locale: "es",
  role: "admin" as const,
  organizationId: "org-1",
  organizationName: { en: "Org", es: "Org" },
  organizationSlug: "org",
};
const SCOPE = { projectId: "p1", organizationId: "org-1", userId: "user-1", locale: "es" };

describe("REG-023 — executive tools in the registry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("both composite tools are ALWAYS active (base set, not flag-gated)", async () => {
    const { ISABELLA_TOOLS, activeTools, listToolSpecs } = await import("@/lib/isabella/tools/registry");
    expect(Object.keys(ISABELLA_TOOLS)).toContain("get_project_executive_brief");
    expect(Object.keys(ISABELLA_TOOLS)).toContain("get_project_risk_outlook");
    expect(Object.keys(activeTools())).toEqual(expect.arrayContaining(["get_project_executive_brief", "get_project_risk_outlook"]));
    const specs = listToolSpecs().map((s) => s.name);
    expect(specs).toContain("get_project_executive_brief");
    expect(specs).toContain("get_project_risk_outlook");
  });

  it("get_project_risk_outlook separates registered risks, detected signals, and gaps", async () => {
    const { executeIsabellaTool } = await import("@/lib/isabella/tools/runtime");
    const { result } = await executeIsabellaTool(ORG, SCOPE, "get_project_risk_outlook", {});
    expect(result.status).toBe("success");
    const payload = JSON.parse(result.message ?? "{}");
    expect(payload.registeredRisks).toHaveLength(2);
    expect(payload.registeredRisks[0]).toMatchObject({ severity: "high" });
    expect(payload.detectedRiskSignals.map((s: { key: string }) => s.key)).toContain("active_blockers");
    expect(payload).toHaveProperty("dataGaps");
    expect(payload.exposure).toBe("high");
  });

  it("get_project_executive_brief returns the consolidated read-only summary", async () => {
    const { executeIsabellaTool } = await import("@/lib/isabella/tools/runtime");
    const { result, audit } = await executeIsabellaTool(ORG, SCOPE, "get_project_executive_brief", {});
    expect(result.status).toBe("success");
    const payload = JSON.parse(result.message ?? "{}");
    expect(payload).toMatchObject({ healthBand: "watch", percentComplete: 62, activeBlockers: 2 });
    expect(audit.status).toBe("success");
  });

  it("maps an unauthorized project to a safe unauthorized result (tenant isolation)", async () => {
    loadBrief.mockResolvedValueOnce({ ok: false, reason: "not_authorized" });
    const { executeIsabellaTool } = await import("@/lib/isabella/tools/runtime");
    const { result } = await executeIsabellaTool(ORG, SCOPE, "get_project_risk_outlook", {});
    expect(result.status).toBe("unauthorized");
    expect(result.rowCount).toBe(0);
  });
});
