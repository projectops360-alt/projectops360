// ============================================================================
// ProjectOps360° — Isabella Process Intelligence · shared types (Phase 5 · Task 1)
// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-EVIDENCE-CONTRACT
//
// The FOUNDATION contract that governs Isabella BEFORE she becomes "intelligent".
// Pure types + closed vocabularies — no runtime behavior, no retrieval, no UI,
// no engine. This is what future Phase-5 tasks (retrieval / diagnosis / root
// cause / recommendation / UI) MUST consume so every project-specific claim is
// evidence-backed, RBAC-safe, deterministic when data is requested, and honest
// when evidence is missing.
//
// Nothing here mutates canonical truth, reads/writes project_event_log, or
// touches process_nodes/process_edges. It is client-safe (no server imports).
// ============================================================================

// ── Confidence / uncertainty ─────────────────────────────────────────────────

/**
 * Isabella's coarse confidence model (distinct from the Knowledge OS tier scale).
 *   verified     — deterministic, record-backed project data (a retrieval).
 *   high         — direct status summary from approved data.
 *   medium       — an inference supported by multiple approved signals.
 *   low          — weak inference; MUST be labeled as such.
 *   unknown      — insufficient evidence to answer.
 *   unavailable  — no project context, retrieval failed, or not authorized.
 */
export type IsabellaConfidence =
  | "verified"
  | "high"
  | "medium"
  | "low"
  | "unknown"
  | "unavailable";

export const ISABELLA_CONFIDENCE_VALUES = [
  "verified",
  "high",
  "medium",
  "low",
  "unknown",
  "unavailable",
] as const satisfies readonly IsabellaConfidence[];

/** Visibility scope of an evidence packet (never widen beyond the caller). */
export type IsabellaEvidenceVisibility = "project" | "org" | "restricted";

// ── Intent categories ────────────────────────────────────────────────────────

/** What the user is asking Isabella to do. Drives the deterministic policy. */
export type IsabellaIntentCategory =
  | "deterministic_project_report"
  | "project_status_question"
  | "process_diagnosis"
  | "root_cause_analysis"
  | "recommendation_request"
  | "navigation_or_how_to"
  | "unsupported_or_missing_context";

export const ISABELLA_INTENT_CATEGORIES = [
  "deterministic_project_report",
  "project_status_question",
  "process_diagnosis",
  "root_cause_analysis",
  "recommendation_request",
  "navigation_or_how_to",
  "unsupported_or_missing_context",
] as const satisfies readonly IsabellaIntentCategory[];

// ── Claim types ──────────────────────────────────────────────────────────────

/** The kind of assertion Isabella makes. Each needs specific evidence. */
export type IsabellaClaimType =
  | "factual_project_data"
  | "status_summary"
  | "dependency_claim"
  | "blocker_claim"
  | "risk_claim"
  | "root_cause_claim"
  | "recommendation_claim"
  | "assumption_or_inference";

export const ISABELLA_CLAIM_TYPES = [
  "factual_project_data",
  "status_summary",
  "dependency_claim",
  "blocker_claim",
  "risk_claim",
  "root_cause_claim",
  "recommendation_claim",
  "assumption_or_inference",
] as const satisfies readonly IsabellaClaimType[];

// ── Evidence types + source kinds ────────────────────────────────────────────

/** The concrete kind of a piece of evidence Isabella may cite. */
export type IsabellaEvidenceType =
  | "task"
  | "subtask"
  | "milestone"
  | "dependency"
  | "blocker"
  | "risk"
  | "decision"
  | "approval"
  | "event_summary"
  | "living_graph_node"
  | "living_graph_edge"
  | "milestone_flow_segment"
  | "delay_finding"
  | "rework_finding"
  | "bottleneck_finding"
  | "status_report"
  | "project_memory";

export const ISABELLA_EVIDENCE_TYPES = [
  "task",
  "subtask",
  "milestone",
  "dependency",
  "blocker",
  "risk",
  "decision",
  "approval",
  "event_summary",
  "living_graph_node",
  "living_graph_edge",
  "milestone_flow_segment",
  "delay_finding",
  "rework_finding",
  "bottleneck_finding",
  "status_report",
  "project_memory",
] as const satisfies readonly IsabellaEvidenceType[];

/**
 * The approved data-source category an evidence packet came from. Broader than
 * evidenceType — it identifies the retrieval surface (see `data-sources.ts`).
 */
export type IsabellaSourceKind =
  | "deterministic_project_data"
  | "living_graph"
  | "milestone_process_flow"
  | "project_event_graph"
  | "risk_decision_approval_blocker"
  | "project_memory_status_report"
  | "observability_realtime_state";

export const ISABELLA_SOURCE_KINDS = [
  "deterministic_project_data",
  "living_graph",
  "milestone_process_flow",
  "project_event_graph",
  "risk_decision_approval_blocker",
  "project_memory_status_report",
  "observability_realtime_state",
] as const satisfies readonly IsabellaSourceKind[];

// ── Citation ─────────────────────────────────────────────────────────────────

/**
 * A SAFE, user-facing citation. No raw DB payloads. `safeRef` is a display-safe
 * reference only — an existing UI path/id convention, never a raw SQL row.
 */
export interface IsabellaCitation {
  sourceLabel: string; // e.g. "Workboard task status"
  entityType: IsabellaEvidenceType;
  entityTitle: string; // human title, e.g. "Zoning review"
  safeRef?: string | null; // display-safe id/path, only when UI convention allows
  occurredAt?: string | null;
  confidence: IsabellaConfidence;
}

// ── Evidence packet ──────────────────────────────────────────────────────────

/**
 * The one shape future engines exchange. PRE-SANITIZED and safe to hand to the
 * LLM: no raw payloads, no secrets, no cross-tenant data. Built ONLY by an
 * approved server-side retrieval layer (Phase 5 · Task 2) after RBAC checks.
 */
export interface IsabellaEvidencePacket {
  evidenceId: string;
  evidenceType: IsabellaEvidenceType;
  sourceKind: IsabellaSourceKind;
  /** Display-safe source reference (never a raw payload). */
  sourceId: string;
  projectId: string;
  organizationId: string;
  title: string;
  summary: string;
  citationLabel: string;
  citationRef?: string | null;
  occurredAt?: string | null;
  updatedAt?: string | null;
  confidence: IsabellaConfidence;
  visibility: IsabellaEvidenceVisibility;
  /** Claim types this evidence is generally RELEVANT to (descriptive). */
  claimSupport?: IsabellaClaimType[];
  /** Explicitly permitted claims (descriptive allow-list). */
  allowedClaims?: IsabellaClaimType[];
  /**
   * HARD prohibitions — a claim here can NEVER be supported by this packet, even
   * if the evidenceType would otherwise qualify. This is how a SYNTHETIC
   * milestone_chain edge (presentation-only sequencing) is barred from ever
   * backing a `dependency_claim`/`blocker_claim`.
   */
  disallowedClaims?: IsabellaClaimType[];
  limitations?: string[];
}
