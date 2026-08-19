// ============================================================================
// ProjectOps360° — Isabella · Friction Radar read view (contracts)
// ============================================================================
// The shapes Isabella is allowed to see. Field names deliberately mirror the
// evidence contract the Friction Radar screen shows, so an answer can be
// checked against the UI field by field.
//
// `globalScore` is present and permanently null on purpose. Omitting it would
// let a model fill the silence; naming it and explaining why it is null is what
// stops "the project's friction score is 62" from ever being said.
// ============================================================================

import type {
  FrictionCategory,
  FrictionConfidence,
  FrictionSeverity,
  FrictionSignal,
  FrictionSource,
} from "@/lib/friction-radar/types";

/** One promoted signal, with its evidence contract preserved. */
export interface IsabellaFrictionSignalView {
  signal_id: string;
  project_id: string;
  task_id: string | null;
  /** Human label for the task, so answers do not read as raw ids. */
  task_title: string | null;
  milestone_id: string | null;
  milestone_title: string | null;
  category: FrictionCategory;
  signal_type: string;
  /** Independent 0–100 rule score. Never aggregated with any other signal. */
  score: number;
  severity: FrictionSeverity;
  confidence: FrictionConfidence;
  evidence_status: FrictionSignal["evidenceStatus"];
  observed_value: string | number | boolean | null;
  expected_or_baseline: string | number | boolean | null;
  evidence_event_ids: string[];
  evidence_timestamp_start: string | null;
  evidence_timestamp_end: string | null;
  evidence_description: string;
  source_engine: FrictionSource;
}

/** Per-category counts. `score` is null in v1 — aggregation is not approved. */
export interface IsabellaFrictionCategoryView {
  category: FrictionCategory;
  score: null;
  signal_count: number;
  confidence: FrictionConfidence;
  highest_independent_score: number | null;
}

/** A detector-level evidence gap. A gap is NEVER a zero-friction result. */
export interface IsabellaFrictionGapView {
  signal_type: string;
  category: FrictionCategory;
  status: "unknown" | "insufficient_evidence";
  reason: string;
  source_tables: string[];
}

export interface IsabellaFrictionRadarView {
  project_id: string;
  project_title: string;
  /** Always null in v1. `global_score_reason` says why, so it is never guessed. */
  global_score: null;
  global_score_reason: string;
  version: "friction-radar-v1";
  read_only: true;
  categories: IsabellaFrictionCategoryView[];
  signals: IsabellaFrictionSignalView[];
  /** Signals matching the request BEFORE the row limit was applied. */
  matched_signal_count: number;
  /** Every promoted signal in the project, ignoring filters. */
  promoted_signal_count: number;
  truncated: boolean;
  applied_filters: Record<string, unknown>;
  evidence_gaps: IsabellaFrictionGapView[];
  rejected_evidence_count: number;
  limitations: string[];
  /** Locale-aware, project-scoped link to the Frictions screen. */
  screen_href: string;
}

export type IsabellaFrictionRadarFailure =
  | "no_project"
  | "not_authorized"
  | "not_enabled"
  | "unavailable";

export type IsabellaFrictionRadarResult =
  | { ok: true; data: IsabellaFrictionRadarView }
  | { ok: false; reason: IsabellaFrictionRadarFailure };
