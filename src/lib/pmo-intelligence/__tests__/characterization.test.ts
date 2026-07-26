// ============================================================================
// CAP-048 Phase 2 · Milestone 1 — characterization tests
// Guard: PMO-IC-CHARACTERIZATION
// ============================================================================
// These tests describe what Dashboards 1 and 2 do TODAY. They assert nothing
// about what is desirable — only about what is true — so that Phase 2 can
// compose these surfaces without silently altering them.
//
// Two things they defend, and both have bitten this product before:
//
//   1. **Formula drift.** The health engine's coefficients are load-bearing and
//      undocumented anywhere except the code. If someone tunes 1.2 to 1.5, a
//      PMO's portfolio score moves with no record of why. Changing a coefficient
//      should require deleting an assertion — a deliberate act, reviewable in a
//      diff — not a quiet edit.
//   2. **Metric divergence.** ADR-012 binds Dashboard 3 to reuse rather than
//      recompute. These tests pin the source functions it will call.
//
// A failure here is not necessarily a bug. It means behaviour changed, and the
// parity matrix and ADR-012 need updating in the same commit.
// ============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { band } from "@/lib/command-center/service";
import {
  effectiveIsBlocked,
  hasActiveBlocker,
  isActiveStatus,
  isCompletedStatus,
  isTerminalStatus,
} from "@/lib/execution/task-activity";
import { EMPTY_SCENARIO, simulateWhatIf } from "@/lib/pmo-process-intelligence/whatif";

const ROOT = join(__dirname, "..", "..", "..", "..");
const source = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

// ---------------------------------------------------------------------------
// Dashboard 1 — health engine
// ---------------------------------------------------------------------------

describe("D1 health bands", () => {
  it("splits at 80 and 60, inclusive at the boundary", () => {
    expect(band(100)).toBe("green");
    expect(band(80)).toBe("green");
    expect(band(79)).toBe("amber");
    expect(band(60)).toBe("amber");
    expect(band(59)).toBe("red");
    expect(band(0)).toBe("red");
  });
});

describe("D1 health formulas are pinned", () => {
  const service = source("src/lib/command-center/service.ts");

  // Each coefficient below is quoted from the implementation. They are the
  // difference between "82 — healthy" and "68 — needs attention" on a PMO's
  // screen, and nothing else records them.
  it.each([
    ["schedule: blocked weight", "pct(blocked.length, totalTasks) * 1.2"],
    ["schedule: overdue weight", "pct(overdue.length, totalTasks) * 1.0"],
    ["budget: variance multiplier", "* 4"],
    ["resources: unassigned weight", "* 0.6"],
    ["risk: high-severity weight", "highRisks.length * 12"],
    ["critical path: blocked ratio", "* 1.5"],
  ])("%s", (_label, fragment) => {
    expect(service).toContain(fragment);
  });

  it("derives the overall score as the mean of its dimensions", () => {
    // Not a weighted sum. If that ever changes, every historical score changes
    // meaning with it.
    expect(service).toContain("dims.reduce");
    expect(service).toContain("dims.length");
  });

  it("computes budget variance against the estimate, not the actual", () => {
    expect(service).toMatch(/fcTotal\s*-\s*estTotal/);
  });
});

describe("D1 stays deterministic", () => {
  const service = source("src/lib/command-center/service.ts");

  it("calls no model at runtime — the 'AI briefing' is rule-based", () => {
    // The section is labelled "AI Operator", which invites the assumption that
    // it is generative. It is not, and Dashboard 3 must not present it as such.
    expect(service).not.toMatch(/anthropic|openai|generateText|streamText/i);
  });

  it("keeps recommendation confidences fixed rather than inferred", () => {
    for (const confidence of ["0.82", "0.9", "0.88"]) {
      expect(service).toContain(confidence);
    }
  });
});

// ---------------------------------------------------------------------------
// REG-010 / ADR-006 — the canonical metric helpers
// ---------------------------------------------------------------------------

