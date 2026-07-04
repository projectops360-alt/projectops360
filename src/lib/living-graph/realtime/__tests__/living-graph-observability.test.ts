// ============================================================================
// Phase 4B · Task 3 — Living Graph Observability Panel guards
// Guard: PHASE4B-LIVING-GRAPH-OBSERVABILITY-PANEL
// ============================================================================
// Protects the safe, HONEST observability summary: instrumented metrics render
// with value + severity; NOT-tracked metrics render as `unavailable` (never a
// fake zero); the environment card reflects infra health; the model carries
// ONLY numbers/booleans/state (no payloads / tenant data); and the admin route
// is gated by the strict email allowlist with a 404 on denial. Pure formatter is
// client-free; the DB-touching env-health helper is server-only and separate.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildObservabilitySummary,
  createRealtimePerfObservability,
  type EnvironmentHealth,
} from "../index";

const env: EnvironmentHealth = {
  realtimePublicationOk: true,
  rlsEnabled: true,
  rlsPolicyCount: 2,
  recentEventCount: 7,
  recentWindowMinutes: 15,
};

function findRow(model: ReturnType<typeof buildObservabilitySummary>, cardKey: string, metricKey: string) {
  return model.cards.find((c) => c.key === cardKey)?.rows.find((r) => r.key === metricKey);
}

describe("buildObservabilitySummary — honesty + safety", () => {
  it("marks metrics NOT present in the source as unavailable / not instrumented (never fake zero)", () => {
    const model = buildObservabilitySummary({
      connectionState: "live",
      freshness: "fresh",
      snapshot: { subscriptionCount: 1, noticeCount: 3 }, // only these tracked
      environment: null,
      lastEventAt: null,
      generatedAt: "2026-07-04T00:00:00.000Z",
    });
    expect(findRow(model, "connection", "subscriptionCount")).toMatchObject({ value: 1, instrumented: true });
    expect(findRow(model, "notice_recalc", "noticeCount")).toMatchObject({ value: 3, instrumented: true });
    // delta/recalc/render never tracked here → unavailable, value null.
    expect(findRow(model, "delta_sync", "deltaCount")).toMatchObject({ instrumented: false, value: null, status: "unavailable" });
    expect(findRow(model, "rendering", "avgRenderLatencyMs")).toMatchObject({ instrumented: false, value: null });
  });

  it("applies severity: reconnects/stale warn, permission loss/errors error, when > 0", () => {
    const model = buildObservabilitySummary({
      connectionState: "degraded_polling",
      freshness: "degraded",
      snapshot: { reconnectCount: 2, permissionLossCount: 1, errorCount: 4, subscriptionCount: 1 },
      environment: null,
      lastEventAt: null,
      generatedAt: "t",
    });
    expect(findRow(model, "connection", "reconnectCount")?.status).toBe("warn");
    expect(findRow(model, "connection", "permissionLossCount")?.status).toBe("error");
    expect(findRow(model, "errors", "errorCount")?.status).toBe("error");
    // A zero-valued tracked counter is ok, not warn.
    const zero = buildObservabilitySummary({
      connectionState: "live", freshness: "fresh", snapshot: { reconnectCount: 0 },
      environment: null, lastEventAt: null, generatedAt: "t",
    });
    expect(findRow(zero, "connection", "reconnectCount")).toMatchObject({ value: 0, status: "ok", instrumented: true });
  });

  it("renders the environment card from infra health (publication + RLS + aggregate count)", () => {
    const model = buildObservabilitySummary({
      connectionState: "unknown", freshness: "unknown", snapshot: null, environment: env,
      lastEventAt: null, generatedAt: "t",
    });
    expect(findRow(model, "environment", "realtimePublicationOk")).toMatchObject({ value: "healthy", status: "ok" });
    expect(findRow(model, "environment", "rlsEnabled")?.value).toContain("enabled");
    expect(findRow(model, "environment", "recentEventCount")).toMatchObject({ value: 7, instrumented: true });
  });

  it("flags unhealthy infra as error (publication missing / RLS disabled)", () => {
    const model = buildObservabilitySummary({
      connectionState: "offline", freshness: "unknown", snapshot: null,
      environment: { ...env, realtimePublicationOk: false, rlsEnabled: false },
      lastEventAt: null, generatedAt: "t",
    });
    expect(findRow(model, "environment", "realtimePublicationOk")).toMatchObject({ value: "missing", status: "error" });
    expect(findRow(model, "environment", "rlsEnabled")).toMatchObject({ status: "error" });
  });

  it("reports hasAnyInstrumented honestly", () => {
    const none = buildObservabilitySummary({
      connectionState: "unknown", freshness: "unknown", snapshot: null, environment: null,
      lastEventAt: null, generatedAt: "t",
    });
    expect(none.hasAnyInstrumented).toBe(false);
    const some = buildObservabilitySummary({
      connectionState: "live", freshness: "fresh", snapshot: { subscriptionCount: 1 }, environment: null,
      lastEventAt: null, generatedAt: "t",
    });
    expect(some.hasAnyInstrumented).toBe(true);
  });

  it("the model is numeric/boolean/string-only — a full session snapshot never leaks a payload key", () => {
    const obs = createRealtimePerfObservability();
    obs.incr("noticeCount", 5);
    const model = buildObservabilitySummary({
      connectionState: "live", freshness: "fresh",
      snapshot: { noticeCount: obs.snapshot().noticeCount },
      environment: env, lastEventAt: "2026-07-04T00:00:00Z", generatedAt: "t",
    });
    const serialized = JSON.stringify(model);
    expect(serialized).not.toMatch(/payload|prompt_body|assigned_to|email|token|secret/i);
    for (const card of model.cards) {
      for (const row of card.rows) {
        expect(["number", "string", "object"].includes(typeof row.value) || row.value === null).toBe(true);
      }
    }
  });
});

describe("import boundary + RBAC gating", () => {
  it("the pure summary module never imports a DB client, Supabase, or the process graph", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/living-graph/realtime/observability-summary.ts"), "utf8");
    const code = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*")).join("\n");
    expect(code).not.toMatch(/supabase|createAdminClient|createClient|server-only/i);
    expect(code).not.toMatch(/project_event_log|process_nodes|process_edges/);
  });

  it("the env-health helper is server-only, count-only, and org-scoped (no rows/payloads)", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/living-graph/observability/environment-health.server.ts"), "utf8");
    expect(src).toMatch(/server-only/);
    // Aggregate count only (head:true) + org scope; never selects payload columns.
    expect(src).toMatch(/head:\s*true/);
    expect(src).toMatch(/organization_id/);
    const code = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*")).join("\n");
    expect(code).not.toMatch(/process_nodes|process_edges/);
    expect(code).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
  });

  it("the admin route is gated by the strict email allowlist with a 404 on denial", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/[locale]/(app)/admin/living-graph-observability/page.tsx"),
      "utf8",
    );
    expect(src).toMatch(/isProductBrainAllowedEmail\(org\.email\)/);
    expect(src).toMatch(/notFound\(\)/);
    // Never mutates canonical data or the ledger from the route.
    expect(src).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
    expect(src).not.toMatch(/process_nodes|process_edges/);
  });

  it("the panel never renders raw payloads or ledger rows", () => {
    const src = readFileSync(join(process.cwd(), "src/components/admin/living-graph-observability-panel.tsx"), "utf8");
    const code = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*")).join("\n");
    expect(code).not.toMatch(/payload\.new|postgres_changes|project_event_log/);
    expect(code).not.toMatch(/\.from\(|createAdminClient/);
  });
});
