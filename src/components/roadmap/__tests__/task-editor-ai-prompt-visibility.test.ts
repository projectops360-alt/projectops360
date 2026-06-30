import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// UX-014 / PD-013 — the task editor must NOT expose internal AI prompt metadata.
// These are source-level guards: they fail if the "Prompt de IA / AI Prompt"
// field (or its inputs) reappears in the normal task editor, or if the data
// preservation (preserve-on-absent) is removed from the update action.
// ============================================================================

const root = process.cwd();
const formSrc = readFileSync(
  join(root, "src/components/roadmap/task-form-dialog.tsx"),
  "utf8",
);
const actionSrc = readFileSync(
  join(root, "src/app/[locale]/(app)/projects/[projectId]/roadmap/actions.ts"),
  "utf8",
);

describe("UX-014 — task editor does not render internal AI prompt fields", () => {
  it("renders no prompt_body / prompt_context / ai_tool_target inputs", () => {
    expect(formSrc).not.toContain('name="prompt_body"');
    expect(formSrc).not.toContain('name="prompt_context"');
    expect(formSrc).not.toContain('name="ai_tool_target"');
  });

  it("renders none of the AI-prompt labels", () => {
    expect(formSrc).not.toContain("t.fields.promptSection");
    expect(formSrc).not.toContain("t.fields.promptBody");
    expect(formSrc).not.toContain("t.fields.promptContext");
    expect(formSrc).not.toContain("t.fields.aiToolTarget");
  });

  it("does not send prompt metadata from the form to the task actions", () => {
    expect(formSrc).not.toContain("prompt_body: promptBody");
    expect(formSrc).not.toContain("prompt_context: promptContext");
    expect(formSrc).not.toContain("ai_tool_target: aiToolTarget");
  });
});

describe("UX-014 — task editor keeps normal user-facing fields", () => {
  it("still renders title, status, acceptance criteria, and notes", () => {
    expect(formSrc).toContain('name="title"');
    expect(formSrc).toContain('name="status"');
    expect(formSrc).toContain('name="acceptance_criteria"');
    expect(formSrc).toContain('name="implementation_notes"');
    expect(formSrc).toContain('name="test_notes"');
  });

  it("exposes the user-facing 'Ask Isabella about this task' action", () => {
    expect(formSrc).toContain("Ask Isabella about this task");
    expect(formSrc).toContain("askIsabella");
  });
});

describe("UX-014 — existing prompt data is preserved on save (preserve-on-absent)", () => {
  it("update action does not unconditionally null the prompt columns", () => {
    // The unconditional wipe must be gone…
    expect(actionSrc).not.toContain("prompt_body: data.prompt_body || null,\n    prompt_context");
    // …replaced by a guarded, preserve-on-absent write.
    expect(actionSrc).toContain("if (data.prompt_body !== undefined)");
    expect(actionSrc).toContain("if (data.prompt_context !== undefined)");
    expect(actionSrc).toContain("if (data.ai_tool_target !== undefined)");
  });

  it("update schema does not force-default the prompt fields to empty string", () => {
    // A `.default("")` on the update schema would turn an absent field into "",
    // which would then wipe the stored value — exactly what we must avoid.
    expect(actionSrc).toContain(
      'prompt_body: z.string().max(10000, "promptTooLong").transform((s) => s.trim()).optional(),',
    );
    expect(actionSrc).toContain(
      'ai_tool_target: z.string().max(100, "aiToolTooLong").transform((s) => s.trim()).optional(),',
    );
  });
});
