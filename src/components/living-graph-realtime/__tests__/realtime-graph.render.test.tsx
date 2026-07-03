// ============================================================================
// LIVING-GRAPH-HIGH-FIDELITY-REALTIME-VISUALIZATION — component render guards
// ============================================================================
// Protects the realtime UI components: node renderers per kind (text+icon,
// change pulse, subtask affordance), the sync-status bar (honest freshness),
// the node inspector (owner/team context), and the import boundary (the UI
// never imports Supabase/raw events). Rendered with react-dom/server; React
// Flow handles mocked.
// ============================================================================

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../../../messages/en.json";
import esMessages from "../../../../messages/es.json";
import type { RealtimeGraphNode, RealtimeSyncState } from "@/lib/living-graph-realtime-ui";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

import { MilestoneNode, TaskNode, SubtaskNode, EvidenceNode, realtimeNodeType } from "../realtime-graph-nodes";
import { RealtimeSyncBar } from "../realtime-sync-bar";
import { RealtimeNodeInspector } from "../realtime-node-inspector";

function render(node: React.ReactElement, locale: "en" | "es" = "en"): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "es" ? esMessages : enMessages}>
      {node}
    </NextIntlClientProvider>,
  );
}

function gnode(overrides: Partial<RealtimeGraphNode> = {}): RealtimeGraphNode {
  return {
    nodeId: "task:t1",
    nodeKind: "task",
    visibility: "default_visible",
    parentId: "milestone:m1",
    parentKind: "milestone",
    milestoneId: "m1",
    taskId: "task:t1",
    hierarchyPath: ["milestone:m1", "task:t1"],
    evidenceAvailable: false,
    directChildCount: 3,
    hasDescendants: true,
    payload: { title: "Build QA pipeline", status: "in_progress", progress: 40 },
    changeState: "stable",
    changedAtVersion: 1,
    updatedAt: "2026-07-03T00:00:00.000Z",
    ...overrides,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function nodeProps(node: RealtimeGraphNode, extra: Record<string, unknown> = {}): any {
  return { data: { node, ownerName: "Ana PM", expanded: false, isCurrentVersion: false, ...extra } };
}

describe("realtime node renderers", () => {
  it("task node shows title, status, owner, and a subtask expand affordance", () => {
    const html = render(<TaskNode {...nodeProps(gnode())} />);
    expect(html).toContain("Build QA pipeline");
    expect(html).toContain("Ana PM");
    expect(html).toContain('data-testid="rt-node-task"');
    expect(html).toContain('data-testid="rt-node-expand"'); // has subtasks
    expect(html).toContain("3 subtasks");
  });

  it("milestone/subtask/evidence nodes render with distinct kinds", () => {
    expect(render(<MilestoneNode {...nodeProps(gnode({ nodeKind: "milestone", payload: { title: "Phase 1" } }))} />)).toContain('data-testid="rt-node-milestone"');
    expect(render(<SubtaskNode {...nodeProps(gnode({ nodeKind: "subtask", directChildCount: 0, payload: { title: "Sub A" } }))} />)).toContain('data-testid="rt-node-subtask"');
    const ev = render(<EvidenceNode {...nodeProps(gnode({ nodeKind: "evidence", payload: { title: "Doc" } }))} />);
    expect(ev).toContain('data-testid="rt-node-evidence"');
    expect(ev).toContain("Evidence");
  });

  it("a recently-changed current node pulses (ring)", () => {
    const html = render(<TaskNode {...nodeProps(gnode({ changeState: "added" }), { isCurrentVersion: true })} />);
    expect(html).toMatch(/ring-2/);
    expect(html).toContain("animate-pulse");
  });

  it("realtimeNodeType maps kinds to registered types with a task fallback", () => {
    expect(realtimeNodeType("milestone")).toBe("milestone");
    expect(realtimeNodeType("subtask")).toBe("subtask");
    expect(realtimeNodeType("mystery")).toBe("task");
  });
});

describe("realtime sync bar", () => {
  function state(o: Partial<RealtimeSyncState> = {}): RealtimeSyncState {
    return { freshness: "live", version: 3, needsFullResync: false, recovering: false, unauthorized: false, lastSyncedAt: "2026-07-03T12:00:05.000Z", reason: "x", ...o };
  }
  it("shows live freshness + version", () => {
    const html = render(<RealtimeSyncBar state={state()} />);
    expect(html).toContain('data-freshness="live"');
    expect(html).toContain("Live");
    expect(html).toContain("v3");
  });
  it("shows resync-required honestly", () => {
    const html = render(<RealtimeSyncBar state={state({ freshness: "resync_required" })} />);
    expect(html).toContain('data-freshness="resync_required"');
    expect(html).toContain("Resync required");
  });
});

describe("realtime node inspector", () => {
  it("renders node details + owner + team access", () => {
    const html = render(
      <RealtimeNodeInspector node={gnode({ evidenceAvailable: true })} ownerName="Ana PM" onClose={() => {}} onOpenTeam={() => {}} />,
    );
    expect(html).toContain('data-testid="rt-inspector"');
    expect(html).toContain("Build QA pipeline");
    expect(html).toContain("Ana PM");
    expect(html).toContain('data-testid="rt-open-team"');
    expect(html).toContain("Available"); // evidence available
  });
  it("renders nothing when no node is selected", () => {
    expect(render(<RealtimeNodeInspector node={null} ownerName={null} onClose={() => {}} />)).toBe("");
  });
  it("renders in Spanish without Spanglish (UX-012)", () => {
    const html = render(<RealtimeNodeInspector node={gnode()} ownerName="Ana PM" onClose={() => {}} />, "es");
    expect(html).toContain("Detalles del nodo");
    expect(html).toContain("Responsable");
  });
});

describe("import boundary — UI never consumes raw events / DB", () => {
  it("realtime components never import Supabase or the event write path", () => {
    const dir = join(process.cwd(), "src/components/living-graph-realtime");
    for (const f of ["realtime-living-graph.tsx", "realtime-graph-nodes.tsx", "realtime-sync-bar.tsx", "realtime-node-inspector.tsx"]) {
      const src = readFileSync(join(dir, f), "utf8");
      const code = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
      expect(code).not.toMatch(/@\/lib\/supabase|createClient|createAdminClient/i);
      expect(code).not.toMatch(/project_event_log|process_nodes|process_edges/);
      expect(code).not.toMatch(/@\/lib\/events\/|postgres_changes/);
      // The UI consumes the load-snapshot loader only on the server page, never
      // in a client component.
      expect(code).not.toMatch(/load-snapshot/);
    }
  });
});
