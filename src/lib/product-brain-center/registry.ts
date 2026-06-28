// ============================================================================
// ProjectOps360° — Product Brain Control Center — curated registry
// ============================================================================
// The structured index of governance items, each citing its canonical source in
// docs/product-brain. This module is imported ONLY by the server route (after the
// email allowlist gate) and never by a client component, so its contents reach
// the client only for authorized users via RSC props. Markdown remains the
// source of truth; this adds trackable status + test-protection metadata.
//
// Keep in sync with: 10-regression-log.md, 30-product-decision-log.md,
// 32-product-ux-contracts.md, regression-test-map.md, 22-modules.md.
// ============================================================================

import type { ProductBrainItem } from "./types";

function mk(p: Partial<ProductBrainItem> & Pick<ProductBrainItem, "itemKey" | "title" | "type">): ProductBrainItem {
  return {
    status: "approved",
    module: null,
    priority: null,
    severity: "none",
    owner: "Product",
    sourcePath: "00-index.md",
    sourceSection: null,
    summary: "",
    decision: null,
    expectedBehavior: null,
    protectionRule: null,
    implementationStatus: null,
    testStatus: "not_required",
    testFiles: [],
    verificationSteps: [],
    relatedItems: [],
    tags: [],
    lastReviewed: "2026-06-28",
    notes: null,
    ...p,
  };
}

