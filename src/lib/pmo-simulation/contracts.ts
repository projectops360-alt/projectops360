// ============================================================================
// PMO Simulation Foundation V1 — data contracts (CAP-049)
// ============================================================================
// One typed vocabulary for scenarios, interventions and results.
//
// Two rules are encoded in the TYPES themselves, because a convention that
// lives only in a comment is a convention that eventually gets violated:
//
//   1. Money, days and counts never share a field. `SimMetric` carries its own
//      `unit`, and there is no arithmetic in this module that adds a value of
//      one unit to a value of another. A "total impact" number that silently
//      mixes $50,000 with 12 days is the single most dangerous artefact a
//      simulator can put in front of a PMO.
//
//   2. Every number states where it came from. `SimProvenance` distinguishes a
//      value the user asserted from one the engine derived from linked records
//      from one that simply is not knowable. The third case is a first-class
//      outcome, not an error — see CAP-049 §4.
// ============================================================================

/** Unit of a simulated metric. Never mixed. */
export type SimUnit = "currency" | "days" | "count" | "percent" | "hours" | "ratio";

/**
 * Where a number came from.
 *
 * ASSUMED and DERIVED_PROXY exist because `risks` has neither a cost column nor
 * a delay column. The product refuses to invent either, and equally refuses to
 * map a qualitative severity ("high") onto dollars — that mapping is fiction
 * with a decimal point. See the risk exposure policy in `risk-exposure.ts`.
 */
export const SIM_PROVENANCE = [
  /** Read directly from a canonical row (budget_items, roadmap_tasks, …). */
  "OBSERVED",
  /** The user typed this number into the intervention. Never written to the domain. */
  "ASSUMED",
  /** Derived by a deterministic, traceable rule from linked canonical records. */
  "DERIVED_PROXY",
  /** Genuinely not knowable from the data available. Never a zero. */
  "UNAVAILABLE",
] as const;
export type SimProvenance = (typeof SIM_PROVENANCE)[number];

/** Scenario lifecycle. `simulated` means "run, not yet saved". */
export type SimScenarioState = "draft" | "simulated" | "saved";

/** The four intervention kinds V1 supports. */
export const SIM_INTERVENTION_KINDS = ["budget", "schedule", "resource", "risk"] as const;
export type SimInterventionKind = (typeof SIM_INTERVENTION_KINDS)[number];

/** What an intervention points at. Resolved against the baseline, never trusted. */
export type SimTargetKind = "project" | "milestone" | "task" | "resource" | "risk";

export interface SimTarget {
  kind: SimTargetKind;
  id: string;
}

// ── Interventions ───────────────────────────────────────────────────────────

interface SimInterventionBase {
  id: string;
  /** Application order. Lower runs first; ties break on `id` for determinism. */
  order: number;
  enabled: boolean;
  /** User-supplied label. Free text, never parsed. */
  label: string;
  note: string | null;
}

/**
 * A. Budget.
 *
 * HARD RULE: increasing a budget NEVER shortens a duration. There is no
 * crash-cost model, no productivity curve and no evidence in this database
 * that money buys time on these projects. Inferring the link would be the
 * simulator inventing a causal law. `budget` interventions therefore feed the
 * financial stage and nothing else — see `engine.ts` stage 4.
 */
export interface SimBudgetIntervention extends SimInterventionBase {
  kind: "budget";
  target: SimTarget;
  /** Absolute currency delta, or a percentage of the current baseline. Exactly one. */
  amountDelta: number | null;
  percentDelta: number | null;
  /** budget_items.category, when the change is scoped to one. */
  category: string | null;
  effectiveDate: string | null;
}

/**
 * B. Schedule.
 *
 * Propagation happens ONLY through real `task_dependencies` edges, by re-running
 * the shared CPM engine over a modified COPY of the baseline. Nothing else in
 * the product is allowed to decide that task B moves because task A moved.
 */
export interface SimScheduleIntervention extends SimInterventionBase {
  kind: "schedule";
  target: SimTarget;
  /** Positive delays, negative accelerates. */
  delayDays: number | null;
  newStartDate: string | null;
  newEndDate: string | null;
  newDurationDays: number | null;
}

/**
 * C. Resource.
 *
 * HARD RULE: a resource change touches only tasks genuinely linked to that
 * resource, via `resource_assignments`, `roadmap_tasks.assigned_resource_id` or
 * `roadmap_tasks.assigned_to`. A resource with no linked task produces an
 * explicit "no linked work" outcome rather than a portfolio-wide ripple.
 */
