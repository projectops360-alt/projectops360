import type { IsabellaSourceKind } from "./types";

export interface ApprovedDataSource {
  kind: IsabellaSourceKind;
  category: string;
  status: "available" | "future";
  description: string;
}

/** Approved, server-governed sources Isabella may use. */
export const APPROVED_DATA_SOURCES = [
  {
    kind: "deterministic_project_data",
    category: "Deterministic Project Data",
    status: "available",
    description: "Tasks, subtasks, milestones, Workboard status, owners, due dates and progress retrieved deterministically with org and project scope.",
  },
  {
    kind: "living_graph",
    category: "Living Graph / Project Execution Map",
    status: "available",
    description: "Hierarchy-safe nodes and edges plus current scope and approved overlays. Projections are never canonical owner data.",
  },
  {
    kind: "milestone_process_flow",
    category: "Milestone Process Flow",
    status: "available",
    description: "Transitions, flow segments, delay, rework, bottleneck and constraint findings from the read-only MPF engine.",
  },
  {
    kind: "risk_decision_approval_blocker",
    category: "Risk / Decision / Approval / Blocker Data",
    status: "available",
    description: "Authorized record-backed risks, decisions, approvals and blockers with status and ownership.",
  },
  {
    kind: "project_memory_status_report",
    category: "Project Memory / Status Reports",
    status: "available",
    description: "Authorized Project Memory entries, status reports, closeout summaries and Product Brain documents.",
  },
  {
    kind: "project_event_graph",
    category: "Project Event Graph",
    status: "available",
    description: "Append-only event summaries, integrity status and evidence refs via an authenticated projection. Raw ledger rows and payloads never reach UI or LLM.",
  },
  {
    kind: "observability_realtime_state",
    category: "Observability / Realtime State",
    status: "future",
    description: "Stale, fresh, degraded and reconnect status only. Raw transport payloads and secrets remain forbidden.",
  },
  {
    kind: "product_brain_knowledge",
    category: "Vectorized Product Brain Knowledge",
    status: "available",
    description: "Curated bilingual Process Mining semantics retrieved through Knowledge OS lexical and vector search. Product knowledge is not project-record truth.",
  },
  {
    kind: "screen_program_context",
    category: "Screen & Program Context",
    status: "available",
    description: "Deterministic screen registry and source-governed explanations for Living Graph and process-mining views. Visual layout remains non-canonical.",
  },
] as const satisfies readonly ApprovedDataSource[];

export interface ForbiddenDataSource {
  id: string;
  reason: string;
}

export const FORBIDDEN_DATA_SOURCES = [
  { id: "raw_project_event_log_rows", reason: "Raw append-only ledger rows never reach UI or LLM; only approved summaries and projections do." },
  { id: "raw_supabase_realtime_payload", reason: "Transport artifacts are not evidence and may leak unscoped data." },
  { id: "raw_database_payload", reason: "Raw rows may contain sensitive fields; Isabella receives sanitized evidence packets only." },
  { id: "unauthorized_tasks_projects_orgs", reason: "Cross-project and cross-organization data must never be retrieved or leaked." },
  { id: "process_nodes_process_edges_as_truth", reason: "The process graph is a projection, never mutable canonical truth." },
  { id: "unscoped_project_wide_data", reason: "Project reads require RBAC plus organization and project scope." },
  { id: "team_details_outside_scope", reason: "User and team details outside the authorized scope must not surface." },
  { id: "synthetic_milestone_chain_as_dependency", reason: "Presentation-only milestone sequencing can never support a dependency or blocker claim." },
  { id: "evidence_or_event_nodes_as_default_children", reason: "Evidence and event nodes are overlay-only, never default task children." },
  { id: "ui_visual_artifact_as_truth", reason: "Layout, saved positions and synthetic edges are never canonical truth." },
] as const satisfies readonly ForbiddenDataSource[];

const APPROVED_KINDS = new Set<IsabellaSourceKind>(APPROVED_DATA_SOURCES.map((source) => source.kind));
const AVAILABLE_KINDS = new Set<IsabellaSourceKind>(
  APPROVED_DATA_SOURCES.filter((source) => source.status === "available").map((source) => source.kind),
);
const FORBIDDEN_IDS = new Set<string>(FORBIDDEN_DATA_SOURCES.map((source) => source.id));

export function isApprovedSource(kind: string): kind is IsabellaSourceKind {
  return APPROVED_KINDS.has(kind as IsabellaSourceKind);
}

export function isAvailableSource(kind: string): boolean {
  return AVAILABLE_KINDS.has(kind as IsabellaSourceKind);
}

export function isForbiddenSource(id: string): boolean {
  return FORBIDDEN_IDS.has(id);
}
