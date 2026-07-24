import "server-only";

import { getOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getI18nValue, type I18nField, type Locale } from "@/types/database";
import {
  adaptFinancialRows,
  adaptProcessCases,
  adaptProjectRows,
  adaptResourceRows,
  adaptRiskRows,
  type CanonicalProjectRow,
  type FinancialCockpitAdapterRow,
  type FinancialMeasurementAdapterRow,
} from "./adapters";
import type {
  PmoAggregateSnapshot,
  PmoRollupRequest,
} from "./contracts";
import { getPmoAggregateSnapshot } from "./engine";
import { isPmoPortfolioRollupEngineEnabled } from "./flags";
import { calendarDaysBetween, stableHash } from "./math";

export type PmoRollupLoadResult =
  | { status: "ok"; snapshot: PmoAggregateSnapshot }
  | { status: "disabled" }
  | { status: "unauthorized" }
  | { status: "error"; reason: string };

export async function loadPmoAggregateSnapshot(
  locale: Locale,
  request: Omit<PmoRollupRequest, "organizationId">,
): Promise<PmoRollupLoadResult> {
  if (!isPmoPortfolioRollupEngineEnabled()) return { status: "disabled" };

  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { status: "unauthorized" };
  }
  if (org.role !== "owner" && org.role !== "admin") return { status: "unauthorized" };

  const supabase = await createClient();
  const projectsResult = await supabase
    .from("projects")
    .select("id, organization_id, slug, title_i18n, status, target_end_date, created_at, updated_at")
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);
  if (projectsResult.error) return { status: "error", reason: "projects_unavailable" };

  const projectRows = (projectsResult.data ?? []) as Array<{
    id: string;
    organization_id: string;
    slug: string;
    title_i18n: I18nField;
    status: CanonicalProjectRow["status"];
    target_end_date: string | null;
    created_at: string;
    updated_at: string;
  }>;
  const projectIds = projectRows.map((project) => project.id);
  const normalizedProjects = adaptProjectRows(projectRows.map((project) => ({
    id: project.id,
    organization_id: project.organization_id,
    name: getI18nValue(project.title_i18n, locale) || project.slug,
    status: project.status,
    target_end_date: project.target_end_date,
    created_at: project.created_at,
    updated_at: project.updated_at,
  })));

  if (projectIds.length === 0) {
    return {
      status: "ok",
      snapshot: getPmoAggregateSnapshot(
        { ...request, organizationId: org.organizationId },
        {
          access: {
            organizationId: org.organizationId,
            scope: org.role === "owner" ? "admin" : "pmo",
            authorizedProjectIds: [],
            capabilities: ["financial.view"],
          },
          projects: [],
        },
      ),
    };
  }

  const [cockpitResult, measurementResult, riskResult, resourceResult, eventResult] = await Promise.all([
    supabase
      .from("financial_project_cockpit")
      .select("organization_id, project_id, currency, data_date, original_budget, current_baseline, authorized_funding, current_commitment, actual_cost, open_accrual, remaining_reserve, latest_eac")
      .eq("organization_id", org.organizationId)
      .in("project_id", projectIds),
    supabase
      .from("financial_measurement_snapshots")
      .select("id, organization_id, project_id, data_date, formula_version, currency, bac, pv, ev, ac")
      .eq("organization_id", org.organizationId)
      .in("project_id", projectIds)
      .lte("data_date", request.asOf.slice(0, 10)),
    supabase
      .from("risks")
      .select("id, organization_id, project_id, status, severity, probability, confidence_score, metadata, updated_at")
      .eq("organization_id", org.organizationId)
      .in("project_id", projectIds)
      .is("deleted_at", null),
    supabase
      .from("resource_workload_snapshots")
      .select("id, organization_id, project_id, resource_profile_id, resource_key, period_start, period_end, effective_capacity_hours, assigned_work_hours, overallocated_hours, metadata, updated_at")
      .eq("organization_id", org.organizationId)
      .in("project_id", projectIds)
      .lte("period_start", request.periodEnd)
      .gte("period_end", request.periodStart),
    supabase
      .from("project_event_log")
      .select("event_id, organization_id, project_id, case_id, event_type, event_category, occurred_at, recorded_at, event_lifecycle_class, is_compensating_event")
      .eq("organization_id", org.organizationId)
      .in("project_id", projectIds)
      .lte("occurred_at", request.asOf)
      .gte("occurred_at", `${request.periodStart}T00:00:00.000Z`)
      .order("occurred_at", { ascending: true })
      .limit(20_000),
  ]);

  const financialFacts = adaptFinancialRows(
    cockpitResult.error ? [] : cockpitResult.data as unknown as FinancialCockpitAdapterRow[],
    measurementResult.error ? [] : measurementResult.data as unknown as FinancialMeasurementAdapterRow[],
    request.asOf,
  );
  const riskFacts = adaptRiskRows(
    riskResult.error ? [] : riskResult.data as unknown as Parameters<typeof adaptRiskRows>[0],
  );
  const resourceFacts = adaptResourceRows(
    resourceResult.error ? [] : resourceResult.data as unknown as Parameters<typeof adaptResourceRows>[0],
  );
  const processCases = adaptEventRows(
    eventResult.error ? [] : eventResult.data as unknown as EventAdapterRow[],
  );

  try {
    const snapshot = getPmoAggregateSnapshot(
      { ...request, organizationId: org.organizationId },
      {
        access: {
          organizationId: org.organizationId,
          scope: org.role === "owner" ? "admin" : "pmo",
          authorizedProjectIds: projectIds,
          capabilities: ["financial.view"],
        },
        projects: normalizedProjects,
        financialFacts,
        riskFacts,
        resourceFacts,
        processCases,
      },
    );
    return { status: "ok", snapshot };
  } catch (error) {
    console.error("[pmo-rollup] snapshot failed", error);
    return { status: "error", reason: "rollup_failed" };
  }
}

