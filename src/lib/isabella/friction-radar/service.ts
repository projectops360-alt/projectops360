// ============================================================================
// ProjectOps360° — Isabella · Friction Radar read service
// ============================================================================
// ISABELLA-FRICTION-RADAR-READ
//
// One brain, one engine. This is a projection over the SAME canonical loader
// the Friction Radar screen uses (`loadFrictionRadarFromProduction`), so what
// Isabella says can always be checked against what the screen shows. It does
// not re-derive a signal, re-score one, promote a rejected one, or open a
// second read path.
//
// Security posture is inherited rather than re-implemented: the canonical
// loader runs on the authenticated, RLS-scoped SSR client with the
// organization enforced on every query, and there is no service-role client
// anywhere in this module. A project in another organization and a project
// that does not exist both return `not_authorized` — the caller must not be
// able to tell them apart.
//
// Read-only: no insert/update/delete/upsert, no RPC, no writes of any kind.
// ============================================================================

import { localizedPath } from "@/lib/knowledge-os/action-links";
import { isFrictionRadarEnabledForProject } from "@/lib/friction-radar/flag";
import { loadFrictionRadarFromProduction } from "@/lib/friction-radar/load-production";
import { scoreFrictionSignal } from "@/lib/friction-radar/scoring";
import {
  DEFAULT_FRICTION_SIGNAL_FILTERS,
  filterAndSortFrictionSignals,
  type FrictionSignalFilters,
} from "@/lib/friction-radar/ui-model";
import {
  FRICTION_CATEGORIES,
  type FrictionCategory,
  type FrictionSignal,
} from "@/lib/friction-radar/types";
import type { IsabellaProjectScope } from "@/lib/isabella/process-context/types";
import {
  FRICTION_SIGNAL_LIMIT_DEFAULT,
  FRICTION_SIGNAL_LIMIT_MAX,
} from "@/lib/isabella/tools/schemas";
import type { Locale } from "@/types/database";
import type {
  IsabellaFrictionCategoryView,
  IsabellaFrictionRadarResult,
  IsabellaFrictionSignalView,
} from "./types";

/** Why the read model reports no global score. Stated, never inferred. */
export const NO_GLOBAL_SCORE_REASON =
  "Friction Radar v1 does not produce a global or per-category friction score: an aggregation policy has not been validated yet. Each signal carries its own independent 0-100 score. Never sum, average or estimate one.";

export interface IsabellaFrictionRadarRequest {
  category?: FrictionCategory;
  taskId?: string;
  milestoneId?: string;
  signalId?: string;
  severity?: FrictionSignalFilters["severity"];
  confidence?: FrictionSignalFilters["confidence"];
  search?: string;
  scope?: "top20" | "all";
  limit?: number;
}

function clampLimit(limit: number | undefined): number {
  if (limit == null || !Number.isFinite(limit)) return FRICTION_SIGNAL_LIMIT_DEFAULT;
  return Math.max(1, Math.min(FRICTION_SIGNAL_LIMIT_MAX, Math.floor(limit)));
}

function toSignalView(
  signal: FrictionSignal,
  taskTitles: Readonly<Record<string, string>>,
  milestoneTitles: Readonly<Record<string, string>>,
): IsabellaFrictionSignalView {
  return {
    signal_id: signal.signalId,
    project_id: signal.projectId,
    task_id: signal.taskId ?? null,
    task_title: signal.taskId ? (taskTitles[signal.taskId] ?? null) : null,
    milestone_id: signal.milestoneId ?? null,
    milestone_title: signal.milestoneId ? (milestoneTitles[signal.milestoneId] ?? null) : null,
    category: signal.category,
    signal_type: signal.signalType,
    // The canonical scorer, not a second scoring rule.
    score: scoreFrictionSignal(signal),
    severity: signal.severity,
    confidence: signal.confidence,
    // Preserved verbatim: "unknown" and "insufficient_evidence" must survive
    // the trip to the model, or absence silently becomes a finding.
    evidence_status: signal.evidenceStatus,
    observed_value: signal.observedValue,
    expected_or_baseline: signal.expectedOrBaseline,
    evidence_event_ids: signal.evidenceRefs
      .filter((ref) => ref.kind === "project_event_log")
      .map((ref) => ref.id),
    evidence_timestamp_start: signal.evidenceTimestampStart,
    evidence_timestamp_end: signal.evidenceTimestampEnd,
    evidence_description: signal.evidenceDescription,
    source_engine: signal.source,
  };
}

