// ============================================================================
// ProjectOps360° — Resource Capacity Intelligence service (server-only)
// ============================================================================
// Generic, deterministic capacity engine for ALL project types. Reads real
// data only (project_resource_allocations / project_team_members + roadmap_tasks)
// and NEVER invents capacity, estimates, dates or assignments. Missing inputs
// are surfaced as needs_review / incomplete / unassigned.
//
// Construction Labor Capacity (labor_resources / construction_activities) is a
// separate engine and is untouched.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "@/lib/auth";
import {
  nominalCapacityHours, effectiveCapacityHours, remainingCapacityHours,
  utilizationPercent, overallocatedHours, classifyCapacityStatus,
  workforceAvailabilityPercent, projectOverheadHours, calculateWorkforceHealthIndex,
  type CapacityStatus, type WorkforceHealthResult,
} from "./formulas";

const DONE = new Set(["done", "tested", "completed", "cancelled"]);
const DEFAULT_WEEKLY = 40, DEFAULT_AVAIL = 100, DEFAULT_OVERHEAD = 0;

export interface CapacityWeek { weekLabel: string; weekStart: string; weekEnd: string }
export interface ResourceCapacityRow {
  resourceKey: string;
  name: string;
  role: string | null;
  userId: string | null;
  teamMemberId: string | null;
  nominalWeeklyHours: number;
  effectiveWeeklyHours: number;
  nominalPeriodHours: number;
  effectivePeriodHours: number;
  assignedHours: number;
  remainingHours: number;
  utilizationPercent: number | null;
  overallocatedHours: number;
  overheadPercent: number;
  availabilityPercent: number;
  status: CapacityStatus;
  assignedTaskCount: number;
  criticalTaskCount: number;
  hasCapacityData: boolean;
}
export interface MilestoneCapacityRow {
  milestoneId: string; name: string; requiredHours: number; resourcesInvolved: number;
  overloadedResources: number; tasksWithoutOwner: number; tasksWithoutEstimate: number;
  capacityRiskLevel: "none" | "low" | "medium" | "high";
}
export interface CapacityTotals {
  totalNominalHours: number; totalEffectiveHours: number; totalAssignedHours: number;
  totalRemainingHours: number; totalOverallocatedHours: number;
  workforceAvailabilityPercent: number | null; projectOverheadPercent: number | null;
  overallocatedResourceCount: number; criticalResourceCount: number;
  unassignedTaskCount: number; unassignedCriticalTaskCount: number;
  missingEstimateCount: number; atRiskMilestoneCount: number; averageUtilizationPercent: number | null;
}
export interface CapacityWeeklyPoint { weekLabel: string; effectiveHours: number; assignedHours: number; utilizationPercent: number | null }
export interface ResourceCapacityResult {
  hasResources: boolean;
  hasCapacityInputs: boolean;
  weeks: CapacityWeek[];
  resources: ResourceCapacityRow[];
  milestones: MilestoneCapacityRow[];
  totals: CapacityTotals;
  weekly: CapacityWeeklyPoint[];
  health: WorkforceHealthResult;
  generatedAt: string;
}

// ── Week helpers (ISO weeks, Monday start) ──────────────────────────────────
function mondayOf(d: Date): Date { const x = new Date(d); const day = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - day); x.setUTCHours(0, 0, 0, 0); return x; }
function isoWeekLabel(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
function buildWeeks(start: Date, count: number): CapacityWeek[] {
  const weeks: CapacityWeek[] = [];
  let cur = mondayOf(start);
  for (let i = 0; i < count; i++) {
    const end = new Date(cur); end.setUTCDate(end.getUTCDate() + 6);
    weeks.push({ weekLabel: isoWeekLabel(cur), weekStart: cur.toISOString().slice(0, 10), weekEnd: end.toISOString().slice(0, 10) });
    cur = new Date(cur); cur.setUTCDate(cur.getUTCDate() + 7);
  }
  return weeks;
}
function daysOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const s = Math.max(aStart.getTime(), bStart.getTime());
  const e = Math.min(aEnd.getTime(), bEnd.getTime());
  if (e < s) return 0;
  return Math.floor((e - s) / 86400000) + 1;
}

interface Opts { periodStart?: Date; weeks?: number }

