// ============================================================================
// ProjectOps360° — Isabella Tool Use Runtime Gateway · barrel
// ============================================================================
// ISABELLA-TOOL-USE-RUNTIME-GATEWAY (Phase 5 · Task 2B)
//
// A feature-flagged (ISABELLA_TOOL_USE_ENABLED, default OFF), read-only,
// evidence-backed tool gateway. Tools WRAP the approved Generic Query Engine +
// Process Context/Evidence layers — never a second source of truth, never raw
// SQL/rows/payloads to the LLM. Rollback = unset the flag (no migration).
// ============================================================================

export { isIsabellaToolUseEnabled } from "./flag";
export * from "./schemas";
export * from "./serializers";
export * from "./audit";
export { ISABELLA_TOOLS, getTool, listToolSpecs, type IsabellaToolDef, type ToolSpec } from "./registry";
export { executeIsabellaTool, type ToolExecution } from "./runtime";
export {
  runIsabellaToolLoop,
  MAX_TOOL_ITERATIONS,
  type ToolCallingModel,
  type ModelMessage,
  type ModelTurn,
  type ToolCallRequest,
  type ToolLoopInput,
  type ToolLoopResult,
} from "./agent-loop";
export { executeQueryTasks, executeQueryProjectData, executeGetProjectSummary } from "./executors";
