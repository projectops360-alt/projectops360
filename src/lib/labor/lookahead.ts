// ============================================================================
// ProjectOps360° — Labor Lookahead Computation Engine
// ============================================================================
// Pure functions that compute 3-week and 6-week labor lookahead views.
// Determines whether upcoming work is executable with available labor by
// assessing activity readiness, detecting blockers, and flagging critical
// path activities within the lookahead horizon.
//
// No database calls — these operate on already-fetched data.
// Deterministic: same inputs → same outputs. No AI calls.
// ============================================================================

import type {
  ActivityDependency,
  ConstructionActivity,
  LaborResource,
  Milestone,
  ReadinessLevel,
  ReadinessChecklistItem,
  LookaheadBlockerType,
  ShortageRiskLevel,
  TradeTaxonomy,
  Locale,
} from "@/types/database";
import {
  generateWeeks,
  computeDemand,
  computeSupply,
  classifyShortageRisk,
  isOnCriticalPath,
  parseAvailabilityWindows,
} from "./capacity";
import type { WeeklyCapacityGap } from "./capacity";
import {
  computeWorkfaceReadiness,
  assessChecklistReadiness,
  generateChecklistBlockers,
} from "./workface-readiness";

// ── Exported Types ──────────────────────────────────────────────────────────────

/** A blocker preventing an activity from being ready. */
export interface LookaheadBlocker {
  activityKey: string;
  blockerType: LookaheadBlockerType;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  /** ID of the blocking activity or resource, if applicable. */
  sourceId: string | null;
}

/** An activity assessed for the lookahead window. */
export interface LookaheadActivity {
  activityKey: string;
  name: string;
  tradeKey: string;
  requiredCrewCount: number;
  status: string;
  progress: number;
  plannedStartDate: string;
  plannedEndDate: string;
  locationZone: string | null;
  assignedResourceKeys: string[];
  readiness: ReadinessLevel;
  blockers: LookaheadBlocker[];
  onCriticalPath: boolean;
  /** ISO week labels where this activity is active within the horizon. */
  activeWeeks: string[];
  /** Workface readiness checklist items. */
  readinessChecklist: ReadinessChecklistItem[];
  /** Readiness percentage based on completed required checklist items (0-100). */
  readinessPct: number;
}

/** Trade-level need for a single week in the lookahead. */
export interface TradeWeekNeed {
  tradeKey: string;
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  requiredCrews: number;
  availableCrews: number;
  gap: number;
  shortageRisk: ShortageRiskLevel;
  onCriticalPath: boolean;
  activityCount: number;
}

/** A single week in the lookahead. */
export interface LookaheadWeek {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  activities: LookaheadActivity[];
  tradeNeeds: TradeWeekNeed[];
  /** Worst readiness among activities in this week. */
  readiness: ReadinessLevel;
}

/** Aggregated trade summary across all weeks in the horizon. */
export interface TradeSummaryRow {
  tradeKey: string;
  totalRequiredCrews: number;
  totalAvailableCrews: number;
  totalGap: number;
  worstRisk: ShortageRiskLevel;
  activityCount: number;
  onCriticalPath: boolean;
}

/** Full lookahead computation result. */
export interface LookaheadResult {
  horizonWeeks: 3 | 6;
  /** ISO date of the reference date (today) used as anchor. */
  referenceDate: string;
  weeks: LookaheadWeek[];
  allActivities: LookaheadActivity[];
  tradeSummary: TradeSummaryRow[];
  overallReadiness: ReadinessLevel;
  criticalPathGaps: TradeWeekNeed[];
  blockers: LookaheadBlocker[];
}

// ── Internal Types ──────────────────────────────────────────────────────────────

