import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

import { CommandCenterShell } from "../command-center-shell";
import { DEFAULT_PMO_PI_FILTERS } from "@/lib/pmo-process-intelligence/contracts";

function render(locale: "en" | "es", base = ""): string {
  return renderToStaticMarkup(
    <CommandCenterShell
      locale={locale}
      base={base}
      organizationName="Acme"
      organizationId="00000000-0000-4000-8000-000000000001"
      userId="00000000-0000-4000-8000-000000000002"
      initialFilters={DEFAULT_PMO_PI_FILTERS}
      hierarchy={{
        organizationId: "00000000-0000-4000-8000-000000000001",
        milestones: [],
        activities: [],
        dependencies: [],
        truncated: false,
        limitations: [],
      }}
    />,
  );
}

describe("CommandCenterShell executive redesign", () => {
  const en = render("en");

  it("preserves the current dashboard and labels the new view as beta", () => {
    expect(en).toContain('href="/"');
    expect(en).toContain("Current Dashboard");
    expect(en).toContain("Executive Portfolio Flow");
    expect(en).toContain("Process Intelligence Beta");

    const es = render("es", "/es");
    expect(es).toContain('href="/es"');
    expect(es).toContain("Dashboard Actual");
  });

  it("renders the seven analytical overlays as tabs", () => {
    for (const label of [
      "Process",
      "Risk",
      "Finance",
      "Resources",
      "Dependencies",
      "Benefits",
      "What-if",
    ]) {
      expect(en).toContain(label);
    }
    expect(en.match(/role="tab"/g)?.length).toBe(7);
  });

  it("declares empty scope honestly instead of inventing portfolio health", () => {
    expect(en).toContain("5 visible nodes");
    expect(en).toContain("0 projects in the current view");
    expect(en).not.toContain("100/100");
  });

  it("states the Isabella evidence rule", () => {
    expect(en).toContain("Isabella Intelligence");
    expect(en).toContain("no recommendation exists without evidence");
  });

  it("renders the executive surface in Spanish", () => {
    const es = render("es", "/es");
    expect(es).toContain("Flujo Ejecutivo del Portafolio");
    expect(es).toContain("Tabla accesible");
    expect(es).toContain("Riesgo");
    expect(es).toContain("5 nodos visibles");
    expect(es).toContain("ninguna recomendación existe sin evidencia");
  });

  it("offers the accessible table fallback", () => {
    expect(en).toContain("Accessible table");
    expect(en).toContain(
      'aria-label="Interactive Process Intelligence canvas"',
    );
  });

  it("keeps technical event names out of the default executive view", () => {
    expect(en).not.toContain("Task Status Changed");
    expect(en).not.toContain("Task Dependency Added");
    expect(en).toContain("Advanced · Technical Events");
  });

  it("renders the shared React Flow interaction surface", () => {
    expect(en).toContain('data-testid="rf__wrapper"');
    expect(en).toContain('data-testid="rf__minimap"');
    expect(en).toContain("Search and focus");
    expect(en).toContain("Save Layout");
    expect(en).toContain("Primary flow");
    expect(en).not.toContain("Observed main route");
  });
});
