// ============================================================================
// CAP-048 Phase 2 — dogfooding remediation
// Guards: PMO-IC-ONE-ISABELLA, PMO-IC-PANEL-PERSISTENCE, PMO-IC-KPI-FEEDBACK,
//         PMO-IC-COUNT-LABELLED
// ============================================================================
// Four defects were reported against Dashboard 3, and each one is a property
// that can regress silently. So each gets a test rather than a code comment.
//
//   PMO-IC-ONE-ISABELLA      Two Isabellas were on screen at once: the global
//                            floating widget and a permanently mounted 320px
//                            panel. The panel must default to CLOSED, and it
//                            must not be reachable from a second floating
//                            button that competes with the global one.
//   PMO-IC-PANEL-PERSISTENCE Collapsing a panel has to survive a reload, and
//                            the key has to be scoped so one org's or one
//                            user's preference cannot leak into another's.
//   PMO-IC-KPI-FEEDBACK      A KPI click that resolves nothing must SAY so.
//                            Silence reads as a broken control.
//   PMO-IC-COUNT-LABELLED    A bare "2" beside a title is not a label.
//
// The storage tests drive a stub `localStorage` because the suite runs in the
// node environment; the module reads `window.localStorage` behind a guarded
// accessor, which is exactly the seam that makes this possible.
// ============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PANEL_PREFERENCES,
  loadPanelPreferences,
  panelPreferencesKey,
  parsePanelPreferences,
  savePanelPreferences,
  togglePanel,
} from "../panel-preferences";
import { kpiOutcome } from "../kpi-feedback";
import { kpiIntent, PMO_KPI_KEYS } from "../kpi-bindings";
import type { GraphNode } from "@/lib/pmo-living-graph/contracts";

const ROOT = join(__dirname, "..", "..", "..", "..");
const source = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

const ORG = "org-1";
const USER = "user-1";

function node(id: string, overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id,
    organizationId: ORG,
    projectId: null,
    kind: "project",
    canonicalEntityType: "projects",
    canonicalEntityId: id.split(":")[1] ?? id,
    label: id,
    description: null,
    status: null,
    health: "unknown",
    criticality: 0,
    metrics: {},
    provenance: "OBSERVED",
    confidence: 1,
    evidenceRefs: [],
    validFrom: null,
    validTo: null,
    updatedAt: null,
    ...overrides,
  };
}

/** Minimal in-memory Storage, enough for the module's get/set/remove usage. */
function installStorage(): Map<string, string> {
  const backing = new Map<string, string>();
  const stub: Storage = {
    get length() {
      return backing.size;
    },
    clear: () => backing.clear(),
    getItem: (key: string) => backing.get(key) ?? null,
    key: (index: number) => [...backing.keys()][index] ?? null,
    removeItem: (key: string) => void backing.delete(key),
    setItem: (key: string, value: string) => void backing.set(key, value),
  };
  (globalThis as { window?: unknown }).window = { localStorage: stub };
  return backing;
}

// ---------------------------------------------------------------------------
// PMO-IC-ONE-ISABELLA
// ---------------------------------------------------------------------------

describe("there is exactly one Isabella on screen (PMO-IC-ONE-ISABELLA)", () => {
  it("defaults the insight panel to closed", () => {
    // The global floating widget is the one Isabella. This panel is her
    // findings for the current scope, and it opens on request.
    expect(DEFAULT_PANEL_PREFERENCES.isabella).toBe(false);
  });

  it("keeps the overview open by default — collapsible, not hidden", () => {
    expect(DEFAULT_PANEL_PREFERENCES.overview).toBe(true);
  });

  it("mounts the insights panel only when the preference says so", () => {
    const shell = source("src/components/pmo-living-graph/portfolio-graph-shell.tsx");
    // Unconditional `intelligence ? <PmoInsightsPanel` is the exact regression:
    // it is what made the panel a permanent column.
    expect(shell).toContain("intelligence && panels.isabella ? (");
    expect(shell).toContain("intelligence && panels.overview ? (");
  });

  it("does not introduce a second floating Isabella entry point", () => {
    const toggles = source("src/components/pmo-intelligence/panel-toggles.tsx");
    // A `fixed`-positioned control would float over the canvas and compete with
    // the global widget. The toggles belong in the toolbar flow.
    expect(toggles).not.toMatch(/\bfixed\b/);
    const shell = source("src/components/pmo-living-graph/portfolio-graph-shell.tsx");
    // The global widget is never re-mounted or wrapped from this dashboard.
    expect(shell).not.toContain("LivingGuideWidget");
  });

  it("still reaches the global Isabella through askIsabella with built context", () => {
    const shell = source("src/components/pmo-living-graph/portfolio-graph-shell.tsx");
    expect(shell).toContain("buildIsabellaAsk");
    expect(shell).toContain("askIsabella(ask)");
  });
});

