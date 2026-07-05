// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-UI-REALTIME-FINAL-INTEGRATION — flags, quick
// actions, wiring gate + import boundaries
// ============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it, expect, vi } from "vitest";
import { isIsabellaProcessIntelligenceEnabled, isIsabellaProcessIntelligenceUiEnabled } from "@/lib/isabella/process-intelligence-runtime/flag";
import { getIsabellaQuickActions } from "@/lib/isabella/process-intelligence-runtime/quick-actions";

afterEach(() => {
  delete process.env.ISABELLA_PROCESS_INTELLIGENCE_ENABLED;
  delete process.env.ISABELLA_PROCESS_INTELLIGENCE_UI_ENABLED;
  vi.resetModules();
});

describe("feature flags default OFF", () => {
  it("runtime + UI flags are false unless explicitly 'true'", () => {
    expect(isIsabellaProcessIntelligenceEnabled()).toBe(false);
    expect(isIsabellaProcessIntelligenceUiEnabled()).toBe(false);
  });
});

describe("quick actions (bilingual, i18n-keyed)", () => {
  it("returns ordered chips with prompts; explain_node only with a selection", () => {
    const en = getIsabellaQuickActions("en");
    expect(en.map((a) => a.id)).toEqual(["daily_diagnosis", "attention", "root_cause", "recommend"]);
    expect(en.every((a) => a.labelKey.startsWith("isabella.quickActions."))).toBe(true);
    const es = getIsabellaQuickActions("es", { hasSelectedNode: true });
    expect(es.map((a) => a.id)).toContain("explain_node");
    expect(es.find((a) => a.id === "root_cause")!.label).toBe("Analizar causa raíz");
  });
});

describe("wiring gate (flag OFF preserves existing behavior)", () => {
  it("maybeAnswerWithProcessIntelligence returns null when the flag is OFF", async () => {
    const { maybeAnswerWithProcessIntelligence } = await import("@/lib/isabella/process-intelligence-runtime/wiring");
    const org = { userId: "u1", organizationId: "org1", role: "member" } as never;
    const input = { query: "What should I do next?", intent: "question", context: { module: "m", projectId: "p1" }, locale: "en" } as never;
    const res = await maybeAnswerWithProcessIntelligence(org, input, { key: "isabella", displayName: "Isabella", title: "Guide" });
    expect(res).toBeNull();
  });
});

describe("import boundaries (read-only, no raw sources, no mutation)", () => {
  const dir = fileURLToPath(new URL("../", import.meta.url));
  it("router/runtime/types/flag/quick-actions never touch the DB / event log / process graph", () => {
    for (const f of ["types.ts", "flag.ts", "router.ts", "runtime.ts", "quick-actions.ts", "index.ts"]) {
      const src = readFileSync(dir + f, "utf8");
      expect(src, f).not.toMatch(/from\s+["']@\/lib\/supabase/);
      expect(src, f).not.toMatch(/\.from\(["']/);
      expect(src, f).not.toMatch(/\.(insert|update|delete|upsert)\s*\(/);
      expect(src, f).not.toMatch(/project_event_log|process_nodes|process_edges/);
    }
  });
  it("the router uses no visual layout coordinates", () => {
    const src = readFileSync(dir + "router.ts", "utf8");
    expect(src).not.toMatch(/\b(x|y|position|coordinate|coord)\b\s*[:=]/i);
  });
});
