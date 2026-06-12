/**
 * Process Intelligence types for ProjectOps360°
 *
 * These types are populated incrementally across Sprint 12 tasks:
 * - PI-001: Living Graph data model (tables + types)
 * - PI-003: Event ingestion pipeline (emit-event.ts)
 * - PI-004: Graph traversal RPC result types
 * - PI-006: ProcessInsight, ProcessPattern, ProcessDeviation, ProcessNarrative,
 *           InterpretationRequest/Response + engine interfaces (done)
 * - PI-007: ProcessTimeline, ProcessPhase, ProcessEvent, ParallelTrack
 * - PI-008: ProcessPattern (expanded)
 * - PI-010: ProcessBottleneck
 * - PI-013: SOPOpportunity
 * - PI-015: Retrospective
 * - PI-020: InsightAction, ApprovalState
 * - PI-021: ProposedAction
 */

// Re-export graph base types from database.ts
export type {
  ProcessNode,
  ProcessEdge,
  ProcessSnapshot,
  ProcessNodeType,
  ProcessEdgeType,
  ProcessNodeSourceType,
} from "./database";

// Re-export graph traversal RPC result types (PI-004)
export type {
  FindPathResult,
  DetectCycleResult,
  SubgraphNode,
  SubgraphEdge,
  ExtractSubgraphResult,
  ProcessTimelineEntry,
  NodeNeighbor,
} from "./database";

import type { ProcessNode, ProcessEdge } from "./database";

// ============================================================================
// PI-006 — Process Interpretation Engine contracts
// ============================================================================
// Design reference: docs/process-interpretation-architecture.md
// All request/response shapes are fully serializable (ISO strings, no
// Maps/Sets/Dates) so they can cross the server-action boundary untouched.
// ============================================================================

// ── Shared unions ──────────────────────────────────────────────────────────────

export type ProcessInsightCategory =
  | "pattern"
  | "deviation"
  | "bottleneck"
  | "sop_opportunity";

export type ProcessInsightSeverity = "info" | "warning" | "critical";

/** Lifecycle for surfaced insights (PI-020 builds approvals on top). */
export type ProcessInsightStatus = "new" | "acknowledged" | "dismissed";

export type ProcessPatternType =
  | "sequential_chain" // stable A→B→C execution chain
  | "handoff_chain" // repeated cross-entity handoffs
  | "rework_loop" // cycle / work returning to an earlier node
  | "parallel_split" // one node fanning out into parallel tracks
  | "convergence_point" // many tracks merging into one node (bottleneck-like)
  | "repeated_segment"; // same sub-flow executed multiple times (SOP candidate)

export type ProcessDeviationType =
  | "skipped_step" // expected intermediate node missing
  | "out_of_order" // events occurred against dependency direction
  | "stalled_node" // no downstream activity for too long
  | "unexpected_rework" // rework loop on a segment marked completed
  | "missing_evidence" // node lacks document/decision links
  | "circular_dependency"; // structural cycle in dependencies

// ── Narrative ──────────────────────────────────────────────────────────────────

/** Human-readable output, AI-generated or deterministic template fallback. */
export interface ProcessNarrative {
  /** One-sentence headline. */
  summary: string;
  /** What happened and why it matters (2–4 sentences). */
  explanation: string;
  /** Concrete next action for the user. */
  recommendation: string;
  /** Language the text is written in. */
  locale: "en" | "es";
  /** Who produced the text. Deterministic = template fallback. */
  generator: "ai" | "deterministic";
  /** Model ID when generator is "ai", null otherwise. */
  model: string | null;
}

/** Context handed to the NarrativeGenerator alongside a finding. */
export interface NarrativeContext {
  projectId: string;
  projectLabel: string;
  locale: "en" | "es";
  /** node id → human label, for readable prompts and fallbacks. */
  nodeLabels: Record<string, string>;
}

// ── Detector findings ──────────────────────────────────────────────────────────

/** One concrete occurrence of a pattern. */
export interface PatternOccurrence {
  /** Node IDs in flow order. */
  nodeIds: string[];
  /** Edge IDs connecting them. */
  edgeIds: string[];
  /** When the occurrence started/ended (ISO). */
  startedAt: string;
  endedAt: string;
  /** Wall-clock span in days. */
  durationDays: number;
}

/** Recurring structure found by a PatternDetector. */
export interface ProcessPattern {
  /** Detector that produced it (e.g. "rework-loop"). */
  detectorId: string;
  patternType: ProcessPatternType;
  /** All matched occurrences (≥1). */
  occurrences: PatternOccurrence[];
  /** How often the pattern repeats; occurrences.length unless sampled. */
  frequency: number;
  /** Mean duration across occurrences, in days. */
  avgDurationDays: number;
  /** 0–1 detector confidence (structural certainty, not AI). */
  confidence: number;
  /** Detector-specific extras (counts, thresholds used, etc.). */
  metadata: Record<string, unknown>;
}

