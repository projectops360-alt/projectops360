// ============================================================================
// ProjectOps360° — Variant Analysis · Read-only Load Adapter (CAP-046 F1)
// ============================================================================
// The smallest safe, READ-ONLY server adapter between the Project Event Graph
// and the Variant Analysis engine. Mirrors the MPF adapter pattern
// (src/lib/milestone-flow-ui/load-projection.ts):
//   1. resolves the caller's org context (existing auth pattern),
//   2. validates the focus project belongs to that organization
//      (deny-by-default — no project row → unauthorized, NO data),
//   3. reads projects + PEG events through the RLS-scoped client (SELECT only —
//      the caller sees only projects/events their role allows, RI-15),
//   4. maps them to engine case inputs and invokes the pure engine.
//
// It NEVER writes: no event emission, no canonical record changes, no LLM call.
// PD-019 rule: no second pipeline — project_event_log is the only event source.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale, ProjectStatus } from "@/types/database";
import { analyzeVariants } from "./engine";
import type {
  VariantAnalysis,
  VariantAssignment,
  VariantCaseInput,
  VariantCaseOutcome,
  VariantEventRef,
} from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cap the event window read for one analysis run. */
const MAX_EVENTS = 20000;

export const VARIANT_PROCESS_TYPE = "project_lifecycle";

export type VariantAnalysisLoadResult =
  | {
      status: "ok";
      analysis: VariantAnalysis;
      /** Assignment of the focus project, when it has analyzable events. */
      focusAssignment: VariantAssignment | null;
      focusProjectId: string;
      projectTitle: string;
      projectNamesById: Record<string, string>;
      /** True when the MAX_EVENTS window truncated history (disclosed, never hidden). */
      truncated: boolean;
    }
  | { status: "unauthorized" }
  | { status: "error" };

/**
 * Project outcome semantics for the `project_lifecycle` process type — derived
 * from the canonical status only (never inferred): completed = success,
 * cancelled = failure, anything else = still open.
 */
export function outcomeForStatus(status: ProjectStatus): VariantCaseOutcome {
  if (status === "completed") return "success";
  if (status === "cancelled") return "failure";
  return "open";
}

interface EventRow {
  event_id: string;
  project_id: string;
  event_type: string;
  event_category: string;
  occurred_at: string;
  event_lifecycle_class: string;
  is_compensating_event: boolean;
}

export async function loadVariantAnalysis(
  focusProjectId: string,
  locale: Locale,
): Promise<VariantAnalysisLoadResult> {
  if (!UUID_RE.test(focusProjectId)) return { status: "unauthorized" };

  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { status: "unauthorized" };
  }

  const supabase = await createClient();

  // Tenant validation — the focus project must exist inside the caller's
  // organization (RLS-scoped). No row → no access; no permissive fallback.
  const { data: focusProject, error: focusError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", focusProjectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();
  if (focusError || !focusProject) return { status: "unauthorized" };

  // Comparable cases = every project the caller can already see (RLS decides).
  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, slug, title_i18n, status")
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);
  if (projectsError || !projects) return { status: "error" };

  const projectIds = projects.map((p) => p.id);
  const { data: eventRows, error: eventsError } = await supabase
    .from("project_event_log")
    .select(
      "event_id, project_id, event_type, event_category, occurred_at, event_lifecycle_class, is_compensating_event",
    )
    .eq("organization_id", org.organizationId)
    .in("project_id", projectIds)
    .order("occurred_at", { ascending: true })
    .order("sequence_number", { ascending: true })
    .limit(MAX_EVENTS);
  if (eventsError) return { status: "error" };

  const rows = (eventRows ?? []) as EventRow[];
  const eventsByProject = new Map<string, VariantEventRef[]>();
  for (const row of rows) {
    const ref: VariantEventRef = {
      eventId: row.event_id,
      eventType: row.event_type,
      eventCategory: row.event_category,
      occurredAt: row.occurred_at,
      lifecycleClass: row.event_lifecycle_class,
      isCompensatingEvent: row.is_compensating_event,
    };
    const list = eventsByProject.get(row.project_id);
    if (list) list.push(ref);
    else eventsByProject.set(row.project_id, [ref]);
  }

  const projectNamesById: Record<string, string> = {};
  const cases: VariantCaseInput[] = projects.map((project) => {
    const title = getI18nValue(project.title_i18n, locale) || project.slug;
    projectNamesById[project.id] = title;
    return {
      caseId: project.id,
      caseLabel: title,
      events: eventsByProject.get(project.id) ?? [],
      outcome: outcomeForStatus(project.status as ProjectStatus),
    };
  });

  try {
    const analysis = analyzeVariants(VARIANT_PROCESS_TYPE, cases);
    return {
      status: "ok",
      analysis,
      focusAssignment:
        analysis.assignments.find((assignment) => assignment.caseId === focusProjectId) ?? null,
      focusProjectId,
      projectTitle: projectNamesById[focusProjectId] ?? "",
      projectNamesById,
      truncated: rows.length >= MAX_EVENTS,
    };
  } catch (err) {
    console.error("Variant analysis failed:", err);
    return { status: "error" };
  }
}
