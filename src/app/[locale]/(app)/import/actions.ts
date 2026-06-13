"use server";

// ============================================================================
// Project Import Intelligence — Server Actions
// ============================================================================
// Lifecycle: register (after client storage upload) → analyze → review
// (toggle/edit entities) → execute → optional rollback. Every step validates
// org access and writes audit events. Files are read back from the private
// 'project-imports' bucket — client metadata is never trusted for parsing.
// ============================================================================

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseImportFile, detectFileType, ImportParseError } from "@/lib/import-intelligence/parse";
import { extractCanonicalImport, buildFieldMappings } from "@/lib/import-intelligence/extract";
import { aiExtractCanonicalImport } from "@/lib/import-intelligence/ai-extract";
import { validateCanonicalImport } from "@/lib/import-intelligence/validate";
import { executeImport, rollbackImport } from "@/lib/import-intelligence/execute";
import type {
  CanonicalImport,
  ImportEntityType,
  ProjectImportJob,
  ProjectImportEntity,
  ProjectImportValidationResult,
} from "@/types/import-intelligence";

// ── Helpers ─────────────────────────────────────────────────────────────────

async function audit(
  organizationId: string,
  jobId: string,
  eventType: string,
  message: string,
  userId?: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("project_import_audit_events").insert({
    organization_id: organizationId,
    import_job_id: jobId,
    event_type: eventType,
    message,
    metadata_json: metadata,
    created_by: userId ?? null,
  });
}

async function loadJob(organizationId: string, jobId: string): Promise<ProjectImportJob | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("project_import_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .single();
  return (data as ProjectImportJob) ?? null;
}

// ── 1. Register job (file already uploaded to storage by the client) ────────

const createJobSchema = z.object({
  fileName: z.string().min(1).max(300),
  fileSize: z.number().int().min(1).max(25 * 1024 * 1024),
  mimeType: z.string().max(200).optional().default(""),
  storagePath: z.string().min(1).max(600),
  importMode: z.enum(["create_new", "merge_existing"]).default("create_new"),
  projectId: z.string().uuid().nullable().optional(),
});

export async function createImportJobAction(input: {
  fileName: string;
  fileSize: number;
  mimeType?: string;
  storagePath: string;
  importMode: string;
  projectId?: string | null;
}): Promise<{ error?: string; jobId?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = createJobSchema.safeParse(input);
  if (!parsed.success) return { error: "validation_error" };
  const data = parsed.data;

  // The path must live inside this org's folder of the import bucket.
  const expectedPrefix = `project-imports/${org.organizationId}/`;
  if (!data.storagePath.startsWith(expectedPrefix)) return { error: "invalid_storage_path" };

  const fileType = detectFileType(data.fileName);
  if (!fileType) return { error: "unsupported_file_type" };

  if (data.importMode === "merge_existing" && !data.projectId) return { error: "project_required" };
  const supabase = createAdminClient();
  if (data.projectId) {
    const { data: project } = await supabase
      .from("projects").select("id")
      .eq("id", data.projectId).eq("organization_id", org.organizationId).is("deleted_at", null).maybeSingle();
    if (!project) return { error: "project_not_found" };
  }

  const { data: job, error } = await supabase
    .from("project_import_jobs")
    .insert({
      organization_id: org.organizationId,
      project_id: data.projectId ?? null,
      import_mode: data.importMode,
      source_file_name: data.fileName,
      source_file_type: fileType,
      source_mime_type: data.mimeType || null,
      source_file_size: data.fileSize,
      storage_path: data.storagePath,
      status: "uploaded",
      created_by: org.userId,
    })
    .select("id")
    .single();
  if (error || !job) return { error: "unexpected" };

  await audit(org.organizationId, job.id, "uploaded", `File uploaded: ${data.fileName}`, org.userId);
  await logAudit({ org, projectId: data.projectId ?? undefined, action: "create", entityType: "project_import_jobs", entityId: job.id, metadata: { file: data.fileName } });

  return { jobId: job.id };
}

