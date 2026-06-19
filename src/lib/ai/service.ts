import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "@/lib/auth";
import type { AiPromptType, AiRunStatus, AiSourceType } from "@/types/database";
import { OpenAiProvider } from "./provider";
import type { AiProvider, AiGenerateOptions, AiGenerateResult } from "./provider";
import { getPromptTemplate, renderTemplate } from "./prompts";

// ── Input / Output Types ─────────────────────────────────────────────────────────

export interface RunAiInput {
  /** Which prompt template to use. */
  promptType: AiPromptType;
  /** Variables to fill into the template's userPromptTemplate. */
  templateVars: Record<string, string>;
  /** Override the template's default model (optional). */
  model?: string;
  /** Override temperature (optional, default 0.2). */
  temperature?: number;
  /** Link this run to a source entity (optional). */
  sourceType?: AiSourceType;
  sourceId?: string;
}

export interface RunAiResult {
  /** The ai_runs row ID for traceability. */
  runId: string;
  /** Final status of the run. */
  status: AiRunStatus;
  /** Raw text content from the model (may be a JSON string). */
  content: string;
  /** Parsed JSON output if jsonMode succeeded, null otherwise. */
  parsedJson: Record<string, unknown> | null;
  /** Token usage from the provider. */
  tokensIn: number;
  tokensOut: number;
  /** Estimated cost in USD. */
  costUsd: number | null;
  /** End-to-end latency in ms. */
  latencyMs: number;
  /** Model that was actually used. */
  model: string;
  /** Error message if status is "failed". */
  errorMessage: string | null;
}

// ── Provider Singleton ────────────────────────────────────────────────────────────

let _provider: AiProvider | null = null;

/**
 * Get or create the default AI provider.
 * Lazy-initialized so the OpenAI SDK is only loaded when first needed.
 */
function getProvider(): AiProvider {
  if (!_provider) {
    _provider = new OpenAiProvider();
  }
  return _provider;
}

/**
 * Replace the provider (useful for testing or future multi-provider routing).
 */
export function setProvider(provider: AiProvider): void {
  _provider = provider;
}

// ── Main Service Function ─────────────────────────────────────────────────────────

/**
 * Run an AI prompt through the provider, logging the full lifecycle to ai_runs.
 *
 * Flow:
 *   1. Resolve the prompt template
 *   2. Insert a "pending" ai_runs row (service role, bypasses RLS)
 *   3. Call the AI provider
 *   4. Update ai_runs to "completed" or "failed"
 *   5. Return structured result (never auto-saves to business tables)
 *
 * @throws Never — errors are captured in the result and logged to ai_runs.
 */
export async function runAi(
  orgContext: OrgContext,
  input: RunAiInput,
): Promise<RunAiResult> {
  const provider = getProvider();
  const template = getPromptTemplate(input.promptType);

  // ── Step 1: Build prompts ────────────────────────────────────────────────
  const systemPrompt = template.systemPrompt;
  let userPrompt = renderTemplate(template.userPromptTemplate, input.templateVars);
  // Locale enforcement: when the caller passes a `language` var, force the model
  // to write ALL output in the UI language regardless of the source content's
  // language. (Custom prompts embed their own language instruction and don't
  // pass `language`, so this never double-applies to them.)
  const language = input.templateVars.language;
  if (language) {
    userPrompt += `\n\nIMPORTANT: Regardless of the language of the input content above, write ALL output text fields (summaries, titles, descriptions, recommendations, etc.) in ${language}.`;
  }
  const model = input.model ?? template.defaultModel;

  const inputSnapshot: Record<string, unknown> = {
    promptType: input.promptType,
    templateVars: input.templateVars,
    sourceType: input.sourceType ?? null,
    sourceId: input.sourceId ?? null,
  };

  // ── Step 2: Insert "pending" row ──────────────────────────────────────────
  const supabase = createAdminClient();

  const { data: runRow, error: insertError } = await supabase
    .from("ai_runs")
    .insert({
      organization_id: orgContext.organizationId,
      user_id: orgContext.userId,
      model,
      prompt_type: input.promptType,
      input_snapshot: inputSnapshot,
      status: "pending",
      source_type: input.sourceType ?? null,
      source_id: input.sourceId ?? null,
    })
    .select("id")
    .single();

  if (insertError || !runRow) {
    return {
      runId: "",
      status: "failed",
      content: "",
      parsedJson: null,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: null,
      latencyMs: 0,
      model,
      errorMessage: `Failed to create ai_runs row: ${insertError?.message ?? "unknown error"}`,
    };
  }

  const runId: string = runRow.id;

  // ── Step 3: Call the provider ─────────────────────────────────────────────
  const options: AiGenerateOptions = {
    model,
    jsonMode: template.requiresJson,
    temperature: input.temperature ?? 0.2,
  };

  let result: AiGenerateResult;
  let status: AiRunStatus = "completed";
  let errorMessage: string | null = null;

  try {
    result = await provider.generate(systemPrompt, userPrompt, options);
  } catch (err: unknown) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : String(err);
    result = {
      content: "",
      parsedJson: null,
      usage: { tokensIn: 0, tokensOut: 0 },
      model,
      latencyMs: 0,
    };
  }

  // ── Step 4: Compute cost ──────────────────────────────────────────────────
  const costUsd =
    status === "completed"
      ? provider.estimateCost(
          result.usage.tokensIn,
          result.usage.tokensOut,
          result.model,
        )
      : null;

  // ── Step 5: Update ai_runs ────────────────────────────────────────────────
  await supabase
    .from("ai_runs")
    .update({
      status,
      output_snapshot: result.parsedJson ?? { raw: result.content },
      tokens_in: result.usage.tokensIn || null,
      tokens_out: result.usage.tokensOut || null,
      cost_usd: costUsd,
      latency_ms: result.latencyMs || null,
      error_message: errorMessage,
    })
    .eq("id", runId);

  // ── Step 6: Return structured result ─────────────────────────────────────
  return {
    runId,
    status,
    content: result.content,
    parsedJson: result.parsedJson,
    tokensIn: result.usage.tokensIn,
    tokensOut: result.usage.tokensOut,
    costUsd,
    latencyMs: result.latencyMs,
    model: result.model,
    errorMessage,
  };
}