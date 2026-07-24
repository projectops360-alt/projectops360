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
import type { PmoPiCase, PmoPiFlowModel } from "./contracts";
import type { PmoPiProjectDirectoryEntry } from "./executive-projection";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cap the event window read for one projection run (disclosed when hit). */
const MAX_EVENTS = 20000;

export type PmoPiFlowLoadResult =
  | {
      status: "ok";
      model: PmoPiFlowModel;
      cases: PmoPiCase[];
      truncated: boolean;
      projects: PmoPiProjectDirectoryEntry[];
      /** Set when drilled into one project. */
      focusProject: PmoPiProjectDirectoryEntry | null;
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
    .select("id, slug, title_i18n, status, project_type, start_date, target_end_date")
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);
  if (projectsError || !projects) return { status: "error" };

  const baseProjectList = projects.map((project) => ({
    id: project.id as string,
    title:
      getI18nValue(project.title_i18n, locale) || (project.slug as string),
    status: project.status as ProjectStatus,
    projectType: (project.project_type as string | null) ?? "general",
    startDate: (project.start_date as string | null) ?? null,
    targetEndDate: (project.target_end_date as string | null) ?? null,
  }));
  const projectIds = baseProjectList.map((project) => project.id);
  const { data: charters } = projectIds.length > 0
    ? await supabase
        .from("project_charters")
        .select("project_id, project_manager_id, sponsor_id")
        .eq("organization_id", org.organizationId)
        .in("project_id", projectIds)
        .is("deleted_at", null)
    : { data: [] };
  const stakeholderIds = [
    ...new Set(
      (charters ?? []).flatMap((charter) => [
        charter.project_manager_id as string | null,
        charter.sponsor_id as string | null,
      ]).filter((id): id is string => id !== null),
    ),
  ];
  const { data: stakeholders } = stakeholderIds.length > 0
    ? await supabase
        .from("stakeholders")
        .select("id, name")
        .eq("organization_id", org.organizationId)
        .in("id", stakeholderIds)
        .is("deleted_at", null)
    : { data: [] };
  const stakeholderNames = new Map(
    (stakeholders ?? []).map((stakeholder) => [
      stakeholder.id as string,
      stakeholder.name as string,
    ]),
  );
  const charterByProject = new Map(
    (charters ?? []).map((charter) => [
      charter.project_id as string,
      charter,
    ]),
  );
  const projectList: Array<PmoPiProjectDirectoryEntry & { status: ProjectStatus }> =
    baseProjectList.map((project) => {
      const charter = charterByProject.get(project.id);
      return {
        ...project,
        projectManager: charter?.project_manager_id
          ? stakeholderNames.get(charter.project_manager_id as string) ?? null
          : null,
        sponsor: charter?.sponsor_id
          ? stakeholderNames.get(charter.sponsor_id as string) ?? null
          : null,
      };
    });

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
    return {
      status: "ok",
      model: empty,
      cases: [],
      truncated: false,
      projects: [],
      focusProject: null,
    };
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
    const startedAt = Date.now();
    const model = buildFlowModel(
      {
        organizationId: org.organizationId,
        projectIds: focus ? [focus.id] : [],
        level: focus ? "project" : "organization",
      },
      cases,
      new Date().toISOString(),
    );
    // Deterministic observability (LGRE pattern): one JSON line, no PII.
    console.log(
      JSON.stringify({
        event: "pmo_pi_projection_built",
        level: focus ? "project" : "organization",
        events: rows.length,
        cases: cases.length,
        nodes: model.nodes.length,
        edges: model.edges.length,
        truncated: rows.length >= MAX_EVENTS,
        durationMs: Date.now() - startedAt,
      }),
    );
    return {
      status: "ok",
      model,
      cases,
      truncated: rows.length >= MAX_EVENTS,
      projects: projectList,
      focusProject: focus ?? null,
    };
  } catch (err) {
    console.error("[pmo-pi] flow projection failed:", err);
    return { status: "error" };
  }
}
