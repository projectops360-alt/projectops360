// ============================================================================
// ProjectOps360° — Isabella Process Intelligence Runtime · types
// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-UI-REALTIME-FINAL-INTEGRATION (Phase 5 · Task 6)
//
// Shared types for the deterministic router + the server orchestrator that wires
// the accepted Task 3/4/5 engines into Isabella's answer. Pure types (client-safe
// where re-used); reuses Task 1 citation types.
// ============================================================================

import type { IsabellaCitation } from "@/lib/isabella/process-intelligence/types";

/** Where a question is routed. `product_help` = RAG (no engine). */
export type IsabellaRoute =
  | "product_help"
  | "factual_project_data"
  | "process_mining_summary"
  // Deterministic screen/UI-label explanation (ISABELLA-SCREEN-CONTEXT-EXPLANATION).
  // Answers "explain this screen" / "what does <UI term> mean" from screen context —
  // MUST take priority over the diagnosis/root-cause/recommendation engines.
  | "screen_context_explanation"
  | "daily_diagnosis"
  | "root_cause"
  | "recommendation"
  | "mixed";

export type IsabellaRuntimeStatus =
  | "answered"
  | "needs_clarification"
  | "unauthorized"
  | "missing_context"
  | "unavailable"
  | "fallback";

/** The safe, display-safe node scope an ask can be scoped to (no coordinates). */
export interface IsabellaSelectedNode {
  id: string;
  type: "project" | "milestone" | "task" | "subtask" | "risk" | "decision" | "approval";
  title?: string;
}

export interface IsabellaScreenContext {
  module?: string;
  screen?: string;
  pathname?: string;
  tab?: string;
}

export interface IsabellaProcessIntelligenceRequest {
  question: string;
  locale?: string;
  timezone?: string;
  projectId?: string;
  organizationId?: string;
  userId?: string;
  screenContext?: IsabellaScreenContext;
  selectedNode?: IsabellaSelectedNode;
  conversationContext?: unknown;
}

export interface IsabellaProcessIntelligenceAudit {
  processIntelligenceEnabled: boolean;
  route: IsabellaRoute | "product_help";
  enginesUsed: string[];
  toolsCalled?: string[];
  resultStatus: string;
  confidence?: string;
  evidenceRefCount: number;
  citationCount: number;
  limitationsCount: number;
  selectedScope: { type: "project" | "milestone" | "task" | "subtask" | "unknown"; id: string };
  executionMs: number;
}

export interface IsabellaProcessIntelligenceResult {
  status: IsabellaRuntimeStatus;
  route: IsabellaRoute;
  answer: string;
  structuredResult?: unknown;
  evidenceRefs?: string[];
  citations?: IsabellaCitation[];
  limitations?: string[];
  audit: IsabellaProcessIntelligenceAudit;
}

export type RuntimeLanguage = "en" | "es";