// ── 2. Analyze ───────────────────────────────────────────────────────────────

export async function analyzeImportJobAction(input: {
  jobId: string;
}): Promise<{ error?: string; status?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  if (!z.string().uuid().safeParse(input.jobId).success) return { error: "validation_error" };

  const supabase = createAdminClient();
  const job = await loadJob(org.organizationId, input.jobId);
  if (!job) return { error: "job_not_found" };
  if (!job.storage_path) return { error: "missing_file" };
  if (!["uploaded", "failed"].includes(job.status)) return { error: "invalid_status" };

  await supabase.from("project_import_jobs").update({ status: "analyzing", error_message: null }).eq("id", job.id);
  await audit(org.organizationId, job.id, "analysis_started", "Analysis started", org.userId);

  try {
    // Download from private storage (server-side, admin client). The object
    // key includes the 'project-imports/' folder prefix — same convention as
    // the drawings bucket (storage.foldername RLS check).
    const { data: blob, error: dlError } = await supabase.storage
      .from("project-imports")
      .download(job.storage_path);
    if (dlError || !blob) {
      throw new Error(`storage_error: ${dlError?.message ?? "download failed"}`);
    }
    const buffer = new Uint8Array(await blob.arrayBuffer());

    // Parse → heuristic extraction
    const parsedFile = await parseImportFile(job.source_file_name, buffer);
    let canonical = extractCanonicalImport(parsedFile, job.source_file_name);

    // AI fallback for unstructured content (no tables → nothing extracted)
    let usedAi = false;
    if (canonical.tasks.length === 0 && canonical.milestones.length === 0 && parsedFile.rawText.trim().length > 100) {
      const aiCanonical = await aiExtractCanonicalImport(org, parsedFile.rawText);
      if (aiCanonical && (aiCanonical.tasks.length > 0 || aiCanonical.milestones.length > 0)) {
        const projectName = canonical.project.name;
        const projectType = canonical.project.project_type;
        canonical = aiCanonical;
        if (!canonical.project.name) canonical.project.name = projectName;
        if (!canonical.project.project_type) canonical.project.project_type = projectType;
        usedAi = true;
      }
    }

    // Validate
    const report = validateCanonicalImport(canonical);

    // Persist raw data (1:1, idempotent on re-analyze)
    await supabase.from("project_import_raw_data").delete().eq("import_job_id", job.id);
    await supabase.from("project_import_raw_data").insert({
      organization_id: org.organizationId,
      import_job_id: job.id,
      raw_text: parsedFile.rawText.slice(0, 100_000),
      raw_json: parsedFile.rawJson != null ? parsedFile.rawJson : null,
      extracted_tables_json: parsedFile.tables.map((t) => ({ name: t.name, headers: t.headers, row_count: t.rows.length, sample: t.rows.slice(0, 5) })),
      extracted_metadata_json: { ...parsedFile.metadata, used_ai: usedAi },
    });

    // Persist mappings
    await supabase.from("project_import_mappings").delete().eq("import_job_id", job.id);
    const mappings = buildFieldMappings(parsedFile);
    if (mappings.length > 0) {
      await supabase.from("project_import_mappings").insert(
        mappings.map((m) => ({ organization_id: org.organizationId, import_job_id: job.id, ...m })),
      );
    }

    // Persist entities
    await supabase.from("project_import_entities").delete().eq("import_job_id", job.id);
    const entityRows: Record<string, unknown>[] = [];
    const statusFor = (entityType: string, sourceId: string) =>
      report.entityStatuses.get(`${entityType}:${sourceId}`) ?? { status: "valid", warnings: [] };

    entityRows.push({
      organization_id: org.organizationId,
      import_job_id: job.id,
      entity_type: "project",
      source_key: "project",
      extracted_json: canonical.project,
      normalized_json: canonical.project,
      confidence_score: canonical.project.name ? 0.9 : 0.4,
      source_reference: job.source_file_name,
      validation_status: canonical.project.name ? "valid" : "needs_review",
      validation_warnings_json: [],
      will_import: true,
    });
    const pushAll = (entityType: ImportEntityType, items: { source_id?: string; confidence_score: number; source_reference: string }[], idOf: (x: never) => string = (x: { source_id: string }) => x.source_id) => {
      for (const item of items) {
        const sourceId = item.source_id ?? idOf(item as never);
        const v = statusFor(entityType, sourceId);
        entityRows.push({
          organization_id: org.organizationId,
          import_job_id: job.id,
          entity_type: entityType,
          source_key: sourceId,
          extracted_json: item,
          normalized_json: item,
          confidence_score: item.confidence_score,
          source_reference: item.source_reference,
          validation_status: v.status,
          validation_warnings_json: v.warnings,
          will_import: v.status !== "invalid",
        });
      }
    };
    pushAll("milestone", canonical.milestones);
    pushAll("task", canonical.tasks);
    for (const dep of canonical.dependencies) {
      const depKey = `${dep.predecessor_source_id}→${dep.successor_source_id}`;
      const v = statusFor("dependency", depKey);
      entityRows.push({
        organization_id: org.organizationId,
        import_job_id: job.id,
        entity_type: "dependency",
        source_key: depKey,
        extracted_json: dep,
        normalized_json: dep,
        confidence_score: dep.confidence_score,
        source_reference: dep.source_reference,
        validation_status: v.status,
        validation_warnings_json: v.warnings,
        will_import: v.status !== "invalid",
      });
    }
    pushAll("resource", canonical.resources);
    pushAll("material", canonical.materials);
    pushAll("budget_item", canonical.budget_items);
    pushAll("risk", canonical.risks);

    for (let i = 0; i < entityRows.length; i += 200) {
      const { error: insError } = await supabase.from("project_import_entities").insert(entityRows.slice(i, i + 200));
      if (insError) throw new Error(insError.message);
    }

    // Persist validation findings
    await supabase.from("project_import_validation_results").delete().eq("import_job_id", job.id);
    if (report.findings.length > 0) {
      await supabase.from("project_import_validation_results").insert(
        report.findings.map((f) => ({
          organization_id: org.organizationId,
          import_job_id: job.id,
          severity: f.severity,
          validation_type: f.validation_type,
          message: f.message_i18n[org.locale as "en" | "es"] ?? f.message_i18n.en ?? f.validation_type,
          affected_entity_type: f.affected_entity_type,
          recommended_action: f.recommended_action_i18n?.[org.locale as "en" | "es"] ?? f.recommended_action_i18n?.en ?? null,
        })),
      );
    }

    // Job summary + status
    const counts = {
      tasks: canonical.tasks.length,
      milestones: canonical.milestones.length,
      dependencies: canonical.dependencies.length,
      resources: canonical.resources.length,
      materials: canonical.materials.length,
      budget_items: canonical.budget_items.length,
      risks: canonical.risks.length,
    };
    const avgConfidence =
      canonical.tasks.length > 0
        ? canonical.tasks.reduce((s, t) => s + t.confidence_score, 0) / canonical.tasks.length
        : 0.5;
    const newStatus = report.hasBlockers || report.findings.some((f) => f.severity === "error")
      ? "needs_review"
      : "ready_to_import";

    await supabase
      .from("project_import_jobs")
      .update({
        status: newStatus,
        detected_project_type: canonical.project.project_type || "general",
        selected_project_type: job.selected_project_type ?? (canonical.project.project_type || "general"),
        confidence_score: Math.round(avgConfidence * 10000) / 10000,
        summary_json: { counts, used_ai: usedAi, critical_path_ready: report.criticalPathReady, tasks_missing_duration: report.tasksMissingDuration },
      })
      .eq("id", job.id);

    await audit(org.organizationId, job.id, "analysis_completed", `Extracted ${counts.tasks} tasks, ${counts.milestones} milestones`, org.userId, counts);
    return { status: newStatus };
  } catch (e) {
    const raw = e instanceof ImportParseError ? e.code : e instanceof Error ? e.message : "unexpected";
    const code = raw.startsWith("storage_error") ? "storage_error" : raw;
    await supabase
      .from("project_import_jobs")
      .update({ status: "failed", error_message: raw })
      .eq("id", input.jobId);
    await audit(org.organizationId, input.jobId, "failed", raw, org.userId);
    return { error: code };
  }
}

