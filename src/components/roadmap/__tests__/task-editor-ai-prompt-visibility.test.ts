import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// UX-014 / PD-013 (amended) — the task editor exposes internal AI prompt
// metadata ONLY through a scoped "AI Execution" section, shown for AI-oriented
// project types (software_development / ai_native_execution). For every other
// project type the fields stay hidden and stored values are preserved on save.
// These are source-level guards: they fail if the fields become ungated again,
// if the generic "Prompt de IA / AI Prompt" labels reappear, or if the
// preserve-on-absent write is removed from the update action.
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

describe("UX-014 (amended) — AI Execution fields are gated to AI project types", () => {
  it("only renders the prompt fields inside the scoped AI-project-type gate", () => {
    // The fields exist (the scoped exception) …
    expect(formSrc).toContain('name="prompt_body"');
    expect(formSrc).toContain('name="prompt_context"');
    expect(formSrc).toContain('name="ai_tool_target"');
    // … but only behind the project-type flag.
    expect(formSrc).toContain("AI_EXECUTION_PROJECT_TYPES");
    expect(formSrc).toContain("ai_native_execution");
    expect(formSrc).toContain("software_development");
    expect(formSrc).toContain("const showAiExecution =");
    expect(formSrc).toContain("{showAiExecution && (");
  });

  it("does not reuse the generic AI-prompt label keys", () => {
    expect(formSrc).not.toContain("t.fields.promptSection");
    expect(formSrc).not.toContain("t.fields.promptBody");
    expect(formSrc).not.toContain("t.fields.promptContext");
    expect(formSrc).not.toContain("t.fields.aiToolTarget");
  });

  it("collects the prompt fields conditionally (preserve-on-absent for other types)", () => {
    expect(formSrc).toContain("const aiExec = showAiExecution");
    expect(formSrc).toContain("...(aiExec ?? {})");
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
      'prompt_body: z.string().max(500000, "promptTooLong").transform((s) => s.trim()).optional(),',
    );
    expect(actionSrc).toContain(
      'ai_tool_target: z.string().max(100, "aiToolTooLong").transform((s) => s.trim()).optional(),',
    );
  });
});
