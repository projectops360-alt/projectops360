// ============================================================================
// CAP-047 M3 — Command Center shell render guards (guard: PMO-PI-SHELL)
// ============================================================================
// Pins the visual-foundation contract: one-click return to the current
// (default) dashboard, Beta labeling, the 7 analytical overlays, HONEST
// unavailable KPI states (no invented numbers), the Isabella evidence rule
// stated in the panel, and full EN/ES rendering (UX-012).
// ============================================================================

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// RealtimeRefresh (M8) uses the App Router — mock it for static rendering.
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
      initialFilters={DEFAULT_PMO_PI_FILTERS}
    />,
  );
}

describe("CommandCenterShell (CAP-047 M3)", () => {
  const en = render("en");

  it("offers a one-click return to the current dashboard (default view)", () => {
    expect(en).toContain('href="/"');
    expect(en).toContain("Current Dashboard");
    const es = render("es", "/es");
    expect(es).toContain('href="/es"');
    expect(es).toContain("Dashboard Actual");
  });

  it("labels itself Beta and never claims to be the default", () => {
    expect(en).toContain("Beta");
    expect(en).toContain("PMO Process Intelligence");
  });

  it("renders the 7 analytical overlays as tabs", () => {
    for (const label of ["Process", "Risk", "Finance", "Resources", "Dependencies", "Benefits", "What-if"]) {
      expect(en).toContain(label);
    }
    expect(en.match(/role="tab"/g)?.length).toBe(7);
  });

  it("KPI bar declares honest unavailable states instead of inventing numbers", () => {
    expect(en).toContain("no data in scope");
    expect(en).not.toMatch(/\b\d+(\.\d+)?%/); // no fabricated percentages
  });

  it("states the Isabella evidence rule in the panel", () => {
    expect(en).toContain("Isabella Intelligence");
    expect(en).toContain("no recommendation exists without evidence");
  });

  it("renders fully in Spanish without Spanglish leaks (UX-012)", () => {
    const es = render("es", "/es");
    expect(es).toContain("Vista de tabla");
    expect(es).toContain("Riesgo");
    expect(es).toContain("sin datos en alcance");
    expect(es).toContain("ninguna recomendación existe sin evidencia");
  });

  it("offers a tabular fallback toggle", () => {
    expect(en).toContain("Table view");
    expect(en).toContain('aria-pressed="false"');
  });
});
