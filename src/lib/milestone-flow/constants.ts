// ============================================================================
// ProjectOps360° — Milestone Process Flow Engine · Constants (Phase 3, Task 1)
// ============================================================================
// The CLOSED vocabularies of the MPF Engine: version identity, segment types,
// transition health, friction/bottleneck taxonomy, evidence kinds, constraint
// propagation, and error codes. Every union type is DERIVED from these frozen
// arrays so the taxonomy has exactly one source of truth (mirrors the Canonical
// Event Taxonomy registry pattern in src/lib/events/registry.ts).
//
// Pure + deterministic. No DB, no AI, no UI. This engine is a READ-ONLY consumer
// of the Project Event Graph — it never mutates project_event_log, process_nodes,
// or process_edges. See docs/product-brain/milestone-process-flow-engine-constitution.md.
// ============================================================================

/** Engine version — bump when a change alters derived output for the same input. */
export const MPF_ENGINE_VERSION = "0.1.0-foundation" as const;

/** Configuration version — versions the rule/threshold set that shapes output. */
export const MPF_CONFIG_VERSION = "2026.07-phase3-task1" as const;

// ── Transition lifecycle ──────────────────────────────────────────────────────

/** Lifecycle of a milestone transition (the execution corridor between two milestones). */
export const MPF_TRANSITION_STATUSES = [
  "pending", // not yet started (source milestone not achieved)
  "active", // execution is flowing toward the target milestone
  "completed", // target milestone achieved
  "regressed", // previously completed/healthy, moved backward
  "unknown", // insufficient evidence to classify
] as const;

// ── Flow segments ─────────────────────────────────────────────────────────────

/** The kinds of flow segment inside a transition. Constitution §8.3 / §12.6. */
export const MPF_SEGMENT_TYPES = [
  "active_work",
  "waiting",
  "blocked",
  "decision_delay",
  "approval_delay",
  "rework",
  "handoff",
  "review",
  "external_constraint",
  "unknown",
] as const;

// ── Transition health ─────────────────────────────────────────────────────────

/** Evidence-backed health of a milestone transition. Constitution §16. */
export const MPF_HEALTH_STATUSES = [
  "healthy",
  "watch",
  "degraded",
  "blocked",
  "at_risk",
  "recovering",
  "regressed",
  "unknown",
] as const;

/** The safe default: absence of evidence is Unknown, never a fabricated status. */
export const MPF_DEFAULT_HEALTH_STATUS = "unknown" as const;

// ── Friction taxonomy ─────────────────────────────────────────────────────────

/** Standard execution-friction taxonomy. Constitution §17 (extensible per org/type). */
export const MPF_FRICTION_TYPES = [
  "decision",
  "approval",
  "dependency",
  "resource",
  "ownership",
  "requirement_clarity",
  "scope_change",
  "quality",
  "rework",
  "communication",
  "handoff",
  "procurement",
  "client_response",
  "external_constraint",
  "regulatory",
  "calendar_availability",
  "unknown",
] as const;

// ── Bottleneck taxonomy ───────────────────────────────────────────────────────

/** Bottleneck categories (structural constraints, not one-off delays). Constitution §12.4. */
export const MPF_BOTTLENECK_TYPES = [
  "decision",
  "approval",
  "dependency",
  "resource",
  "ownership",
  "requirement_clarity",
  "quality",
  "rework",
  "communication",
  "external_constraint",
  "process_design",
  "unknown",
] as const;

// ── Constraint propagation ────────────────────────────────────────────────────

/** How a constraint moves through downstream execution. Constitution §19. */
export const MPF_PROPAGATION_TYPES = [
  "direct_dependency",
  "decision",
  "approval",
  "risk",
  "resource",
  "rework",
  "scope_change",
  "external_constraint",
] as const;

// ── Evidence ──────────────────────────────────────────────────────────────────

/** The epistemic kind of a derived statement. Constitution §15.2 / §24. */
export const MPF_EVIDENCE_KINDS = [
  "fact",
  "inference",
  "prediction",
  "recommendation",
  "uncertainty",
] as const;

/** Confidence level of a derived conclusion. Constitution §15.3. */
export const MPF_EVIDENCE_CONFIDENCE_LEVELS = ["high", "medium", "low", "unknown"] as const;

/** The safe default: without supporting evidence, confidence is Unknown. */
export const MPF_DEFAULT_CONFIDENCE = "unknown" as const;

// ── Data quality flags ────────────────────────────────────────────────────────

/** Data-quality conditions the engine must surface rather than hide. Constitution §32. */
export const MPF_DATA_QUALITY_FLAGS = [
  "missing_milestone_dates",
  "missing_milestone_owner",
  "missing_transition_pair",
  "missing_dependency_links",
  "missing_approval_owner",
  "missing_decision_owner",
  "missing_task_owner",
  "conflicting_events",
  "out_of_order_events",
  "backfilled_only_evidence",
  "low_confidence_evidence",
  "insufficient_event_density",
  "unknown_project_calendar",
  "unknown_working_days",
] as const;

// ── Access scope ──────────────────────────────────────────────────────────────

/** The visibility level a caller is exercising against the engine. Constitution §23. */
export const MPF_ACCESS_SCOPES = ["pm", "pmo", "admin"] as const;

// ── Error codes ───────────────────────────────────────────────────────────────

/** Typed, testable engine failure codes. See errors.ts. */
export const MPF_ERROR_CODES = [
  "MISSING_PROJECT_SCOPE",
  "MISSING_ORGANIZATION_SCOPE",
  "UNAUTHORIZED_ACCESS",
  "INVALID_EVENT_INPUT",
  "INVALID_MILESTONE_INPUT",
  "UNSUPPORTED_ENGINE_OPERATION",
  "MISSING_EVIDENCE",
  "REPLAY_INCOMPATIBILITY",
  "UNKNOWN_ENGINE_FAILURE",
] as const;

// ── Frozen membership sets (runtime guards) ───────────────────────────────────

export const SEGMENT_TYPE_SET: ReadonlySet<string> = new Set(MPF_SEGMENT_TYPES);
export const HEALTH_STATUS_SET: ReadonlySet<string> = new Set(MPF_HEALTH_STATUSES);
export const FRICTION_TYPE_SET: ReadonlySet<string> = new Set(MPF_FRICTION_TYPES);
export const BOTTLENECK_TYPE_SET: ReadonlySet<string> = new Set(MPF_BOTTLENECK_TYPES);
export const EVIDENCE_KIND_SET: ReadonlySet<string> = new Set(MPF_EVIDENCE_KINDS);
export const CONFIDENCE_LEVEL_SET: ReadonlySet<string> = new Set(MPF_EVIDENCE_CONFIDENCE_LEVELS);
export const ACCESS_SCOPE_SET: ReadonlySet<string> = new Set(MPF_ACCESS_SCOPES);
