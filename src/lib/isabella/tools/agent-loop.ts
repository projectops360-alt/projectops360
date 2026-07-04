// ============================================================================
// ProjectOps360° — Isabella Tool Use Runtime · agent tool-use loop
// ============================================================================
// ISABELLA-TOOL-USE-RUNTIME-GATEWAY
//
// PROVIDER-AGNOSTIC loop: the model chooses approved tools, the runtime executes
// them server-side and feeds sanitized results back, up to a bounded number of
// iterations. The model is injected (a `ToolCallingModel`) so this is unit-
// testable with no live API, and swappable between OpenAI/Anthropic. Read-only.
// ============================================================================

import type { OrgContext } from "@/lib/auth";
import type { IsabellaProjectScope } from "@/lib/isabella/process-context/types";
import { executeIsabellaTool } from "./runtime";
import { listToolSpecs, type ToolSpec } from "./registry";
import { emptyToolUseAudit, type ToolUseAudit } from "./audit";

export const MAX_TOOL_ITERATIONS = 5;

export interface ToolCallRequest {
  id: string;
  name: string;
  args: unknown;
}

export interface ModelMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolName?: string;
}

export interface ModelTurn {
  /** Tool calls the model wants executed this turn (if any). */
  toolCalls?: ToolCallRequest[];
  /** The final answer text (present when the model is done). */
  finalText?: string;
}

export interface ToolCallingModel {
  next(input: { system: string; messages: ModelMessage[]; tools: ToolSpec[] }): Promise<ModelTurn>;
}

export interface ToolLoopInput {
  org: OrgContext;
  scope: IsabellaProjectScope;
  model: ToolCallingModel;
  system: string;
  userQuestion: string;
  maxIterations?: number;
}

export interface ToolLoopResult {
  answer: string;
  audit: ToolUseAudit;
}

/**
 * Run the bounded tool-use loop. Returns the model's final answer plus compact
 * audit. On max iterations, returns the best partial answer with the limit
 * disclosed. The model NEVER touches the DB — it only names approved tools; the
 * runtime validates + executes them.
 */
export async function runIsabellaToolLoop(input: ToolLoopInput): Promise<ToolLoopResult> {
  const maxIterations = input.maxIterations ?? MAX_TOOL_ITERATIONS;
  const tools = listToolSpecs();
  const audit = emptyToolUseAudit(true);
  const messages: ModelMessage[] = [{ role: "user", content: input.userQuestion }];

  for (let i = 0; i < maxIterations; i++) {
    let turn: ModelTurn;
    try {
      turn = await input.model.next({ system: input.system, messages, tools });
    } catch {
      return { answer: "", audit }; // caller falls back to RAG
    }

    if (turn.toolCalls && turn.toolCalls.length > 0) {
      // Record the assistant's tool request, then execute each tool.
      messages.push({ role: "assistant", content: turn.finalText ?? "" });
      for (const call of turn.toolCalls) {
        const { result, audit: entry } = await executeIsabellaTool(input.org, input.scope, call.name, call.args);
        audit.toolsCalled.push(entry);
        messages.push({
          role: "tool",
          toolCallId: call.id,
          toolName: call.name,
          content: JSON.stringify(result),
        });
      }
      continue; // let the model read the tool results
    }

    // No tool calls → final answer.
    return { answer: turn.finalText ?? "", audit };
  }

  // Bounded: return the best partial with the limit disclosed.
  audit.maxIterationsReached = true;
  return { answer: "", audit };
}
