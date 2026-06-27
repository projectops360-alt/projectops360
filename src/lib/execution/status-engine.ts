// ============================================================================
// ProjectOps360° — Execution Status Engine™ (single source of truth)
// ============================================================================
// THE core service that determines the true operational state of any work
// item: project, phase, deliverable, milestone, WBS node, or task.
//
// It resolves FOUR strictly independent dimensions — they must never be mixed:
//
//   1. Execution Status  — "What is this item doing right now?"
//   2. Dependency Status — the relationship of this item to its predecessors.
//   3. Project Health    — schedule/cost/risk/forecast condition (see
//                          project-health-status.ts, layered on health.ts).
//   4. Risk Status       — probability/impact of an adverse event.
//
// Non-negotiable rules (deterministic business logic):
//   • Blocked REQUIRES an explicit impediment record. It is NEVER inferred
//     from dependencies. An item waiting for predecessors is NOT blocked.
//   • Waiting on Dependency REQUIRES unfinished predecessor(s).
//   • Waiting REQUIRES no predecessor issue and no impediment — the item is
//     simply not yet executable (its scheduled moment has not arrived, or the
//     workflow has not reached it). This is NOT a problem.
//
// Pure functions over already-fetched data — callers batch-load per project.
// Every result carries a deterministic, bilingual explanation so Isabella /
// Knowledge OS can answer "why is X blocked?" without guessing.
// ============================================================================

import type { I18nField } from "@/types/database";
import type { ReadinessBlocker, ReadinessBlockerType } from "./readiness";

// ── Dimension value types ─────────────────────────────────────────────────────

/** Execution Status — the operational state. Answers only: "what is it doing now?" */
export type ExecutionStatus =
  | "draft"
  | "ready"
  | "in_progress"
  | "waiting"
  | "waiting_on_dependency"
  | "blocked"
  | "on_hold"
  | "completed"
  | "cancelled";

/** Dependency Status — independent of Execution Status. */
export type DependencyStatus =
  | "no_dependencies"
  | "waiting_for_dependency"
  | "dependencies_satisfied"
  | "critical_dependency"
  | "circular_dependency";

/** Project Health — 5-level. Computed in project-health-status.ts. */
export type HealthStatus = "healthy" | "watch" | "at_risk" | "critical" | "failed";

/** Risk Status — independent dimension. */
export type RiskStatus = "none" | "low" | "medium" | "high" | "critical";

// ── Explicit impediment record ────────────────────────────────────────────────

/**
 * The ONLY kinds of evidence that may make an item Blocked. Each maps to a
 * concrete, recorded fact — never to a dependency relationship.
 */
export type ExplicitBlockerKind =
  | "manual_flag" // is_blocked flag set by a PM (with blocker_reason)
  | "blocker_event" // a blocker_event node materialized in the process graph
  | ReadinessBlockerType; // material / rfi / submittal / inspection / permit / budget / resource_unavailable / assignment

export interface ExplicitBlocker {
  kind: ExplicitBlockerKind;
  /** Human-recorded reason / evidence. */
  reason_i18n: I18nField;
  /** Entity that records the impediment (task id, rfi id, permit id, …). */
  evidence_entity_id: string | null;
  severity: "low" | "medium" | "high" | "critical";
}

/** A predecessor that has not finished yet — the basis for Waiting on Dependency. */
export interface PendingPredecessor {
  id: string;
  title: string;
  status: string | null;
}

// ── Engine input signals (entity-agnostic) ────────────────────────────────────

/**
 * Normalized signals an adapter extracts from a concrete entity. The engine
 * decides purely from these — it never reaches into task/milestone shapes
 * directly, which is what lets one engine serve every item type.
 */
export interface ExecutionSignals {
  /** Lifecycle the entity declares about itself, when it maps cleanly. */
  lifecycle: ExecutionLifecycle;
  /** Explicit impediments recorded against this item. Drives Blocked — only this. */
  explicitBlockers: ExplicitBlocker[];
  /** Predecessors that are not finished yet. Drives Waiting on Dependency. */
  pendingPredecessors: PendingPredecessor[];
  /** Total number of predecessors (finished or not). Drives Dependency Status. */
  predecessorCount: number;
  /** This item participates in a dependency cycle. */
  inCycle: boolean;
  /** This item is on the project critical path. */
  onCriticalPath: boolean;
  /**
   * Whether the item is executable right now from a scheduling/workflow view:
   *   • true  → its moment has arrived and the workflow reached it.
   *   • false → not yet (scheduled in the future, or upstream gate not opened).
   *   • null  → unknown / not schedule-driven (treat as executable).
   */
  scheduledStartReached: boolean | null;
  /** 0–100 progress, when resolvable. */
  progress: number | null;
}