export interface SimResourceIntervention extends SimInterventionBase {
  kind: "resource";
  target: SimTarget;
  /** New availability in percent (0–100), or a delta in weekly hours. */
  availabilityPercent: number | null;
  weeklyHoursDelta: number | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export type SimRiskAction =
  | "reduce_probability"
  | "reduce_impact"
  | "mitigate_partial"
  | "mitigate_full"
  | "materialize";

/**
 * D. Risk.
 *
 * `assumedCostImpact` / `assumedDelayDays` live HERE, on the intervention, and
 * are never written back to `risks`. That table has no such columns and V1 does
 * not add them: a simulation input is not a domain fact.
 */
export interface SimRiskIntervention extends SimInterventionBase {
  kind: "risk";
  target: SimTarget;
  action: SimRiskAction;
  /** 0–100. Only meaningful for the two "reduce" actions. */
  reductionPercent: number | null;
  /** ASSUMED exposure, in currency. Optional — absent falls back to DERIVED_PROXY. */
  assumedCostImpact: number | null;
  /** ASSUMED exposure, in days. Kept strictly apart from the currency figure. */
  assumedDelayDays: number | null;
}

export type SimIntervention =
  | SimBudgetIntervention
  | SimScheduleIntervention
  | SimResourceIntervention
  | SimRiskIntervention;

// ── Scenario ────────────────────────────────────────────────────────────────

export interface SimScenario {
  id: string;
  organizationId: string;
  name: string;
  /** The hypothesis being tested. Prose is fine here; it is never parsed. */
  description: string | null;
  /** Empty = the whole organization. Otherwise the projects in scope. */
  projectIds: string[];
  /** When the baseline was captured. Results are only comparable within one baseline. */
  baselineAt: string;
  horizonDays: number | null;
  state: SimScenarioState;
  interventions: SimIntervention[];
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastRunAt: string | null;
}

// ── Results ─────────────────────────────────────────────────────────────────

/**
 * One row of the results table. `baseline` and `simulated` share a unit by
 * construction, and `delta` is their difference in that same unit — there is no
 * code path that produces a delta between two different units.
 */
export interface SimMetric {
  key: string;
  unit: SimUnit;
  baseline: number | null;
  simulated: number | null;
  delta: number | null;
  /** Which engine produced this. Displayed, because hours ≠ headcount (CAP-048 §5). */
  engine: "cpm" | "evm" | "capacity_generic" | "risk_policy" | "projection";
  provenance: SimProvenance;
  /** Why the value is missing, when it is. */
  unavailableReason: string | null;
  /**
   * Which formula variant produced this, when the metric has more than one.
   *
   * EAC accepts four formulas and the engine picks one. Without reporting which,
   * the glossary can only show a default and admit it does not know — which
   * understates what we actually do know. Optional: most metrics have exactly
   * one formula and nothing to disambiguate.
   */
  formulaId?: string;
}

export type SimIssueSeverity = "info" | "warning" | "conflict";

/**
 * A problem with the scenario itself. A contradictory pair of interventions
 * surfaces here rather than resolving silently to whichever ran last.
 */
export interface SimIssue {
  code: string;
  severity: SimIssueSeverity;
  /** The interventions involved, so the UI can point at them. */
  interventionIds: string[];
  detail: string | null;
}

/** One link of the causal chain: intervention → node → … → metric. */
export interface SimCausalStep {
  kind: "intervention" | "node" | "dependency" | "milestone" | "project" | "metric";
  id: string;
  label: string;
  /** The canonical row that justifies this step. Evidence, not prose. */
  evidence: { sourceTable: string; sourceId: string } | null;
}

export interface SimCausalChain {
  interventionId: string;
  steps: SimCausalStep[];
}

/** Per-intervention outcome. A non-computable intervention is KEPT, not dropped. */
export interface SimInterventionOutcome {
  interventionId: string;
  kind: SimInterventionKind;
  computable: boolean;
  /** Present when `computable` is false: exactly what is missing. */
  notComputableReason: string | null;
  /** Canonical node ids this intervention actually touched. */
  affectedNodeIds: string[];
  metrics: SimMetric[];
}

export interface SimDataCoverage {
  /** Tables that answered, and tables that did not. */
  availableSources: string[];
  unavailableSources: string[];
  /** Targets named by an intervention that do not exist in the baseline. */
  unresolvedTargets: SimTarget[];
}

export interface SimResult {
  scenarioId: string;
  baselineAt: string;
  ranAt: string;
  metrics: SimMetric[];
  outcomes: SimInterventionOutcome[];
  issues: SimIssue[];
  assumptions: string[];
  causalChains: SimCausalChain[];
  coverage: SimDataCoverage;
  /** Union of every `affectedNodeIds`, for the Compare mode on the graph. */
  affectedNodeIds: string[];
}