// ---------------------------------------------------------------------------
// PMO-IC-COUNT-LABELLED
// ---------------------------------------------------------------------------

describe("counts are labelled, never bare badges (PMO-IC-COUNT-LABELLED)", () => {
  it("labels the insight count in both the panel header and the toggle", () => {
    const en = JSON.parse(source("messages/en.json")) as {
      pmoIntelligence: Record<string, string>;
    };
    const es = JSON.parse(source("messages/es.json")) as {
      pmoIntelligence: Record<string, string>;
    };

    for (const messages of [en.pmoIntelligence, es.pmoIntelligence]) {
      // Both strings must interpolate the count AND name what it counts, so the
      // number can never render on its own.
      expect(messages.insightsFindingCount).toContain("{count}");
      expect(messages.insightsFindingCount.replace("{count}", "").trim().length).toBeGreaterThan(0);
      expect(messages.panelIsabellaWithCount).toContain("{count}");
      expect(messages.panelIsabellaWithCount).toMatch(/Isabella/);
    }
  });

  it("removed the unexplained bare-count badge from the panel header", () => {
    const panel = source("src/components/pmo-intelligence/insights-panel.tsx");
    // The old markup rendered `{insights.length}` alone inside a pill.
    expect(panel).not.toMatch(/>\s*\{insights\.length\}\s*</);
    expect(panel).toContain("insightsFindingCount");
  });

  it("disambiguates the at-risk COUNT from the risk health SCORE", () => {
    // The reported contradiction: "At risk 2" beside "Risk 0". They measure
    // different things — a count of projects vs a 0-100 health score — and the
    // labels have to say which is which.
    const en = (JSON.parse(source("messages/en.json")) as {
      pmoIntelligence: Record<string, string>;
    }).pmoIntelligence;
    const es = (JSON.parse(source("messages/es.json")) as {
      pmoIntelligence: Record<string, string>;
    }).pmoIntelligence;

    expect(en.kpi_projectsAtRisk).toMatch(/project/i);
    expect(en.healthDimension_risk).toMatch(/score/i);
    expect(es.kpi_projectsAtRisk).toMatch(/proyecto/i);
    expect(es.healthDimension_risk).toMatch(/puntaje/i);

    // And they must not be the same string, which is what made them read as one
    // metric contradicting itself.
    expect(en.kpi_projectsAtRisk).not.toBe(en.healthDimension_risk);
    expect(es.kpi_projectsAtRisk).not.toBe(es.healthDimension_risk);
  });
});

// ---------------------------------------------------------------------------
// PMO-IC-PANEL-PERSISTENCE
// ---------------------------------------------------------------------------

