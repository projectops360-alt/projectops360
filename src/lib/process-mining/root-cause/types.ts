// ============================================================================
// ProjectOps360° — Project Intelligence Engine · Root Cause Miner Types
// ============================================================================
// CAP-046 / PD-019 — Feature 2: statistical root-cause mining. Complements the
// qualitative Isabella root-cause engine (src/lib/isabella/root-cause/) with a
// deterministic statistical layer — it NEVER replaces it and NEVER emits
// recommendations: evidence only.
//
// PO-10 (process — not surveillance): dimensions are STRUCTURAL. There is no
// per-person dimension anywhere in this engine — ownership is analyzed only as
// assigned vs unassigned.
// ============================================================================

export type RootCauseProblemType = "delay" | "blockage" | "rework";

/** Structural dimensions only — never an individual person. */
export type RootCauseDimension =
  | "milestone"
  | "priority"
  | "ownership" // assigned | unassigned — structural, not a person
  | "criticality"
  | "discipline"
  | "trade"
  | "location";

/** One task, pre-resolved by the loader with REG-010-compliant flags. */
export interface RootCauseTaskInput {
  taskId: string;
  title: string;
  milestoneId: string | null;
  milestoneLabel: string | null;
  priority: string;
  hasOwner: boolean;
  isCritical: boolean;
  discipline: string | null;
  trade: string | null;
  location: string | null;
  /** Active blocker per REG-010 (terminal tasks never blocked). */
  isBlocked: boolean;
  /** Open past planned finish, or completed after planned finish. */
  isDelayed: boolean;
  /** TaskReopened business events recorded for this task. */
  reworkCount: number;
}

export type RootCauseConfidence = "high" | "medium" | "low";

export interface RootCauseEvidence {
  groupSize: number;
  groupProblemCount: number;
  /** Problem rate inside the group (0–1). */
  groupRate: number;
  /** Problem rate across all analyzed tasks (0–1). */
  baselineRate: number;
  /** groupRate / baselineRate (adverse lift; always > 1 for reported findings). */
  lift: number;
  /** Phi coefficient of the 2×2 contingency (association strength, 0–1 here). */
  phi: number;
  /** Share of all problem tasks that fall inside this group (0–1). */
  coverage: number;
  /** Up to 3 affected tasks as safe refs (opaque ref + title). */
  exampleRefs: Array<{ ref: string; title: string }>;
}

export interface RootCauseFinding {
  problemType: RootCauseProblemType;
  dimension: RootCauseDimension;
  /** Stable value key (e.g. milestone id, "p1", "unassigned"). */
  dimensionValue: string;
  /** Human label (e.g. milestone title). */
  dimensionLabel: string;
  /** 0–100 — lift + association + coverage, penalized by small samples. */
  influenceScore: number;
  confidence: RootCauseConfidence;
  method: "contingency_lift_phi";
  evidence: RootCauseEvidence;
  /** Evidence narrative — states WHAT the data shows, never what to do. */
  explanationEs: string;
  explanationEn: string;
}

export interface RootCauseProblemStats {
  problemType: RootCauseProblemType;
  problemCount: number;
  totalTasks: number;
  baselineRate: number;
}

export interface RootCauseMinerResult {
  totalTasks: number;
  problems: RootCauseProblemStats[];
  /** Sorted by influenceScore desc; capped per problem type. */
  findings: RootCauseFinding[];
  /** Honest disclosure of what could not be analyzed. */
  limitations: string[];
}
