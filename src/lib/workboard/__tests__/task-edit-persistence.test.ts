// ============================================================================
// WORKBOARD-TASK-EDIT-PERSISTENCE — task edit/save pipeline guards
// ============================================================================
// Protects the Workboard task editor against silent data loss and stale UI:
//   1. PRESERVE-ON-ABSENT for EVERY optional field: a field the caller did not
//      send is NOT written (stored value survives); an explicit "" clears it.
//      This is what used to wipe notes/prompts/dates/progress when a collapsed
//      form section unmounted its inputs.
//   2. actual_hours is never nulled by an edit that does not send it.
//   3. Long multi-line AI prompts (up to 500k chars) survive intact.
//   4. The form keeps collapsed sections MOUNTED (hidden), so the submitted
//      FormData always carries the full visible state.
//   5. The Workboard syncs its local task state from server props after
//      router.refresh() — saves become visible without a browser reload.
//   6. revalidatePath uses a valid route pattern (the old literal never
//      matched, so the server cache was never invalidated).
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  updateTaskSchema,
  createTaskSchema,
  buildTaskUpdatePatch,
} from "../task-schemas";

const root = process.cwd();
// Normalize line endings so multi-line source asserts work on every checkout.
const read = (rel: string) => readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");

const TASK_ID = "11111111-2222-4333-8444-555555555555";
const PROJECT_ID = "99999999-8888-4777-8666-555555555555";

const minimalUpdate = {
  taskId: TASK_ID,
  title: "My task",
  status: "in_progress",
  priority: "p1",
  projectId: PROJECT_ID,
};

// ── 1. Schema: absent stays undefined (never coerced to "") ──────────────────

describe("updateTaskSchema — preserve-on-absent semantics", () => {
  it("keeps ALL omitted optional fields undefined (no silent empty-string default)", () => {
    const data = updateTaskSchema.parse(minimalUpdate);
    for (const field of [
      "description", "sprint_name", "dependency_notes", "acceptance_criteria",
      "implementation_notes", "test_notes", "execution_notes", "blocker_reason",
      "start_date", "end_date", "progress", "estimate_hours", "actual_hours",
      "prompt_body", "prompt_context", "ai_tool_target", "milestone_id",
    ] as const) {
      expect(data[field], `${field} must stay undefined when omitted`).toBeUndefined();
    }
  });

  it("keeps an explicit empty string as the clear signal", () => {
    const data = updateTaskSchema.parse({ ...minimalUpdate, description: "", execution_notes: "" });
    expect(data.description).toBe("");
    expect(data.execution_notes).toBe("");
  });

  it("accepts a long multi-line prompt without truncation (500k limit)", () => {
    const longPrompt = ("# Prompt line with detail\n".repeat(15000)).slice(0, 400000);
    const data = updateTaskSchema.parse({ ...minimalUpdate, prompt_body: longPrompt });
    expect(data.prompt_body).toBe(longPrompt.trim());
    // Interior newlines preserved — only ends are trimmed.
    expect(data.prompt_body!.split("\n").length).toBeGreaterThan(10000);
  });

  it("rejects a prompt beyond the 500k limit with a clear error", () => {
    const result = updateTaskSchema.safeParse({ ...minimalUpdate, prompt_body: "x".repeat(500001) });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("promptTooLong");
  });

  it("createTaskSchema keeps its defaults (create has nothing to preserve)", () => {
    const data = createTaskSchema.parse({ title: "T", projectId: PROJECT_ID });
    expect(data.description).toBe("");
    expect(data.progress).toBe(0);
  });
});

// ── 2. Patch builder: only sent fields are written ────────────────────────────