interface WeekDefinition {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

/** Severity ranking for readiness levels (higher = worse). */
const READINESS_SEVERITY: Record<ReadinessLevel, number> = {
  ready: 0,
  at_risk: 1,
  not_ready: 2,
  blocked: 3,
};

/** Severity ranking for shortage risk levels (higher = worse). */
const RISK_SEVERITY: Record<ShortageRiskLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/** Return the worse of two readiness levels. */
function worseReadiness(a: ReadinessLevel, b: ReadinessLevel): ReadinessLevel {
  return READINESS_SEVERITY[a] >= READINESS_SEVERITY[b] ? a : b;
}

/** Return the worse of two shortage risk levels. */
function worseRisk(a: ShortageRiskLevel, b: ShortageRiskLevel): ShortageRiskLevel {
  return RISK_SEVERITY[a] >= RISK_SEVERITY[b] ? a : b;
}

/** Map a blocker type severity from a shortage risk level. */
function shortageRiskToBlockerSeverity(
  risk: ShortageRiskLevel
): "low" | "medium" | "high" | "critical" {
  switch (risk) {
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
      return "high";
    case "critical":
      return "critical";
    default:
      return "low";
  }
}

// ── generateLookaheadWeeks ───────────────────────────────────────────────────────

/**
 * Generate ISO week definitions for the next N weeks starting from
 * the ISO week containing `referenceDate`. Returns weeks sorted
 * chronologically.
 */
export function generateLookaheadWeeks(
  referenceDate: Date,
  horizon: 3 | 6
): WeekDefinition[] {
  const weeks: WeekDefinition[] = [];

  // Find the Monday of the current ISO week
  const dayOfWeek = referenceDate.getUTCDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(referenceDate);
  monday.setUTCDate(referenceDate.getUTCDate() + mondayOffset);
  monday.setUTCHours(0, 0, 0, 0);

  for (let i = 0; i < horizon; i++) {
    const weekStart = new Date(monday);
    weekStart.setUTCDate(monday.getUTCDate() + i * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 4); // Friday

    const year = weekStart.getUTCFullYear();
    // ISO week calculation
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const dayOfYear =
      Math.floor(
        (weekStart.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000)
      ) + 1;
    // Adjust for ISO week (week containing Thursday)
    const thursday = new Date(weekStart);
    thursday.setUTCDate(weekStart.getUTCDate() + 3);
    const thursdayYear = thursday.getUTCFullYear();
    const jan1Thu = new Date(Date.UTC(thursdayYear, 0, 1));
    const isoWeek = Math.ceil(
      ((thursday.getTime() - jan1Thu.getTime()) / (24 * 60 * 60 * 1000) + 1) /
        7
    );

    const weekLabel = `${thursdayYear}-W${String(isoWeek).padStart(2, "0")}`;

    weeks.push({
      weekLabel,
      weekStart: formatDateStr(weekStart),
      weekEnd: formatDateStr(weekEnd),
    });
  }

  return weeks;
}

/** Format a Date to YYYY-MM-DD. */
function formatDateStr(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse a date input (ISO string, Date object, or null) to a Date at midnight UTC. */
function parseDate(dateInput: string | Date | null | undefined): Date {
  if (!dateInput) return new Date(NaN);
  if (dateInput instanceof Date) {
    return new Date(
      Date.UTC(
        dateInput.getUTCFullYear(),
        dateInput.getUTCMonth(),
        dateInput.getUTCDate()
      )
    );
  }
  const isoMatch = (dateInput as string).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(
      Date.UTC(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3])
    );
  }
  return new Date(NaN);
}

/** Check if two date ranges overlap. */
function dateRangesOverlap(
  startA: string | Date,
  endA: string | Date,
  startB: string | Date | null,
  endB: string | Date | null
): boolean {
  if (!startB || !endB) return false;
  const aStart = parseDate(startA).getTime();
  const aEnd = parseDate(endA).getTime();
  const bStart = parseDate(startB).getTime();
  const bEnd = parseDate(endB).getTime();
  if (isNaN(aStart) || isNaN(aEnd) || isNaN(bStart) || isNaN(bEnd))
    return false;
  return aStart <= bEnd && aEnd >= bStart;
}

// ── assessActivityReadiness ──────────────────────────────────────────────────────

/**
 * Determine the readiness level of an activity based on:
 * 1. Activity status (blocked → blocked)
 * 2. Predecessor dependencies (blocked predecessor → blocked, incomplete → at_risk)
 * 3. Resource assignment coverage (none → not_ready, partial → at_risk)
 * 4. Labor gap severity for the trade in active weeks (high/critical → not_ready, medium/low → at_risk)
 * 5. Workface readiness checklist (≥3 incomplete required → not_ready, 1-2 → at_risk)
 */