describe("panel preferences persist and stay scoped (PMO-IC-PANEL-PERSISTENCE)", () => {
  beforeEach(() => installStorage());
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("round-trips a collapsed panel", () => {
    savePanelPreferences(ORG, USER, { isabella: true, overview: false });
    expect(loadPanelPreferences(ORG, USER)).toEqual({ isabella: true, overview: false });
  });

  it("keys by organization AND user, so a preference cannot leak", () => {
    savePanelPreferences(ORG, USER, { isabella: true, overview: false });

    // Different org, same user: back to the defaults, not the other portfolio's.
    expect(loadPanelPreferences("org-2", USER)).toEqual(DEFAULT_PANEL_PREFERENCES);
    // Same org, different user (a shared browser).
    expect(loadPanelPreferences(ORG, "user-2")).toEqual(DEFAULT_PANEL_PREFERENCES);

    expect(panelPreferencesKey(ORG, USER)).not.toBe(panelPreferencesKey("org-2", USER));
    expect(panelPreferencesKey(ORG, USER)).not.toBe(panelPreferencesKey(ORG, "user-2"));
  });

  it("separates ids that differ only by punctuation", () => {
    // `safeSegment` collapses non-alphanumerics; two different ids must still
    // not collide once the segments are joined.
    expect(panelPreferencesKey("a.b", "u")).not.toBe(panelPreferencesKey("a", "b.u"));
  });

  it("falls back to the defaults on a corrupt or partial payload", () => {
    expect(parsePanelPreferences(null)).toEqual(DEFAULT_PANEL_PREFERENCES);
    expect(parsePanelPreferences("nonsense")).toEqual(DEFAULT_PANEL_PREFERENCES);
    // A missing key must inherit the DEFAULT, not `false` — a truncated payload
    // must never silently hide a panel the user never closed.
    expect(parsePanelPreferences({ isabella: true })).toEqual({
      isabella: true,
      overview: true,
    });
    expect(parsePanelPreferences({ overview: false })).toEqual({
      isabella: false,
      overview: false,
    });
  });

  it("survives storage being unavailable", () => {
    delete (globalThis as { window?: unknown }).window;
    // No window (SSR, or a private-mode browser that throws): the defaults come
    // back and nothing throws, so the first paint is still correct.
    expect(() => savePanelPreferences(ORG, USER, DEFAULT_PANEL_PREFERENCES)).not.toThrow();
    expect(loadPanelPreferences(ORG, USER)).toEqual(DEFAULT_PANEL_PREFERENCES);
  });

  it("toggles one panel without disturbing the other", () => {
    const start = { isabella: false, overview: true };
    expect(togglePanel(start, "isabella")).toEqual({ isabella: true, overview: true });
    expect(togglePanel(start, "overview")).toEqual({ isabella: false, overview: false });
    // Pure: the input is not mutated.
    expect(start).toEqual({ isabella: false, overview: true });
  });

  it("persists on the transition rather than from an effect", () => {
    const shell = source("src/components/pmo-living-graph/portfolio-graph-shell.tsx");
    expect(shell).toContain("savePanelPreferences(organizationId, userId, next)");
    // Lazy initialiser, so the panels never flash open and then collapse.
    expect(shell).toContain("useState(() =>");
    expect(shell).toContain("loadPanelPreferences(organizationId, userId)");
  });
});

// ---------------------------------------------------------------------------
// PMO-IC-OVERVIEW-ALWAYS-VISIBLE
// ---------------------------------------------------------------------------
// The follow-up report: "the panorama on the RIGHT was the one I needed
// collapsible; the one on the LEFT you made disappear."
//
// The right panel (Isabella's findings) is collapsible and defaults closed —
// covered by PMO-IC-ONE-ISABELLA above. What follows guards the other half: the
// LEFT rail (portfolio health + today's PMO focus) is present on every first
// load and nothing may close it behind the user's back.
// ---------------------------------------------------------------------------

describe("the left rail is visible by default (PMO-IC-OVERVIEW-ALWAYS-VISIBLE)", () => {
  beforeEach(() => installStorage());
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("defaults the overview OPEN", () => {
    expect(DEFAULT_PANEL_PREFERENCES.overview).toBe(true);
    expect(loadPanelPreferences(ORG, USER).overview).toBe(true);
  });

  it("retires stored preferences from the build that defaulted it closed", () => {
    // Users who loaded the earlier build carry `{"overview":false}`. A default
    // change alone cannot reach them, so the namespace was bumped: the old
    // payload must be invisible to the current key.
    const backing = installStorage();
    backing.set(
      "p360.pmo-panels.v1.user-1.org-1",
      JSON.stringify({ isabella: false, overview: false }),
    );
    expect(loadPanelPreferences(ORG, USER).overview).toBe(true);
    expect(panelPreferencesKey(ORG, USER)).toContain("v2");
  });

  it("still lets the user collapse it deliberately, and remembers that", () => {
    // Collapsible, not hidden. An explicit click is the ONLY thing that closes
    // it, and that choice does survive a reload.
    savePanelPreferences(ORG, USER, { isabella: false, overview: false });
    expect(loadPanelPreferences(ORG, USER).overview).toBe(false);
  });

  it("has a labelled toolbar control for each panel", () => {
    const toggles = source("src/components/pmo-intelligence/panel-toggles.tsx");
    // Both panels are reachable, and neither control is an unlabelled icon.
    expect(toggles).toContain("onToggleOverview");
    expect(toggles).toContain("panelOverview");
    expect(toggles).toContain("onToggleIsabella");
    expect(toggles).toContain("aria-pressed={overviewOpen}");
    expect(toggles).toContain("aria-pressed={isabellaOpen}");
  });

  it("is never auto-closed by any code path", () => {
    const shell = source("src/components/pmo-living-graph/portfolio-graph-shell.tsx");
    // KPI intents may OPEN a panel; nothing may close one. A guarded toggle that
    // only fires when the panel is shut can only ever open it.
    expect(shell).toContain("if (intent.openPanel === \"health\" && !panels.overview)");
    // No unguarded close, and no direct write of `overview: false`.
    expect(shell).not.toMatch(/overview:\s*false/);
  });
});

