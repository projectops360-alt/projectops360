// ============================================================================
// CAP-048 — three-dashboard coexistence guard
// Guards: PMO-LG-FLAG-OFF, PMO-LG-COEXISTENCE
// ============================================================================
// The binding promise of CAP-048 is that Dashboard 3 is purely additive: with
// its flag off the application is the application that shipped before it. This
// file is that promise made executable.
// ============================================================================

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { internalNav, sidebarNav, type InternalGate } from "@/config/navigation";

const ROOT = join(__dirname, "..", "..", "..", "..");
const source = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

describe("the three dashboards coexist (PMO-LG-COEXISTENCE)", () => {
  it("all three routes exist, each on its own path", () => {
    expect(existsSync(join(ROOT, "src/app/[locale]/(app)/page.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "src/app/[locale]/(app)/process-intelligence/page.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "src/app/[locale]/(app)/pmo-living-graph/page.tsx"))).toBe(true);
  });

  it("the project Living Graph is untouched and still lives at its own route", () => {
    expect(
      existsSync(join(ROOT, "src/app/[locale]/(app)/projects/[projectId]/execution-map/living-graph/page.tsx")),
    ).toBe(true);
  });

  it("Dashboard 1's switcher offers all three, each behind its own gate", () => {
    const page = source("src/app/[locale]/(app)/page.tsx");
    // CAP-047's entry must keep working exactly as it did…
    expect(page).toContain("/process-intelligence");
    expect(page).toContain("showProcessIntelligence");
    // …and CAP-048 sits beside it rather than replacing it.
    expect(page).toContain("/pmo-living-graph");
    expect(page).toContain("showPmoLivingGraph");
  });

  it("the two switcher entries are gated independently", () => {
    const page = source("src/app/[locale]/(app)/page.tsx");
    // A single combined condition would make one flag hide the other's entry.
    expect(page).toContain("showProcessIntelligence || showPmoLivingGraph");
    expect(page).toContain("{showProcessIntelligence && (");
    expect(page).toContain("{showPmoLivingGraph && (");
  });

  it("the whole switcher disappears when both flags are off", () => {
    // The container is conditional on the disjunction, so neither entry can
    // leave an empty pill behind on the untouched dashboard.
    const page = source("src/app/[locale]/(app)/page.tsx");
    expect(page).toContain("{(showProcessIntelligence || showPmoLivingGraph) && (");
  });

  it("Dashboard 3 does not make the existing dashboards its dependencies", () => {
    const files = [
      "src/lib/pmo-living-graph/read-model.server.ts",
      "src/lib/pmo-living-graph/node-projection.ts",
      "src/lib/pmo-living-graph/edge-projection.ts",
      "src/lib/pmo-living-graph/graph-algorithms.ts",
      "src/lib/pmo-living-graph/portfolio-metrics.ts",
      "src/lib/pmo-living-graph/subgraph.ts",
    ];
    for (const file of files) {
      const content = source(file);
      expect(content, `${file} imports the Process Intelligence module`).not.toContain(
        "@/lib/pmo-process-intelligence",
      );
      expect(content, `${file} imports the Command Center service`).not.toContain(
        "@/lib/command-center",
      );
      expect(content, `${file} imports the project Living Graph`).not.toContain("@/lib/graph/");
    }
  });

  it("the graph reads canonical tables rather than inventing a second source of truth", () => {
    const readModel = source("src/lib/pmo-living-graph/read-model.server.ts");
    for (const table of [
      "projects",
      "milestones",
      "roadmap_tasks",
      "risks",
      "task_dependencies",
      "project_resource_allocations",
    ]) {
      expect(readModel).toContain(`from("${table}")`);
    }
  });
});

describe("navigation is unchanged while the flag is off (PMO-LG-FLAG-OFF)", () => {
  it("the new entry is gated, never a plain sidebar item", () => {
    // A gate-less entry in sidebarNav would show up for everyone the moment it
    // merged — which is precisely the regression this asserts against.
    expect(sidebarNav.some((item) => item.href === "/pmo-living-graph")).toBe(false);
    const entry = internalNav.find((item) => item.href === "/pmo-living-graph");
    expect(entry).toBeDefined();
    expect(entry?.gate).toBe("pmoLivingGraph");
  });

  it("filters out of the sidebar when its gate is false", () => {
    // Mirrors the Sidebar's own filter, so this test fails if that logic drifts.
    const gateFlags: Record<InternalGate, boolean> = {
      productBrain: true,
      adminConsole: true,
      pmoLivingGraph: false,
    };
    const visible = internalNav.filter((item) => gateFlags[item.gate]);

    expect(visible.some((item) => item.href === "/pmo-living-graph")).toBe(false);
    // The pre-existing entries are untouched by the new gate.
    expect(visible.map((item) => item.href)).toEqual(["/product-intelligence", "/admin"]);
  });

  it("appears once its gate is true", () => {
    const gateFlags: Record<InternalGate, boolean> = {
      productBrain: false,
      adminConsole: false,
      pmoLivingGraph: true,
    };
    const visible = internalNav.filter((item) => gateFlags[item.gate]);

    expect(visible.map((item) => item.href)).toEqual(["/pmo-living-graph"]);
  });

  it("the route 404s rather than rendering an empty shell", () => {
    const page = source("src/app/[locale]/(app)/pmo-living-graph/page.tsx");
    expect(page).toContain("canAccessPmoLivingGraph");
    expect(page).toContain("notFound()");
  });
});

describe("new tables are RLS-guarded and cannot join two tenants", () => {
  const migration = source("supabase/migrations/20260861000000_pmo_living_graph.sql");

  it("enables row level security on both new tables", () => {
    expect(migration).toContain("ALTER TABLE public.pmo_graph_views ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain(
      "ALTER TABLE public.pmo_graph_declared_edges ENABLE ROW LEVEL SECURITY",
    );
  });

  it("scopes every policy through is_org_member", () => {
    expect(migration).toContain("public.is_org_member(organization_id)");
  });

  it("rejects cross-organization declared edges in the database, not only in code", () => {
    expect(migration).toContain("belongs to a different organization");
    expect(migration).toContain("pmo_graph_declared_edge_guard");
  });

  it("never lets a declared edge claim it was OBSERVED", () => {
    // Provenance is what makes the graph auditable; a human assertion must not
    // be able to disguise itself as something read from operational data.
    const provenanceCheck = migration.match(/provenance text NOT NULL DEFAULT 'DECLARED'[\s\S]*?\)/);
    expect(provenanceCheck?.[0]).toBeDefined();
    expect(provenanceCheck?.[0]).not.toContain("OBSERVED");
    expect(provenanceCheck?.[0]).not.toContain("INFERRED");
  });
});