export function assessActivityReadiness(
  activity: ConstructionActivity,
  dependencies: ActivityDependency[],
  allActivities: ConstructionActivity[],
  tradeWeekGaps: Map<string, ShortageRiskLevel>,
  resources: LaborResource[]
): ReadinessLevel {
  // 1. Blocked status gate
  if (activity.status === "blocked") return "blocked";

  // 2. Check predecessor dependencies
  const predecessorDeps = dependencies.filter(
    (d) => d.successor_id === activity.id
  );

  // Build activity lookup
  const activityById = new Map(allActivities.map((a) => [a.id, a]));

  for (const dep of predecessorDeps) {
    const pred = activityById.get(dep.predecessor_id);
    if (pred) {
      if (pred.status === "blocked") return "blocked";
    }
  }

  // 3. Check resource assignment coverage
  const assignedCount = activity.assigned_resource_keys?.length ?? 0;
  const required = activity.required_crew_count;

  if (required > 0 && assignedCount === 0) return "not_ready";

  // 4. Check labor gaps for the trade in active weeks
  let worstGapRisk: ShortageRiskLevel = "none";
  for (const [, risk] of tradeWeekGaps) {
    if (RISK_SEVERITY[risk] > RISK_SEVERITY[worstGapRisk]) {
      worstGapRisk = risk;
    }
  }

  if (worstGapRisk === "critical" || worstGapRisk === "high") return "not_ready";

  // 5. Now assess remaining factors for at_risk vs ready
  let readiness: ReadinessLevel = "ready";

  // Predecessor not completed → at_risk
  for (const dep of predecessorDeps) {
    const pred = activityById.get(dep.predecessor_id);
    if (pred && pred.status !== "completed") {
      readiness = "at_risk";
      break;
    }
  }

  // Partial resource assignment → at_risk
  if (required > 0 && assignedCount < required) {
    readiness = worseReadiness(readiness, "at_risk");
  }

  // Labor shortage medium/low → at_risk
  if (worstGapRisk === "medium" || worstGapRisk === "low") {
    readiness = worseReadiness(readiness, "at_risk");
  }

  // 5. Workface readiness checklist gate
  const checklistReadiness = assessChecklistReadiness(activity.readiness_checklist);
  readiness = worseReadiness(readiness, checklistReadiness);

  return readiness;
}

/** Map a shortage risk level to a readiness level for gap assessment. */
function riskToReadiness(risk: ShortageRiskLevel): ReadinessLevel {
  switch (risk) {
    case "critical":
    case "high":
      return "not_ready";
    case "medium":
    case "low":
      return "at_risk";
    default:
      return "ready";
  }
}

// ── detectBlockers ──────────────────────────────────────────────────────────────

/**
 * Detect all blockers for an activity.
 */
export function detectBlockers(
  activity: ConstructionActivity,
  dependencies: ActivityDependency[],
  allActivities: ConstructionActivity[],
  tradeWeekGaps: Map<string, ShortageRiskLevel>,
  resources: LaborResource[]
): LookaheadBlocker[] {
  const blockers: LookaheadBlocker[] = [];
  const activityById = new Map(allActivities.map((a) => [a.id, a]));

  // Blocked status
  if (activity.status === "blocked") {
    blockers.push({
      activityKey: activity.activity_key,
      blockerType: "blocked_status",
      description: `Activity "${activity.name}" is marked as blocked.`,
      severity: "critical",
      sourceId: activity.id,
    });
  }

  // Unmet dependencies
  const predecessorDeps = dependencies.filter(
    (d) => d.successor_id === activity.id
  );

  for (const dep of predecessorDeps) {
    const pred = activityById.get(dep.predecessor_id);
    if (pred && pred.status !== "completed") {
      const severity: "low" | "medium" | "high" | "critical" =
        pred.status === "blocked" ? "critical" : "medium";
      blockers.push({
        activityKey: activity.activity_key,
        blockerType: "unmet_dependency",
        description: `Predecessor "${pred.name}" is ${pred.status}.`,
        severity,
        sourceId: pred.id,
      });
    }
  }

  // Labor shortages
  for (const [weekKey, risk] of tradeWeekGaps) {
    if (risk !== "none") {
      blockers.push({
        activityKey: activity.activity_key,
        blockerType: "labor_shortage",
        description: `${risk} labor shortage for trade "${activity.required_trade_key}" in ${weekKey.split(":")[1]}.`,
        severity: shortageRiskToBlockerSeverity(risk),
        sourceId: null,
      });
      // Only report one shortage blocker per activity (worst week)
      break;
    }
  }

  // Vendor unconfirmed and over-allocated resources
  const assignedResources = resources.filter((r) =>
    activity.assigned_resource_keys?.includes(r.resource_key)
  );

  for (const resource of assignedResources) {
    const constraintType = (resource.constraints as Record<string, unknown>)
      ?.type as string | undefined;

    if (constraintType === "vendor_unconfirmed") {
      blockers.push({
        activityKey: activity.activity_key,
        blockerType: "vendor_unconfirmed",
        description: `Vendor "${resource.name}" has not confirmed availability.`,
        severity: "high",
        sourceId: resource.id,
      });
    }

    if (constraintType === "over_allocated") {
      blockers.push({
        activityKey: activity.activity_key,
        blockerType: "over_allocated",
        description: `Resource "${resource.name}" is over-allocated across projects.`,
        severity: "medium",
        sourceId: resource.id,
      });
    }
  }

  // Workface readiness checklist blockers
  const checklistBlockers = generateChecklistBlockers(
    activity.activity_key,
    activity.name,
    activity.readiness_checklist,
    "en" // Default locale for blocker descriptions; the UI renders localized labels separately
  );
  blockers.push(...checklistBlockers);

  return blockers;
}