/** Departure from expected flow found by a DeviationDetector. */
export interface ProcessDeviation {
  /** Detector that produced it (e.g. "stalled-node"). */
  detectorId: string;
  deviationType: ProcessDeviationType;
  /** What the process was expected to do (machine-readable hint). */
  expected: string;
  /** What was actually observed. */
  observed: string;
  /** Nodes implicated in the deviation. */
  affectedNodeIds: string[];
  /** Edges implicated, if any. */
  affectedEdgeIds: string[];
  severity: ProcessInsightSeverity;
  /** 0–1 detector confidence. */
  confidence: number;
  /** When the deviation was (last) observed (ISO). */
  observedAt: string;
  metadata: Record<string, unknown>;
}

// ── Insight (engine output) ────────────────────────────────────────────────────

/** Graph elements backing an insight, for UI highlighting. */
export interface ProcessInsightEvidence {
  nodeIds: string[];
  edgeIds: string[];
}

/** Final interpreted unit returned to (and persisted for) the UI. */
export interface ProcessInsight {
  id: string;
  organizationId: string;
  projectId: string;
  category: ProcessInsightCategory;
  severity: ProcessInsightSeverity;
  /** Short title for lists/feeds. */
  title: string;
  narrative: ProcessNarrative;
  evidence: ProcessInsightEvidence;
  /** Structured finding the narrative was generated from. */
  source: ProcessPattern | ProcessDeviation | null;
  /** 0–1 combined confidence. */
  confidence: number;
  status: ProcessInsightStatus;
  /** Graph signature at detection time (cache invalidation key). */
  graphSignature: string;
  /** ai_runs row for traceability; null when deterministic. */
  aiRunId: string | null;
  detectedAt: string;
  metadata: Record<string, unknown>;
}

// ── Request / Response (server action contract) ────────────────────────────────

/** Which slice of the graph to interpret. */
export type InterpretationScope =
  | { kind: "project" }
  | {
      kind: "subgraph";
      entityType: string;
      entityId: string;
      /** BFS depth for extract_subgraph. Default 2. */
      depth?: number;
    }
  | { kind: "nodes"; nodeIds: string[] };

export interface InterpretationRequest {
  projectId: string;
  scope: InterpretationScope;
  locale: "en" | "es";
  /** Restrict to specific categories; all when omitted. */
  categories?: ProcessInsightCategory[];
  /** Bypass the interpretation cache. Default false. */
  forceRefresh?: boolean;
  /** Cap on insights with AI narratives per run. Default 10. */
  maxInsights?: number;
}

export interface InterpretationUsage {
  tokensIn: number;
  tokensOut: number;
  costUsd: number | null;
}

export interface InterpretationResponse {
  /** failed = graph could not be read; partial = some detectors errored. */
  status: "completed" | "partial" | "failed";
  insights: ProcessInsight[];
  /** True when served from the process_insights cache (no AI spent). */
  fromCache: boolean;
  /** Signature of the graph the insights describe. */
  graphSignature: string;
  /** True when AI was unavailable and deterministic fallbacks were used. */
  degraded: boolean;
  /** Detector/AI error messages (empty when status is "completed"). */
  errors: string[];
  /** AI usage for this run; null when cached or fully deterministic. */
  usage: InterpretationUsage | null;
  generatedAt: string;
}

// ── Engine interfaces (implemented in src/lib/interpretation/, PI-007/008) ─────

/** Scope of graph data handed to detectors. */
export interface GraphSlice {
  nodes: ProcessNode[];
  edges: ProcessEdge[];
}

/** Orchestrates the full pipeline for one request. */
export interface ProcessInterpreter {
  interpret(
    request: InterpretationRequest,
    slice: GraphSlice,
  ): Promise<InterpretationResponse>;
}

/** Finds recurring structures. Must be pure and deterministic. */
export interface PatternDetector {
  readonly id: string;
  readonly category: ProcessInsightCategory;
  detect(slice: GraphSlice): ProcessPattern[];
}

/** Finds departures from expected flow. Must be pure and deterministic. */
export interface DeviationDetector {
  readonly id: string;
  detect(slice: GraphSlice): ProcessDeviation[];
}

/** Converts structured findings into human-readable text (AI with fallback). */
export interface NarrativeGenerator {
  generate(
    finding: ProcessPattern | ProcessDeviation,
    context: NarrativeContext,
  ): Promise<ProcessNarrative>;
}