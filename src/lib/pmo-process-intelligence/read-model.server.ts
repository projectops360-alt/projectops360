// ============================================================================
// PMO Process Intelligence — read-only server adapter (CAP-047 · M4)
// ============================================================================
// The smallest safe adapter between the PEG and the module's pure engines.
// Mirrors the CAP-046 load-analysis pattern:
//   1. org context via the existing auth pattern,
//   2. RLS-scoped SELECTs only (the caller sees only what their role allows),
//   3. defense-in-depth scopeToOrganization barrier (CAP-047 M2),
//   4. pure case mapping + buildFlowModel.
// NEVER writes: no event emission, no LLM, no canonical record changes.
// PD-019: project_event_log is the only event source — no second pipeline.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale, ProjectStatus } from "@/types/database";
import { outcomeForStatus } from "@/lib/process-mining/variants/load-analysis";
import { buildFlowModel } from "./flow-projection";
import { casesByProject, casesBySubject, type PmoPiEventRow } from "./case-mapping";
import { scopeToOrganization } from "./scope";
import type { PmoPiFlowModel } from "./contracts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cap the event window read for one projection run (disclosed when hit). */
const MAX_EVENTS = 20000;

export type PmoPiFlowLoadResult =
  | {
      status: "ok";
      model: PmoPiFlowModel;
      truncated: boolean;
      projects: { id: string; title: string }[];
      /** Set when drilled into one project. */
      focusProject: { id: string; title: string } | null;
    }
  | { status: "unauthorized" }
  | { status: "error" };

export async function loadPmoPiFlowModel(
  locale: Locale,
  focusProjectId: string | null,
): Promise<PmoPiFlowLoadResult> {
  if (focusProjectId !== null && !UUID_RE.test(focusProjectId)) return { status: "unauthorized" };

  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { status: "unauthorized" };
  }

  const supabase = await createClient();

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, slug, title_i18n, status")
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);
  if (projectsError || !projects) return { status: "error" };

  const projectList = projects.map((p) => ({
    id: p.id as string,
    title: getI18nValue(p.title_i18n, locale) || (p.slug as string),
    status: p.status as ProjectStatus,
  }));

  // Drill-down target must belong to the caller's org (deny-by-default).
  const focus = focusProjectId ? projectList.find((p) => p.id === focusProjectId) ?? null : null;
  if (focusProjectId && !focus) return { status: "unauthorized" };

  const scopedProjectIds = focus ? [focus.id] : projectList.map((p) => p.id);
  if (scopedProjectIds.length === 0) {
    const empty = buildFlowModel(
      { organizationId: org.organizationId, projectIds: [], level: "organization" },
      [],
      new Date().toISOString(),
    );
    return { status: "ok", model: empty, truncated: false, projects: [], focusProject: null };
  }

  const { data: eventRows, error: eventsError } = await supabase
    .from("project_event_log")
    .select(
      "event_id, organization_id, project_id, event_type, event_category, occurred_at, recorded_at, event_lifecycle_class, is_compensating_event, subject_type, subject_id, actor_type",
    )
    .eq("organization_id", org.organizationId)
    .in("project_id", scopedProjectIds)
    .order("occurred_at", { ascending: true })
    .order("sequence_number", { ascending: true })
    .limit(MAX_EVENTS);
  if (eventsError) return { status: "error" };

  // Defense in depth: a cross-tenant row can never survive (PMO-PI-TENANT-SCOPE).
  const raw = (eventRows ?? []).map((r) => ({
    ...(r as unknown as Omit<PmoPiEventRow, "source_module">),
    source_module: null,
  })) as PmoPiEventRow[];
  const rows = scopeToOrganization(
    raw.map((row) => ({ organizationId: row.organization_id, row })),
    org.organizationId,
  ).map((x) => x.row);

  const cases = focus
    ? casesBySubject(rows, focus.id)
    : casesByProject(
        rows,
        projectList.map((p) => ({ id: p.id, label: p.title, outcome: outcomeForStatus(p.status) })),
      );

  try {
    const model = buildFlowModel(
      {
        organizationId: org.organizationId,
        projectIds: focus ? [focus.id] : [],
        level: focus ? "project" : "organization",
      },
      cases,
      new Date().toISOString(),
    );
    return {
      status: "ok",
      model,
      truncated: rows.length >= MAX_EVENTS,
      projects: projectList.map((p) => ({ id: p.id, title: p.title })),
      focusProject: focus ? { id: focus.id, title: focus.title } : null,
    };
  } catch (err) {
    console.error("[pmo-pi] flow projection failed:", err);
    return { status: "error" };
  }
}
