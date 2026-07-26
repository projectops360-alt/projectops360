// ============================================================================
// Single Dashboard Mode — guard: SINGLE-DASHBOARD-MODE
// ============================================================================
// The product decided to expose ONE dashboard (the PMO Intelligence Center) and
// retire the two that preceded it — "for now", which is the whole reason this is
// a flag and not a deletion. Two promises therefore need to be executable:
//
//   1. With the mode OFF, the application is exactly the three-dashboard
//      application that shipped. Reversal is one environment variable, and this
//      file fails if that stops being true.
//   2. With the mode ON, SURFACES are retired but SERVICES are not. ADR-012 has
//      Dashboard 3 computing nothing of its own — it composes the Command Center
//      and Process Intelligence read models. Deleting either would break the
//      dashboard that replaced them, which is the failure this guards against.
// ============================================================================

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isSingleDashboardMode,
  isProcessIntelligenceRouteRetired,
  shouldRedirectLegacyIntelligenceRoute,
  shouldServeIntelligenceCenterAtRoot,
  shouldShowDashboardSwitcher,
  shouldShowIntelligenceCenterNavEntry,
} from "../single-dashboard";

const ROOT = join(__dirname, "..", "..", "..", "..");
const source = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

/** Reproduces the environment each mode needs, so no test leaks into the next. */
function setEnv({ single, dashboard3 }: { single: boolean; dashboard3: boolean }) {
  if (single) process.env.SINGLE_DASHBOARD_MODE = "true";
  else delete process.env.SINGLE_DASHBOARD_MODE;
  if (dashboard3) process.env.PMO_LIVING_GRAPH_ENABLED = "true";
  else delete process.env.PMO_LIVING_GRAPH_ENABLED;
}

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("flag OFF ⇒ nothing changed (SINGLE-DASHBOARD-MODE)", () => {
  beforeEach(() => setEnv({ single: false, dashboard3: true }));

  it("is off by default — an unset variable is not an enabled feature", () => {
    expect(isSingleDashboardMode()).toBe(false);
  });

  it("only 'true' turns it on, so a stray value cannot retire two dashboards", () => {
    for (const value of ["1", "yes", "TRUE", "on", ""]) {
      process.env.SINGLE_DASHBOARD_MODE = value;
      expect(isSingleDashboardMode(), value).toBe(false);
    }
  });

  it("leaves the root serving the Command Center for every role", () => {
    for (const role of ["owner", "admin", "member", "viewer"]) {
      expect(shouldServeIntelligenceCenterAtRoot(role), role).toBe(false);
    }
  });

  it("keeps /process-intelligence reachable", () => {
    expect(isProcessIntelligenceRouteRetired()).toBe(false);
  });

  it("keeps /pmo-living-graph rendering rather than redirecting", () => {
    for (const role of ["owner", "admin", "member", "viewer"]) {
      expect(shouldRedirectLegacyIntelligenceRoute(role), role).toBe(false);
    }
  });

  it("keeps the comparison switcher on the Command Center", () => {
    expect(shouldShowDashboardSwitcher()).toBe(true);
  });

  it("keeps the Dashboard 3 sidebar entry on its original gate", () => {
    expect(shouldShowIntelligenceCenterNavEntry("owner")).toBe(true);
    expect(shouldShowIntelligenceCenterNavEntry("admin")).toBe(true);
    // Unchanged from canAccessPmoLivingGraph: members and viewers never saw it.
    expect(shouldShowIntelligenceCenterNavEntry("member")).toBe(false);
    expect(shouldShowIntelligenceCenterNavEntry("viewer")).toBe(false);
  });

  it("all three dashboard routes still exist as files", () => {
    expect(existsSync(join(ROOT, "src/app/[locale]/(app)/page.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "src/app/[locale]/(app)/process-intelligence/page.tsx"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/app/[locale]/(app)/pmo-living-graph/page.tsx"))).toBe(true);
  });
});

describe("flag ON ⇒ one dashboard, no dead ends (SINGLE-DASHBOARD-MODE)", () => {
  beforeEach(() => setEnv({ single: true, dashboard3: true }));

  it("serves the Intelligence Center at the root for owner and admin", () => {
    expect(shouldServeIntelligenceCenterAtRoot("owner")).toBe(true);
    expect(shouldServeIntelligenceCenterAtRoot("admin")).toBe(true);
  });

  it("keeps the Command Center at the root for member and viewer", () => {
    // The deliberate decision: Dashboard 3's owner/admin gate covers portfolio
    // finance, cross-project risk and capacity. Promoting it to "/" for everyone
    // would hand a member a 404 on the home page — worse than the duplication
    // this mode removes. They keep a working root and simply see no switcher.
    expect(shouldServeIntelligenceCenterAtRoot("member")).toBe(false);
    expect(shouldServeIntelligenceCenterAtRoot("viewer")).toBe(false);
  });

  it("still refuses the root promotion when Dashboard 3's own flag is off", () => {
    // Single-dashboard mode must not become a back door that enables an
    // unreleased dashboard; both gates have to agree.
    setEnv({ single: true, dashboard3: false });
    expect(shouldServeIntelligenceCenterAtRoot("owner")).toBe(false);
    expect(shouldServeIntelligenceCenterAtRoot("admin")).toBe(false);
  });

  it("retires /process-intelligence into a 404", () => {
    expect(isProcessIntelligenceRouteRetired()).toBe(true);
  });

  it("redirects /pmo-living-graph for the users now served at the root", () => {
    expect(shouldRedirectLegacyIntelligenceRoute("owner")).toBe(true);
    expect(shouldRedirectLegacyIntelligenceRoute("admin")).toBe(true);
  });

  it("does not redirect a role that would land on a different dashboard", () => {
    // Redirecting a member to a Command Center they never asked for would turn
    // an authorization denial into a silent bounce. They keep the 404.
    expect(shouldRedirectLegacyIntelligenceRoute("member")).toBe(false);
    expect(shouldRedirectLegacyIntelligenceRoute("viewer")).toBe(false);
  });

  it("removes the comparison switcher — there is nothing to switch between", () => {
    expect(shouldShowDashboardSwitcher()).toBe(false);
  });

  it("removes the Dashboard 3 sidebar entry for every role", () => {
    for (const role of ["owner", "admin", "member", "viewer"]) {
      expect(shouldShowIntelligenceCenterNavEntry(role), role).toBe(false);
    }
  });
});

