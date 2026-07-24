// ============================================================================
// CAP-047 M6 — overlay panels render guards (guard: PMO-PI-OVERLAY-PANELS)
// ============================================================================
// Pins: severity/status expressed in TEXT (never color alone), evidence
// sources on screen, the declared benefits/no-data honesty, EN/ES (UX-012).
// ============================================================================

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BenefitsPanel, DependenciesPanel, RiskPanel } from "../overlays-panels";
import { buildDependencyOverlay, buildRiskOverlay } from "@/lib/pmo-process-intelligence/overlays";

const deps = [
  { projectId: "p1", predecessorId: "t1", successorId: "t2" },
  { projectId: "p1", predecessorId: "t1", successorId: "t3" },
];
const riskOverlay = buildRiskOverlay(
  [{ id: "r1", projectId: "p1", title: "Vendor delay", category: "schedule", probability: "high", impact: "high", severity: "critical", status: "open", linkedTaskId: "t1" }],
  deps,
);
const names = { p1: "Torre Norte" };

describe("RiskPanel (CAP-047 M6)", () => {
  const en = renderToStaticMarkup(<RiskPanel overlay={riskOverlay} projectNames={names} locale="en" />);

  it("shows exposure with severity in text and the systemic propagation evidence", () => {
    expect(en).toContain("Torre Norte");
    expect(en).toContain("[critical] Vendor delay");
    expect(en).toContain("blocks 2 downstream task(s)");
    expect(en).toContain("risks + task_dependencies");
    expect(en).toContain("never inferred");
  });

  it("renders in Spanish (UX-012)", () => {
    const es = renderToStaticMarkup(<RiskPanel overlay={riskOverlay} projectNames={names} locale="es" />);
    expect(es).toContain("[crítico] Vendor delay");
    expect(es).toContain("bloquea 2 tarea(s) aguas abajo");
    expect(es).toContain("nunca se infiere");
  });
});

describe("DependenciesPanel (CAP-047 M6)", () => {
  it("shows counts, hubs and the intra-project limitation", () => {
    const html = renderToStaticMarkup(
      <DependenciesPanel overlay={buildDependencyOverlay(deps)} projectNames={names} locale="en" />,
    );
    expect(html).toContain("2 dependencies");
    expect(html).toContain("direct successors");
    expect(html).toContain("only intra-project dependencies are recorded");
  });
});

describe("BenefitsPanel (CAP-047 M6)", () => {
  it("declares the missing benefits data model instead of faking figures", () => {
    const html = renderToStaticMarkup(<BenefitsPanel locale="en" />);
    expect(html).toContain("no benefits/strategic-objective data model yet");
    expect(html).toContain("source and date");
    const es = renderToStaticMarkup(<BenefitsPanel locale="es" />);
    expect(es).toContain("cifras inventadas");
  });
});