export const PRODUCT_BRAIN_ITEMS: ProductBrainItem[] = [
  // ── Regressions (all resolved + protected) ────────────────────────────────
  mk({
    itemKey: "REG-008", type: "regression", title: "Living Graph false blocked state",
    module: "Living Graph", status: "resolved", severity: "high", testStatus: "protected",
    sourcePath: "10-regression-log.md", sourceSection: "REG-008",
    summary: "Header showed a blocked count from a stale is_blocked flag on a completed task; waiting-on-dependency was conflated with blocked.",
    expectedBehavior: "Blocked requires an explicit ACTIVE impediment; completed/terminal tasks are never blocked; waiting is counted separately.",
    protectionRule: "Living Graph derives node state from the Execution Status Engine; header counts come from the same resolver.",
    testFiles: ["src/lib/graph/__tests__/living-graph-status.test.ts"],
    verificationSteps: ["Open Mobile App Design → Execution Map → Living Graph", "Header shows 0 blocked, waiting shown separately"],
    relatedItems: ["REG-010", "REG-006"], tags: ["living-graph", "blocked", "status"],
  }),
  mk({
    itemKey: "REG-009", type: "regression", title: "ProjectOps Scribe restoration",
    module: "Project Memory / Scribe", status: "resolved", severity: "high", testStatus: "protected",
    sourcePath: "10-regression-log.md", sourceSection: "REG-009",
    summary: "Voice/paste → AI structure → review → save into Project Memory had been lost in the feat/rythm divergence.",
    expectedBehavior: "Capture → AI extraction (anti-hallucination) → human review → save into Project Memory; verbatim source_excerpt, null for missing, needs_review, no entity without approval.",
    protectionRule: "Project Memory / Scribe / AI-extraction changes must not remove the voice-note → actions/decisions → review → save workflow.",
    testFiles: ["src/lib/scribe/__tests__/scribe-ai.test.ts"],
    verificationSteps: ["Project Memory → ProjectOps Scribe → Dictate/Paste → Analyze → review → Save"],
    relatedItems: ["REG-011"], tags: ["scribe", "project-memory", "ai"],
  }),
  mk({
    itemKey: "REG-010", type: "regression", title: "Cross-module metric rollup inconsistency",
    module: "Metrics / Rollups", status: "resolved", severity: "high", testStatus: "protected",
    sourcePath: "10-regression-log.md", sourceSection: "REG-010",
    summary: "Blocker/waiting/capacity counts disagreed across surfaces; a stale flag on a Done task inflated blockers.",
    expectedBehavior: "Single source of truth (task-activity rules + rollup engine); terminal tasks never count as active blockers; every metric declares scope.",
    protectionRule: "Any surface reporting blockers/waiting/capacity/milestone rollups must use task-activity.ts rules or the rollup engine.",
    testFiles: ["src/lib/project-rollups/__tests__/project-rollup-engine.test.ts", "src/lib/execution/__tests__/task-activity.test.ts"],
    verificationSteps: ["Living Graph header blockers == Executive Insights == PMO Summary"],
    relatedItems: ["REG-008", "REG-013"], tags: ["metrics", "rollups", "blocked"],
  }),
  mk({
    itemKey: "REG-011", type: "regression", title: "Rythm/Rhythm duplicate navigation & broken route",
    module: "Navigation / Rythm", status: "resolved", severity: "high", testStatus: "protected",
    sourcePath: "10-regression-log.md", sourceSection: "REG-011",
    summary: "Two near-identical nav items (Rhythm/Rythm); /rythm crashed. Consolidated into one canonical Rhythm Center.",
    expectedBehavior: "Exactly one visible Rythm/Rhythm nav item (canonical /rhythm); /rythm is a redirect, never a 2nd item.",
    protectionRule: "Navigation must never expose two visible modules for the same capability; legacy routes redirect, never crash.",
    testFiles: ["src/components/layout/__tests__/project-tabs-nav.test.ts"],
    verificationSteps: ["Open a project → only one Ritmo tab", "Visit /projects/:id/rythm → lands on /rhythm"],
    relatedItems: ["REG-012"], tags: ["navigation", "rythm"],
  }),
  mk({
    itemKey: "REG-012", type: "regression", title: "BIM missing from navigation",
    module: "Navigation / BIM", status: "resolved", severity: "critical", testStatus: "protected",
    sourcePath: "10-regression-log.md", sourceSection: "REG-012",
    summary: "BIM (Drawing Intelligence) was silently hidden for non-construction projects.",
    expectedBehavior: "BIM lives in the Technical/BIM group; kept visible-but-disabled when the module is off; never buried.",
    protectionRule: "Navigation simplification must never remove or orphan a strategic module.",
    testFiles: ["src/components/layout/__tests__/project-tabs-nav.test.ts"],
    verificationSteps: ["Construction project → Technical/BIM group shows BIM", "Software project → BIM disabled with tooltip"],
    relatedItems: ["REG-011", "UX-006"], tags: ["navigation", "bim"],
  }),
  mk({
    itemKey: "REG-013", type: "regression", title: "Isabella Project Health Briefing not triggering on load",
    module: "Isabella", status: "resolved", severity: "high", testStatus: "protected",
    sourcePath: "10-regression-log.md", sourceSection: "REG-013",
    summary: "Isabella opened passively inside a project; no proactive briefing. Restored deterministic briefing (no AI on open).",
    expectedBehavior: "Inside a project, Isabella shows a grounded Project Health Briefing on load; PMO gets a Portfolio Briefing outside a project.",
    protectionRule: "Future Isabella UI/Brain/layout changes must not remove project-aware automatic briefing behavior.",
    testFiles: ["src/lib/project-briefing/__tests__/briefing-engine.test.ts", "src/lib/portfolio-briefing/__tests__/portfolio-engine.test.ts"],
    verificationSteps: ["Open a project → Isabella → Project Briefing appears", "Open Isabella outside a project (PMO) → Portfolio Briefing"],
    relatedItems: ["REG-014", "REG-010"], tags: ["isabella", "briefing"],
  }),
  mk({
    itemKey: "REG-014", type: "regression", title: "Isabella Welcome Hero lifecycle reverted",
    module: "Isabella", status: "resolved", severity: "high", testStatus: "protected",
    sourcePath: "10-regression-log.md", sourceSection: "REG-014",
    summary: "The large avatar stacked on top of the Project Briefing, wasting ~40-45% of the panel.",
    expectedBehavior: "Full Welcome Hero only in empty state; any active content (a briefing counts) collapses it to a ≤70px compact header.",
    protectionRule: "Future Isabella UI changes must preserve the Welcome Hero lifecycle (UX-001); the hero never auto-stacks over content.",
    testFiles: ["src/lib/product-ux-contracts/__tests__/isabella-welcome-hero.test.ts"],
    verificationSteps: ["Open a project → Isabella → compact header above the briefing (no stacked avatar)"],
    relatedItems: ["UX-001", "REG-013"], tags: ["isabella", "ux", "layout"],
  }),

  mk({
    itemKey: "REG-015", type: "regression", title: "Project Status not surfaced on the main dashboard",
    module: "Command Center / Dashboard", status: "resolved", severity: "high", testStatus: "protected",
    sourcePath: "10-regression-log.md", sourceSection: "REG-015",
    summary: "The Overview dashboard had no explained Status summary (only a separate tab); Closeout was buried at the bottom.",
    expectedBehavior: "A prominent Project Status card on the dashboard with explained health (blocked vs waiting, overdue, at-risk, capacity), using the shared briefing engine; Status route preserved.",
    protectionRule: "Navigation simplification must not remove the Project Status capability; relocate to Command Center with prominence.",
    testFiles: ["src/components/layout/__tests__/project-tabs-nav.test.ts", "src/lib/project-briefing/__tests__/briefing-engine.test.ts"],
    verificationSteps: ["Open a project → Overview → Project Status card near the top → View full status → /status"],
    relatedItems: ["REG-013", "UX-006", "UX-009"], tags: ["command-center", "status", "dashboard"],
  }),
  mk({
    itemKey: "UX-009", type: "ux_contract", title: "Closeout Report dashboard prominence",
    module: "Reports / Closeout Report", status: "implemented", severity: "medium", testStatus: "manual_only",
    sourcePath: "32-product-ux-contracts.md", sourceSection: "UX-009",
    decision: "Closeout Report is a key executive artifact: promote it to a 'Reports & Executive Outputs' card near the top of the dashboard, not buried below activity cards.",
    testFiles: ["src/components/layout/__tests__/project-tabs-nav.test.ts"],
    relatedItems: ["REG-015"], tags: ["reports", "closeout", "dashboard"],
  }),

  // ── UX Contracts ──────────────────────────────────────────────────────────
  mk({
    itemKey: "UX-001", type: "ux_contract", title: "Isabella Welcome Hero Lifecycle",
    module: "Isabella", status: "protected_by_test", severity: "high", testStatus: "protected",
    sourcePath: "32-product-ux-contracts.md", sourceSection: "UX-001",
    summary: "The avatar is a welcome affordance, not chrome. Active content collapses it to a compact header.",
    decision: "Show full hero only in empty welcome; collapse on first interaction or when a briefing/conversation exists; compact header ≤70px; smooth 250-350ms.",
    protectionRule: "The rule lives in src/lib/product-ux-contracts/contracts.ts and is consumed by the component; tests fail if the hero stacks over content.",
    testFiles: ["src/lib/product-ux-contracts/__tests__/isabella-welcome-hero.test.ts"],
    relatedItems: ["REG-014"], tags: ["isabella", "ux"],
  }),
  mk({
    itemKey: "UX-006", type: "ux_contract", title: "Project Navigation Simplification (grouped nav)",
    module: "Navigation", status: "implemented", severity: "medium", testStatus: "protected",
    sourcePath: "25-ux-design-debt.md", sourceSection: "UX-006",
    summary: "13 flat tabs grouped by user intent (Command Center · Planning · Execution · Resources · Intelligence · Technical/BIM · More).",
    decision: "Group navigation by intent; never hide or orphan a strategic module while simplifying.",
    protectionRule: "Grouping reduces clutter by organizing capabilities, never by hiding them.",
    testFiles: ["src/components/layout/__tests__/project-tabs-nav.test.ts"],
    relatedItems: ["REG-012"], tags: ["navigation", "ux"],
  }),
  mk({
    itemKey: "UX-008", type: "ux_contract", title: "Living Graph Edge Task Tooltip",
    module: "Living Graph", status: "protected_by_test", severity: "low", testStatus: "protected",
    sourcePath: "32-product-ux-contracts.md", sourceSection: "UX-008",
    summary: "Hovering/tapping an edge or its task-count badge shows the tasks it represents and their statuses.",
    decision: "Edges are evidence, not decoration: an edge labelled '3 tasks' must reveal which tasks and their state. Read-only, deterministic, no invention; stale-done ≠ blocked, waiting ≠ blocked.",
    protectionRule: "The tooltip must not modify graph data, dependencies, milestones, tasks, blockers or rollups; no DB/AI on hover.",
    testFiles: ["src/lib/graph/__tests__/edge-task-tooltip.test.ts"],
    verificationSteps: ["Execution Map → Living Graph (Milestones level) → hover an edge or its 'N tasks' badge → tooltip lists tasks + statuses", "On touch, tap the badge to open"],
    relatedItems: ["REG-008", "REG-010"], tags: ["living-graph", "ux", "tooltip", "edges"],
  }),
  mk({
    itemKey: "UX-007", type: "ux_contract", title: "Living Graph Saved Layouts are presentation-only",
    module: "Living Graph", status: "protected_by_test", severity: "medium", testStatus: "protected",
    sourcePath: "30-product-decision-log.md", sourceSection: "PD-008",
    summary: "Manual node positions persist per project/context/user; visual only.",
    decision: "Saved layouts never change tasks, dependencies, edges, status, capacity or project data.",
    protectionRule: "Saving node position is presentation state only; it must not mutate graph relationships.",
    testFiles: ["src/lib/graph/__tests__/graph-layout-storage.test.ts", "src/lib/graph/__tests__/graph-ui-prefs.test.ts"],
    tags: ["living-graph", "ux", "layout"],
  }),

  // ── Product Decisions ─────────────────────────────────────────────────────
  mk({
    itemKey: "PD-CRITICAL-PATH", type: "product_decision", title: "Critical Path lives inside the Living Graph",
    module: "Living Graph", status: "approved", testStatus: "manual_only",
    sourcePath: "12-living-graph-strategy.md", sourceSection: "Critical Path",
    decision: "The Roadmap must NOT maintain a separate Critical Path engine; the Living Graph is the single source of truth.",
    testFiles: ["src/lib/execution/__tests__/critical-path.test.ts"],
    tags: ["living-graph", "critical-path"],
  }),
  mk({
    itemKey: "PD-RYTHM-HOME", type: "product_decision", title: "Rythm lives inside Rhythm Center / Project Memory",
    module: "Rythm / Meetings", status: "approved", testStatus: "protected",
    sourcePath: "10-regression-log.md", sourceSection: "REG-011 (Rythm canonical naming)",
    decision: "Meeting/audio intelligence is one capability with one visible home (Rhythm Center); Project Memory is the permanent evidence store.",
    testFiles: ["src/components/layout/__tests__/project-tabs-nav.test.ts"],
    relatedItems: ["REG-011", "REG-009"], tags: ["rythm", "project-memory"],
  }),
  mk({
    itemKey: "PD-BIM-DISCOVERABLE", type: "product_decision", title: "BIM must remain discoverable",
    module: "BIM", status: "approved", testStatus: "protected",
    sourcePath: "30-product-decision-log.md", sourceSection: "PD-009",
    decision: "BIM stays discoverable in the Technical/BIM group or as a context-aware, explained disabled entry.",
    testFiles: ["src/components/layout/__tests__/project-tabs-nav.test.ts"],
    relatedItems: ["REG-012"], tags: ["bim", "navigation"],
  }),
  mk({
    itemKey: "PD-WORKBOARD-OWNER", type: "product_decision", title: "Workboard cards show assignee avatar/name/role",
    module: "Workboard", status: "implemented", testStatus: "unit_tested",
    sourcePath: "26-sprint-01-operational-clarity.md", sourceSection: "Workboard ownership",
    decision: "Every task card surfaces its owner (avatar + name) or an explicit Unassigned affordance.",
    testFiles: ["src/lib/roadmap/__tests__/task-owner.test.ts"],
    tags: ["workboard", "ownership"],
  }),
  mk({
    itemKey: "PD-VARIANCE-BASELINE", type: "product_decision", title: "Variance View requires an approved baseline",
    module: "Living Graph", status: "approved", testStatus: "manual_only",
    sourcePath: "30-product-decision-log.md", sourceSection: "Variance",
    decision: "Variance is measured against the approved baseline; without a baseline, variance is not shown as fact.",
    tags: ["variance", "baseline"],
  }),
  mk({
    itemKey: "PD-TIMELINE-HISTORY", type: "product_decision", title: "Timeline Playback requires real project history",
    module: "Living Graph", status: "approved", testStatus: "manual_only",
    sourcePath: "30-product-decision-log.md", sourceSection: "Timeline",
    decision: "Timeline Playback replays real recorded history; it never fabricates states.",
    tags: ["timeline", "history"],
  }),
  mk({
    itemKey: "PD-WHATIF-SANDBOX", type: "product_decision", title: "What-if Simulation is sandbox-first",
    module: "Living Graph", status: "approved", testStatus: "manual_only",
    sourcePath: "30-product-decision-log.md", sourceSection: "What-if",
    decision: "What-if changes are a sandbox; no real project data changes unless explicitly applied.",
    tags: ["what-if", "sandbox"],
  }),
  mk({
    itemKey: "PD-FOCUS-MODE", type: "product_decision", title: "Living Graph must support Focus Mode",
    module: "Living Graph", status: "implemented", testStatus: "manual_only",
    sourcePath: "27-sprint-02-living-graph-focus.md", sourceSection: "Decisions",
    decision: "Focus Mode collapses secondary UI to make the graph the protagonist; layout-only, changes no engine.",
    tags: ["living-graph", "focus"],
  }),

  // ── AI development / engineering rules ─────────────────────────────────────
  mk({
    itemKey: "RULE-BRAIN-FIRST", type: "ai_development_rule", title: "Product Brain first, before implementation",
    status: "approved", testStatus: "not_required",
    sourcePath: "11-ai-development-rules.md", sourceSection: "Rule 2",
    decision: "Inspect the relevant module doc, ADRs and regression log before implementing.",
    tags: ["governance", "ai-rules"],
  }),
  mk({
    itemKey: "RULE-NO-REG-WITHOUT-TEST", type: "ai_development_rule", title: "No closed regression without an executable test",
    status: "approved", testStatus: "protected",
    sourcePath: "11-ai-development-rules.md", sourceSection: "Rule 13",
    decision: "A REG-### is closed only when a test fails if it returns; tracked in regression-test-map.md and enforced by CI.",
    protectionRule: "CI (.github/workflows/ci.yml) runs typecheck + test:run + build on every PR and push to master.",
    testFiles: ["docs/product-brain/regression-test-map.md"],
    tags: ["governance", "ci", "tests"],
  }),

  // ── Security rules ────────────────────────────────────────────────────────
  mk({
    itemKey: "SEC-PB-ALLOWLIST", type: "security_rule", title: "Product Brain Control Center email allowlist (server-side)",
    module: "Navigation / Shell", status: "protected_by_test", severity: "high", testStatus: "protected",
    sourcePath: "30-product-decision-log.md", sourceSection: "Product Brain Control Center",
    decision: "Access is a strict server-side EMAIL allowlist (PRODUCT_BRAIN_ALLOWED_EMAILS), not UI hiding. Route, nav flag, server actions, Isabella bridge and export all enforce it.",
    protectionRule: "Unauthorized users get notFound() and never receive Product Brain data via page, search, export, detail or Isabella.",
    testFiles: ["src/lib/product-brain/__tests__/access.test.ts"],
    verificationSteps: ["Sign in as a non-allowed user → /product-intelligence returns 404", "No Product Brain nav item appears"],
    tags: ["security", "rbac", "allowlist"],
  }),

  // ── Modules ───────────────────────────────────────────────────────────────
  ...(
    [
      ["MOD-LIVING-GRAPH", "Living Graph", "Primary project-intelligence surface (process map, critical path, overlays, focus).", "implemented"],
      ["MOD-ISABELLA", "Isabella", "Primary AI advisor; grounded briefings + Product-Brain answers.", "implemented"],
      ["MOD-PROJECT-MEMORY", "Project Memory", "Permanent evidence store for decisions/actions/notes.", "implemented"],
      ["MOD-SCRIBE", "ProjectOps Scribe", "Quick capture → AI structure → review → Project Memory.", "implemented"],
      ["MOD-RYTHM", "Rythm / Meetings", "Meeting/audio intelligence within Rhythm Center.", "in_progress"],
      ["MOD-RESOURCE-CAPACITY", "Resource Capacity", "Capacity/utilization intelligence + Workforce layer.", "in_progress"],
      ["MOD-EXEC-STATUS", "Execution Status Engine", "Deterministic state resolver (blocked vs waiting, risk, dependency).", "in_progress"],
      ["MOD-WORKBOARD", "Workboard", "Task execution board with ownership.", "implemented"],
      ["MOD-BIM", "BIM", "Drawing Intelligence (takeoff, extraction, costing).", "implemented"],
      ["MOD-NAV-SHELL", "Navigation / Shell", "App shell, grouped project navigation, sidebar.", "implemented"],
      ["MOD-LANDING", "Landing Page", "Public marketing surface with animated Execution Map.", "implemented"],
    ] as const
  ).map(([itemKey, module, summary, status]) =>
    mk({
      itemKey, type: "module", title: module, module, summary,
      status: status as ProductBrainItem["status"], testStatus: "not_required",
      sourcePath: "22-modules.md", sourceSection: module, tags: ["module"],
    }),
  ),

  // ── ADRs / CAPs ───────────────────────────────────────────────────────────
  mk({ itemKey: "ADR-002", type: "adr", title: "Living Graph is the primary surface", module: "Living Graph", status: "approved", sourcePath: "adrs/ADR-002-living-graph-primary-surface.md", summary: "The Living Graph is the primary intelligence/navigation surface, not a decorative chart.", tags: ["adr"] }),
  mk({ itemKey: "ADR-005", type: "adr", title: "Isabella is the primary AI interface", module: "Isabella", status: "approved", sourcePath: "adrs/ADR-005-isabella-primary-ai-interface.md", summary: "Isabella is the primary, app-wide AI advisor grounded in Knowledge OS.", tags: ["adr"] }),
  mk({ itemKey: "ADR-006", type: "adr", title: "Independent status dimensions", module: "Execution Status Engine", status: "approved", sourcePath: "adrs/ADR-006-independent-status-dimensions.md", summary: "Execution, dependency, health and risk are independent dimensions; blocked requires explicit impediment.", relatedItems: ["REG-008", "REG-010"], tags: ["adr", "status"] }),
  mk({ itemKey: "CAP-002", type: "cap", title: "Isabella (AI advisor)", module: "Isabella", status: "implemented", sourcePath: "05-capability-registry.md", sourceSection: "CAP-002", summary: "AI advisor capability.", tags: ["cap"] }),
  mk({ itemKey: "CAP-005", type: "cap", title: "Living Graph", module: "Living Graph", status: "implemented", sourcePath: "05-capability-registry.md", sourceSection: "CAP-005", summary: "Living Graph capability.", tags: ["cap"] }),
  mk({ itemKey: "CAP-009", type: "cap", title: "Resource Capacity Intelligence", module: "Resource Capacity", status: "in_progress", sourcePath: "05-capability-registry.md", sourceSection: "CAP-009", summary: "Resource capacity capability.", tags: ["cap"] }),

  // ── Known gaps / technical debt ───────────────────────────────────────────
  mk({ itemKey: "GAP-RBAC-FINE", type: "known_gap", title: "Fine-grained RBAC permissions", module: "Navigation / Shell", status: "needs_review", severity: "medium", testStatus: "missing", sourcePath: "25-ux-design-debt.md", summary: "Richer PMO/PM/role permissions beyond owner/admin/member/viewer.", tags: ["rbac", "gap"] }),
  mk({ itemKey: "GAP-PLAYWRIGHT", type: "known_gap", title: "Playwright visual/e2e smoke tests", module: "Navigation / Shell", status: "needs_test", severity: "low", testStatus: "missing", sourcePath: "25-ux-design-debt.md", summary: "Visual regression coverage (e.g. Isabella compact header ≤70px) is unit-only today.", relatedItems: ["UX-001"], tags: ["testing", "gap"] }),
  mk({ itemKey: "GAP-BASELINE-ENGINE", type: "known_gap", title: "Baseline engine for Variance", module: "Living Graph", status: "needs_review", severity: "medium", testStatus: "missing", sourcePath: "30-product-decision-log.md", summary: "Variance View needs an approved-baseline engine to compute against.", relatedItems: ["PD-VARIANCE-BASELINE"], tags: ["variance", "gap"] }),
  mk({ itemKey: "GAP-TIMELINE-SNAPSHOTS", type: "known_gap", title: "Timeline history snapshots", module: "Living Graph", status: "needs_review", severity: "low", testStatus: "missing", sourcePath: "30-product-decision-log.md", summary: "Timeline Playback needs persisted historical snapshots.", relatedItems: ["PD-TIMELINE-HISTORY"], tags: ["timeline", "gap"] }),
];