// ── computeTradeWeekNeeds ───────────────────────────────────────────────────────

/**
 * Compute trade-level needs per week for the lookahead window.
 * Joins demand/supply data and flags critical path impact.
 */
export function computeTradeWeekNeeds(
  activities: ConstructionActivity[],
  resources: LaborResource[],
  weeks: WeekDefinition[],
  dependencies: ActivityDependency[]
): TradeWeekNeed[] {
  const demand = computeDemand(activities, weeks, dependencies);
  const supply = computeSupply(resources);

  // Build supply lookup
  const supplyByKey = new Map<string, { headcount: number; resourceKeys: string[] }>();
  for (const s of supply) {
    const key = `${s.tradeKey}:${s.weekLabel}`;
    const existing = supplyByKey.get(key);
    if (existing) {
      existing.headcount += s.availableHeadcount;
      existing.resourceKeys.push(...s.affectedResourceKeys);
    } else {
      supplyByKey.set(key, {
        headcount: s.availableHeadcount,
        resourceKeys: [...s.affectedResourceKeys],
      });
    }
  }

  // Build activity count per (trade, week)
  const activityCount = new Map<string, Set<string>>();
  for (const a of activities) {
    if (!a.planned_start_date || !a.planned_end_date) continue;
    for (const w of weeks) {
      if (
        dateRangesOverlap(
          a.planned_start_date,
          a.planned_end_date,
          w.weekStart,
          w.weekEnd
        )
      ) {
        const key = `${a.required_trade_key}:${w.weekLabel}`;
        const set = activityCount.get(key) ?? new Set();
        set.add(a.activity_key);
        activityCount.set(key, set);
      }
    }
  }

  // Determine critical path for each (trade, week) — any activity on critical path?
  const criticalPathMap = new Map<string, boolean>();
  for (const a of activities) {
    if (isOnCriticalPath(a.id, dependencies)) {
      for (const w of weeks) {
        if (
          !a.planned_start_date ||
          !a.planned_end_date ||
          !dateRangesOverlap(
            a.planned_start_date,
            a.planned_end_date,
            w.weekStart,
            w.weekEnd
          )
        )
          continue;
        const key = `${a.required_trade_key}:${w.weekLabel}`;
        criticalPathMap.set(key, true);
      }
    }
  }

  // Build trade week needs from demand
  const needs: TradeWeekNeed[] = [];
  const seenKeys = new Set<string>();

  for (const d of demand) {
    const key = `${d.tradeKey}:${d.weekLabel}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const supplyData = supplyByKey.get(key);
    const reqCrews = d.requiredHeadcount;
    const availCrews = supplyData?.headcount ?? 0;
    const gap = availCrews - reqCrews;

    needs.push({
      tradeKey: d.tradeKey,
      weekLabel: d.weekLabel,
      weekStart: d.weekStart,
      weekEnd: d.weekEnd,
      requiredCrews: reqCrews,
      availableCrews: availCrews,
      gap,
      shortageRisk: classifyShortageRisk(reqCrews, availCrews),
      onCriticalPath: criticalPathMap.get(key) ?? false,
      activityCount: activityCount.get(key)?.size ?? 0,
    });
  }

  // Add supply-only entries (available resources with no demand)
  for (const [key, supplyData] of supplyByKey) {
    if (seenKeys.has(key)) continue;
    const [tradeKey, weekLabel] = key.split(":");
    const week = weeks.find((w) => w.weekLabel === weekLabel);
    if (!week) continue;

    needs.push({
      tradeKey,
      weekLabel,
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      requiredCrews: 0,
      availableCrews: supplyData.headcount,
      gap: supplyData.headcount,
      shortageRisk: "none",
      onCriticalPath: criticalPathMap.get(key) ?? false,
      activityCount: 0,
    });
  }

  // Sort by week, then trade
  needs.sort((a, b) => {
    const weekCmp = a.weekLabel.localeCompare(b.weekLabel);
    if (weekCmp !== 0) return weekCmp;
    return a.tradeKey.localeCompare(b.tradeKey);
  });

  return needs;
}

// ── computeTradeSummary ─────────────────────────────────────────────────────────

/**
 * Aggregate trade-level summary across all weeks in the horizon.
 */
function computeTradeSummary(
  tradeNeeds: TradeWeekNeed[],
  activities: LookaheadActivity[],
  dependencies: ActivityDependency[]
): TradeSummaryRow[] {
  const tradeMap = new Map<
    string,
    {
      tradeKey: string;
      totalRequired: number;
      totalAvailable: number;
      worstRisk: ShortageRiskLevel;
      activityKeys: Set<string>;
      onCriticalPath: boolean;
    }
  >();

  for (const need of tradeNeeds) {
    const existing = tradeMap.get(need.tradeKey);
    if (existing) {
      existing.totalRequired += need.requiredCrews;
      existing.totalAvailable += need.availableCrews;
      if (
        READINESS_SEVERITY[riskToReadiness(need.shortageRisk)] >
        READINESS_SEVERITY[riskToReadiness(existing.worstRisk)]
      ) {
        existing.worstRisk = need.shortageRisk;
      }
      if (need.onCriticalPath) existing.onCriticalPath = true;
    } else {
      tradeMap.set(need.tradeKey, {
        tradeKey: need.tradeKey,
        totalRequired: need.requiredCrews,
        totalAvailable: need.availableCrews,
        worstRisk: need.shortageRisk,
        activityKeys: new Set(),
        onCriticalPath: need.onCriticalPath,
      });
    }
  }

  // Add activity keys
  for (const a of activities) {
    const entry = tradeMap.get(a.tradeKey);
    if (entry) {
      entry.activityKeys.add(a.activityKey);
    }
  }

  return Array.from(tradeMap.values())
    .map((entry) => ({
      tradeKey: entry.tradeKey,
      totalRequiredCrews: entry.totalRequired,
      totalAvailableCrews: entry.totalAvailable,
      totalGap: entry.totalAvailable - entry.totalRequired,
      worstRisk: entry.worstRisk,
      activityCount: entry.activityKeys.size,
      onCriticalPath: entry.onCriticalPath,
    }))
    .sort((a, b) => a.tradeKey.localeCompare(b.tradeKey));
}

// ── computeLookahead ────────────────────────────────────────────────────────────

/**
 * Compute all lookahead metrics for a given horizon.
 * This is the main entry point — call from the server page and pass
 * the result down to all components.
 *
 * Pure function: same inputs → same outputs. No database calls.
 */
export function computeLookahead(
  resources: LaborResource[],
  activities: ConstructionActivity[],
  dependencies: ActivityDependency[],
  milestones: Milestone[],
  taxonomy: TradeTaxonomy[],
  horizon: 3 | 6,
  referenceDate?: Date
): LookaheadResult {
  const refDate = referenceDate ?? new Date();
  const refISO = formatDateStr(refDate);

  // 1. Generate lookahead weeks
  const weeks = generateLookaheadWeeks(refDate, horizon);

  if (weeks.length === 0) {
    return {
      horizonWeeks: horizon,
      referenceDate: refISO,
      weeks: [],
      allActivities: [],
      tradeSummary: [],
      overallReadiness: "ready",
      criticalPathGaps: [],
      blockers: [],
    };
  }

  // 2. Filter activities to those overlapping the lookahead window
  const horizonStart = parseDate(weeks[0].weekStart);
  const horizonEnd = parseDate(weeks[weeks.length - 1].weekEnd);

  const horizonActivities = activities.filter((a) => {
    if (!a.planned_start_date || !a.planned_end_date) return false;
    const start = parseDate(a.planned_start_date);
    const end = parseDate(a.planned_end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
    return start <= horizonEnd && end >= horizonStart;
  });

  // 3. Compute trade week needs
  const tradeNeeds = computeTradeWeekNeeds(
    horizonActivities,
    resources,
    weeks,
    dependencies
  );

  // 4. Build trade-week gap lookup for readiness assessment
  const tradeWeekGapMap = new Map<string, ShortageRiskLevel>();
  for (const need of tradeNeeds) {
    const key = `${need.tradeKey}:${need.weekLabel}`;
    const existing = tradeWeekGapMap.get(key);
    if (!existing || RISK_SEVERITY[need.shortageRisk] > RISK_SEVERITY[existing]) {
      tradeWeekGapMap.set(key, need.shortageRisk);
    }
  }

  // 5. Assess each activity's readiness and blockers
  const allLookaheadActivities: LookaheadActivity[] = horizonActivities.map(
    (activity) => {
      // Determine which weeks this activity spans
      const activeWeeks = weeks
        .filter((w) =>
          dateRangesOverlap(
            activity.planned_start_date,
            activity.planned_end_date,
            w.weekStart,
            w.weekEnd
          )
        )
        .map((w) => w.weekLabel);

      // Build gap map for this activity's trade + active weeks
      const activityGapMap = new Map<string, ShortageRiskLevel>();
      for (const weekLabel of activeWeeks) {
        const key = `${activity.required_trade_key}:${weekLabel}`;
        const risk = tradeWeekGapMap.get(key);
        if (risk) activityGapMap.set(key, risk);
      }

      const readiness = assessActivityReadiness(
        activity,
        dependencies,
        activities,
        activityGapMap,
        resources
      );

      const blockers = detectBlockers(
        activity,
        dependencies,
        activities,
        activityGapMap,
        resources
      );

      // Compute workface readiness percentage from checklist
      const workfaceResult = computeWorkfaceReadiness(
        activity.activity_key,
        activity.readiness_checklist
      );

      return {
        activityKey: activity.activity_key,
        name: activity.name,
        tradeKey: activity.required_trade_key,
        requiredCrewCount: activity.required_crew_count,
        status: activity.status,
        progress: activity.progress ?? 0,
        plannedStartDate: activity.planned_start_date ?? "",
        plannedEndDate: activity.planned_end_date ?? "",
        locationZone: activity.location_zone ?? null,
        assignedResourceKeys: activity.assigned_resource_keys ?? [],
        readiness,
        blockers,
        onCriticalPath: isOnCriticalPath(activity.id, dependencies),
        activeWeeks,
        readinessChecklist: workfaceResult.checklist,
        readinessPct: workfaceResult.readinessPct,
      };
    }
  );

  // 6. Build per-week data
  const lookaheadWeeks: LookaheadWeek[] = weeks.map((w) => {
    const weekActivities = allLookaheadActivities.filter((a) =>
      a.activeWeeks.includes(w.weekLabel)
    );
    const weekTradeNeeds = tradeNeeds.filter(
      (n) => n.weekLabel === w.weekLabel
    );

    // Week readiness = worst activity readiness
    let weekReadiness: ReadinessLevel = "ready";
    for (const a of weekActivities) {
      weekReadiness = worseReadiness(weekReadiness, a.readiness);
    }
    if (weekActivities.length === 0) weekReadiness = "ready";

    return {
      weekLabel: w.weekLabel,
      weekStart: w.weekStart,
      weekEnd: w.weekEnd,
      activities: weekActivities,
      tradeNeeds: weekTradeNeeds,
      readiness: weekReadiness,
    };
  });

  // 7. Compute overall readiness
  let overallReadiness: ReadinessLevel = "ready";
  for (const a of allLookaheadActivities) {
    overallReadiness = worseReadiness(overallReadiness, a.readiness);
  }

  // 8. Compute trade summary
  const tradeSummary = computeTradeSummary(
    tradeNeeds,
    allLookaheadActivities,
    dependencies
  );

  // 9. Identify critical path gaps
  const criticalPathGaps = tradeNeeds.filter(
    (n) => n.onCriticalPath && n.shortageRisk !== "none"
  );

  // 10. Collect all blockers
  const allBlockers = allLookaheadActivities.flatMap((a) => a.blockers);

  return {
    horizonWeeks: horizon,
    referenceDate: refISO,
    weeks: lookaheadWeeks,
    allActivities: allLookaheadActivities,
    tradeSummary,
    overallReadiness,
    criticalPathGaps,
    blockers: allBlockers,
  };
}