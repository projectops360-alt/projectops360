"use server";

import { getOrgContext } from "@/lib/auth";
import { runAi } from "@/lib/ai";
import type { AiPromptType, AiSourceType } from "@/types/database";
import type { RunAiResult } from "@/lib/ai";

// ── Input Validation ────────────────────────────────────────────────────────────

const VALID_PROMPT_TYPES: Set<string> = new Set([
  "summary",
  "decision_analysis",
  "action_extraction",
  "stakeholder_mapping",
  "risk_assessment",
  "custom",
]);

const VALID_SOURCE_TYPES: Set<string> = new Set([
  "decision",
  "meeting",
  "communication",
  "document",
  "action_item",
  "project",
]);

// ── Action Result Types ──────────────────────────────────────────────────────────

export type AiActionSuccess = {
  success: true;
  data: RunAiResult;
};

export type AiActionError = {
  success: false;
  error: string;
};

export type AiActionResult = AiActionSuccess | AiActionError;

// ── Server Action ─────────────────────────────────────────────────────────────────

/**
 * Server action to run an AI extraction or summary.
 *
 * This is the only entry point from the UI. It:
 *   1. Validates the user is authenticated (via getOrgContext)
 *   2. Validates input parameters
 *   3. Delegates to runAi()
 *   4. Returns a typed result for the UI to display
 *
 * The UI must then ask for human confirmation before saving any results
 * to business tables (decisions, action_items, etc.).
 */
export async function runAiAction(input: {
  promptType: string;
  templateVars: Record<string, string>;
  model?: string;
  sourceType?: string;
  sourceId?: string;
}): Promise<AiActionResult> {
  // ── Authenticate ────────────────────────────────────────────────────────
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { success: false, error: "Not authenticated" };
  }

  // ── Validate promptType ──────────────────────────────────────────────────
  if (!VALID_PROMPT_TYPES.has(input.promptType)) {
    return {
      success: false,
      error: `Invalid prompt type: ${input.promptType}`,
    };
  }

  // ── Validate sourceType ─────────────────────────────────────────────────
  if (input.sourceType && !VALID_SOURCE_TYPES.has(input.sourceType)) {
    return {
      success: false,
      error: `Invalid source type: ${input.sourceType}`,
    };
  }

  // ── Validate templateVars ────────────────────────────────────────────────
  if (
    !input.templateVars ||
    typeof input.templateVars !== "object" ||
    Object.keys(input.templateVars).length === 0
  ) {
    return {
      success: false,
      error: "templateVars must be a non-empty object",
    };
  }

  // ── Call service ─────────────────────────────────────────────────────────
  const result = await runAi(org, {
    promptType: input.promptType as AiPromptType,
    templateVars: input.templateVars,
    model: input.model,
    sourceType: input.sourceType as AiSourceType | undefined,
    sourceId: input.sourceId,
  });

  // ── Return result ────────────────────────────────────────────────────────
  // Even if the AI call failed, we return success: true so the UI can display
  // the error. We only return success: false for auth/validation errors.
  return { success: true, data: result };
}