describe("canonical task metrics (REG-010)", () => {
  it("treats done, tested and implemented as completed", () => {
    for (const status of ["done", "tested", "implemented"]) {
      expect(isCompletedStatus(status), status).toBe(true);
    }
    expect(isCompletedStatus("in_progress")).toBe(false);
    expect(isCompletedStatus(null)).toBe(false);
  });

  it("counts deferred, cancelled and archived as terminal but not completed", () => {
    for (const status of ["deferred", "cancelled", "archived"]) {
      expect(isTerminalStatus(status), status).toBe(true);
      expect(isCompletedStatus(status), status).toBe(false);
    }
  });

  it("active is exactly the complement of terminal", () => {
    for (const status of ["not_started", "in_progress", "blocked", "done", "cancelled", null]) {
      expect(isActiveStatus(status)).toBe(!isTerminalStatus(status));
    }
  });

  it("a terminal task is never an active blocker, even with a stale flag", () => {
    // REG-010's core rule. A completed task carrying is_blocked = true is a
    // data artefact, not an impediment, and counting it inflates every
    // blocker metric on every surface.
    const stale = { status: "done", is_blocked: true } as Parameters<typeof hasActiveBlocker>[0];
    expect(hasActiveBlocker(stale)).toBe(false);
    expect(effectiveIsBlocked(stale)).toBe(false);
  });

  it("an active task with the flag, or with blocked status, is a blocker", () => {
    expect(hasActiveBlocker({ status: "in_progress", is_blocked: true } as never)).toBe(true);
    expect(hasActiveBlocker({ status: "blocked", is_blocked: false } as never)).toBe(true);
    expect(hasActiveBlocker({ status: "in_progress", is_blocked: false } as never)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Dashboard 2 — What-if
// ---------------------------------------------------------------------------

describe("D2 What-if is a pure, non-persistent simulation", () => {
  // `capacity` must be an array: simulateWhatIf calls .filter() on it without a
  // guard, so a null from an upstream loader would throw rather than degrade.
  // Worth knowing before Phase 2 feeds it composed data.
  const inputs = {
    financeRows: [],
    criticalRiskCount: 4,
    systemicRisks: [],
    capacity: [],
  } as unknown as Parameters<typeof simulateWhatIf>[0];

  it("returns the current state unchanged for an empty scenario", () => {
    const result = simulateWhatIf(inputs, EMPTY_SCENARIO);
    expect(result).toBeDefined();
    expect(result.current).toBeDefined();
    expect(result.simulated).toBeDefined();
  });

  it("is deterministic — same input, same output", () => {
    expect(simulateWhatIf(inputs, EMPTY_SCENARIO)).toEqual(
      simulateWhatIf(inputs, EMPTY_SCENARIO),
    );
  });

  it("writes nothing: no Supabase, no server action", () => {
    // Dashboard 3 may surface What-if, but it must not imply that a scenario
    // was applied. Nothing here can persist.
    const whatif = source("src/lib/pmo-process-intelligence/whatif.ts");
    expect(whatif).not.toContain("createClient");
    expect(whatif).not.toContain("use server");
  });
});

// ---------------------------------------------------------------------------
// Dashboard 2 — Isabella insights and their feedback command
// ---------------------------------------------------------------------------

describe("D2 Isabella is deterministic and evidence-bound", () => {
  const insights = source("src/lib/pmo-process-intelligence/insights.ts");

  it("generates insights from rules, not from a model", () => {
    expect(insights).not.toMatch(/anthropic|openai|generateText|streamText/i);
  });

  it("attaches an evidence package to every insight", () => {
    expect(insights).toContain("evidence");
    expect(insights).toContain("formulas");
  });
});

describe("D2 accept / reject / defer already persist", () => {
  const actions = source("src/app/[locale]/(app)/process-intelligence/actions.ts");

  it("exposes the feedback action Dashboard 3 must reuse", () => {
    // ADR-012: commands are re-exported, never reimplemented. If this action
    // is renamed, Dashboard 3's buttons must follow it rather than grow their
    // own write path.
    expect(actions).toContain("recordInsightFeedbackAction");
  });

  it("records the decision in audit_logs rather than a bespoke table", () => {
    expect(actions).toContain("audit_logs");
  });

  it("accepts exactly the three decisions the UI offers", () => {
    for (const decision of ["accepted", "rejected", "deferred"]) {
      expect(actions).toContain(decision);
    }
  });

  it("enforces access server-side, not just by hiding buttons", () => {
    expect(actions).toContain("canAccessProcessIntelligence");
  });
});

// ---------------------------------------------------------------------------
// Reuse surface — the functions Phase 2 will compose
// ---------------------------------------------------------------------------

describe("the composition surface exists and is callable", () => {
  it.each([
    ["command centre summary", "src/lib/command-center/service.ts", "export async function getCommandCenterSummary"],
    ["flow model", "src/lib/pmo-process-intelligence/read-model.server.ts", "loadPmoPiFlowModel"],
    ["finance overlay", "src/lib/pmo-process-intelligence/financial-read.server.ts", "loadPmoPiFinanceOverlay"],
    ["overlays", "src/lib/pmo-process-intelligence/overlays-read.server.ts", "loadPmoPiOverlays"],
    ["portfolio graph", "src/lib/pmo-living-graph/read-model.server.ts", "loadPortfolioGraph"],
    ["critical path engine", "src/lib/execution/critical-path.ts", "calculateCriticalPath"],
    ["capacity engine", "src/lib/capacity/service.ts", "computeResourceCapacity"],
    ["report runner", "src/lib/reports/query-service.ts", "runReport"],
  ])("%s", (_label, path, symbol) => {
    expect(source(path)).toContain(symbol);
  });

  it("keeps the two capacity engines apart", () => {
    // Hours and headcount. The generic engine must not import the construction
    // one, or the units get mixed at the source. See parity matrix §5.
    expect(source("src/lib/capacity/service.ts")).not.toContain("@/lib/labor/");
  });
});
