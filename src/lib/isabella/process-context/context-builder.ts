// ============================================================================
// ProjectOps360° — Isabella Process Context · main context builder (server-only)
// ============================================================================
// ISABELLA-PROCESS-CONTEXT-EVIDENCE-RETRIEVAL
//
// Resolves access → retrieves the requested (approved) includes → assembles a
// sanitized IsabellaProcessContext with evidence packets + citations + explicit
// limitations. Partial context never fails the whole build; unavailable future
// sources are DISCLOSED, never invented. Never throws.
// ============================================================================

import { getOrgContext } from "@/lib/auth";
import { resolveIsabellaProjectAccess } from "./access";
import { getIsabellaTaskEvidence } from "./task-evidence";
import { getIsabellaMilestoneEvidence } from "./milestone-evidence";
import { buildProcessSignals } from "./process-signals";
import { buildIsabellaCitation, safeRef } from "./evidence-builder";
import type {
  IsabellaContextInclude,
  IsabellaContextRequest,
  IsabellaProcessContext,
} from "./types";

const DEFAULT_INCLUDES: IsabellaContextInclude[] = ["project", "tasks", "milestones", "blockers"];

// Includes recognized by the contract but not wired to a source yet → disclosed.
const FUTURE_INCLUDES: Record<string, { en: string; es: string }> = {
  living_graph_summary: { en: "Living Graph summary is not wired into this layer yet.", es: "El resumen del Living Graph aún no está conectado a esta capa." },
  milestone_flow_summary: { en: "Milestone Process Flow summary is not wired yet.", es: "El resumen del Milestone Process Flow aún no está conectado." },
  risks: { en: "Risk evidence is not available in this layer yet.", es: "La evidencia de riesgos aún no está disponible en esta capa." },
  decisions: { en: "Decision evidence is not available yet.", es: "La evidencia de decisiones aún no está disponible." },
  approvals: { en: "Approval evidence is not available yet.", es: "La evidencia de aprobaciones aún no está disponible." },
  status_reports: { en: "Status report evidence is not wired yet.", es: "La evidencia de reportes de estado aún no está conectada." },
  project_memory: { en: "Project Memory evidence is not wired yet.", es: "La evidencia de Project Memory aún no está conectada." },
};

/** Build the sanitized process context Isabella's engines will reason from. */
export async function buildIsabellaProcessContext(
  request: IsabellaContextRequest,
): Promise<IsabellaProcessContext> {
  const snapshotAt = new Date().toISOString();
  const locale = request.locale === "es" ? "es" : "en";
  const es = locale === "es";
  const included = request.include && request.include.length > 0 ? request.include : DEFAULT_INCLUDES;

  const empty = (status: IsabellaProcessContext["status"], message?: string): IsabellaProcessContext => ({
    scope: null,
    project: null,
    snapshotAt,
    included,
    evidencePackets: [],
    citations: [],
    limitations: [],
    status,
    message,
  });

  // ── Access (deny-by-default) ───────────────────────────────────────────────
  const access = await resolveIsabellaProjectAccess({ projectId: request.projectId, locale });
  if (access.status !== "authorized" || !access.scope) {
    return empty(access.status === "authorized" ? "unavailable" : access.status, access.message);
  }
  const scope = access.scope;

  // Trusted org for the RBAC-scoped reads (session, not client).
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return empty("unauthorized", access.message);
  }

  const limitations: string[] = [];
  const ctx: IsabellaProcessContext = {
    scope,
    project: null,
    snapshotAt,
    included,
    evidencePackets: [],
    citations: [],
    limitations,
    status: "ready",
  };

  // ── Tasks (+ optional subtasks) ────────────────────────────────────────────
  let taskCountByMilestone: Record<string, number> = {};
  if (included.includes("tasks") || included.includes("subtasks") || included.includes("workboard") || included.includes("blockers")) {
    const taskRes = await getIsabellaTaskEvidence(org, scope, {
      includeSubtasks: included.includes("subtasks"),
    });
    if (!taskRes.ok) {
      limitations.push(es ? "No pude cargar las tareas." : "Could not load tasks.");
      if (taskRes.reason === "not_authorized") return empty("unauthorized", access.message);
    } else {
      ctx.project = { projectId: scope.projectId, name: taskRes.projectName, citationRef: safeRef("project", scope.projectId) };
      if (included.includes("tasks") || included.includes("subtasks")) {
        ctx.taskContext = taskRes.context;
        ctx.evidencePackets.push(...taskRes.packets);
        ctx.citations.push(...taskRes.citations);
      }
      // Milestone task counts derived from the retrieved tasks.
      taskCountByMilestone = {};
      for (const t of taskRes.context.tasks) {
        if (t.milestoneId) taskCountByMilestone[t.milestoneId] = (taskCountByMilestone[t.milestoneId] ?? 0) + 1;
      }
      if (included.includes("blockers")) {
        ctx.processSignals = buildProcessSignals(taskRes.context.tasks, scope);
        ctx.evidencePackets.push(...ctx.processSignals.packets);
      }
    }
  }

  // ── Milestones ─────────────────────────────────────────────────────────────
  if (included.includes("milestones")) {
    const msRes = await getIsabellaMilestoneEvidence(org, scope, taskCountByMilestone);
    if (!msRes.ok) {
      limitations.push(es ? "No pude cargar los hitos." : "Could not load milestones.");
    } else {
      ctx.milestoneContext = msRes.context;
      ctx.evidencePackets.push(...msRes.packets);
      ctx.citations.push(...msRes.citations);
    }
  }

  // ── Project summary fallback (if tasks were not requested) ──────────────────
  if (!ctx.project) {
    ctx.project = { projectId: scope.projectId, name: es ? "Proyecto" : "Project", citationRef: safeRef("project", scope.projectId) };
  }
  ctx.citations.unshift(
    buildIsabellaCitation({
      sourceLabel: es ? "Proyecto" : "Project",
      entityType: "status_report",
      entityTitle: ctx.project.name,
      safeRef: ctx.project.citationRef,
      confidence: "verified",
    }),
  );

  // ── Future/unavailable includes → disclosed limitations ────────────────────
  let requestedFuture = false;
  for (const inc of included) {
    if (FUTURE_INCLUDES[inc]) {
      requestedFuture = true;
      limitations.push(es ? FUTURE_INCLUDES[inc].es : FUTURE_INCLUDES[inc].en);
    }
  }

  // ── Status resolution ──────────────────────────────────────────────────────
  const noTasks = !ctx.taskContext || ctx.taskContext.totalVisibleTasks === 0;
  const noMilestones = !ctx.milestoneContext || ctx.milestoneContext.totalVisibleMilestones === 0;
  if (limitations.some((l) => l.includes("Could not load") || l.includes("No pude cargar"))) {
    ctx.status = "partial";
  } else if (noTasks && noMilestones) {
    ctx.status = "empty";
    ctx.message = es ? "Este proyecto no tiene datos visibles para ti todavía." : "This project has no data visible to you yet.";
  } else if (requestedFuture) {
    ctx.status = "partial";
  } else {
    ctx.status = "ready";
  }

  return ctx;
}