// ── 3. Read job detail ───────────────────────────────────────────────────────

export async function getImportJobAction(input: { jobId: string }): Promise<{
  error?: string;
  job?: ProjectImportJob;
  entities?: ProjectImportEntity[];
  validations?: ProjectImportValidationResult[];
}> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const job = await loadJob(org.organizationId, input.jobId);
  if (!job) return { error: "job_not_found" };

  const supabase = createAdminClient();
  const [entitiesRes, validationsRes] = await Promise.all([
    supabase.from("project_import_entities").select("*").eq("import_job_id", job.id).order("entity_type").order("created_at"),
    supabase.from("project_import_validation_results").select("*").eq("import_job_id", job.id).order("severity"),
  ]);
  return {
    job,
    entities: (entitiesRes.data ?? []) as ProjectImportEntity[],
    validations: (validationsRes.data ?? []) as ProjectImportValidationResult[],
  };
}

// ── 4. Review edits ──────────────────────────────────────────────────────────

export async function toggleImportEntityAction(input: {
  entityId: string;
  willImport: boolean;
}): Promise<{ error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("project_import_entities")
    .update({ will_import: input.willImport, user_modified: true })
    .eq("id", input.entityId)
    .eq("organization_id", org.organizationId);
  return error ? { error: "unexpected" } : {};
}

