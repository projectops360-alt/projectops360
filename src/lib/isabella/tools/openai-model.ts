// ============================================================================
// ProjectOps360° — Isabella Tool Use Runtime · OpenAI tool-calling adapter
// ============================================================================
// ISABELLA-TOOL-USE-RUNTIME-GATEWAY
//
// A `ToolCallingModel` backed by OpenAI function-calling — the DEFAULT model for
// the tool loop. Provider-agnostic by design: swap for an Anthropic adapter
// without touching the loop. Server-only; used only when the flag is enabled and
// a key is configured. The model only NAMES approved tools + typed args; the
// runtime validates + executes them.
// ============================================================================

import OpenAI from "openai";
import { env } from "@/lib/env";
import type { ModelTurn, ToolCallingModel } from "./agent-loop";
import type { ToolSpec } from "./registry";

const DEFAULT_TOOL_MODEL = "gpt-4o-mini";

/** Create the default OpenAI-backed tool model, or null when no key is set. */
export function createOpenAiToolModel(model = DEFAULT_TOOL_MODEL): ToolCallingModel | null {
  const key = env.OPENAI_API_KEY;
  if (!key) return null;
  const client = new OpenAI({ apiKey: key });

  return {
    async next({ system, messages, tools }): Promise<ModelTurn> {
      const oaiTools = tools.map((t: ToolSpec) => ({
        type: "function" as const,
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oaiMessages: any[] = [{ role: "system", content: system }];
      for (const m of messages) {
        if (m.role === "tool") {
          oaiMessages.push({ role: "tool", tool_call_id: m.toolCallId, content: m.content });
        } else {
          oaiMessages.push({ role: m.role, content: m.content });
        }
      }

      const res = await client.chat.completions.create({
        model,
        temperature: 0.2,
        max_tokens: 1024,
        messages: oaiMessages,
        tools: oaiTools,
      });

      const choice = res.choices[0]?.message;
      const calls = choice?.tool_calls ?? [];
      if (calls.length > 0) {
        return {
          toolCalls: calls.map((c) => ({
            id: c.id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            name: (c as any).function?.name ?? "",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            args: safeParse((c as any).function?.arguments),
          })),
          finalText: choice?.content ?? "",
        };
      }
      return { finalText: choice?.content ?? "" };
    },
  };
}

function safeParse(s: string | undefined): unknown {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
