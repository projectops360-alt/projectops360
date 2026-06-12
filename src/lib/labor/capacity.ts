// ============================================================================
// ProjectOps360° — Labor Capacity Calculation Logic
// ============================================================================
// Pure functions that compute weekly labor capacity gaps by comparing required
// labor from planned activities against available crew capacity by trade and
// week. Returns labor gap, over-allocation, utilization percentage, shortage
// severity, affected activities, and affected milestones.
//
// No database calls — these operate on already-fetched data.
// Deterministic: same inputs → same outputs. No AI calls.
//
// Mirrors the SQL compute_labor_capacity() function defined in
// supabase/migrations/20260628000000_create_labor_capacity.sql.
// ============================================================================

import type {
  ActivityDependency,
  ConstructionActivity,
  LaborResource,
  Milestone,
  ShortageRiskLevel,
} from "@/types/database";

// ── Availability Window ────────────────────────────────────────────────────────

/** Weekly availability window for a labor resource.
 *  Corresponds to the JSONB structure in LaborResource.availability. */
export interface AvailabilityWindow {
  week: string; // e.g. "2026-W29"
  start: string; // ISO date, Monday
  end: string; // ISO date, Friday
  available_hours: number;
  status: "available" | "partial" | "unavailable";
}

// ── Shortage Risk Thresholds ───────────────────────────────────────────────────

/** Thresholds for shortage risk classification.
 *  Values are ratios of required_headcount / available_headcount. */
export interface ShortageThresholds {
  low: number; // default 1.10
  medium: number; // default 1.25
  high: number; // default 1.50
  // critical = ratio > high OR (available = 0 AND required > 0)
  // none   = ratio <= 1.0
}

/** Default thresholds matching the SQL compute_labor_capacity() function. */
export const DEFAULT_SHORTAGE_THRESHOLDS: ShortageThresholds = {
  low: 1.10,
  medium: 1.25,
  high: 1.50,
};

// ── Output Types ───────────────────────────────────────────────────────────────

/** One row of weekly labor capacity gap analysis, for a single (trade, week). */
export interface WeeklyCapacityGap {
  tradeKey: string;
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  locationZone: string | null;
  requiredHeadcount: number;
  availableHeadcount: number;
  requiredHours: number;
  availableHours: number;
  gapHeadcount: number; // available - required (negative = shortage)
  gapHours: number;
  utilizationPct: number | null; // required/available * 100 (null if available=0)
  shortageRisk: ShortageRiskLevel;
  criticalPathImpact: boolean;
  affectedActivityKeys: string[];
  affectedResourceKeys: string[];
}

/** Full labor capacity computation result, analogous to RoadmapProgress. */
export interface LaborCapacityResult {
  /** One entry per (trade, week) pair that has demand or supply. */
  weeklyGaps: WeeklyCapacityGap[];
  /** Milestone IDs that are potentially impacted by labor gaps. */
  affectedMilestoneIds: string[];
  /** Number of trades with at least one week at "high" or "critical" risk. */
  criticalTradeCount: number;
  /** Number of distinct weeks that have at least one shortage (risk > "none"). */
  shortageWeekCount: number;
  /** Maximum utilization across all rows (null if no rows). */
  maxUtilizationPct: number | null;
  /** ISO timestamp of when this computation was run. */
  computedAt: string;
}

// ── Internal Types ─────────────────────────────────────────────────────────────

/** A generated ISO week definition. */
interface WeekDefinition {
  weekLabel: string; // e.g. "2026-W29"
  weekStart: string; // ISO date (Monday)
  weekEnd: string; // ISO date (Friday)
}

/** Demand contribution from activities for a (trade, week, zone) tuple. */
interface DemandEntry {
  tradeKey: string;
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  locationZone: string | null;
  requiredHeadcount: number;
  requiredHours: number;
  affectedActivityKeys: string[];
  hasSuccessors: boolean;
}