function categoryViews(
  signals: readonly FrictionSignal[],
  radarCategories: ReadonlyArray<{
    category: FrictionCategory;
    signalCount: number;
    confidence: IsabellaFrictionCategoryView["confidence"];
  }>,
): IsabellaFrictionCategoryView[] {
  return FRICTION_CATEGORIES.map((category) => {
    const fromRadar = radarCategories.find((entry) => entry.category === category);
    const scores = signals
      .filter((signal) => signal.category === category)
      .map(scoreFrictionSignal);
    return {
      category,
      // Mirrors the screen: a count and the highest INDEPENDENT score, never a
      // category total.
      score: null,
      signal_count: fromRadar?.signalCount ?? scores.length,
      confidence: fromRadar?.confidence ?? "unknown",
      highest_independent_score: scores.length > 0 ? Math.max(...scores) : null,
    };
  });
}

/**
 * Read the current project's Friction Radar for Isabella.
 *
 * Gating order matters: the feature flag is checked BEFORE any data is read, so
 * a non-pilot project performs no query at all.
 */
export async function getFrictionRadarForIsabella(
  scope: IsabellaProjectScope,
  request: IsabellaFrictionRadarRequest = {},
): Promise<IsabellaFrictionRadarResult> {
  const projectId = (scope.projectId ?? "").trim();
  if (!projectId) return { ok: false, reason: "no_project" };

  // Controlled pilot. Off ⇒ behave as if the capability does not exist.
  if (!isFrictionRadarEnabledForProject(projectId)) {
    return { ok: false, reason: "not_enabled" };
  }

  const locale: Locale = (scope.locale === "es" ? "es" : "en") as Locale;

  let loaded;
  try {
    loaded = await loadFrictionRadarFromProduction(projectId, locale);
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  // A foreign-organization project is indistinguishable from a missing one.
  if (loaded.status === "unauthorized") return { ok: false, reason: "not_authorized" };
  if (loaded.status !== "ok") return { ok: false, reason: "unavailable" };

  const taskTitles: Record<string, string> = Object.fromEntries(
    loaded.taskEvidence.map((task) => [task.taskId, task.title]),
  );
  const milestoneTitles: Record<string, string> = Object.fromEntries(
    loaded.milestones.map((milestone) => [milestone.id, milestone.title]),
  );

  // The screen's own pure projection — same filtering and ordering, so the two
  // surfaces cannot disagree about what the top signals are.
  const filters: FrictionSignalFilters = {
    ...DEFAULT_FRICTION_SIGNAL_FILTERS,
    query: request.search?.trim() ?? "",
    category: request.category ?? "all",
    severity: request.severity ?? "all",
    confidence: request.confidence ?? "all",
    milestoneId: request.milestoneId ?? "all",
    taskId: request.taskId ?? "all",
    // Asking about one signal must never be hidden by the Top 20 default.
    scope: request.signalId ? "all" : (request.scope ?? "top20"),
    sort: "score",
  };

  let matched = filterAndSortFrictionSignals({
    signals: loaded.signals,
    topSignalIds: loaded.radar.topSignalIds,
    filters,
    taskTitles,
  });
  if (request.signalId) {
    matched = matched.filter((signal) => signal.signalId === request.signalId);
  }

  const limit = clampLimit(request.limit);
  const page = matched.slice(0, limit);

  return {
    ok: true,
    data: {
      project_id: projectId,
      project_title: loaded.projectTitle,
      global_score: null,
      global_score_reason: NO_GLOBAL_SCORE_REASON,
      version: loaded.radar.version,
      read_only: true,
      categories: categoryViews(loaded.signals, loaded.radar.categories),
      signals: page.map((signal) => toSignalView(signal, taskTitles, milestoneTitles)),
      matched_signal_count: matched.length,
      promoted_signal_count: loaded.signals.length,
      truncated: matched.length > page.length,
      applied_filters: {
        category: filters.category,
        severity: filters.severity,
        confidence: filters.confidence,
        milestone_id: filters.milestoneId,
        task_id: filters.taskId,
        signal_id: request.signalId ?? null,
        search: filters.query || null,
        scope: filters.scope,
        limit,
      },
      // Gaps are surfaced, never dropped: an unreported gap reads as "no
      // friction here", which is the exact claim the radar must not make.
      evidence_gaps: loaded.signalGaps.map((gap) => ({
        signal_type: gap.signalType,
        category: gap.category,
        status: gap.status,
        reason: gap.reason,
        source_tables: gap.sourceTables,
      })),
      rejected_evidence_count: loaded.rejectedEvidenceCount,
      limitations: loaded.limitations,
      screen_href: localizedPath(`/projects/${projectId}/friction-radar`, locale),
    },
  };
}