interface EventAdapterRow {
  event_id: string;
  organization_id: string;
  project_id: string;
  case_id: string;
  event_type: string;
  event_category: string;
  occurred_at: string;
  recorded_at: string;
  event_lifecycle_class: string;
  is_compensating_event: boolean;
}

function adaptEventRows(rows: readonly EventAdapterRow[]) {
  const businessRows = rows.filter((row) =>
    row.event_lifecycle_class === "BUSINESS_EVENT" && !row.is_compensating_event);
  const groups = new Map<string, EventAdapterRow[]>();
  for (const row of businessRows) {
    const key = `${row.organization_id}:${row.project_id}:${row.case_id}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  return adaptProcessCases([...groups.values()].map((events) => {
    const sorted = [...events].sort(
      (left, right) =>
        left.occurred_at.localeCompare(right.occurred_at)
        || left.event_id.localeCompare(right.event_id),
    );
    const eventTypes = sorted.map((event) => event.event_type);
    const startedAt = sorted[0]?.occurred_at ?? "1970-01-01T00:00:00.000Z";
    const lastEventAt = sorted.at(-1)?.occurred_at ?? startedAt;
    const completed = eventTypes.some((eventType) =>
      /(completed|closed|achieved|accepted)$/i.test(eventType));
    return {
      factId: `process-case:${sorted[0]?.case_id}:${stableHash(eventTypes)}`,
      organizationId: sorted[0]?.organization_id ?? "",
      projectId: sorted[0]?.project_id ?? "",
      caseId: sorted[0]?.case_id ?? "",
      stageId: null,
      status: completed ? "completed" as const : "active" as const,
      variantId: stableHash(eventTypes),
      eventCount: sorted.length,
      cycleTimeDays: completed
        ? calendarDaysBetween(startedAt.slice(0, 10), lastEventAt.slice(0, 10))
        : null,
      leadTimeDays: calendarDaysBetween(startedAt.slice(0, 10), lastEventAt.slice(0, 10)),
      waitingTimeDays: null,
      hasRework: new Set(eventTypes).size < eventTypes.length,
      repeatedActivityCount: eventTypes.length - new Set(eventTypes).size,
      skippedActivityCount: 0,
      conformant: null,
      slaViolated: null,
      startedAt,
      completedAt: completed ? lastEventAt : null,
      lastEventAt,
    };
  }));
}