describe("buildTaskUpdatePatch — only writes what the caller sent", () => {
  it("a minimal edit writes only title/status/priority (nothing else wiped)", () => {
    const patch = buildTaskUpdatePatch(updateTaskSchema.parse(minimalUpdate));
    expect(Object.keys(patch).sort()).toEqual(["priority", "status", "title"]);
  });

  it("never writes actual_hours unless explicitly provided", () => {
    const without = buildTaskUpdatePatch(updateTaskSchema.parse(minimalUpdate));
    expect("actual_hours" in without).toBe(false);
    const withHours = buildTaskUpdatePatch(updateTaskSchema.parse({ ...minimalUpdate, actual_hours: 12.5 }));
    expect(withHours.actual_hours).toBe(12.5);
  });

  it("writes a full edit completely (details, notes, dates, progress, prompt)", () => {
    const patch = buildTaskUpdatePatch(
      updateTaskSchema.parse({
        ...minimalUpdate,
        description: "Long detail\nwith lines",
        acceptance_criteria: "AC",
        implementation_notes: "impl",
        test_notes: "tests",
        execution_notes: "exec",
        start_date: "2026-07-01",
        end_date: "2026-07-15",
        progress: 40,
        prompt_body: "line 1\nline 2\nline 3",
      }),
    );
    expect(patch.description).toBe("Long detail\nwith lines");
    expect(patch.progress).toBe(40);
    expect(patch.prompt_body).toBe("line 1\nline 2\nline 3");
    expect(patch.start_date).toBe("2026-07-01");
  });

  it("explicit empty string clears the column (null), absence preserves it", () => {
    const cleared = buildTaskUpdatePatch(updateTaskSchema.parse({ ...minimalUpdate, description: "" }));
    expect(cleared.description).toBeNull();
    const preserved = buildTaskUpdatePatch(updateTaskSchema.parse(minimalUpdate));
    expect("description" in preserved).toBe(false);
  });

  it("progress 0 is a real write, not a dropped falsy value", () => {
    const patch = buildTaskUpdatePatch(updateTaskSchema.parse({ ...minimalUpdate, progress: 0 }));
    expect(patch.progress).toBe(0);
  });

  it("milestone_id null (No milestone) writes null; omitted preserves", () => {
    const explicit = buildTaskUpdatePatch(updateTaskSchema.parse({ ...minimalUpdate, milestone_id: null }));
    expect(explicit.milestone_id).toBeNull();
    const omitted = buildTaskUpdatePatch(updateTaskSchema.parse(minimalUpdate));
    expect("milestone_id" in omitted).toBe(false);
  });
});

// ── 3. Source guards: form, board refresh, action wiring ─────────────────────

describe("task editor form — collapsed sections keep their fields mounted", () => {
  const formSrc = read("src/components/roadmap/task-form-dialog.tsx");

  it("FormSection hides collapsed content with CSS instead of unmounting it", () => {
    expect(formSrc).toContain('className={open ? "space-y-4 border-t border-border px-3 pb-4 pt-3" : "hidden"}');
    expect(formSrc).not.toContain("{open && (");
  });

  it("submits with presence-aware reads (absent field ⇒ not sent ⇒ preserved)", () => {
    expect(formSrc).toContain("const readStr = (name: string): string | undefined");
    expect(formSrc).toContain("return v == null ? undefined : (v as string);");
    // The old pattern coerced unmounted prompt fields to "" (which wiped them).
    expect(formSrc).not.toContain('?.trim() ?? ""');
  });
});

describe("update action — generalized preserve-on-absent + valid revalidation", () => {
  const actionSrc = read("src/app/[locale]/(app)/projects/[projectId]/roadmap/actions.ts");

  it("delegates column writes to the unit-tested patch builder", () => {
    expect(actionSrc).toContain("buildTaskUpdatePatch(data)");
    // The unconditional full-overwrite UPDATE block must not come back (the
    // CREATE insert legitimately maps every field — there is nothing to wipe).
    expect(actionSrc).not.toContain(
      "description: data.description || null,\n    milestone_id: data.milestone_id ?? null,",
    );
  });

  it("revalidates with a real route pattern (the old literal never matched)", () => {
    expect(actionSrc).toContain('revalidatePath("/[locale]/(app)/projects/[projectId]", "layout")');
    expect(actionSrc).not.toContain("revalidatePath(`/(app)/projects/");
  });
});

describe("workboard — saved edits become visible without a browser reload", () => {
  const boardSrc = read("src/app/[locale]/(app)/projects/[projectId]/workboard/workboard-client.tsx");

  it("syncs local task state from fresh server props after router.refresh()", () => {
    expect(boardSrc).toContain("setTasks(initialTasks);");
    expect(boardSrc).toContain("}, [initialTasks]);");
  });

  it("still refreshes the router when the edit dialog saves", () => {
    expect(boardSrc).toContain("onSaved={() => { setEditingTask(null); router.refresh(); }}");
  });
});