// ---------------------------------------------------------------------------
// PMO-IC-KPI-ALIGNMENT
// ---------------------------------------------------------------------------
// Reported defect: the eight KPI values sat at different heights because cards
// with a subtitle were taller than cards without one, and long helper text
// pushed the content around.
//
// The fix is structural, so the guard is structural too: every card renders the
// same three rows, the row heights are fixed, and the value row absorbs the
// slack. A CSS-only tweak would not survive the next content change.
// ---------------------------------------------------------------------------

describe("the KPI cards line up (PMO-IC-KPI-ALIGNMENT)", () => {
  const bar = () => source("src/components/pmo-intelligence/kpi-bar.tsx");

  it("stretches every card to a common height", () => {
    const body = bar();
    expect(body).toContain("items-stretch");
    expect(body).toContain("h-full");
  });

  it("reserves the subtitle row even when there is no subtitle", () => {
    const body = bar();
    // The regression was a conditional row: `{kpi.subtitle ? <span/> : null}`
    // makes cards without one shorter, which is what misaligned the values.
    expect(body).not.toMatch(/\{kpi\.subtitle \? \([\s\S]{0,200}\) : null\}/);
    expect(body).toContain("kpi.subtitle ? kpi.subtitle :");
  });

  it("pins the value row to a shared baseline", () => {
    // `flex-1` lets the value row take up the slack and `items-end` puts the
    // number on the same line in every card regardless of what is above it.
    expect(bar()).toContain("flex w-full flex-1 items-end");
  });

  it("truncates label and subtitle to one line each", () => {
    const body = bar();
    // Two-line wrapping is what let a long string push the row out of shape.
    expect(body).not.toContain("line-clamp-2");
    const clamps = body.match(/line-clamp-1/g) ?? [];
    expect(clamps.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps the full subtitle reachable when it is truncated", () => {
    // Truncation must not destroy information: the whole string stays in the
    // tooltip.
    expect(bar()).toContain("title={kpi.subtitle ?? undefined}");
  });

  it("still refuses to render a missing value as zero", () => {
    // The alignment work must not have flattened the unavailable branch, which
    // is a correctness property rather than a cosmetic one.
    const body = bar();
    expect(body).toContain("metric.state === \"ok\"");
    expect(body).toContain("kpiUnavailable");
  });
});

// ---------------------------------------------------------------------------
// PMO-IC-KPI-FEEDBACK
// ---------------------------------------------------------------------------

describe("every KPI click produces visible feedback (PMO-IC-KPI-FEEDBACK)", () => {
  const nodes = [
    node("n:p1", { kind: "project", projectId: "p1", health: "critical" }),
    node("n:p2", { kind: "project", projectId: "p2", health: "healthy" }),
    node("n:d1", { kind: "decision", status: "proposed" }),
  ];
  const context = {
    criticalNodeIds: ["n:p1"],
    sharedResourceProjectIds: ["p1"],
    blockedSubjectIds: ["p1"],
  };

  it("gives every KPI an outcome with a message — none is silent", () => {
    for (const key of PMO_KPI_KEYS) {
      const outcome = kpiOutcome(key, kpiIntent(key, nodes, context));
      expect(outcome.messageKey, `KPI ${key} has no message`).toBeTruthy();
      expect(["applied", "lens-only", "empty"]).toContain(outcome.kind);
    }
  });

  it("resolves every message key against both locales", () => {
    const en = (JSON.parse(source("messages/en.json")) as {
      pmoIntelligence: Record<string, string>;
    }).pmoIntelligence;
    const es = (JSON.parse(source("messages/es.json")) as {
      pmoIntelligence: Record<string, string>;
    }).pmoIntelligence;

    // An outcome pointing at a missing key would throw at render time, which is
    // the worst place to discover it.
    for (const key of PMO_KPI_KEYS) {
      const { messageKey } = kpiOutcome(key, kpiIntent(key, nodes, context));
      expect(en[messageKey], `EN missing ${messageKey}`).toBeTruthy();
      expect(es[messageKey], `ES missing ${messageKey}`).toBeTruthy();
    }
  });

  it("reports what was selected when the click resolved nodes", () => {
    const outcome = kpiOutcome("projectsAtRisk", kpiIntent("projectsAtRisk", nodes, context));
    expect(outcome.kind).toBe("applied");
    expect(outcome.selectedCount).toBe(1);
    expect(outcome.messageKey).toBe("kpiOutcomeSelected");
  });

  it("distinguishes focus mode, because isolating looks different from selecting", () => {
    const outcome = kpiOutcome("criticalNodes", kpiIntent("criticalNodes", nodes, context));
    expect(outcome.messageKey).toBe("kpiOutcomeFocused");
  });

  it("calls a portfolio-wide figure what it is, not 'nothing found'", () => {
    // Budget variance legitimately selects no node: it is a percentage over the
    // portfolio, not a place. Reporting it as an empty result would be wrong.
    const budget = kpiOutcome("budgetVariance", kpiIntent("budgetVariance", nodes, context));
    expect(budget.kind).toBe("lens-only");
    expect(budget.messageKey).toBe("kpiOutcomeLensOnly");

    const health = kpiOutcome("portfolioHealth", kpiIntent("portfolioHealth", nodes, context));
    expect(health.kind).toBe("lens-only");
    expect(health.messageKey).toBe("kpiOutcomePanel");
  });

  it("says so when a spatial KPI resolves nothing", () => {
    // The failure the user reported: a click with no visible effect. An empty
    // graph must produce a stated result, not silence.
    const empty = kpiOutcome(
      "projectsAtRisk",
      kpiIntent("projectsAtRisk", [], { ...context, criticalNodeIds: [] }),
    );
    expect(empty.kind).toBe("empty");
    expect(empty.messageKey).toBe("kpiOutcomeLensNoNodes");

    const noLens = kpiOutcome(
      "pendingDecisions",
      kpiIntent("pendingDecisions", [], { ...context, criticalNodeIds: [] }),
    );
    expect(noLens.kind).toBe("empty");
    expect(noLens.messageKey).toBe("kpiOutcomeNothing");
  });

  it("wires the outcome into the shell and honours openPanel", () => {
    const shell = source("src/components/pmo-living-graph/portfolio-graph-shell.tsx");
    expect(shell).toContain("setKpiFeedback(kpiOutcome(key, intent))");
    // `openPanel` was computed but never applied before: the health KPI selects
    // no nodes, so without this its click had no visible effect at all.
    expect(shell).toContain('intent.openPanel === "health"');
    expect(shell).toContain('intent.openPanel === "evidence"');
    // The camera still moves on a resolved selection.
    expect(shell).toContain("centreOn(nodeIds)");
  });

  it("does not let a confirmation and an empty result share a dismissal rule", () => {
    const shell = source("src/components/pmo-living-graph/portfolio-graph-shell.tsx");
    // An empty result is the ONLY evidence the click did anything, so it must
    // not auto-dismiss the way a confirmation does.
    expect(shell).toContain('kpiFeedback.kind === "empty"');
  });
});

// ---------------------------------------------------------------------------
// ADR-012 — the remediation added no new formula
// ---------------------------------------------------------------------------

describe("the remediation orchestrates and does not recompute (ADR-012)", () => {
  it("keeps the new modules free of metric arithmetic", () => {
    const feedback = source("src/lib/pmo-intelligence/kpi-feedback.ts");
    const preferences = source("src/lib/pmo-intelligence/panel-preferences.ts");

    for (const file of [feedback, preferences]) {
      // No thresholds, no scoring, no percentages. These modules classify and
      // remember; every number on screen still comes from its named source.
      expect(file).not.toMatch(/\*\s*100|\/\s*100|Math\.round\s*\(/);
    }
  });

  it("leaves the KPI bindings themselves untouched by presentation concerns", () => {
    const bindings = source("src/lib/pmo-intelligence/kpi-bindings.ts");
    // Feedback lives in its own module: the intent must stay a pure mapping.
    expect(bindings).not.toContain("messageKey");
  });
});
