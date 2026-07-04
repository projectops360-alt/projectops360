// ============================================================================
// CI-safe guard for the Phase 4B multi-tab realtime E2E
// Guard: PHASE4B-REAL-MULTI-TAB-REALTIME-E2E (selector contract)
// ============================================================================
// The real cross-browser realtime E2E (e2e/realtime-sync.spec.ts) needs a live
// app + Supabase Realtime + auth, so it CANNOT run in CI. This deterministic
// vitest guard runs in CI and protects the STABLE SELECTORS the E2E depends on:
// if a refactor removes a `data-testid` the spec targets, CI fails here (instead
// of the E2E silently rotting). It never renders or hits the network.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("realtime E2E selector contract", () => {
  it("Workboard exposes stable column + card test ids with status data attributes", () => {
    const src = read("src/app/[locale]/(app)/projects/[projectId]/workboard/workboard-client.tsx");
    expect(src).toMatch(/data-testid=\{`workboard-column-\$\{status\}`\}/);
    expect(src).toMatch(/data-status=\{status\}/);
    expect(src).toMatch(/data-testid=\{`workboard-card-\$\{task\.id\}`\}/);
    expect(src).toMatch(/data-task-status=\{task\.status\}/);
  });

  it("Task editor exposes the status select + submit test ids (the approved move path)", () => {
    const src = read("src/components/roadmap/task-form-dialog.tsx");
    expect(src).toMatch(/data-testid="task-status-select"/);
    expect(src).toMatch(/data-testid="task-form-submit"/);
  });

  it("Realtime Living Graph node exposes its status for cross-browser assertion", () => {
    const src = read("src/components/living-graph-realtime/realtime-graph-nodes.tsx");
    expect(src).toMatch(/data-testid=\{`rt-node-\$\{data\.node\.nodeKind\}`\}/);
    expect(src).toMatch(/data-node-status=/);
  });

  it("Realtime view exposes the root + sync-bar the E2E waits on before acting", () => {
    const src = read("src/components/living-graph-realtime/realtime-living-graph.tsx");
    expect(src).toMatch(/data-testid="rt-root"/);
    const syncBar = read("src/components/living-graph-realtime/realtime-sync-bar.tsx");
    expect(syncBar).toMatch(/data-testid="rt-sync-bar"/);
  });

  it("the E2E spec uses the approved UI path and never mutates the ledger/process graph directly", () => {
    const spec = read("e2e/realtime-sync.spec.ts");
    const code = spec.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
    // Never touches canonical/event tables directly.
    expect(code).not.toMatch(/project_event_log|process_nodes|process_edges/);
    expect(code).not.toMatch(/createClient|supabase|service_role|\.from\(/i);
    // Never uses an arbitrary sleep as the sync mechanism.
    expect(code).not.toMatch(/waitForTimeout\(|setTimeout\(/);
    // Never reloads to fake a realtime update.
    expect(code).not.toMatch(/\.reload\(/);
    // Uses the approved status-change UI path.
    expect(code).toMatch(/task-status-select/);
    expect(code).toMatch(/task-form-submit/);
  });
});
