// ============================================================================
// Phase 3 · Task 8 — MPF Living Graph UI import-boundary guards
// ============================================================================
// Protects PEG-MPF-LIVING-GRAPH-UI-CONSUMER (boundary layer): the UI consumer
// may only FORMAT engine output. It must never import detector/calculator/
// builder internals as business logic, never call an LLM/AI SDK, never write
// canonical truth (project_event_log / process_nodes / process_edges), and the
// client components must not even import the engine's runtime entry point.
// Source-level checks — if a forbidden import appears, this fails loudly.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..", "..", "..");

function src(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

/** Strip comments so documentation mentioning a forbidden name never masks (or fakes) a violation. */
function code(rel: string): string {
  return src(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s\/\/[^"'`\n]*$/gm, "");
}

const UI_FILES = [
  "src/components/milestone-flow/milestone-flow-view.tsx",
  "src/components/milestone-flow/transition-detail-panel.tsx",
  "src/components/milestone-flow/style-maps.ts",
  "src/app/[locale]/(app)/projects/[projectId]/execution-map/milestone-flow/page.tsx",
  "src/app/[locale]/(app)/projects/[projectId]/execution-map/milestone-flow/loading.tsx",
];

const CONSUMER_FILES = [
  ...UI_FILES,
  "src/lib/milestone-flow-ui/selectors.ts",
  "src/lib/milestone-flow-ui/load-projection.ts",
];

// Engine internals whose direct import would mean the UI re-runs detection /
// calculation / building instead of consuming the projection.
const ENGINE_INTERNAL_MODULES = [
  "milestone-flow/delay-detector",
  "milestone-flow/blocker-detector",
  "milestone-flow/rework-detector",
  "milestone-flow/bottleneck-detector",
  "milestone-flow/constraint-propagation-detector",
  "milestone-flow/advanced-detection",
  "milestone-flow/metrics-calculator",
  "milestone-flow/transition-builder",
  "milestone-flow/flow-segment-builder",
  "milestone-flow/transition-health-classifier",
  "milestone-flow/isabella-evidence-packet-builder",
  "milestone-flow/event-semantics",
];

const LLM_MARKERS = ["openai", "anthropic", "@ai-sdk", 'from "ai"', "from 'ai'", "GoogleGenerativeAI", "assemblyai"];

const CANONICAL_WRITE_MARKERS = [
  "process_nodes",
  "process_edges",
  "emitProjectEvent",
  "emitCompensatingEvent",
  ".insert(",
  ".update(",
  ".upsert(",
  ".delete(",
];

describe("no engine internals imported as business logic", () => {
  it.each(CONSUMER_FILES)("%s does not import detector/calculator/builder internals", (file) => {
    const code = src(file);
    for (const mod of ENGINE_INTERNAL_MODULES) {
      expect(code, `${file} must not import ${mod}`).not.toContain(`${mod}"`);
      expect(code, `${file} must not import ${mod}`).not.toContain(`${mod}'`);
    }
  });

  it("selectors import ONLY types from the engine (no runtime engine code in the display layer)", () => {
    const code = src("src/lib/milestone-flow-ui/selectors.ts");
    const engineImports = code.match(/import[^;]*from\s+["']@\/lib\/milestone-flow["']/g) ?? [];
    expect(engineImports.length).toBeGreaterThan(0);
    for (const stmt of engineImports) {
      expect(stmt, "selectors.ts may only `import type` from the engine").toMatch(/import\s+type/);
    }
  });

  it.each([
    "src/components/milestone-flow/milestone-flow-view.tsx",
    "src/components/milestone-flow/transition-detail-panel.tsx",
    "src/components/milestone-flow/style-maps.ts",
  ])("client component %s does not import the engine at all", (file) => {
    const code = src(file);
    expect(code).not.toContain('@/lib/milestone-flow"');
    expect(code).not.toContain("@/lib/milestone-flow'");
  });
});

describe("no LLM / AI API calls", () => {
  it.each(CONSUMER_FILES)("%s does not reference an LLM/AI SDK", (file) => {
    const code = src(file).toLowerCase();
    for (const marker of LLM_MARKERS) {
      expect(code, `${file} must not reference ${marker}`).not.toContain(marker.toLowerCase());
    }
  });
});

describe("no canonical truth mutation", () => {
  it.each(CONSUMER_FILES)("%s never writes canonical data or emits PEG events", (file) => {
    const body = code(file);
    for (const marker of CANONICAL_WRITE_MARKERS) {
      expect(body, `${file} must not contain ${marker}`).not.toContain(marker);
    }
  });

  it("the adapter reads project_event_log via SELECT only (append-only ledger stays untouched)", () => {
    const code = src("src/lib/milestone-flow-ui/load-projection.ts");
    expect(code).toContain('from("project_event_log")');
    expect(code).toContain(".select(");
    // The ingestion service is the ONLY writer — the adapter must not import it.
    expect(code).not.toContain("@/lib/events/ingestion");
    expect(code).not.toContain("dual-write");
  });

  it("client components touch no data source directly (no supabase import)", () => {
    for (const file of [
      "src/components/milestone-flow/milestone-flow-view.tsx",
      "src/components/milestone-flow/transition-detail-panel.tsx",
    ]) {
      const code = src(file);
      expect(code, `${file} must not import supabase`).not.toContain("@/lib/supabase");
    }
  });
});
