// ============================================================================
// ProjectOps360° — Isabella Process Intelligence · data-source allowlist
// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-EVIDENCE-CONTRACT
//
// The ONLY sources Isabella may ground factual claims in — and the raw sources
// she may NEVER touch. "available" sources are reachable today via approved
// server-side retrieval; "future" sources are placeholders wired in later
// Phase-5 tasks. Pure data + predicates; no retrieval here.
// ============================================================================

import type { IsabellaSourceKind } from "./types";

export interface ApprovedDataSource {
  kind: IsabellaSourceKind;
  /** Human category label. */
  category: string;
  /** available now vs. reserved for a later Phase-5 task. */
  status: "available" | "future";
  description: string;
}

/**
 * The approved source model. Every factual project claim must trace to one of
 * these — always via an approved SERVER-SIDE retrieval/selector, never a raw
 * client query.
 */
export const APPROVED_DATA_SOURCES = [
  {
    kind: "deterministic_project_data",
    category: "Deterministic Project Data",
    status: "available",
    description:
      "Tasks, subtasks, milestones/phases, Workboard status, owners/assignees, due dates, priorities, status, progress, project team (if authorized). Retrieved deterministically, org+project scoped.",
  },
  {
    kind: "living_graph",
    category: "Living Graph / Project Execution Map",
    status: "available",
    description:
      "Hierarchy-safe nodes/edges, current scope, node/edge kinds, visibility policy, stale/fresh state, changed-node signals, dependency/evidence overlays when enabled. Consumed via approved projections, never raw payloads.",
  },
  {
    kind: "milestone_process_flow",
    category: "Milestone Process Flow",
    status: "available",
    description:
      "Transitions, flow segments, delay/rework/bottleneck/constraint findings, health summaries, and existing Isabella evidence packets from the MPF engine (read-only projection).",
  },
  {
    kind: "risk_decision_approval_blocker",
    category: "Risk / Decision / Approval / Blocker Data",
    status: "available",
    description:
      "Open risks, unresolved decisions, pending approvals, active blockers with status/ownership (if authorized). Record-backed.",
  },
  {
    kind: "project_memory_status_report",
    category: "Project Memory / Status Reports",
    status: "available",
    description:
      "Project Memory entries (if authorized), status report + closeout readiness summaries, Product Brain docs. Read-only.",
  },
  {
    kind: "project_event_graph",
    category: "Project Event Graph",
    status: "future",
    description:
      "Approved append-only event SUMMARIES + event evidence references — ONLY via approved server-side retrieval/projection. NEVER raw project_event_log rows in UI/LLM. Wired in a later Phase-5 task.",
  },
  {
    kind: "observability_realtime_state",
    category: "Observability / Realtime State",
    status: "future",
    description:
      "Stale/fresh/degraded + sync/reconnect status only. Never raw Supabase realtime payloads, never secrets. Wired in a later Phase-5 task.",
  },
] as const satisfies readonly ApprovedDataSource[];

/** A raw/forbidden source that must NEVER back a factual claim. */
export interface ForbiddenDataSource {
  id: string;
  reason: string;
}

export const FORBIDDEN_DATA_SOURCES = [
  { id: "raw_project_event_log_rows", reason: "Raw append-only ledger rows must never be read directly from UI/LLM — only approved event SUMMARIES/projections." },
  { id: "raw_supabase_realtime_payload", reason: "Raw realtime payloads are transport artifacts, not evidence, and may leak unscoped data." },
  { id: "raw_database_payload", reason: "Raw DB rows may contain unsanitized/sensitive fields; the LLM only sees pre-sanitized evidence packets." },
  { id: "unauthorized_tasks_projects_orgs", reason: "Cross-project/cross-org data must never be retrieved or leaked." },
  { id: "process_nodes_process_edges_as_truth", reason: "The process graph is a projection, never mutable canonical truth; never a source Isabella writes or trusts as authoritative over owners." },
  { id: "unscoped_project_wide_data", reason: "No project-wide reads without RBAC/org+project scope." },
  { id: "team_details_outside_scope", reason: "User/team details outside the authorized scope must not surface." },
  { id: "synthetic_milestone_chain_as_dependency", reason: "The presentation-only milestone_chain sequencing edge is NOT a real prerequisite and can never back a dependency/blocker claim." },
  { id: "evidence_or_event_nodes_as_default_children", reason: "Evidence/event nodes are overlay-only, never default task children." },
  { id: "ui_visual_artifact_as_truth", reason: "UI-only visual artifacts (layout, saved positions, synthetic edges) are never canonical truth." },
] as const satisfies readonly ForbiddenDataSource[];

const APPROVED_KINDS = new Set<IsabellaSourceKind>(APPROVED_DATA_SOURCES.map((s) => s.kind));
const AVAILABLE_KINDS = new Set<IsabellaSourceKind>(
  APPROVED_DATA_SOURCES.filter((s) => s.status === "available").map((s) => s.kind),
);
const FORBIDDEN_IDS = new Set<string>(FORBIDDEN_DATA_SOURCES.map((s) => s.id));

/** Is this an approved source kind (available OR future placeholder)? */
export function isApprovedSource(kind: string): kind is IsabellaSourceKind {
  return APPROVED_KINDS.has(kind as IsabellaSourceKind);
}

/** Is this source usable for grounding a claim TODAY (available, not future)? */
export function isAvailableSource(kind: string): boolean {
  return AVAILABLE_KINDS.has(kind as IsabellaSourceKind);
}

/** Is this an explicitly forbidden raw source? */
export function isForbiddenSource(id: string): boolean {
  return FORBIDDEN_IDS.has(id);
}