export async function computeResourceCapacity(org: OrgContext, projectId: string, opts: Opts = {}): Promise<ResourceCapacityResult> {
  const supabase = createAdminClient();
  const weekCount = opts.weeks ?? 4;
  const weeks = buildWeeks(opts.periodStart ?? new Date(), weekCount);
  const periodStart = new Date(weeks[0].weekStart + "T00:00:00Z");
  const periodEnd = new Date(weeks[weeks.length - 1].weekEnd + "T00:00:00Z");

  const [allocRes, teamRes, tasksRes, milestonesRes] = await Promise.all([
    supabase.from("project_resource_allocations").select("*").eq("project_id", projectId).eq("organization_id", org.organizationId).neq("status", "removed"),
    supabase.from("project_team_members").select("id, user_id, display_name, project_role").eq("project_id", projectId).eq("organization_id", org.organizationId).neq("status", "removed"),
    supabase.from("roadmap_tasks").select("id, title, estimate_hours, assigned_to, project_team_member_id, start_date, end_date, status, is_critical, milestone_id").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null),
    supabase.from("milestones").select("id, title").eq("project_id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null),
  ]);

  const allocations = (allocRes.data ?? []) as Record<string, unknown>[];
  const team = (teamRes.data ?? []) as Record<string, unknown>[];
  const tasks = (tasksRes.data ?? []) as Record<string, unknown>[];
  const milestones = (milestonesRes.data ?? []) as Record<string, unknown>[];
  const hasCapacityInputs = allocations.length > 0;

  // ── Build the resource list ───────────────────────────────────────────────
  interface Res {
    key: string; name: string; role: string | null; userId: string | null; teamMemberId: string | null;
    weekly: number; avail: number; overhead: number; hasCapacityData: boolean;
  }
  const resources: Res[] = [];
  if (hasCapacityInputs) {
    for (const a of allocations) {
      resources.push({
        key: `alloc:${String(a.id)}`,
        name: (a.display_name as string) || "—",
        role: (a.project_role as string) ?? null,
        userId: (a.user_id as string) ?? null,
        teamMemberId: (a.project_team_member_id as string) ?? null,
        weekly: numOr(a.weekly_capacity_hours, DEFAULT_WEEKLY),
        avail: numOr(a.availability_percent, DEFAULT_AVAIL),
        overhead: numOr(a.overhead_percent, DEFAULT_OVERHEAD),
        hasCapacityData: a.weekly_capacity_hours != null,
      });
    }
  } else {
    // Fallback: project team members, capacity unknown → needs_review.
    for (const m of team) {
      resources.push({
        key: `tm:${String(m.id)}`,
        name: (m.display_name as string) || "—",
        role: (m.project_role as string) ?? null,
        userId: (m.user_id as string) ?? null,
        teamMemberId: String(m.id),
        weekly: DEFAULT_WEEKLY, avail: DEFAULT_AVAIL, overhead: DEFAULT_OVERHEAD,
        hasCapacityData: false,
      });
    }
  }

  // ── Assign tasks to resources + compute per-resource assigned hours ───────
  const byUser = new Map<string, Res>(); const byTm = new Map<string, Res>();
  for (const r of resources) { if (r.userId) byUser.set(r.userId, r); if (r.teamMemberId) byTm.set(r.teamMemberId, r); }

  const assignedHours = new Map<string, number>();
  const assignedTaskCount = new Map<string, number>();
  const criticalTaskCount = new Map<string, number>();
  let unassignedTaskCount = 0, unassignedCriticalTaskCount = 0, missingEstimateCount = 0;

  // Per-week assigned totals (for the timeline) + per-milestone aggregation.
  const weeklyAssigned = new Map<string, number>(); // weekLabel → hours
  const msRequired = new Map<string, number>();
  const msResources = new Map<string, Set<string>>();
  const msNoOwner = new Map<string, number>();
  const msNoEstimate = new Map<string, number>();

  for (const t of tasks) {
    const status = String(t.status ?? "");
    if (DONE.has(status)) continue;
    const est = t.estimate_hours == null ? null : Number(t.estimate_hours);
    const msId = (t.milestone_id as string) ?? null;
    const res: Res | null =
      (t.project_team_member_id ? byTm.get(String(t.project_team_member_id)) : undefined)
      ?? (t.assigned_to ? byUser.get(String(t.assigned_to)) : undefined)
      ?? null;

    if (est == null) {
      missingEstimateCount++;
      if (msId) msNoEstimate.set(msId, (msNoEstimate.get(msId) ?? 0) + 1);
    }
    if (!res) {
      unassignedTaskCount++;
      if (t.is_critical) unassignedCriticalTaskCount++;
      if (msId) msNoOwner.set(msId, (msNoOwner.get(msId) ?? 0) + 1);
    } else {
      assignedTaskCount.set(res.key, (assignedTaskCount.get(res.key) ?? 0) + 1);
      if (t.is_critical) criticalTaskCount.set(res.key, (criticalTaskCount.get(res.key) ?? 0) + 1);
      if (msId) { const set = msResources.get(msId) ?? new Set(); set.add(res.key); msResources.set(msId, set); }
    }

    if (est != null && est > 0) {
      // Prorate estimate across the period weeks the task overlaps.
      const ts = t.start_date ? new Date(String(t.start_date) + "T00:00:00Z") : null;
      const te = t.end_date ? new Date(String(t.end_date) + "T00:00:00Z") : null;
      if (msId) msRequired.set(msId, (msRequired.get(msId) ?? 0) + est);

      if (ts && te && te >= ts) {
        const taskDays = Math.floor((te.getTime() - ts.getTime()) / 86400000) + 1;
        for (const w of weeks) {
          const ws = new Date(w.weekStart + "T00:00:00Z"), we = new Date(w.weekEnd + "T00:00:00Z");
          const ov = daysOverlap(ts, te, ws, we);
          if (ov <= 0) continue;
          const portion = (est * ov) / taskDays;
          weeklyAssigned.set(w.weekLabel, (weeklyAssigned.get(w.weekLabel) ?? 0) + portion);
          if (res) assignedHours.set(res.key, (assignedHours.get(res.key) ?? 0) + portion);
        }
      } else {
        // No dates → attribute fully to the first week of the period.
        weeklyAssigned.set(weeks[0].weekLabel, (weeklyAssigned.get(weeks[0].weekLabel) ?? 0) + est);
        if (res) assignedHours.set(res.key, (assignedHours.get(res.key) ?? 0) + est);
      }
    }
  }

  // ── Apply availability exceptions (subtract unavailable hours) ────────────
  // (Phase A: per-resource exceptions reduce effective capacity for the period.)
  // Kept minimal — exceptions are optional. Fetch only if profiles are linked.
  const profileIds = allocations.map((a) => a.resource_profile_id).filter(Boolean).map(String);
  const exceptionHours = new Map<string, number>();
  if (profileIds.length > 0) {
    const { data: exc } = await supabase.from("resource_availability_exceptions")
      .select("resource_profile_id, start_date, end_date, hours_unavailable")
      .in("resource_profile_id", profileIds).eq("organization_id", org.organizationId);
    for (const e of exc ?? []) {
      const pid = String((e as Record<string, unknown>).resource_profile_id);
      const h = Number((e as Record<string, unknown>).hours_unavailable ?? 0);
      if (h > 0) exceptionHours.set(pid, (exceptionHours.get(pid) ?? 0) + h);
    }
  }
  const profileByResKey = new Map<string, string>();
  if (hasCapacityInputs) for (const a of allocations) if (a.resource_profile_id) profileByResKey.set(`alloc:${String(a.id)}`, String(a.resource_profile_id));

  // ── Build per-resource rows ───────────────────────────────────────────────
  const rows: ResourceCapacityRow[] = resources.map((r) => {
    const effWeekly = effectiveCapacityHours(r.weekly, r.avail, r.overhead);
    const nominalPeriod = nominalCapacityHours(r.weekly) * weekCount;
    const pid = profileByResKey.get(r.key);
    const excH = pid ? (exceptionHours.get(pid) ?? 0) : 0;
    const effPeriod = Math.max(0, effWeekly * weekCount - excH);
    const assigned = round2(assignedHours.get(r.key) ?? 0);
    const util = utilizationPercent(assigned, effPeriod);
    const status = classifyCapacityStatus(util, r.hasCapacityData && effPeriod > 0);
    return {
      resourceKey: r.key, name: r.name, role: r.role, userId: r.userId, teamMemberId: r.teamMemberId,
      nominalWeeklyHours: round2(r.weekly), effectiveWeeklyHours: effWeekly,
      nominalPeriodHours: round2(nominalPeriod), effectivePeriodHours: round2(effPeriod),
      assignedHours: assigned, remainingHours: remainingCapacityHours(effPeriod, assigned),
      utilizationPercent: util, overallocatedHours: overallocatedHours(assigned, effPeriod),
      overheadPercent: round2(r.overhead), availabilityPercent: round2(r.avail),
      status, assignedTaskCount: assignedTaskCount.get(r.key) ?? 0,
      criticalTaskCount: criticalTaskCount.get(r.key) ?? 0, hasCapacityData: r.hasCapacityData,
    };
  });

  // ── Milestones ────────────────────────────────────────────────────────────
  const overloadedKeys = new Set(rows.filter((r) => r.status === "overallocated" || r.status === "critical").map((r) => r.resourceKey));
  const milestoneRows: MilestoneCapacityRow[] = milestones.map((m) => {
    const id = String(m.id);
    const involved = msResources.get(id) ?? new Set<string>();
    const overloaded = [...involved].filter((k) => overloadedKeys.has(k)).length;
    const noOwner = msNoOwner.get(id) ?? 0;
    const noEst = msNoEstimate.get(id) ?? 0;
    const required = round2(msRequired.get(id) ?? 0);
    let risk: MilestoneCapacityRow["capacityRiskLevel"] = "none";
    if (overloaded > 0 || (noOwner > 0 && required > 0)) risk = "high";
    else if (noOwner > 0 || noEst > 0) risk = "medium";
    else if (required > 0 && involved.size === 0) risk = "low";
    return { milestoneId: id, name: String(m.title ?? "—"), requiredHours: required, resourcesInvolved: involved.size, overloadedResources: overloaded, tasksWithoutOwner: noOwner, tasksWithoutEstimate: noEst, capacityRiskLevel: risk };
  });
  // REG-010: the "At-risk Milestones" KPI card and the "Capacity risks" list
  // must use the SAME scope. The list shows high+medium, so the card counts
  // high+medium. "Severe" (high only) feeds the health index, not the card.
  const atRiskMilestoneCount = milestoneRows.filter(
    (m) => m.capacityRiskLevel === "high" || m.capacityRiskLevel === "medium",
  ).length;
  const severeCapacityGapMilestoneCount = milestoneRows.filter((m) => m.capacityRiskLevel === "high").length;

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalNominal = round2(rows.reduce((s, r) => s + r.nominalPeriodHours, 0));
  const totalEffective = round2(rows.reduce((s, r) => s + r.effectivePeriodHours, 0));
  const totalAssigned = round2(rows.reduce((s, r) => s + r.assignedHours, 0));
  const totalOverallocated = round2(rows.reduce((s, r) => s + r.overallocatedHours, 0));
  const overallocCount = rows.filter((r) => r.status === "overallocated").length;
  const criticalCount = rows.filter((r) => r.status === "critical").length;
  const utils = rows.map((r) => r.utilizationPercent).filter((u): u is number => u != null);
  const avgUtil = utils.length ? round2(utils.reduce((s, u) => s + u, 0) / utils.length) : null;
  const overheadPct = totalNominal > 0 ? round2((projectOverheadHours(totalNominal, totalEffective) / totalNominal) * 100) : null;

  const totals: CapacityTotals = {
    totalNominalHours: totalNominal, totalEffectiveHours: totalEffective, totalAssignedHours: totalAssigned,
    totalRemainingHours: round2(totalEffective - totalAssigned), totalOverallocatedHours: totalOverallocated,
    workforceAvailabilityPercent: workforceAvailabilityPercent(totalEffective, totalNominal),
    projectOverheadPercent: overheadPct,
    overallocatedResourceCount: overallocCount, criticalResourceCount: criticalCount,
    unassignedTaskCount, unassignedCriticalTaskCount, missingEstimateCount, atRiskMilestoneCount,
    averageUtilizationPercent: avgUtil,
  };

  // ── Weekly timeline ───────────────────────────────────────────────────────
  const effWeeklyTotal = round2(rows.reduce((s, r) => s + r.effectiveWeeklyHours, 0));
  const weekly: CapacityWeeklyPoint[] = weeks.map((w) => {
    const a = round2(weeklyAssigned.get(w.weekLabel) ?? 0);
    return { weekLabel: w.weekLabel, effectiveHours: effWeeklyTotal, assignedHours: a, utilizationPercent: utilizationPercent(a, effWeeklyTotal) };
  });

  // ── Health index ──────────────────────────────────────────────────────────
  const health = calculateWorkforceHealthIndex({
    criticalResourceCount: criticalCount,
    overallocatedResourceCount: overallocCount,
    unassignedCriticalTaskCount,
    missingEstimateCount,
    severeCapacityGapMilestoneCount,
    overheadExceedsThreshold: (overheadPct ?? 0) > 35,
    effectiveBelow70PctOfNominal: totalNominal > 0 && totalEffective < totalNominal * 0.7,
    missingCriticalRoleCount: 0, // role coverage analysis lands in a later phase
  });

  return {
    hasResources: rows.length > 0, hasCapacityInputs, weeks, resources: rows, milestones: milestoneRows,
    totals, weekly, health, generatedAt: new Date().toISOString(),
  };
}

function numOr(v: unknown, dflt: number): number { const n = Number(v); return Number.isFinite(n) && v != null ? n : dflt; }
function round2(n: number): number { return Math.round((n + Number.EPSILON) * 100) / 100; }
