// ============================================================================
// ProjectOps360° — Isabella Tool Use Runtime · compact audit metadata
// ============================================================================
// ISABELLA-TOOL-USE-RUNTIME-GATEWAY
//
// Compact, non-sensitive tool metadata for ai_runs. NEVER stores full/large/
// sensitive result payloads — only summaries (arg keys redacted, row counts,
// status, timing). Pure.
// ============================================================================

import type { ToolResult } from "./serializers";

export type ToolAuditStatus = ToolResult["status"] | "unknown_tool" | "error";

export interface ToolAuditEntry {
  name: string;
  argsSummary: Record<string, unknown>;
  rowCount: number;
  truncated: boolean;
  executionMs: number;
  status: ToolAuditStatus;
}

export interface ToolUseAudit {
  toolUseEnabled: boolean;
  toolsCalled: ToolAuditEntry[];
  maxIterationsReached: boolean;
}

/** Redact args to a compact, non-sensitive summary (no long free text / raw ids). */
export function summarizeArgs(name: string, args: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (args && typeof args === "object") {
    for (const [k, v] of Object.entries(args as Record<string, unknown>)) {
      if (k === "project_id") out[k] = v ? "provided" : "current_project";
      else if (typeof v === "string") out[k] = v.length > 24 ? `${v.slice(0, 24)}…` : v;
      else if (Array.isArray(v)) out[k] = `[${v.length}]`;
      else out[k] = v; // booleans / numbers / null
    }
  }
  return out;
}

export function emptyToolUseAudit(enabled: boolean): ToolUseAudit {
  return { toolUseEnabled: enabled, toolsCalled: [], maxIterationsReached: false };
}
