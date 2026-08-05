// ============================================================================
// Project Import Intelligence — Import Execution Service
// ============================================================================
// Takes the approved entities of an import job and writes real records:
// project, milestones, tasks, dependencies, resources, materials, budget,
// risks. Every created row is registered in project_import_created_records
// so the whole batch can be rolled back by import_job_id (the safe-rollback
// strategy — the Supabase API layer does not expose multi-statement
// transactions). Merge mode never overwrites: duplicates are skipped and
// reported. Server-side only.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emitProcessNode, emitProcessEdge } from "@/lib/graph/emit-event";
import { captureRiskRegisteredAtomic } from "@/lib/events/risk-events";
import {
  buildMilestoneCreatedEvents,
  buildTaskCreatedEvents,
  buildTaskDependencyEvent,
  captureProcessMiningEvents,
  type ProcessMiningCaptureSource,
} from "@/lib/events/process-mining-capture";
import { recalculateCriticalPath } from "@/lib/execution/critical-path-service";
import { generateImportRecommendations } from "./validate";
import { CHARTER_FIELDS } from "@/lib/charter/fields";
import { createCharterForProject } from "@/lib/charter/service";
import type {
  CanonicalTask,
  CanonicalMilestone,
  CanonicalDependency,
  CanonicalResource,
  CanonicalMaterial,
  CanonicalBudgetItem,
  CanonicalRisk,
  CanonicalCharter,
  CanonicalImport,
  ImportEntityType,
} from "@/types/import-intelligence";
import { emptyCanonicalImport } from "./extract";
import { orderImportEntities } from "./source-order";

type Admin = ReturnType<typeof createAdminClient>;

export interface ImportEntityRow {
  id: string;
  entity_type: ImportEntityType;
  source_order: number | null;
  source_key: string | null;
  normalized_json: Record<string, unknown>;
  validation_status: string;
  will_import: boolean;
}

/** A row the database refused. Never swallowed: an import that writes less
 *  than it promised has to say so. */
export interface ImportWriteFailure {
  entity_type: string;
  source_id: string;
  title: string;
  reason: string;
}

export interface ExecuteImportResult {
  projectId: string;
  created: Record<string, number>;
  skippedDuplicates: number;
  criticalPathCalculated: boolean;
  recommendations: { type: string; message_i18n: Record<string, string | undefined> }[];
  /** Rows accepted for import that the database rejected. Empty on a clean run. */
  writeFailures: ImportWriteFailure[];
}