/**
 * What the entity itself claims about its lifecycle. Adapters map a raw status
 * (e.g. roadmap task status, milestone status) onto this small vocabulary. It
 * is a HINT — the engine still applies the precedence rules below.
 */
export type ExecutionLifecycle =
  | "draft"
  | "not_started"
  | "started"
  | "completed"
  | "on_hold"
  | "cancelled";

// ── Engine result ─────────────────────────────────────────────────────────────

export interface ExecutionExplanation {
  /** The primary reason this Execution Status was chosen (bilingual). */
  summary_i18n: I18nField;
  /** Explicit impediments (only when Blocked). Evidence-first for Isabella. */
  blockers: ExplicitBlocker[];
  /** Unfinished predecessors (only when Waiting on Dependency). */
  pendingPredecessors: PendingPredecessor[];
}

export interface ExecutionState {
  executionStatus: ExecutionStatus;
  dependencyStatus: DependencyStatus;
  /** Risk dimension. Health is computed separately (project-health-status.ts). */
  risk: RiskStatus;
  onCriticalPath: boolean;
  explanation: ExecutionExplanation;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function highestSeverity(blockers: ExplicitBlocker[]): ExplicitBlocker["severity"] {
  const order: ExplicitBlocker["severity"][] = ["low", "medium", "high", "critical"];
  return blockers.reduce<ExplicitBlocker["severity"]>((acc, b) => {
    return order.indexOf(b.severity) > order.indexOf(acc) ? b.severity : acc;
  }, "low");
}

// ── Execution Status decider (the heart) ──────────────────────────────────────

/**
 * Resolve Execution Status by strict precedence. Order matters: terminal
 * lifecycle states win, then explicit impediments, then dependency waiting,
 * then activity, then schedulability.
 *
 * The single most important branch: an item with unfinished predecessors but
 * NO explicit impediment is `waiting_on_dependency`, never `blocked`.
 */
export function resolveExecutionStatus(signals: ExecutionSignals): ExecutionStatus {
  // 1. Terminal lifecycle states win outright.
  if (signals.lifecycle === "cancelled") return "cancelled";
  if (signals.lifecycle === "completed" || signals.progress === 100) return "completed";

  // 2. Explicit hold declared by a human.
  if (signals.lifecycle === "on_hold") return "on_hold";

  // 3. Blocked — ONLY when an explicit impediment is recorded. Never from deps.
  if (signals.explicitBlockers.length > 0) return "blocked";

  // 4. In progress — work has demonstrably started.
  //    (Checked before dependency-waiting: if it is already moving, it is not
  //    "waiting" for anything — predecessor state is informational at that point.)
  if (signals.lifecycle === "started" || (signals.progress != null && signals.progress > 0)) {
    return "in_progress";
  }

  // 5. Waiting on Dependency — unfinished predecessor(s), no impediment.
  if (signals.pendingPredecessors.length > 0) return "waiting_on_dependency";

  // 6. Draft — declared as not yet finalized/committed.
  if (signals.lifecycle === "draft") return "draft";

  // 7. Waiting — executable conditions not yet met (its time has not arrived /
  //    the workflow has not reached it). NOT a problem.
  if (signals.scheduledStartReached === false) return "waiting";

  // 8. Ready — everything clear, executable now, simply not started.
  return "ready";
}

// ── Dependency Status decider (independent) ───────────────────────────────────

/**
 * Resolve Dependency Status independently of Execution Status. This describes
 * the predecessor relationship only — it never says what the item is doing.
 */
export function resolveDependencyStatus(signals: ExecutionSignals): DependencyStatus {
  if (signals.inCycle) return "circular_dependency";
  if (signals.predecessorCount === 0) return "no_dependencies";

  const hasPending = signals.pendingPredecessors.length > 0;
  // A critical dependency is an unfinished predecessor link on the critical
  // path — a delay there propagates to the project finish.
  if (hasPending && signals.onCriticalPath) return "critical_dependency";
  if (hasPending) return "waiting_for_dependency";
  return "dependencies_satisfied";
}

// ── Risk Status decider (independent) ─────────────────────────────────────────

export interface RiskSignals {
  /** Base risk level the item already carries (low/medium/high), if any. */
  baseRisk: "low" | "medium" | "high" | null;
  /** Item is blocked by an explicit impediment. */
  hasExplicitBlocker: boolean;
  /** Severity of the worst explicit blocker. */
  worstBlockerSeverity: ExplicitBlocker["severity"] | null;
  onCriticalPath: boolean;
  /** Item is overdue (past planned finish and not complete). */
  overdue: boolean;
}

/**
 * Resolve Risk Status independently. Blocking/overdue on the critical path
 * escalates risk, but risk NEVER changes Execution Status and vice versa.
 */
export function resolveRiskStatus(signals: RiskSignals): RiskStatus {
  let score = 0;
  if (signals.baseRisk === "low") score = Math.max(score, 1);
  if (signals.baseRisk === "medium") score = Math.max(score, 2);
  if (signals.baseRisk === "high") score = Math.max(score, 3);

  if (signals.hasExplicitBlocker) {
    const sev = signals.worstBlockerSeverity ?? "high";
    const sevScore = sev === "critical" ? 4 : sev === "high" ? 3 : sev === "medium" ? 2 : 1;
    score = Math.max(score, sevScore);
  }
  if (signals.overdue) score = Math.max(score, 2);

  // Critical-path pressure bumps an already-elevated risk one notch up.
  if (signals.onCriticalPath && score >= 2) score = Math.min(4, score + 1);

  const levels: RiskStatus[] = ["none", "low", "medium", "high", "critical"];
  return levels[score];
}

// ── Explanation builder (deterministic; the truth Isabella narrates) ──────────

const EXECUTION_REASON_I18N: Record<ExecutionStatus, (s: ExecutionSignals) => I18nField> = {
  cancelled: () => ({ en: "This item has been cancelled.", es: "Este elemento fue cancelado." }),
  completed: () => ({ en: "This item is completed.", es: "Este elemento está completado." }),
  on_hold: () => ({
    en: "This item is on hold by an explicit decision.",
    es: "Este elemento está en pausa por una decisión explícita.",
  }),
  blocked: (s) => {
    const first = s.explicitBlockers[0];
    const reason = first?.reason_i18n;
    return {
      en: `This item is blocked: ${reason?.en ?? "a recorded impediment is preventing progress."}`,
      es: `Este elemento está bloqueado: ${reason?.es ?? "un impedimento registrado impide avanzar."}`,
    };
  },
  in_progress: () => ({ en: "This item is in progress.", es: "Este elemento está en progreso." }),
  waiting_on_dependency: (s) => {
    const count = s.pendingPredecessors.length;
    return {
      en: `This item is not blocked. It is waiting for ${count} predecessor activit${count === 1 ? "y" : "ies"} to finish. No impediments have been recorded; execution will continue automatically once those dependencies are completed.`,
      es: `Este elemento no está bloqueado. Está esperando que ${count} actividad${count === 1 ? "" : "es"} predecesora${count === 1 ? "" : "s"} termine${count === 1 ? "" : "n"}. No se ha registrado ningún impedimento; la ejecución continuará automáticamente cuando esas dependencias se completen.`,
    };
  },
  draft: () => ({
    en: "This item is still a draft and has not been committed for execution.",
    es: "Este elemento sigue en borrador y aún no se ha comprometido para ejecución.",
  }),
  waiting: () => ({
    en: "This item is waiting: its scheduled moment has not arrived yet. This is not a problem.",
    es: "Este elemento está en espera: su momento programado aún no ha llegado. Esto no es un problema.",
  }),
  ready: () => ({
    en: "This item is ready to start — all prerequisites are satisfied.",
    es: "Este elemento está listo para iniciar — todos los prerrequisitos están satisfechos.",
  }),
};

export function buildExecutionExplanation(
  status: ExecutionStatus,
  signals: ExecutionSignals,
): ExecutionExplanation {
  return {
    summary_i18n: EXECUTION_REASON_I18N[status](signals),
    blockers: status === "blocked" ? signals.explicitBlockers : [],
    pendingPredecessors:
      status === "waiting_on_dependency" ? signals.pendingPredecessors : [],
  };
}

// ── Unified entry point ───────────────────────────────────────────────────────

/**
 * Resolve all independent dimensions for one item in a single pass. This is the
 * function every surface (Living Graph, dashboards, reports, timeline, Navigator,
 * Isabella, …) should call — there must be only one source of truth.
 *
 * Project Health is intentionally NOT computed here: it is a project-scoped
 * aggregate (project-health-status.ts) and depends on far more than one item.
 */
export function resolveExecutionState(
  signals: ExecutionSignals,
  riskExtras: Pick<RiskSignals, "baseRisk" | "overdue">,
): ExecutionState {
  const executionStatus = resolveExecutionStatus(signals);
  const dependencyStatus = resolveDependencyStatus(signals);
  const risk = resolveRiskStatus({
    baseRisk: riskExtras.baseRisk,
    hasExplicitBlocker: signals.explicitBlockers.length > 0,
    worstBlockerSeverity:
      signals.explicitBlockers.length > 0 ? highestSeverity(signals.explicitBlockers) : null,
    onCriticalPath: signals.onCriticalPath,
    overdue: riskExtras.overdue,
  });

  return {
    executionStatus,
    dependencyStatus,
    risk,
    onCriticalPath: signals.onCriticalPath,
    explanation: buildExecutionExplanation(executionStatus, signals),
  };
}