const updateEntitySchema = z.object({
  entityId: z.string().uuid(),
  patch: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).refine((p) => Object.keys(p).length <= 10),
});

export async function updateImportEntityAction(input: {
  entityId: string;
  patch: Record<string, string | number | null>;
}): Promise<{ error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = updateEntitySchema.safeParse(input);
  if (!parsed.success) return { error: "validation_error" };

  const supabase = createAdminClient();
  const { data: entity } = await supabase
    .from("project_import_entities")
    .select("normalized_json")
    .eq("id", parsed.data.entityId)
    .eq("organization_id", org.organizationId)
    .single();
  if (!entity) return { error: "entity_not_found" };

  const ALLOWED_KEYS = new Set(["name", "title", "description", "assigned_to", "planned_start", "planned_finish", "duration_days", "quantity", "unit", "estimated_cost", "target_date", "milestone", "phase"]);
  const merged = { ...(entity.normalized_json as Record<string, unknown>) };
  for (const [k, v] of Object.entries(parsed.data.patch)) {
    if (ALLOWED_KEYS.has(k)) merged[k] = v;
  }

  const { error } = await supabase
    .from("project_import_entities")
    .update({ normalized_json: merged, user_modified: true, validation_status: "valid" })
    .eq("id", parsed.data.entityId)
    .eq("organization_id", org.organizationId);
  return error ? { error: "unexpected" } : {};
}

// ── 5. Execute ───────────────────────────────────────────────────────────────

