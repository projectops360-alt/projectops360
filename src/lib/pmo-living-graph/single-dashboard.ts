// ============================================================================
// Single Dashboard Mode — feature flag (guard: SINGLE-DASHBOARD-MODE)
// ============================================================================
// The product decision is to expose ONE dashboard, the PMO Intelligence Center
// (Dashboard 3), and to retire the two surfaces that preceded it. The decision
// was taken "for now", so it is expressed as a flag rather than a deletion.
//
// What this mode retires is SURFACES, never SERVICES. ADR-012 is explicit that
// Dashboard 3 computes nothing of its own: it composes getCommandCenterSummary,
// loadPmoPiFlowModel, loadPmoPiFinanceOverlay, loadPmoPiOverlays and
// buildInsights. Deleting src/lib/command-center/** or
// src/lib/pmo-process-intelligence/** would therefore break the very dashboard
// this mode promotes. Every module stays; only three routes change what they
// render.
//
// With the flag OFF the application is byte-for-byte the application that
// shipped before: three dashboards, the comparison switcher, the sidebar entry.
// Reversal is one environment variable.
//
// Server-side only, default OFF — read on the server and passed to clients as
// data, never via NEXT_PUBLIC.
// ============================================================================

import { canAccessPmoLivingGraph } from "./flags";

/** True only when the mode is explicitly enabled ("true"). Default OFF. */
export function isSingleDashboardMode(): boolean {
  return (
    process.env.SINGLE_DASHBOARD_MODE === "true" ||
    process.env.single_dashboard_mode === "true"
  );
}

/**
 * Whether the root route "/" should serve Dashboard 3 for this user.
 *
 * Deliberately narrower than `isSingleDashboardMode()`. Dashboard 3 is gated to
 * owner/admin on purpose — it shows portfolio finance, cross-project risk and
 * capacity, which members and viewers are not entitled to. Promoting it to "/"
 * unconditionally would hand every member a 404 on the application's home page,
 * a regression strictly worse than the duplication this mode removes. So those
 * roles keep the Command Center at "/" and simply never see a switcher.
 */
export function shouldServeIntelligenceCenterAtRoot(role: string): boolean {
  return isSingleDashboardMode() && canAccessPmoLivingGraph(role);
}

/**
 * Whether /process-intelligence (Dashboard 2) is still reachable as a route.
 * In single-dashboard mode it 404s for everyone — the same denial the route
 * already performs when its own flag is off, so no new failure shape appears.
 * `canAccessProcessIntelligence` and the whole module remain intact; Dashboard
 * 3 keeps calling its read models.
 */
export function isProcessIntelligenceRouteRetired(): boolean {
  return isSingleDashboardMode();
}

/**
 * Whether /pmo-living-graph should redirect to "/" instead of rendering.
 * Bookmarks, Isabella deep links and the sidebar history must not break just
 * because the dashboard moved to the root, so the old path forwards rather
 * than 404s. Only for users who would actually be served Dashboard 3 at "/" —
 * for anyone else the route keeps its existing 404, because redirecting a
 * member to a Command Center they did not ask for would silently swallow a
 * genuine authorization denial.
 */
export function shouldRedirectLegacyIntelligenceRoute(role: string): boolean {
  return shouldServeIntelligenceCenterAtRoot(role);
}

/**
 * Whether the Command Center should still render its dashboard switcher.
 * With one dashboard there is nothing to switch between, so it disappears.
 * The switcher markup itself is untouched — it is simply not reached.
 */
export function shouldShowDashboardSwitcher(): boolean {
  return !isSingleDashboardMode();
}

/**
 * Whether the "Dashboard 3" sidebar entry should still be offered.
 * In single-dashboard mode it is the root route, already the first item in the
 * sidebar, and a second entry pointing at the same screen is noise.
 */
export function shouldShowIntelligenceCenterNavEntry(role: string): boolean {
  if (isSingleDashboardMode()) return false;
  return canAccessPmoLivingGraph(role);
}
