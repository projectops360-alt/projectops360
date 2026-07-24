// ============================================================================
// PMO Process Intelligence Command Center — canonical contracts (CAP-047 · M2)
// ============================================================================
// Typed, versioned read-model contracts. Presentational components consume
// ONLY these shapes — never database rows. Sources of truth:
//   events    → project_event_log (PEG, CAP-045) via read-only refs
//   variants  → analyzeVariants (CAP-046, pure)
//   financial → financial_project_cockpit + lib/financial calculations (pure)
// Temporal order never implies causality (PD-018); nothing is displayed
// without an evidence package; unavailable data is declared, never invented.
// ============================================================================

import type { VariantEventRef, VariantAnalysis } from "@/lib/process-mining/variants";

/** Bump when a breaking change is made to any contract in this file. */
export const PMO_PI_CONTRACT_VERSION = 1;

// ── Hierarchy (v1 is org-level: organization → project → milestone) ─────────

export type PmoPiLevel = "organization" | "project" | "milestone";

export interface PmoPiScope {
  organizationId: string;
  /** Empty = every live project in the organization. */
  projectIds: string[];
  level: PmoPiLevel;
}

// ── Event contract (module projection over the PEG — no second event store) ─

/**
 * One PEG event as this module consumes it. `caseId` is a real domain object
 * id (project or milestone journey — PD-018 §0.4), `activity` is the closed
 * registry event type. Extends the variant engine ref so cases feed
 * analyzeVariants without re-mapping.
 */
export interface PmoPiEventRecord extends VariantEventRef {
  organizationId: string;
  projectId: string;
  caseId: string;
  /** Business object the event is about (task, milestone, risk, decision…). */
  subjectType: string;
  subjectId: string;
  actorType: string;
  /** Recording time — kept separate from business time (occurredAt). */
  recordedAt: string;
  /** Producing module from provenance (e.g. roadmap, import-intelligence). */
  sourceModule: string;
}

/** One case (process instance) scoped to this module. */
export interface PmoPiCase {
  caseId: string;
  caseLabel: string;
  organizationId: string;
  projectId: string;
  events: PmoPiEventRecord[];
  outcome: "success" | "failure" | "open";
}

// ── Flow read model (what the canvas renders) ───────────────────────────────

export interface PmoPiProcessNode {
  /** Stable id — the activity name (registry event type). */
  id: string;
  activity: string;
  frequency: number;
  caseCount: number;
  /** Mean waiting before this activity starts (ms); null when not computable. */
  avgIncomingWaitingMs: number | null;
  /** Times this activity re-occurred within a single case (rework signal). */
  reworkOccurrences: number;
  /** 0–1 normalized waiting×frequency pressure; calculated, never decorated. */
  bottleneckScore: number;
  onDominantPath: boolean;
}

export interface PmoPiProcessEdge {
  from: string;
  to: string;
  frequency: number;
  caseCount: number;
  avgWaitingMs: number | null;
  /** True when `to` had already occurred earlier in the same case (loop). */
  isRework: boolean;
  onDominantPath: boolean;
}

export interface PmoPiFlowQuality {
  totalEventsSeen: number;
  businessEventsUsed: number;
  excludedEvents: number;
  casesWithoutEvents: number;
  /** 0–1 honest confidence in the projection given the inputs. */
  dataQualityScore: number;
}

export interface PmoPiFlowModel {
  contractVersion: number;
  scope: PmoPiScope;
  nodes: PmoPiProcessNode[];
  edges: PmoPiProcessEdge[];
  /** Full variant analysis (CAP-046 engine output) for the same cases. */
  variants: VariantAnalysis;
  /** Activity sequence of the most frequent variant; [] when none. */
  dominantPath: string[];
  quality: PmoPiFlowQuality;
  generatedAt: string;
}

// ── Evidence package (mandatory for anything displayed) ─────────────────────

export interface PmoPiEvidencePackage {
  sourceEventIds: string[];
  /** Technical event names stay inside Evidence/Technical View only. */
  technicalEventTypes?: string[];
  affectedCaseCount?: number;
  cutoffDate?: string;
  knowledgeVersion?: string;
  /** Human-readable formulas actually used (e.g. "CPI = EV / AC"). */
  formulas: string[];
  /** Projections/read models consulted (e.g. financial_project_cockpit). */
  projections: string[];
  /** Business + recording timestamps backing the claim. */
  timestamps: { occurredAt?: string; recordedAt?: string; statusDate?: string }[];
  assumptions: string[];
  limitations: string[];
  dataQualityScore: number;
}

// ── Financial snapshot (module projection over the canonical model) ─────────

/** Mirrors lib/financial MetricResult: value or an honest unavailable reason. */
export interface PmoPiMetric {
  status: "available" | "unavailable";
  value: number | null;
  reason?: string;
}

/**
 * Executive financial snapshot. Actuals, commitments and accruals are
 * SEPARATE fields by design — they are never summed into one number
 * (double-counting guard, CAP-047 §6). Every snapshot carries its baseline
 * version and status date.
 */
export interface PmoPiFinancialSnapshot {
  contractVersion: number;
  organizationId: string;
  projectId: string;
  currency: string;
  baselineVersion: number | null;
  statusDate: string | null;
  originalBudget: number | null;
  currentBaseline: number | null;
  authorizedFunding: number | null;
  releasedFunding: number | null;
  /** Separate exposure components — never pre-summed. */
  currentCommitment: number | null;
  outstandingCommitment: number | null;
  actualCost: number | null;
  openAccrual: number | null;
  remainingReserve: number | null;
  evm: {
    pv: PmoPiMetric;
    ev: PmoPiMetric;
    ac: PmoPiMetric;
    cv: PmoPiMetric;
    sv: PmoPiMetric;
    cpi: PmoPiMetric;
    spi: PmoPiMetric;
    tcpi: PmoPiMetric;
    etc: PmoPiMetric;
    eac: PmoPiMetric;
    vac: PmoPiMetric;
  };
  evidence: PmoPiEvidencePackage;
}

// ── Filters (preserved across switcher and drill-down) ──────────────────────

export interface PmoPiFilters {
  projectIds: string[];
  dateFrom: string | null;
  dateTo: string | null;
  level: PmoPiLevel;
  overlay: "process" | "risk" | "finance" | "resources" | "dependencies" | "benefits" | "whatif";
}

export const DEFAULT_PMO_PI_FILTERS: PmoPiFilters = {
  projectIds: [],
  dateFrom: null,
  dateTo: null,
  level: "organization",
  overlay: "process",
};