describe("surfaces are retired, services are not (SINGLE-DASHBOARD-MODE)", () => {
  it("keeps every service Dashboard 3 composes (ADR-012)", () => {
    // Dashboard 3 computes no metric of its own. Deleting any of these while
    // "removing the old dashboards" would break the surviving dashboard — the
    // precise mistake this mode invites and this test forbids.
    for (const file of [
      "src/lib/command-center/service.ts",
      "src/lib/pmo-process-intelligence/read-model.server.ts",
      "src/lib/pmo-process-intelligence/financial-read.server.ts",
      "src/lib/pmo-process-intelligence/overlays-read.server.ts",
      "src/lib/pmo-process-intelligence/insights.ts",
      "src/lib/pmo-process-intelligence/flags.ts",
    ]) {
      expect(existsSync(join(ROOT, file)), `${file} was deleted`).toBe(true);
    }
  });

  it("keeps the read model actually calling them", () => {
    const readModel = source("src/lib/pmo-intelligence/read-model.server.ts");
    for (const fn of [
      "getCommandCenterSummary",
      "loadPmoPiFlowModel",
      "loadPmoPiFinanceOverlay",
      "loadPmoPiOverlays",
      "buildInsights",
    ]) {
      expect(readModel, `${fn} is no longer composed`).toContain(fn);
    }
  });

  it("leaves the project Living Graph untouched at its own routes", () => {
    // A portfolio-level decision must not reach into the per-project graph.
    expect(
      existsSync(
        join(ROOT, "src/app/[locale]/(app)/projects/[projectId]/execution-map/living-graph/page.tsx"),
      ),
    ).toBe(true);
    const singleDashboard = source("src/lib/pmo-living-graph/single-dashboard.ts");
    expect(singleDashboard).not.toContain("@/lib/graph/");
    expect(singleDashboard).not.toContain("@/components/graph/");
  });
});

describe("the routes are wired to the mode (SINGLE-DASHBOARD-MODE)", () => {
  it("the root branches to the Intelligence Center instead of duplicating it", () => {
    const page = source("src/app/[locale]/(app)/page.tsx");
    expect(page).toContain("shouldServeIntelligenceCenterAtRoot");
    expect(page).toContain("PmoIntelligenceCenterView");
    // The composition itself must not be copy-pasted into the root: one screen,
    // one read model. Two copies would drift exactly as ADR-012 warns.
    expect(page).not.toContain("loadPmoIntelligence");
  });

  it("both routes render the SAME extracted component", () => {
    const root = source("src/app/[locale]/(app)/page.tsx");
    const legacy = source("src/app/[locale]/(app)/pmo-living-graph/page.tsx");
    const shared = "@/components/pmo-living-graph/intelligence-center-view";
    expect(root).toContain(shared);
    expect(legacy).toContain(shared);
  });

  it("the switcher is suppressed through its existing gates, not deleted", () => {
    const page = source("src/app/[locale]/(app)/page.tsx");
    // The markup stays put — reversal has to be a flag flip, not a re-write.
    expect(page).toContain("{showProcessIntelligence && (");
    expect(page).toContain("{showPmoLivingGraph && (");
    expect(page).toContain("shouldShowDashboardSwitcher");
  });

  it("/process-intelligence denies with notFound, the pattern it already used", () => {
    const page = source("src/app/[locale]/(app)/process-intelligence/page.tsx");
    expect(page).toContain("isProcessIntelligenceRouteRetired");
    expect(page).toContain("notFound()");
  });

  it("/pmo-living-graph redirects rather than 404ing, so links survive", () => {
    const page = source("src/app/[locale]/(app)/pmo-living-graph/page.tsx");
    expect(page).toContain("shouldRedirectLegacyIntelligenceRoute");
    expect(page).toContain("redirect(");
    // The original denial is still there for unauthorized roles.
    expect(page).toContain("canAccessPmoLivingGraph");
    expect(page).toContain("notFound()");
  });

  it("the sidebar entry is gated through the mode in the app layout", () => {
    const layout = source("src/app/[locale]/(app)/layout.tsx");
    expect(layout).toContain("shouldShowIntelligenceCenterNavEntry");
  });
});
