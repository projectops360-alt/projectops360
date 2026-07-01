import { describe, it, expect } from "vitest";
import {
  TASK_EDITOR_INTERNAL_AI_FIELDS,
  isInternalAiTaskField,
  isForbiddenTaskEditorLabel,
  UX_014_TASK_EDITOR_AI_PROMPT,
  PRODUCT_UX_CONTRACTS,
} from "../contracts";

// ── UX-014 — Internal AI Prompt Metadata Must Not Be User-Facing ─────────────
describe("UX-014 contract", () => {
  it("flags the three internal AI task fields", () => {
    expect(TASK_EDITOR_INTERNAL_AI_FIELDS).toEqual(["prompt_body", "prompt_context", "ai_tool_target"]);
    expect(isInternalAiTaskField("prompt_body")).toBe(true);
    expect(isInternalAiTaskField("prompt_context")).toBe(true);
    expect(isInternalAiTaskField("ai_tool_target")).toBe(true);
  });

  it("does NOT flag legitimate user-facing fields", () => {
    for (const ok of [
      "title",
      "description",
      "acceptance_criteria",
      "implementation_notes",
      "test_notes",
      "status",
      "priority",
      "start_date",
      "assigned_to",
    ]) {
      expect(isInternalAiTaskField(ok)).toBe(false);
    }
  });

  it("rejects forbidden user-facing labels in both languages", () => {
    expect(isForbiddenTaskEditorLabel("AI Prompt")).toBe(true);
    expect(isForbiddenTaskEditorLabel("Prompt de IA")).toBe(true);
    expect(isForbiddenTaskEditorLabel("  prompt de ia  ")).toBe(true);
    expect(isForbiddenTaskEditorLabel("Developer Prompt")).toBe(true);
    expect(isForbiddenTaskEditorLabel("System Prompt")).toBe(true);
  });

  it("allows clear notes labels", () => {
    for (const ok of [
      "Implementation Notes",
      "Notas de implementación y pruebas",
      "Testing Notes",
      "Acceptance Criteria",
      "Tracking & Notes",
      "Ask Isabella about this task",
    ]) {
      expect(isForbiddenTaskEditorLabel(ok)).toBe(false);
    }
  });

  it("is registered as an APPROVED product UX contract", () => {
    expect(UX_014_TASK_EDITOR_AI_PROMPT.status).toBe("APPROVED");
    expect(PRODUCT_UX_CONTRACTS.map((c) => c.id)).toContain("UX-014");
  });
});
