// ============================================================================
// ProjectOps360° — Isabella Tool Use Runtime · single tool execution
// ============================================================================
// ISABELLA-TOOL-USE-RUNTIME-GATEWAY
//
// Validate tool name → validate args (Zod) → execute the approved executor →
// sanitized result + compact audit. Unknown tool / invalid args / execution
// errors return a SAFE tool error (no stack traces, no crash). Server-only.
// ============================================================================

import type { OrgContext } from "@/lib/auth";
import type { IsabellaProjectScope } from "@/lib/isabella/process-context/types";
import { getTool } from "./registry";
import { toolFailure, type ToolResult } from "./serializers";
import { summarizeArgs, type ToolAuditEntry } from "./audit";

export interface ToolExecution {
  result: ToolResult;
  audit: ToolAuditEntry;
}

/** Execute one approved tool safely. Never throws. */
export async function executeIsabellaTool(
  org: OrgContext,
  scope: IsabellaProjectScope,
  name: string,
  rawArgs: unknown,
): Promise<ToolExecution> {
  const start = Date.now();
  const argsSummary = summarizeArgs(name, rawArgs);

  const tool = getTool(name);
  if (!tool) {
    return {
      result: toolFailure("invalid_args", `Unknown tool: ${name}`),
      audit: { name, argsSummary, rowCount: 0, truncated: false, executionMs: Date.now() - start, status: "unknown_tool" },
    };
  }

  const parsed = tool.schema.safeParse(rawArgs);
  if (!parsed.success) {
    return {
      result: toolFailure("invalid_args", "Invalid tool arguments."),
      audit: { name, argsSummary, rowCount: 0, truncated: false, executionMs: Date.now() - start, status: "invalid_args" },
    };
  }

  try {
    const result = await tool.execute(org, scope, parsed.data);
    return {
      result,
      audit: { name, argsSummary, rowCount: result.rowCount, truncated: result.truncated, executionMs: Date.now() - start, status: result.status },
    };
  } catch {
    // Never expose a stack trace or crash the response.
    return {
      result: toolFailure("unavailable", "The tool could not complete right now."),
      audit: { name, argsSummary, rowCount: 0, truncated: false, executionMs: Date.now() - start, status: "error" },
    };
  }
}
