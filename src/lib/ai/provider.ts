import OpenAI from "openai";
import { env } from "@/lib/env";

// ── Provider Interface ─────────────────────────────────────────────────────────

export interface AiGenerateOptions {
  /** Model ID to use (e.g. "gpt-4o-mini"). Falls back to the provider default. */
  model?: string;
  /** Request JSON-mode output. Default true. */
  jsonMode?: boolean;
  /** Sampling temperature 0–2. Default 0.2 for deterministic extraction tasks. */
  temperature?: number;
  /** Max tokens for the completion. Default 2048. */
  maxTokens?: number;
}

export interface AiGenerateResult {
  /** Raw text content from the model. */
  content: string;
  /** Parsed JSON if jsonMode was true and output was valid JSON. */
  parsedJson: Record<string, unknown> | null;
  /** Token counts reported by the API. */
  usage: { tokensIn: number; tokensOut: number };
  /** Model ID that was actually used. */
  model: string;
  /** End-to-end latency in ms. */
  latencyMs: number;
}

export interface AiProvider {
  /** Unique identifier for this provider (e.g. "openai"). */
  readonly name: string;

  /** Send a chat completion request and return a structured result. */
  generate(
    systemPrompt: string,
    userPrompt: string,
    options?: AiGenerateOptions,
  ): Promise<AiGenerateResult>;

  /** Estimate cost in USD for the given token counts and model. Null if unknown. */
  estimateCost(tokensIn: number, tokensOut: number, model: string): number | null;
}

// ── OpenAI Cost Table ──────────────────────────────────────────────────────────

/** Cost per 1K tokens (input/output). Update when pricing changes. */
const OPENAI_COSTS: Record<
  string,
  { inputPer1K: number; outputPer1K: number }
> = {
  "gpt-4o-mini": { inputPer1K: 0.00015, outputPer1K: 0.0006 },
  "gpt-4o": { inputPer1K: 0.0025, outputPer1K: 0.01 },
  "gpt-4.1-mini": { inputPer1K: 0.0004, outputPer1K: 0.0016 },
  "gpt-4.1": { inputPer1K: 0.002, outputPer1K: 0.008 },
};

const DEFAULT_MODEL = "gpt-4o-mini";

// ── OpenAI Provider ────────────────────────────────────────────────────────────

export class OpenAiProvider implements AiProvider {
  readonly name = "openai";
  private client: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey ?? env.OPENAI_API_KEY;
    if (!key) {
      throw new Error(
        "OPENAI_API_KEY is not configured. Add it to .env.local (server-side only).",
      );
    }
    this.client = new OpenAI({ apiKey: key });
  }

  async generate(
    systemPrompt: string,
    userPrompt: string,
    options?: AiGenerateOptions,
  ): Promise<AiGenerateResult> {
    const model = options?.model ?? DEFAULT_MODEL;
    const temperature = options?.temperature ?? 0.2;
    const maxTokens = options?.maxTokens ?? 2048;
    const jsonMode = options?.jsonMode ?? true;

    const start = Date.now();

    const response = await this.client.chat.completions.create({
      model,
      temperature,
      max_tokens: maxTokens,
      response_format: jsonMode ? { type: "json_object" } : undefined,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const latencyMs = Date.now() - start;
    const content = response.choices[0]?.message?.content ?? "";
    const tokensIn = response.usage?.prompt_tokens ?? 0;
    const tokensOut = response.usage?.completion_tokens ?? 0;

    let parsedJson: Record<string, unknown> | null = null;
    if (jsonMode && content) {
      try {
        parsedJson = JSON.parse(content);
      } catch {
        parsedJson = null;
      }
    }

    return {
      content,
      parsedJson,
      usage: { tokensIn, tokensOut },
      model: response.model ?? model,
      latencyMs,
    };
  }

  estimateCost(tokensIn: number, tokensOut: number, model: string): number | null {
    const costs = OPENAI_COSTS[model];
    if (!costs) return null;
    return (
      (tokensIn / 1000) * costs.inputPer1K +
      (tokensOut / 1000) * costs.outputPer1K
    );
  }
}