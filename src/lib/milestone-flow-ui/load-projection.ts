// ============================================================================
// ProjectOps360° — Milestone Process Flow · Read-only Projection Adapter (Task 8)
// ============================================================================
// The smallest safe, READ-ONLY server adapter between canonical data and the
// Living Graph UI consumer. It:
//   1. resolves the caller's org context (existing auth pattern),
//   2. validates the project belongs to that organization (deny-by-default —
//      no permissive fallback: no project row → unauthorized state),
//   3. reads canonical milestones + Project Event Graph events (SELECT only),
//   4. maps them to the engine's read-only input refs,
//   5. invokes the MPF Engine (Tasks 1–7) to build the projection.
//
// It NEVER writes: no project_event_log mutation, no process_nodes/process_edges
// access, no canonical record changes, no PEG event emission, no LLM/AI call.
// All intelligence comes from the engine — this file only feeds it and returns
// its output. Empty data yields the engine's safe empty projection.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale, Milestone } from "@/types/database";
import {
  createMilestoneProcessFlowEngine,
  MPF_CONFIG_VERSION,
  MpfUnauthorizedAccessError,
} from "@/lib/milestone-flow";
import type {
  MilestoneFlowProjection,
  MilestoneFlowEventRef,
  MilestoneFlowMilestoneRef,
  MilestoneFlowAccessContext,
} from "@/lib/milestone-flow";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cap the event window read for one projection run (newest-first, then replayed in order). */
const MAX_EVENTS = 5000;

export type MilestoneFlowLoadResult =
  | {
      status: "ok";
      projection: MilestoneFlowProjection;
      milestoneNamesById: Record<string, string>;
      milestoneCount: number;
      eventCount: number;
      projectTitle: string;
    }
  | { status: "unauthorized" }
  | { status: "error" };

/** A read-only projection of the project_event_log columns the engine consumes. */
interface EventLogRow {
  event_id: string;
  event_type: string;
  event_category: string;
  occurred_at: string;
  subject_type: string;
  subject_id: string | null;
  from_state: string | null;
  to_state: string | null;
  event_lifecycle_class: string;
  confidence: number | null;
  is_compensating_event: boolean;
  payload: Record<string, unknown> | null;
}

function toEventRef(row: EventLogRow): MilestoneFlowEventRef {
  const payloadMilestoneId = row.payload?.["milestone_id"];
  return {
    eventId: row.event_id,
    eventType: row.event_type,
    eventCategory: row.event_category,
    occurredAt: row.occurred_at,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    fromState: row.from_state,
    toState: row.to_state,
    lifecycleClass: row.event_lifecycle_class,
    confidence: row.confidence,
    isCompensatingEvent: row.is_compensating_event,
    milestoneId: typeof payloadMilestoneId === "string" ? payloadMilestoneId : null,
  };
}

function toMilestoneRef(m: Milestone, predecessorId: string | null): MilestoneFlowMilestoneRef {
  return {
    milestoneId: m.id,
    name: m.title,
    type: null,
    plannedDate: m.target_date,
    forecastDate: null,
    actualDate: m.completed_date,
    ownerId: null,
    status: m.status,
    // Canonical milestone order (order_index) — the same ordering the Execution
    // Map and Workboard use. Mapping canonical order to the engine's predecessor
    // link is data plumbing, not flow inference (the engine decides everything).
    predecessorMilestoneId: predecessorId,
  };
}

/**
 * Load the Milestone Process Flow projection for one project, read-only.
 * Deny-by-default: any auth/scope failure returns `unauthorized` with NO data.
 */
export async function loadMilestoneFlowProjection(
  projectId: string,
  locale: Locale,
): Promise<MilestoneFlowLoadResult> {
  if (!UUID_RE.test(projectId)) return { status: "unauthorized" };

  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { status: "unauthorized" };
  }

  const supabase = await createClient();

  // Tenant validation — the project must exist inside the caller's organization
  // (RLS-scoped client). No row → no access; no permissive fallback.
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, slug, title_i18n")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();

  if (projectError || !project) return { status: "unauthorized" };

  const [milestonesResult, eventsResult] = await Promise.all([
    supabase
      .from("milestones")
      .select("*")
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("order_index", { ascending: true }),
    supabase
      .from("project_event_log")
      .select(
        "event_id, event_type, event_category, occurred_at, subject_type, subject_id, from_state, to_state, event_lifecycle_class, confidence, is_compensating_event, payload",
      )
      .eq("project_id", projectId)
      .eq("organization_id", org.organizationId)
      .order("occurred_at", { ascending: true })
      .order("sequence_number", { ascending: true })
      .limit(MAX_EVENTS),
  ]);

  if (milestonesResult.error) return { status: "error" };
  // A missing/unavailable event log is NOT fatal: the engine handles zero events
  // honestly (safe empty projection + insufficient-evidence flags).
  const eventRows = (eventsResult.error ? [] : (eventsResult.data ?? [])) as EventLogRow[];

  const milestones = (milestonesResult.data ?? []) as Milestone[];
  const milestoneRefs = milestones.map((m, i) =>
    toMilestoneRef(m, i > 0 ? milestones[i - 1].id : null),
  );
  const events = eventRows.map(toEventRef);

  // Engine-side access gate (deny-by-default, tenant-isolated). The project was
  // validated against the caller's org above, so its id is the authorized set.
  const access: MilestoneFlowAccessContext = {
    userId: org.userId,
    organizationId: org.organizationId,
    scope: "pm",
    authorizedProjectIds: [projectId],
  };

  try {
    const engine = createMilestoneProcessFlowEngine();
    const output = engine.buildMilestoneFlowProjection({
      scope: { organizationId: org.organizationId, projectId },
      milestones: milestoneRefs,
      events,
      config: { configVersion: MPF_CONFIG_VERSION },
      access,
    });

    const milestoneNamesById: Record<string, string> = {};
    for (const m of milestones) milestoneNamesById[m.id] = m.title;

    return {
      status: "ok",
      projection: output.projection,
      milestoneNamesById,
      milestoneCount: milestones.length,
      eventCount: events.length,
      projectTitle: getI18nValue(project.title_i18n, locale) || project.slug,
    };
  } catch (err) {
    if (err instanceof MpfUnauthorizedAccessError) return { status: "unauthorized" };
    console.error("Milestone Process Flow projection failed:", err);
    return { status: "error" };
  }
}