/** Supply from resources for a (trade, week) tuple. */
interface SupplyEntry {
  tradeKey: string;
  weekLabel: string;
  availableHeadcount: number;
  availableHours: number;
  affectedResourceKeys: string[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

/** Parse a date input (ISO string, Date object, or null/undefined) to a Date at midnight UTC.
 *  Handles both Supabase JS client (returns ISO strings) and raw pg client (returns Date objects). */
function parseDate(dateInput: string | Date | null | undefined): Date {
  if (!dateInput) return new Date(NaN);
  if (dateInput instanceof Date) {
    // Normalize to midnight UTC (strip timezone offset from pg Date objects)
    return new Date(
      Date.UTC(
        dateInput.getFullYear(),
        dateInput.getMonth(),
        dateInput.getDate()
      )
    );
  }
  // ISO string: strip any time portion and set to UTC midnight
  const isoMatch = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(
      Date.UTC(
        +isoMatch[1],
        +isoMatch[2] - 1,
        +isoMatch[3]
      )
    );
  }
  return new Date(NaN);
}

/** Format a Date to YYYY-MM-DD. */
function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Round a number to `decimals` decimal places. */
function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Compute the ISO week number and year for a given date.
 * Returns { year, week } where week is 1-53 and year is the ISO year.
 * Follows the same logic as PostgreSQL's to_char(date, 'IYYY') / to_char(date, 'IW').
 */
function getIsoWeek(date: Date): { year: number; week: number } {
  // Copy date and set to Thursday of the same ISO week
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  // Set to nearest Thursday (ISO week starts on Monday)
  const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // Thursday in current week: day 4
  // Adjust: Thursday = current date + (4 - current day of week) adjusted for Sunday
  const thursdayOffset = dayOfWeek <= 4 ? 4 - dayOfWeek : 4 - dayOfWeek + 7;
  d.setUTCDate(d.getUTCDate() + thursdayOffset);

  const year = d.getUTCFullYear();
  // Week number: days from Jan 1 to Thursday, divided by 7, + 1
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dayOfYear =
    (d.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000) + 1;
  const week = Math.ceil(dayOfYear / 7);

  return { year, week };
}

/** Format an ISO week label like "2026-W29". */
function formatWeekLabel(date: Date): string {
  const { year, week } = getIsoWeek(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Check if two date ranges overlap. Accepts ISO strings or Date objects. */
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
  if (isNaN(aStart) || isNaN(aEnd) || isNaN(bStart) || isNaN(bEnd)) return false;
  return aStart <= bEnd && aEnd >= bStart;
}

// ── parseAvailabilityWindows ────────────────────────────────────────────────────

const VALID_STATUSES = new Set(["available", "partial", "unavailable"]);

/**
 * Safely parse the untyped availability JSONB into typed AvailabilityWindow[].
 * Invalid entries are silently skipped (defensive against malformed data).
 */
export function parseAvailabilityWindows(
  raw: Record<string, unknown>[]
): AvailabilityWindow[] {
  const result: AvailabilityWindow[] = [];
  for (const entry of raw) {
    if (
      typeof entry.week === "string" &&
      typeof entry.start === "string" &&
      typeof entry.end === "string" &&
      typeof entry.available_hours === "number" &&
      VALID_STATUSES.has(entry.status as string)
    ) {
      result.push({
        week: entry.week,
        start: entry.start,
        end: entry.end,
        available_hours: entry.available_hours,
        status: entry.status as AvailabilityWindow["status"],
      });
    }
  }
  return result;
}

// ── generateWeeks ───────────────────────────────────────────────────────────────

/**
 * Generate ISO week definitions from the date range spanned by activities.
 * Mirrors the SQL compute_labor_capacity() project_weeks CTE:
 * starts from MIN(planned_start_date), steps by 7 days, and computes
 * ISO week label + week_end = week_start + 4 days.
 * Returns weeks sorted by weekStart.
 * If activities array is empty, returns [].
 */
export function generateWeeks(
  activities: ConstructionActivity[]
): WeekDefinition[] {
  if (activities.length === 0) return [];

  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  for (const a of activities) {
    if (!a.planned_start_date || !a.planned_end_date) continue;
    const start = parseDate(a.planned_start_date);
    const end = parseDate(a.planned_end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;
    if (!minDate || start < minDate) minDate = start;
    if (!maxDate || end > maxDate) maxDate = end;
  }

  if (!minDate || !maxDate) return [];

  const weeks: WeekDefinition[] = [];
  const current = new Date(minDate);

  while (current <= maxDate) {
    const weekEnd = new Date(current);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 4);

    weeks.push({
      weekLabel: formatWeekLabel(current),
      weekStart: formatDate(current),
      weekEnd: formatDate(weekEnd),
    });

    // Advance by 7 days
    current.setUTCDate(current.getUTCDate() + 7);
  }

  return weeks;
}

// ── computeDemand ───────────────────────────────────────────────────────────────

/**
 * Compute labor demand per (trade_key, week, location_zone) from activities.
 * For each activity that spans a given week, its required_crew_count contributes
 * to required_headcount and its estimated_hours are prorated by the fraction of
 * the activity that falls within the week.
 */
export function computeDemand(
  activities: ConstructionActivity[],
  weeks: WeekDefinition[],
  dependencies: ActivityDependency[]
): DemandEntry[] {
  // Build set of predecessor IDs for critical path check
  const predecessorIds = new Set(dependencies.map((d) => d.predecessor_id));

  // Accumulate demand grouped by (tradeKey, weekLabel, locationZone)
  const demandMap = new Map<
    string,
    {
      tradeKey: string;
      weekLabel: string;
      weekStart: string;
      weekEnd: string;
      locationZone: string | null;
      requiredHeadcount: number;
      requiredHours: number;
      affectedActivityKeys: Set<string>;
      hasSuccessors: boolean;
    }
  >();

  for (const a of activities) {
    if (!a.planned_start_date || !a.planned_end_date) continue;

    const activityStart = parseDate(a.planned_start_date);
    const activityEnd = parseDate(a.planned_end_date);
    const totalDays =
      (activityEnd.getTime() - activityStart.getTime()) / (24 * 60 * 60 * 1000) + 1;

    const activityHasSuccessors = predecessorIds.has(a.id);

    for (const w of weeks) {
      const weekStart = parseDate(w.weekStart);
      const weekEnd = parseDate(w.weekEnd);

      // Does this activity overlap with this week?
      if (activityStart > weekEnd || activityEnd < weekStart) continue;

      // Compute overlap in days
      const overlapStart = activityStart > weekStart ? activityStart : weekStart;
      const overlapEnd = activityEnd < weekEnd ? activityEnd : weekEnd;
      const overlapDays =
        (overlapEnd.getTime() - overlapStart.getTime()) /
          (24 * 60 * 60 * 1000) +
        1;

      // Prorate hours
      const proratedHours = roundTo(
        (a.estimated_hours * overlapDays) / totalDays,
        2
      );

      // Group key: tradeKey:weekLabel:zone
      const zoneKey = a.location_zone ?? "__all__";
      const key = `${a.required_trade_key}:${w.weekLabel}:${zoneKey}`;

      const existing = demandMap.get(key);
      if (existing) {
        existing.requiredHeadcount += a.required_crew_count;
        existing.requiredHours = roundTo(existing.requiredHours + proratedHours, 2);
        existing.affectedActivityKeys.add(a.activity_key);
        if (activityHasSuccessors) existing.hasSuccessors = true;
      } else {
        demandMap.set(key, {
          tradeKey: a.required_trade_key,
          weekLabel: w.weekLabel,
          weekStart: w.weekStart,
          weekEnd: w.weekEnd,
          locationZone: a.location_zone || null,
          requiredHeadcount: a.required_crew_count,
          requiredHours: proratedHours,
          affectedActivityKeys: new Set([a.activity_key]),
          hasSuccessors: activityHasSuccessors,
        });
      }
    }
  }

  // Convert map to array, replace Set with array for output
  return Array.from(demandMap.values()).map((d) => ({
    ...d,
    affectedActivityKeys: Array.from(d.affectedActivityKeys),
  }));
}

// ── computeSupply ───────────────────────────────────────────────────────────────

/**
 * Compute labor supply per (trade_key, week) from resources.
 * Sums headcount and hours from availability windows where status != "unavailable".
 */
export function computeSupply(resources: LaborResource[]): SupplyEntry[] {
  const supplyMap = new Map<
    string,
    {
      tradeKey: string;
      weekLabel: string;
      availableHeadcount: number;
      availableHours: number;
      affectedResourceKeys: Set<string>;
    }
  >();

  for (const r of resources) {
    const windows = parseAvailabilityWindows(r.availability);

    for (const w of windows) {
      if (w.status === "unavailable") continue;

      const key = `${r.trade_key}:${w.week}`;

      const existing = supplyMap.get(key);
      if (existing) {
        existing.availableHeadcount += r.headcount;
        existing.availableHours = roundTo(
          existing.availableHours + w.available_hours,
          2
        );
        existing.affectedResourceKeys.add(r.resource_key);
      } else {
        supplyMap.set(key, {
          tradeKey: r.trade_key,
          weekLabel: w.week,
          availableHeadcount: r.headcount,
          availableHours: w.available_hours,
          affectedResourceKeys: new Set([r.resource_key]),
        });
      }
    }
  }

  return Array.from(supplyMap.values()).map((s) => ({
    ...s,
    affectedResourceKeys: Array.from(s.affectedResourceKeys),
  }));
}

// ── computeUtilization ──────────────────────────────────────────────────────────

/**
 * Compute utilization percentage: required / available * 100.
 * Returns null when available is 0 (cannot divide by zero).
 * Returns 0 when both required and available are 0.
 */
export function computeUtilization(
  requiredHeadcount: number,
  availableHeadcount: number
): number | null {
  if (availableHeadcount === 0) {
    return requiredHeadcount > 0 ? null : 0;
  }
  return roundTo((requiredHeadcount / availableHeadcount) * 100, 2);
}

// ── classifyShortageRisk ────────────────────────────────────────────────────────

/**
 * Classify shortage severity based on the ratio of required to available headcount.
 * Uses configurable thresholds; defaults match the SQL compute_labor_capacity() function.
 * Special case: available=0 and required>0 → "critical".
 * Special case: available=0 and required=0 → "none".
 */
export function classifyShortageRisk(
  requiredHeadcount: number,
  availableHeadcount: number,
  thresholds: ShortageThresholds = DEFAULT_SHORTAGE_THRESHOLDS
): ShortageRiskLevel {
  // No available capacity but demand exists — worst case
  if (availableHeadcount === 0 && requiredHeadcount > 0) return "critical";
  // No demand and no supply — nothing to classify
  if (availableHeadcount === 0) return "none";

  const ratio = requiredHeadcount / availableHeadcount;

  if (ratio > thresholds.high) return "critical";
  if (ratio > thresholds.medium) return "high";
  if (ratio > thresholds.low) return "medium";
  if (ratio > 1.0) return "low";
  return "none";
}

// ── isOnCriticalPath ────────────────────────────────────────────────────────────

/**
 * Determine if an activity is on or near the critical path.
 * An activity is considered to have critical path impact if it has
 * at least one successor in the dependency graph (it is a predecessor
 * for another activity). This mirrors the SQL function's
 * BOOL_OR(EXISTS (SELECT 1 FROM activity_dependencies ad WHERE ad.predecessor_id = a.id)).
 */
export function isOnCriticalPath(
  activityId: string,
  dependencies: ActivityDependency[]
): boolean {
  return dependencies.some((d) => d.predecessor_id === activityId);
}

// ── findAffectedMilestones ──────────────────────────────────────────────────────

/**
 * Infer which milestones are potentially impacted by labor gaps.
 * A milestone is affected if any gapped activity's date range overlaps
 * the milestone's start_date..target_date window. Only activities with
 * shortage_risk > "none" are considered.
 * Returns milestone IDs sorted by order_index.
 */
export function findAffectedMilestones(
  weeklyGaps: WeeklyCapacityGap[],
  activities: ConstructionActivity[],
  milestones: Milestone[]
): string[] {
  // Collect activity keys that have a shortage
  const gappedActivityKeys = new Set<string>();
  for (const gap of weeklyGaps) {
    if (gap.shortageRisk !== "none") {
      for (const key of gap.affectedActivityKeys) {
        gappedActivityKeys.add(key);
      }
    }
  }

  if (gappedActivityKeys.size === 0) return [];

  // Map activity keys to their date ranges
  const gappedActivities = activities.filter((a) =>
    gappedActivityKeys.has(a.activity_key)
  );

  // Find milestones where at least one gapped activity overlaps
  const affectedIds = new Set<string>();
  for (const milestone of milestones) {
    if (!milestone.start_date || !milestone.target_date) continue;

    for (const activity of gappedActivities) {
      if (
        dateRangesOverlap(
          activity.planned_start_date,
          activity.planned_end_date,
          milestone.start_date,
          milestone.target_date
        )
      ) {
        affectedIds.add(milestone.id);
        break; // No need to check more activities for this milestone
      }
    }
  }

  // Sort by milestone order_index
  const sortedMilestones = milestones
    .filter((m) => affectedIds.has(m.id))
    .sort((a, b) => a.order_index - b.order_index);

  return sortedMilestones.map((m) => m.id);
}

// ── computeLaborCapacity ────────────────────────────────────────────────────────

/**
 * Compute all weekly labor capacity metrics in one pass.
 * This is the main entry point — call from the server page and pass
 * the result down to all components.
 *
 * Pure function: same inputs → same outputs. No database calls.
 */
export function computeLaborCapacity(
  resources: LaborResource[],
  activities: ConstructionActivity[],
  dependencies: ActivityDependency[],
  milestones: Milestone[],
  thresholds: ShortageThresholds = DEFAULT_SHORTAGE_THRESHOLDS
): LaborCapacityResult {
  // 1. Generate week grid from activity date range
  const weeks = generateWeeks(activities);

  // 2. Compute demand and supply
  const demand = computeDemand(activities, weeks, dependencies);
  const supply = computeSupply(resources);

  // 3. Build supply lookup: tradeKey:weekLabel → SupplyEntry
  const supplyByKey = new Map<string, SupplyEntry>();
  for (const s of supply) {
    supplyByKey.set(`${s.tradeKey}:${s.weekLabel}`, s);
  }

  // 4. Track which supply keys were matched (for supply-only entries)
  const matchedSupplyKeys = new Set<string>();

  // 5. Build weekly gaps from demand (with matched supply)
  const weeklyGaps: WeeklyCapacityGap[] = [];

  for (const d of demand) {
    const supplyKey = `${d.tradeKey}:${d.weekLabel}`;
    const s = supplyByKey.get(supplyKey);
    if (s) matchedSupplyKeys.add(supplyKey);

    const reqHc = d.requiredHeadcount;
    const availHc = s?.availableHeadcount ?? 0;
    const reqHrs = d.requiredHours;
    const availHrs = s?.availableHours ?? 0;

    weeklyGaps.push({
      tradeKey: d.tradeKey,
      weekLabel: d.weekLabel,
      weekStart: d.weekStart,
      weekEnd: d.weekEnd,
      locationZone: d.locationZone,
      requiredHeadcount: reqHc,
      availableHeadcount: availHc,
      requiredHours: reqHrs,
      availableHours: availHrs,
      gapHeadcount: availHc - reqHc,
      gapHours: roundTo(availHrs - reqHrs, 2),
      utilizationPct: computeUtilization(reqHc, availHc),
      shortageRisk: classifyShortageRisk(reqHc, availHc, thresholds),
      criticalPathImpact: d.hasSuccessors,
      affectedActivityKeys: d.affectedActivityKeys,
      affectedResourceKeys: s?.affectedResourceKeys ?? [],
    });
  }

  // 6. Add supply-only entries (available resources with no demand)
  for (const s of supply) {
    const supplyKey = `${s.tradeKey}:${s.weekLabel}`;
    if (matchedSupplyKeys.has(supplyKey)) continue;

    weeklyGaps.push({
      tradeKey: s.tradeKey,
      weekLabel: s.weekLabel,
      // Derive week start/end from the supply data (availability window dates)
      weekStart: "", // Will be filled from weeks map below
      weekEnd: "",
      locationZone: null,
      requiredHeadcount: 0,
      availableHeadcount: s.availableHeadcount,
      requiredHours: 0,
      availableHours: s.availableHours,
      gapHeadcount: s.availableHeadcount,
      gapHours: s.availableHours,
      utilizationPct: 0,
      shortageRisk: "none" as ShortageRiskLevel,
      criticalPathImpact: false,
      affectedActivityKeys: [],
      affectedResourceKeys: s.affectedResourceKeys,
    });
  }

  // 7. Fill weekStart/weekEnd for supply-only entries from weeks map
  const weekByLabel = new Map(weeks.map((w) => [w.weekLabel, w]));
  for (const gap of weeklyGaps) {
    if (!gap.weekStart) {
      const w = weekByLabel.get(gap.weekLabel);
      if (w) {
        gap.weekStart = w.weekStart;
        gap.weekEnd = w.weekEnd;
      }
    }
  }

  // 8. Sort: by weekLabel, then tradeKey
  weeklyGaps.sort((a, b) => {
    const weekCmp = a.weekLabel.localeCompare(b.weekLabel);
    if (weekCmp !== 0) return weekCmp;
    return a.tradeKey.localeCompare(b.tradeKey);
  });

  // 9. Compute affected milestones
  const affectedMilestoneIds = findAffectedMilestones(
    weeklyGaps,
    activities,
    milestones
  );

  // 10. Compute summary statistics
  const shortageWeeks = new Set<string>();
  const criticalTrades = new Set<string>();
  let maxUtil: number | null = null;

  for (const gap of weeklyGaps) {
    if (gap.shortageRisk !== "none") {
      shortageWeeks.add(gap.weekLabel);
    }
    if (gap.shortageRisk === "high" || gap.shortageRisk === "critical") {
      criticalTrades.add(gap.tradeKey);
    }
    if (gap.utilizationPct !== null) {
      if (maxUtil === null || gap.utilizationPct > maxUtil) {
        maxUtil = gap.utilizationPct;
      }
    }
  }

  return {
    weeklyGaps,
    affectedMilestoneIds,
    criticalTradeCount: criticalTrades.size,
    shortageWeekCount: shortageWeeks.size,
    maxUtilizationPct: maxUtil,
    computedAt: new Date().toISOString(),
  };
}