export async function executeImportAction(input: {
  jobId: string;
  selectedProjectType?: string;
}): Promise<{
  error?: string;
  projectId?: string;
  created?: Record<string, number>;
  skippedDuplicates?: number;
  criticalPathCalculated?: boolean;
}> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const supabase = createAdminClient();
  const job = await loadJob(org.organizationId, input.jobId);
  if (!job) return { error: "job_not_found" };
  if (!["ready_to_import", "needs_review", "mapped"].includes(job.status)) return { error: "invalid_status" };

  // Blockers must be resolved (disabled) before import
  const { data: blockers } = await supabase
    .from("project_import_validation_results")
    .select("id")
    .eq("import_job_id", job.id)
    .eq("severity", "blocker")
    .limit(1);
  const { data: entities } = await supabase
    .from("project_import_entities")
    .select("id, entity_type, source_key, normalized_json, validation_status, will_import")
    .eq("import_job_id", job.id);

  if ((blockers?.length ?? 0) > 0) {
    // A blocker (e.g. circular dependency) still allows import when the user
    // disabled the offending dependencies.
    const activeDeps = (entities ?? []).filter((e) => e.entity_type === "dependency" && e.will_import);
    const { findCycle } = await import("@/lib/import-intelligence/validate");
    const cycle = findCycle(
      activeDeps.map((d) => {
        const dep = d.normalized_json as { predecessor_source_id: string; successor_source_id: string };
        return [dep.predecessor_source_id, dep.successor_source_id] as [string, string];
      }),
    );
    if (cycle) return { error: "blocker_unresolved" };
  }

  await supabase.from("project_import_jobs").update({ status: "importing" }).eq("id", job.id);
  await audit(org.organizationId, job.id, "import_started", "Import execution started", org.userId);

  try {
    const result = await executeImport({
      organizationId: org.organizationId,
      userId: org.userId,
      jobId: job.id,
      importMode: job.import_mode,
      targetProjectId: job.project_id,
      selectedProjectType: input.selectedProjectType || job.selected_project_type || job.detected_project_type || "general",
      entities: (entities ?? []) as Parameters<typeof executeImport>[0]["entities"],
      locale: (org.locale as "en" | "es") ?? "en",
    });

    await supabase
      .from("project_import_jobs")
      .update({
        status: "imported",
        project_id: result.projectId,
        completed_at: new Date().toISOString(),
        summary_json: { ...job.summary_json, created: result.created, skipped_duplicates: result.skippedDuplicates, critical_path_calculated: result.criticalPathCalculated },
      })
      .eq("id", job.id);
    await audit(org.organizationId, job.id, "import_completed", "Import completed", org.userId, result.created);
    await logAudit({ org, projectId: result.projectId, action: "create", entityType: "project_import_jobs", entityId: job.id, metadata: result.created });
    revalidatePath(`/(app)/projects/${result.projectId}`, "layout");

    return {
      projectId: result.projectId,
      created: result.created,
      skippedDuplicates: result.skippedDuplicates,
      criticalPathCalculated: result.criticalPathCalculated,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "unexpected";
    // Best-effort cleanup of the partial batch
    try {
      await rollbackImport(org.organizationId, job.id);
    } catch (rollbackError) {
      console.error("[import] rollback after failure also failed:", rollbackError);
    }
    await supabase.from("project_import_jobs").update({ status: "failed", error_message: message }).eq("id", job.id);
    await audit(org.organizationId, job.id, "failed", message, org.userId);
    return { error: "import_failed" };
  }
}

// ── 6. Rollback ──────────────────────────────────────────────────────────────

export async function rollbackImportAction(input: { jobId: string }): Promise<{ error?: string; removed?: number }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const job = await loadJob(org.organizationId, input.jobId);
  if (!job) return { error: "job_not_found" };
  if (job.status !== "imported" && job.status !== "failed") return { error: "invalid_status" };

  const removed = await rollbackImport(org.organizationId, job.id);
  const supabase = createAdminClient();
  await supabase.from("project_import_jobs").update({ status: "cancelled" }).eq("id", job.id);
  await audit(org.organizationId, job.id, "rolled_back", `Removed ${removed} records`, org.userId);
  return { removed };
}

// ── 7. Lists ─────────────────────────────────────────────────────────────────

export async function listImportJobsAction(): Promise<{ error?: string; jobs?: ProjectImportJob[] }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("project_import_jobs")
    .select("*")
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(25);
  return { jobs: (data ?? []) as ProjectImportJob[] };
}

export async function listProjectsForImportAction(): Promise<{
  error?: string;
  projects?: { id: string; title: string }[];
}> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("projects")
    .select("id, title_i18n, slug")
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return {
    projects: (data ?? []).map((p) => ({
      id: p.id,
      title: (p.title_i18n as Record<string, string>)?.[org.locale] ?? (p.title_i18n as Record<string, string>)?.en ?? p.slug,
    })),
  };
}
