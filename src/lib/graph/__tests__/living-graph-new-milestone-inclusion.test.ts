// ============================================================================
// Bug guard — LIVING-GRAPH-NEW-MILESTONE-AUTO-INCLUSION
// ============================================================================
// A milestone (or task) that exists in Roadmap/Tasks MUST exist in the Living
// Graph / Project Execution Map. The classic graph derives its milestone/task
// nodes exclusively from process_nodes (source_entity_type in
// ('milestones','roadmap_tasks'), node_type in ('milestone_gate',
// 'task_transition')). Root cause of the bug: createMilestoneAction /
// createTaskAction persisted the entity but never emitted its process_node, so a
// newly created milestone was invisible in the graph (and its direct tasks did
// not appear on expansion). This guard protects:
//   • both create actions emit the node via the APPROVED emit-event path,
//     awaited BEFORE revalidate (deterministic, appears on next render);
//   • a new milestone flips the auto-refresh signature → cross-browser inclusion
//     without a manual refresh;
//   • milestone nodes are default-visible (appear with 0 tasks, no flow edge,
//     planned/P2 — never hidden for those reasons) while evidence/events stay
//     hidden by default;
//   • the idempotent backfill migration exists and never updates/deletes
//     process_nodes or mutates canonical truth / project_event_log.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeGraphSignature } from "@/lib/living-graph-realtime-ui";
import { resolveNodeVisibility } from "@/lib/living-graph/realtime/delta-builder";

const roadmapActions = readFileSync(
  join(process.cwd(), "src/app/[locale]/(app)/projects/[projectId]/roadmap/actions.ts"),
  "utf8",
);
const backfill = readFileSync(
  join(process.cwd(), "supabase/migrations/20260835000000_backfill_milestone_task_process_nodes.sql"),
  "utf8",
);

// ── 1. Create actions materialize the graph node via the approved path ────────
describe("milestone/task creation emits a Living Graph node", () => {
  it("createMilestoneAction emits a milestone_gate node for 'milestones' before revalidate", () => {
    const start = roadmapActions.indexOf("createMilestoneAction");
    const end = roadmapActions.indexOf("updateMilestoneAction");
    const body = roadmapActions.slice(start, end);
    expect(body).toMatch(/emitProcessNode\(/);
    expect(body).toMatch(/nodeType:\s*["']milestone_gate["']/);
    expect(body).toMatch(/sourceEntityType:\s*["']milestones["']/);
    // The emit must precede revalidate so the node exists on the next render.
    expect(body.indexOf("emitProcessNode(")).toBeLessThan(body.indexOf("revalidatePath("));
  });

  it("createTaskAction emits a task_transition node for 'roadmap_tasks' before revalidate", () => {
    const start = roadmapActions.indexOf("export async function createTaskAction");
    const rest = roadmapActions.slice(start);
    const end = start + rest.indexOf("return { taskId:");
    const body = roadmapActions.slice(start, end);
    expect(body).toMatch(/emitProcessNode\(/);
    expect(body).toMatch(/nodeType:\s*["']task_transition["']/);
    expect(body).toMatch(/sourceEntityType:\s*["']roadmap_tasks["']/);
    expect(body.indexOf("emitProcessNode(")).toBeLessThan(body.indexOf("revalidatePath("));
  });
});

// ── 2. New milestone flips the cross-browser auto-refresh signature ───────────
describe("new milestone is picked up by the auto-refresh signature", () => {
  it("adding a milestone changes computeGraphSignature (→ cross-browser refresh)", () => {
    const before = computeGraphSignature(
      [{ id: "m1", token: "planned" }],
      [{ id: "t1", token: "todo" }],
      [],
    );
    const after = computeGraphSignature(
      [
        { id: "m1", token: "planned" },
        { id: "m2", token: "planned" }, // the newly created milestone
      ],
      [{ id: "t1", token: "todo" }],
      [],
    );
    expect(after).not.toBe(before);
    expect(after).toContain("m2:planned");
  });

  it("a milestone with 0 tasks still appears in the signature", () => {
    const sig = computeGraphSignature([{ id: "m-empty", token: "planned" }], [], []);
    expect(sig).toContain("m-empty:planned");
  });
});

// ── 3. Milestone nodes are default-visible; evidence stays hidden ─────────────
describe("milestone visibility gate", () => {
  it("milestone nodes are default-visible (0 tasks / no flow edge / planned all still show)", () => {
    expect(resolveNodeVisibility("milestone")).toBe("default_visible");
  });

  it("evidence/event nodes remain hidden by default", () => {
    expect(resolveNodeVisibility("evidence")).toBe("visible_in_evidence_overlay");
    expect(resolveNodeVisibility("event")).toBe("visible_in_evidence_overlay");
  });
});

// ── 4. Backfill migration is idempotent and non-destructive ──────────────────
describe("backfill migration safety", () => {
  it("backfills both milestone_gate and task_transition nodes", () => {
    expect(backfill).toMatch(/milestone_gate/);
    expect(backfill).toMatch(/task_transition/);
  });

  it("is idempotent (NOT EXISTS guard) and skips soft-deleted entities", () => {
    expect(backfill.toLowerCase()).toMatch(/not exists/);
    expect(backfill).toMatch(/deleted_at is null/);
  });

  it("never updates/deletes process_nodes and never mutates canonical truth or the event log", () => {
    // Assert on the executable SQL only — the banner legitimately names the
    // tables it promises not to touch.
    const sql = backfill
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(sql).not.toMatch(/update\s+public\.process_nodes|delete\s+from\s+public\.process_nodes/i);
    expect(sql).not.toMatch(/update\s+public\.milestones|update\s+public\.roadmap_tasks/i);
    expect(sql).not.toMatch(/delete\s+from\s+public\.milestones|delete\s+from\s+public\.roadmap_tasks/i);
    expect(sql).not.toMatch(/project_event_log/i);
    // Only INSERT ... SELECT into process_nodes.
    expect(sql).toMatch(/insert into public\.process_nodes/i);
  });
});