function normTitle(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/**
 * A plan legitimately carries zero-duration rows — milestones, deliverables
 * and quality gates are points in time, not spans. `roadmap_tasks` constrains
 * `duration_days` to NULL or > 0, so a literal 0 made Postgres reject the row.
 * The model cannot express "zero days", and claiming one day would invent a
 * span the plan never stated, so an explicit 0 becomes "no duration" — the
 * dates are still imported and the schedule still draws it.
 */
export function normalizeDurationDays(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  return v;
}

async function track(
  supabase: Admin,
  organizationId: string,
  jobId: string,
  table: string,
  id: string,
): Promise<void> {
  await supabase.from("project_import_created_records").insert({
    organization_id: organizationId,
    import_job_id: jobId,
    entity_table: table,
    entity_id: id,
  });
}

/** Rebuild the canonical import from the stored, possibly user-edited entities. */
export function entitiesToCanonical(entities: ImportEntityRow[]): CanonicalImport {
  const canonical = emptyCanonicalImport();
  for (const e of orderImportEntities(entities)) {
    const n = e.normalized_json as unknown;
    switch (e.entity_type) {
      case "project": Object.assign(canonical.project, n); break;
      case "milestone": canonical.milestones.push(n as CanonicalMilestone); break;
      case "task": canonical.tasks.push(n as CanonicalTask); break;
      case "dependency": canonical.dependencies.push(n as CanonicalDependency); break;
      case "resource": canonical.resources.push(n as CanonicalResource); break;
      case "material": canonical.materials.push(n as CanonicalMaterial); break;
      case "budget_item": canonical.budget_items.push(n as CanonicalBudgetItem); break;
      case "risk": canonical.risks.push(n as CanonicalRisk); break;
      case "charter": canonical.charter = n as CanonicalCharter; break;
      default: break;
    }
  }
  return canonical;
}

/**
 * Execute an approved import job. Caller is responsible for auth and for
 * having moved the job into 'importing'.
 */
export async function executeImport(params: {
  organizationId: string;
  userId: string;
  jobId: string;
  importMode: "create_new" | "merge_existing";
  targetProjectId: string | null;
  governanceUnitId: string | null;
  selectedProjectType: string;
  entities: ImportEntityRow[];
  locale: "en" | "es";
}): Promise<ExecuteImportResult> {
  const supabase = createAdminClient();
  const { organizationId, jobId } = params;
  const approved = params.entities.filter((e) => e.will_import && e.validation_status !== "invalid");
  const canonical = entitiesToCanonical(approved);
  const created: Record<string, number> = {};
  let skippedDuplicates = 0;
  const bump = (k: string) => { created[k] = (created[k] ?? 0) + 1; };
  // A rejected INSERT used to vanish: only `data` was read, so the row was
  // dropped and the summary still reported it as imported. Every refusal is
  // now recorded and surfaced to the review step.
  const writeFailures: ImportWriteFailure[] = [];
  const recordFailure = (
    entityType: string,
    sourceId: string,
    title: string,
    error: { message?: string } | null,
  ) => {
    writeFailures.push({
      entity_type: entityType,
      source_id: sourceId,
      title,
      reason: error?.message ?? "unknown database error",
    });
    console.error(`[import] ${entityType} "${title}" rejected:`, error?.message ?? error);
  };
  const semanticallyCapturedIds = new Set<string>();
  const captureSource: ProcessMiningCaptureSource = {
    actorType: "human",
    actorId: params.userId,
    sourceModule: "import-intelligence",
    captureMethod: "imported",
    provenance: { import_job_id: jobId },
  };

  // ── 1. Project ─────────────────────────────────────────────────────────────
  let projectId = params.targetProjectId;
  const existingTaskTitles = new Set<string>();
  const existingMilestonesByTitle = new Map<string, string>();

  if (params.importMode === "create_new" || !projectId) {
    const name = canonical.project.name || "Imported Project";
    const slugBase = normTitle(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "imported-project";
    let slug = slugBase;
    for (let suffix = 1; suffix < 50; suffix++) {
      const { data: clash } = await supabase
        .from("projects").select("id")
        .eq("organization_id", organizationId).eq("slug", slug).is("deleted_at", null).maybeSingle();
      if (!clash) break;
      slug = `${slugBase}-${suffix}`;
    }
    // WHY A SESSION CLIENT ONLY HERE
    // Creating a project is the one authorisation decision in this pipeline.
    // `create_project_v2` is the single governed command that writes the
    // `projects` row, its `multi_pmo_v2` contract and its owner assignment in
    // one transaction; it authorises via `auth.uid()` plus the `project.create`
    // capability, so it MUST run on the caller's own session — the admin client
    // is `service_role` and would bypass RLS, which is exactly how imports used
    // to produce ungoverned legacy projects owned by whatever unit the
    // `trg_projects_sync_governance_owner` trigger happened to pick.
    // Every later write (milestones, tasks, dependencies, risks, resources,
    // budget, events, process nodes) stays on the admin client: those are
    // follow-up writes on a project whose authorisation is already settled.
    if (!params.governanceUnitId) throw new Error("governance_unit_required");
    const sessionClient = await createClient();
    const { data: project, error } = await sessionClient
      .rpc("create_project_v2", {
        p_organization_id: organizationId,
        p_governance_unit_id: params.governanceUnitId,
        p_slug: slug,
        p_title_i18n: { [params.locale]: name },
        p_description_i18n: canonical.project.description ? { [params.locale]: canonical.project.description } : {},
        p_project_type: params.selectedProjectType || "general",
        p_start_date: canonical.project.start_date || null,
        p_target_end_date: canonical.project.target_finish_date || null,
      })
      .single();
    if (error || !project) throw new Error(`Project creation failed: ${error?.message}`);
    projectId = (project as { project_id: string }).project_id;
    await track(supabase, organizationId, jobId, "projects", projectId);
    bump("projects");
  } else {
    // Merge mode: load existing titles for duplicate detection — never overwrite.
    const [{ data: tasks }, { data: milestones }] = await Promise.all([
      supabase.from("roadmap_tasks").select("title").eq("project_id", projectId).is("deleted_at", null),
      supabase.from("milestones").select("id, title").eq("project_id", projectId).is("deleted_at", null),
    ]);
    for (const t of tasks ?? []) existingTaskTitles.add(normTitle(t.title));
    for (const m of milestones ?? []) existingMilestonesByTitle.set(normTitle(m.title), m.id);
  }

  // ── 1b. Project Charter ────────────────────────────────────────────────────
  // Fill-only-empty and only while the charter is a draft: the import never
  // overwrites human-written charter content and never touches a charter that
  // entered the review/approval lifecycle (those changes go through
  // updateCharterAction, which handles revision + version bumps).
  if (canonical.charter && projectId && Object.keys(canonical.charter.fields).length > 0) {
    const { data: existingCharter } = await supabase
      .from("project_charters").select("*")
      .eq("project_id", projectId).eq("organization_id", organizationId).is("deleted_at", null)
      .maybeSingle();
    let charterRow = existingCharter as Record<string, unknown> | null;
    if (!charterRow) {
      const charterId = await createCharterForProject(
        supabase, organizationId, projectId, params.userId, canonical.project.name || null,
      );
      if (charterId) {
        const { data } = await supabase.from("project_charters").select("*").eq("id", charterId).maybeSingle();
        charterRow = data as Record<string, unknown> | null;
        await track(supabase, organizationId, jobId, "project_charters", charterId);
      }
    }
    if (charterRow && charterRow.status === "draft") {
      const allowedKeys = new Set(CHARTER_FIELDS.map((f) => f.key as string));
      const patch: Record<string, string> = {};
      for (const [k, v] of Object.entries(canonical.charter.fields)) {
        if (!allowedKeys.has(k)) continue;
        const current = charterRow[k];
        if (current == null || String(current).trim() === "") patch[k] = v;
      }
      if (Object.keys(patch).length > 0) {
        const { error: charterError } = await supabase
          .from("project_charters").update(patch).eq("id", charterRow.id as string);
        if (!charterError) created["charter_fields"] = Object.keys(patch).length;
      }
    }
  }

  // ── 2. Milestones ──────────────────────────────────────────────────────────
  const milestoneIdBySourceName = new Map<string, string>();
  let msOrder = existingMilestonesByTitle.size;
  for (const ms of canonical.milestones) {
    const tKey = normTitle(ms.name);
    const existing = existingMilestonesByTitle.get(tKey);
    if (existing) {
      milestoneIdBySourceName.set(tKey, existing);
      skippedDuplicates++;
      continue;
    }
    const { data: row, error: rowError } = await supabase
      .from("milestones")
      .insert({
        organization_id: organizationId,
        project_id: projectId,
        title: ms.name,
        description: ms.description || null,
        status: ms.status === "completed" ? "completed" : "planned",
        target_date: ms.target_date || null,
        order_index: msOrder++,
        created_by: params.userId,
      })
      .select("id, title, status")
      .single();
    if (!row) recordFailure("milestone", ms.source_id, ms.name, rowError);
    if (row) {
      milestoneIdBySourceName.set(tKey, row.id);
      await track(supabase, organizationId, jobId, "milestones", row.id);
      bump("milestones");
      const capture = await captureProcessMiningEvents(buildMilestoneCreatedEvents({
        milestone: {
          milestoneId: row.id,
          organizationId,
          projectId,
          title: row.title,
          status: row.status,
        },
        source: captureSource,
      }));
      if (capture.complete) semanticallyCapturedIds.add(row.id);
    }
  }

  // Auto-generate milestones referenced by tasks but not defined as entities
  for (const task of canonical.tasks) {
    const ref = task.milestone || task.phase;
    if (!ref) continue;
    const tKey = normTitle(ref);
    if (milestoneIdBySourceName.has(tKey) || existingMilestonesByTitle.has(tKey)) continue;
    const { data: row, error: rowError } = await supabase
      .from("milestones")
      .insert({
        organization_id: organizationId,
        project_id: projectId,
        title: ref,
        status: "planned",
        order_index: msOrder++,
        created_by: params.userId,
      })
      .select("id, title, status")
      .single();
    if (!row) recordFailure("milestone", ref, ref, rowError);
    if (row) {
      milestoneIdBySourceName.set(tKey, row.id);
      await track(supabase, organizationId, jobId, "milestones", row.id);
      bump("milestones");
      const capture = await captureProcessMiningEvents(buildMilestoneCreatedEvents({
        milestone: {
          milestoneId: row.id,
          organizationId,
          projectId,
          title: row.title,
          status: row.status,
        },
        source: captureSource,
      }));
      if (capture.complete) semanticallyCapturedIds.add(row.id);
    }
  }

  // ── 3. Resources ───────────────────────────────────────────────────────────
  const resourceIdByName = new Map<string, string>();
  for (const res of canonical.resources) {
    const nKey = normTitle(res.name);
    if (resourceIdByName.has(nKey)) continue;
    const { data: existing } = await supabase
      .from("resources").select("id")
      .eq("organization_id", organizationId).eq("project_id", projectId)
      .ilike("name", res.name).is("deleted_at", null).maybeSingle();
    if (existing) {
      resourceIdByName.set(nKey, existing.id);
      skippedDuplicates++;
      continue;
    }
    const validTypes = new Set(["person", "crew", "team", "role", "skill", "material", "equipment", "tool", "software_license", "cloud_service", "vendor", "supplier", "subcontractor", "facility", "budget_pool", "ai_agent"]);
    const { data: row, error: rowError } = await supabase
      .from("resources")
      .insert({
        organization_id: organizationId,
        project_id: projectId,
        resource_type: validTypes.has(res.resource_type) ? res.resource_type : "person",
        name: res.name,
        status: "active",
        trade_key: res.trade || null,
        skills: res.skills ?? [],
        cost_rate: res.cost_rate,
        cost_unit: res.cost_rate != null ? "hour" : null,
        metadata: { origin: "import", import_job_id: jobId, source_reference: res.source_reference },
      })
      .select("id")
      .single();
    if (!row) recordFailure("resource", res.source_id, res.name, rowError);
    if (row) {
      resourceIdByName.set(nKey, row.id);
      await track(supabase, organizationId, jobId, "resources", row.id);
      bump("resources");
    }
  }

  // ── 4. Budget items ────────────────────────────────────────────────────────
  const budgetIdBySourceId = new Map<string, string>();
  const validCategories = new Set(["labor", "material", "equipment", "subcontractor", "software", "cloud", "permit", "contingency", "other"]);
  for (const b of canonical.budget_items) {
    const { data: row, error: rowError } = await supabase
      .from("budget_items")
      .insert({
        organization_id: organizationId,
        project_id: projectId,
        name: b.name,
        category: validCategories.has(normTitle(b.category)) ? normTitle(b.category) : "other",
        cost_code: b.cost_code || null,
        estimated_cost: b.estimated_cost ?? 0,
        actual_cost: b.actual_cost ?? 0,
        status: "planned",
        metadata: { origin: "import", import_job_id: jobId, source_reference: b.source_reference },
      })
      .select("id")
      .single();
    if (!row) recordFailure("budget_item", b.source_id, b.name, rowError);
    if (row) {
      budgetIdBySourceId.set(b.source_id, row.id);
      await track(supabase, organizationId, jobId, "budget_items", row.id);
      bump("budget_items");
    }
  }

  // ── 5. Tasks ───────────────────────────────────────────────────────────────
  const taskIdBySourceId = new Map<string, string>();
  let taskOrder = 0;
  for (const task of canonical.tasks) {
    if (params.importMode === "merge_existing" && existingTaskTitles.has(normTitle(task.name))) {
      skippedDuplicates++;
      continue;
    }
    const milestoneRef = normTitle(task.milestone || task.phase);
    const validStatuses = new Set(["not_started", "prompt_ready", "sent_to_ai", "in_progress", "implemented", "tested", "done", "blocked", "deferred"]);
    const assignedResourceId = task.assigned_to ? resourceIdByName.get(normTitle(task.assigned_to)) ?? null : null;
    const { data: row, error: taskError } = await supabase
      .from("roadmap_tasks")
      .insert({
        organization_id: organizationId,
        project_id: projectId,
        milestone_id: milestoneRef ? milestoneIdBySourceName.get(milestoneRef) ?? existingMilestonesByTitle.get(milestoneRef) ?? null : null,
        title: task.name,
        description: task.description || null,
        status: validStatuses.has(task.status) ? task.status : "not_started",
        priority: ["p1", "p2", "p3"].includes(task.priority) ? task.priority : "p2",
        order_index: taskOrder++,
        external_key: task.source_id,
        start_date: task.planned_start || null,
        end_date: task.planned_finish || null,
        duration_days: normalizeDurationDays(task.duration_days),
        // One figure from the source file, two readers. `estimate_hours` is the
        // generic effort estimate that the CPM, the generic capacity engine,
        // process mining and Isabella all read; `estimated_labor_hours` is the
        // construction-specific crew figure used by readiness and reports.
        //
        // Writing only the second one dropped the estimate for every imported
        // project as far as scheduling and capacity were concerned — a software
        // import lost it entirely, since nothing there reads the labour field.
        //
        // These are two lenses on one effort, never two quantities to add.
        // Nothing in the product sums them; the "never combine the two capacity
        // engines" rule is about hours vs headcount (CAP-048 §5), not these.
        estimate_hours: task.estimated_hours,
        estimated_labor_hours: task.estimated_hours,
        assigned_resource_id: assignedResourceId,
        assignment_type: assignedResourceId ? "person" : null,
        location_zone: task.location || null,
        discipline: task.discipline || null,
        trade_key: task.trade || null,
        cost_code: task.cost_code || null,
        execution_notes: task.assigned_to && !assignedResourceId ? `Imported owner: ${task.assigned_to}` : null,
        // Internal AI execution prompt (UX-014/PD-013): stored metadata only —
        // the task editor never renders it as a plain user-facing field.
        prompt_body: task.prompt_body || null,
        created_by: params.userId,
      })
      .select("id, title, status, milestone_id, assigned_to, assigned_resource_id, project_team_member_id, priority, estimate_hours, start_date, end_date")
      .single();
    if (!row) recordFailure("task", task.source_id, task.name, taskError);
    if (row) {
      taskIdBySourceId.set(task.source_id, row.id);
      await track(supabase, organizationId, jobId, "roadmap_tasks", row.id);
      bump("tasks");
      const capture = await captureProcessMiningEvents(buildTaskCreatedEvents({
        task: {
          taskId: row.id,
          organizationId,
          projectId,
          title: row.title,
          status: row.status,
          milestoneId: row.milestone_id,
          assignedTo: row.assigned_to,
          assignedResourceId: row.assigned_resource_id,
          projectTeamMemberId: row.project_team_member_id,
          priority: row.priority,
          estimateHours: row.estimate_hours,
          startDate: row.start_date,
          endDate: row.end_date,
        },
        source: { ...captureSource, provenance: { ...captureSource.provenance, source_task_id: task.source_id } },
      }));
      if (capture.complete) semanticallyCapturedIds.add(row.id);
    }
  }

  // ── 6. Dependencies ────────────────────────────────────────────────────────
  for (const dep of canonical.dependencies) {
    const predecessorId = taskIdBySourceId.get(dep.predecessor_source_id);
    const successorId = taskIdBySourceId.get(dep.successor_source_id);
    if (!predecessorId || !successorId || predecessorId === successorId) continue;
    const { data: row, error: rowError } = await supabase
      .from("task_dependencies")
      .insert({
        organization_id: organizationId,
        project_id: projectId,
        predecessor_id: predecessorId,
        successor_id: successorId,
        dependency_type: dep.dependency_type,
        lag_days: dep.lag_days,
      })
      .select("id, predecessor_id, successor_id, dependency_type, lag_days")
      .single();
    if (!row) recordFailure("dependency", `${dep.predecessor_source_id}->${dep.successor_source_id}`, "dependency", rowError);
    if (row) {
      await track(supabase, organizationId, jobId, "task_dependencies", row.id);
      bump("dependencies");
      await captureProcessMiningEvents([buildTaskDependencyEvent({
        dependency: {
          dependencyId: row.id,
          organizationId,
          projectId,
          predecessorId: row.predecessor_id,
          successorId: row.successor_id,
          dependencyType: row.dependency_type,
          lagDays: row.lag_days,
        },
        change: "added",
        source: captureSource,
      })]);
    }
  }

  // ── 7. Materials ───────────────────────────────────────────────────────────
  const materialIdBySourceId = new Map<string, string>();
  for (const mat of canonical.materials) {
    const { data: row, error: rowError } = await supabase
      .from("material_requirements")
      .insert({
        organization_id: organizationId,
        project_id: projectId,
        name: mat.name,
        quantity: mat.quantity,
        unit_of_measure: mat.unit || null,
        estimated_unit_cost: mat.unit_cost,
        estimated_total_cost: mat.total_cost ?? (mat.quantity != null && mat.unit_cost != null ? mat.quantity * mat.unit_cost : null),
        lead_time_days: mat.lead_time_days,
        status: "planned",
        required_by_task_id: mat.required_by_task_source_id ? taskIdBySourceId.get(mat.required_by_task_source_id) ?? null : null,
        required_by_date: mat.required_by_date || null,
        confidence_score: mat.confidence_score,
        needs_review: mat.confidence_score < 0.7,
        origin: "import",
        evidence_json: { source_reference: mat.source_reference, import_job_id: jobId },
        metadata: { supplier_name: mat.supplier || null },
      })
      .select("id")
      .single();
    if (!row) recordFailure("material", mat.source_id, mat.name, rowError);
    if (row) {
      materialIdBySourceId.set(mat.source_id, row.id);
      await track(supabase, organizationId, jobId, "material_requirements", row.id);
      bump("materials");
    }
  }

  // ── 8. Risks ───────────────────────────────────────────────────────────────
  for (const [riskIndex, risk] of canonical.risks.entries()) {
    const lvl = (v: string, allowCritical = true): string =>
      ["low", "medium", "high"].includes(v) ? v : allowCritical && v === "critical" ? "critical" : "medium";
    const riskFields = {
      organization_id: organizationId,
      project_id: projectId,
      title: risk.title,
      description: risk.description || null,
      category: "other",
      probability: lvl(risk.probability, false),
      impact: lvl(risk.impact),
      severity: lvl(risk.severity),
      status: "open",
      mitigation_plan: risk.mitigation || null,
      linked_task_id: risk.linked_task_source_id ? taskIdBySourceId.get(risk.linked_task_source_id) ?? null : null,
      origin: "import",
      confidence_score: risk.confidence_score,
      needs_review: risk.confidence_score < 0.7,
      evidence_json: { source_reference: risk.source_reference, import_job_id: jobId },
    };
    // P2-T2 remediation (PD-018): with the pilot flag ON, the risk + its
    // risk_registered event are written in ONE transaction (capture_risk_registered
    // RPC) — no fire-and-forget, no silent divergence. With the flag OFF the
    // helper returns flag_off before any DB call and we fall back to the
    // pre-P2-T2 direct INSERT (byte-identical row, no event).
    const captured = projectId
      ? await captureRiskRegisteredAtomic({
          riskFields,
          actor: { actorType: "human", actorId: params.userId },
          captureMethod: "imported",
          origin: "import",
          sourceModule: "import-intelligence",
          title: risk.title,
          evidenceRef: { type: "project_import_job", id: jobId },
          extraProvenance: risk.source_reference ? { source_reference: risk.source_reference } : undefined,
          // Stable per import job + source identity: a retry of the SAME import
          // run dedupes each risk to the first row + event (no second Risk).
          // Prefer the parsed source_reference (intrinsic per-row id); fall back
          // to the deterministic parse position, which is stable for a given job.
          operationId: `import:${jobId}:${risk.source_reference ?? `idx${riskIndex}`}`,
        })
      : ({ ok: false, error: "flag_off" } as { ok: false; error: string; errors?: string[] });
    let riskId: string | null = null;
    if (captured.ok && captured.riskId) {
      riskId = captured.riskId;
    } else if (captured.error === "flag_off") {
      const { data: row, error: rowError } = await supabase.from("risks").insert(riskFields).select("id").single();
      riskId = row ? (row.id as string) : null;
      if (!row) recordFailure("risk", risk.source_id, risk.title, rowError);
    } else {
      console.error("[import] atomic risk_registered capture failed:", captured.error, captured.errors ?? "");
      recordFailure("risk", risk.source_id, risk.title, { message: captured.error });
    }
    if (riskId) {
      await track(supabase, organizationId, jobId, "risks", riskId);
      bump("risks");
    }
  }

  // ── 9. Living Graph ────────────────────────────────────────────────────────
  if (!projectId) throw new Error("No project id after import");
  const importNodeId = await emitProcessNode({
    organizationId,
    projectId,
    nodeType: "import_event",
    sourceEntityType: "project_import_jobs",
    sourceEntityId: jobId,
    title: `Imported: ${canonical.project.name || "project file"}`,
    metadata: { created, skipped_duplicates: skippedDuplicates },
  });

  // Milestone nodes + contains edges to their tasks; imported_from edges to the import node
  const milestoneNodeByTitleKey = new Map<string, string>();
  for (const [titleKey, msId] of milestoneIdBySourceName) {
    const nodeId = await emitProcessNode({
      organizationId, projectId,
      nodeType: "milestone_gate", sourceEntityType: "milestones", sourceEntityId: msId,
      title: titleKey,
      metadata: {
        origin: "import",
        canonical_event_emitted: semanticallyCapturedIds.has(msId),
      },
    });
    if (nodeId) {
      milestoneNodeByTitleKey.set(titleKey, nodeId);
      if (importNodeId) {
        await emitProcessEdge({ organizationId, projectId, fromNodeId: importNodeId, toNodeId: nodeId, edgeType: "imported_from" });
      }
    }
  }
  for (const task of canonical.tasks) {
    const taskDbId = taskIdBySourceId.get(task.source_id);
    if (!taskDbId) continue;
    const taskNodeId = await emitProcessNode({
      organizationId, projectId,
      nodeType: "task_transition", sourceEntityType: "roadmap_tasks", sourceEntityId: taskDbId,
      title: task.name,
      metadata: {
        origin: "import",
        new_status: task.status,
        canonical_event_emitted: semanticallyCapturedIds.has(taskDbId),
      },
    });
    if (!taskNodeId) continue;
    if (importNodeId) {
      await emitProcessEdge({ organizationId, projectId, fromNodeId: importNodeId, toNodeId: taskNodeId, edgeType: "imported_from" });
    }
    const msNode = milestoneNodeByTitleKey.get(normTitle(task.milestone || task.phase));
    if (msNode) {
      await emitProcessEdge({ organizationId, projectId, fromNodeId: msNode, toNodeId: taskNodeId, edgeType: "contains" });
    }
  }
  for (const mat of canonical.materials) {
    const matDbId = materialIdBySourceId.get(mat.source_id);
    if (!matDbId) continue;
    const matNodeId = await emitProcessNode({
      organizationId, projectId,
      nodeType: "material_event", sourceEntityType: "material_requirements", sourceEntityId: matDbId,
      title: mat.name, metadata: { origin: "import" },
    });
    if (matNodeId && importNodeId) {
      await emitProcessEdge({ organizationId, projectId, fromNodeId: importNodeId, toNodeId: matNodeId, edgeType: "imported_from" });
    }
  }

  // ── 10. Critical path ──────────────────────────────────────────────────────
  let criticalPathCalculated = false;
  if ((created["dependencies"] ?? 0) > 0 || (created["tasks"] ?? 0) > 1) {
    try {
      await recalculateCriticalPath(organizationId, projectId, "dependency_change");
      criticalPathCalculated = true;
    } catch (e) {
      console.error("[import] critical path failed:", e);
    }
  }

  // ── 11. Recommendations ────────────────────────────────────────────────────
  const recommendations = generateImportRecommendations(canonical);
  for (const rec of recommendations) {
    await supabase.from("project_import_validation_results").insert({
      organization_id: organizationId,
      import_job_id: jobId,
      severity: "info",
      validation_type: `recommendation:${rec.type}`,
      message: rec.message_i18n[params.locale] ?? rec.message_i18n.en ?? rec.type,
      recommended_action: null,
    });
  }

  // ── 12. Rows the database refused ──────────────────────────────────────────
  // Reported as errors, grouped by entity type, naming the rows. Silence here
  // is what let 73 tasks disappear from a 274-task plan while the summary
  // still said they had been imported.
  if (writeFailures.length > 0) {
    const byType = new Map<string, ImportWriteFailure[]>();
    for (const f of writeFailures) {
      if (!byType.has(f.entity_type)) byType.set(f.entity_type, []);
      byType.get(f.entity_type)!.push(f);
    }
    for (const [entityType, failures] of byType) {
      const sample = failures.slice(0, 5).map((f) => `"${f.title}"`).join(", ");
      const more = failures.length > 5 ? ` (+${failures.length - 5})` : "";
      const message =
        params.locale === "es"
          ? `${failures.length} ${entityType}(s) no se pudieron guardar y no están en el proyecto: ${sample}${more}. Motivo: ${failures[0].reason}`
          : `${failures.length} ${entityType}(s) could not be saved and are NOT in the project: ${sample}${more}. Reason: ${failures[0].reason}`;
      await supabase.from("project_import_validation_results").insert({
        organization_id: organizationId,
        import_job_id: jobId,
        severity: "error",
        validation_type: `write_failed:${entityType}`,
        message,
        affected_entity_type: entityType,
        recommended_action:
          params.locale === "es"
            ? "Revisa el origen, corrige esas filas y vuelve a importar (o deshaz la importación)."
            : "Review the source, fix those rows and import again (or roll the import back).",
      });
    }
  }

  return { projectId, created, skippedDuplicates, criticalPathCalculated, recommendations, writeFailures };
}

// ── Rollback ────────────────────────────────────────────────────────────────

/** Delete-order matters: children before parents. */
const ROLLBACK_ORDER = [
  "task_dependencies",
  "material_requirements",
  "risks",
  "budget_items",
  "roadmap_tasks",
  "milestones",
  "resources",
  "project_charters",
];

/** Remove every record created by an import job. Hard-deletes link tables,
 *  soft-deletes business tables that follow the soft-delete convention. */
export async function rollbackImport(organizationId: string, jobId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data: records } = await supabase
    .from("project_import_created_records")
    .select("entity_table, entity_id")
    .eq("import_job_id", jobId)
    .eq("organization_id", organizationId);

  const byTable = new Map<string, string[]>();
  for (const r of records ?? []) {
    if (!byTable.has(r.entity_table)) byTable.set(r.entity_table, []);
    byTable.get(r.entity_table)!.push(r.entity_id);
  }

  let removed = 0;
  for (const table of ROLLBACK_ORDER) {
    const ids = byTable.get(table);
    if (!ids || ids.length === 0) continue;
    if (table === "task_dependencies") {
      const { count } = await supabase.from(table).delete({ count: "exact" }).in("id", ids);
      removed += count ?? 0;
    } else {
      const { count } = await supabase
        .from(table)
        .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
        .in("id", ids)
        .is("deleted_at", null);
      removed += count ?? 0;
    }
  }

  // A project created by this import is soft-deleted last
  const projectIds = byTable.get("projects") ?? [];
  for (const pid of projectIds) {
    await supabase.from("projects").update({ deleted_at: new Date().toISOString() }).eq("id", pid).eq("organization_id", organizationId);
    removed++;
  }

  return removed;
}
