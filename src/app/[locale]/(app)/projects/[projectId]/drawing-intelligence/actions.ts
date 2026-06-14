"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import {
  validateDrawingFile,
  inferDrawingMetadata,
} from "@/lib/drawing-intelligence/ingestion";
import type {
  DrawingEvidence,
  DrawingExtraction,
  DrawingFile,
  DrawingPage,
  DrawingProcessingJob,
} from "@/types/drawing-intelligence";
import type { EstimateSummary } from "@/lib/drawing-intelligence/costing";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Verify the project belongs to the caller's organization. Returns the org
 *  context, or null when access is denied / project missing. */
async function assertProjectAccess(projectId: string) {
  const org = await getOrgContext();
  const supabase = createAdminClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();
  if (!project) return null;
  return { org, supabase };
}

// ── Register Drawing File (after client-side storage upload) ─────────────────

const registerDrawingFileSchema = z.object({
  projectId: z.string().uuid("invalid_project_id"),
  fileName: z.string().min(1).max(300),
  originalFileName: z.string().min(1).max(300),
  fileSize: z.number().int().positive(),
  mimeType: z.string().max(150).optional(),
  storagePath: z.string().min(1).max(600),
  checksum: z.string().max(128).optional(),
  sourceSystem: z.enum(["manual_upload"]).default("manual_upload"),
  processingMode: z.enum(["quick_scan", "standard_analysis", "deep_analysis"]).default("standard_analysis"),
});

export interface RegisterDrawingResult {
  error?: string;
  fileId?: string;
  duplicateOf?: string;
}

export async function registerDrawingFileAction(
  input: z.infer<typeof registerDrawingFileSchema>,
): Promise<RegisterDrawingResult> {
  let access;
  try {
    access = await assertProjectAccess(input.projectId);
  } catch {
    return { error: "not_authenticated" };
  }
  if (!access) return { error: "missing_project_context" };
  const { org, supabase } = access;

  const parsed = registerDrawingFileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "validation_error" };
  }
  const data = parsed.data;

  // Server-side validation — never trust client metadata alone
  const validation = validateDrawingFile({
    fileName: data.fileName,
    fileSize: data.fileSize,
  });
  if (!validation.ok) {
    return { error: validation.error };
  }

  // Storage path must follow the org/project convention (no cross-org writes)
  const expectedPrefix = `drawings/${org.organizationId}/${data.projectId}/`;
  if (!data.storagePath.startsWith(expectedPrefix)) {
    return { error: "permission_error" };
  }

  // Duplicate detection: checksum first (strongest), then name+size fallback
  let duplicateQuery = supabase
    .from("drawing_files")
    .select("id, file_name, metadata")
    .eq("project_id", data.projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);
  if (data.checksum) {
    duplicateQuery = duplicateQuery.eq("metadata->>checksum", data.checksum);
  } else {
    duplicateQuery = duplicateQuery
      .eq("file_name", data.fileName)
      .eq("file_size", data.fileSize);
  }
  const { data: duplicates } = await duplicateQuery.limit(1);
  if (duplicates && duplicates.length > 0) {
    return { error: "duplicate_file", duplicateOf: duplicates[0].id };
  }

  // Infer drawing number / revision from the file name (overridable in Prompt 3)
  const inferred = inferDrawingMetadata(data.originalFileName);

  // Create the drawing file record
  const { data: fileRow, error: insertError } = await supabase
    .from("drawing_files")
    .insert({
      organization_id: org.organizationId,
      project_id: data.projectId,
      file_name: data.fileName,
      original_file_name: data.originalFileName,
      file_type: validation.fileType,
      file_extension: validation.extension,
      mime_type: data.mimeType ?? null,
      file_size: data.fileSize,
      storage_path: data.storagePath,
      source_system: data.sourceSystem,
      drawing_number: inferred.drawing_number,
      revision: inferred.revision,
      status: "active",
      processing_status: "pending", // = queued for intelligence processing
      uploaded_by: org.userId,
      metadata: {
        ...(data.checksum ? { checksum: data.checksum } : {}),
        processing_mode: data.processingMode,
      },
    })
    .select("id")
    .single();

  if (insertError || !fileRow) {
    console.error("[drawing-intelligence] file insert failed:", insertError);
    return { error: "storage_error" };
  }

  // Pipeline jobs: ingest completes synchronously (validation + storage +
  // record done here); downstream stages stay pending for their engines.
  const now = new Date().toISOString();
  const { error: jobsError } = await supabase.from("drawing_processing_jobs").insert([
    {
      organization_id: org.organizationId,
      project_id: data.projectId,
      drawing_file_id: fileRow.id,
      job_type: "ingest",
      status: "completed",
      started_at: now,
      completed_at: now,
      processing_metadata_json: {
        stages: ["upload_received", "metadata_stored", "file_stored", "record_created", "validation_completed"],
      },
    },
    {
      organization_id: org.organizationId,
      project_id: data.projectId,
      drawing_file_id: fileRow.id,
      job_type: "page_split",
      status: "pending",
      // TODO(prompt-3): PDF page counting/preview needs a PDF dependency
      // (none in the project today). The job is queued and idempotent.
      processing_metadata_json: { queued_reason: "awaiting_pdf_engine" },
    },
    {
      organization_id: org.organizationId,
      project_id: data.projectId,
      drawing_file_id: fileRow.id,
      job_type: "ocr_extraction",
      status: "pending",
      processing_metadata_json: { queued_reason: "awaiting_ocr_engine" },
    },
    {
      organization_id: org.organizationId,
      project_id: data.projectId,
      drawing_file_id: fileRow.id,
      job_type: "ai_interpretation",
      status: "pending",
      processing_metadata_json: { queued_reason: "awaiting_ai_engine" },
    },
  ]);

  if (jobsError) {
    console.error("[drawing-intelligence] job creation failed:", jobsError);
    // File record exists; jobs can be recreated by retry. Don't fail the upload.
  }

  // Fire-and-forget: run the extraction pipeline (same pattern as embedding
  // generation elsewhere in the app). Failures land on the job rows.
  import("@/lib/drawing-intelligence/processing").then(({ processDrawingFile }) => {
    processDrawingFile({
      fileId: fileRow.id,
      organizationId: org.organizationId,
      projectId: data.projectId,
      // Pass org context so the AI enhancement (material takeoff + insights)
      // can run on upload — without this, AI never runs and only the heuristic
      // general-notes insights are produced.
      orgContext: org,
    }).catch((error) => {
      console.error("[drawing-intelligence] background processing failed:", error);
    });
  });

  revalidatePath(`/projects/${data.projectId}/drawing-intelligence`, "page");
  return { fileId: fileRow.id };
}

// ── Run / re-run the extraction pipeline for a file ───────────────────────────

export async function processDrawingFileAction(input: {
  fileId: string;
  projectId: string;
  mode?: "quick_scan" | "standard_analysis" | "deep_analysis";
}): Promise<{ error?: string; status?: string }> {
  let access;
  try {
    access = await assertProjectAccess(input.projectId);
  } catch {
    return { error: "not_authenticated" };
  }
  if (!access) return { error: "missing_project_context" };

  if (!z.string().uuid().safeParse(input.fileId).success) {
    return { error: "validation_error" };
  }

  const { processDrawingFile } = await import("@/lib/drawing-intelligence/processing");
  const outcome = await processDrawingFile({
    fileId: input.fileId,
    organizationId: access.org.organizationId,
    projectId: input.projectId,
    orgContext: access.org, // enables the AI interpretation enhancement (deep mode)
    mode: input.mode,
  });

  revalidatePath(`/projects/${input.projectId}/drawing-intelligence`, "page");
  if (!outcome.ok) return { error: outcome.error ?? "processing_job_failed", status: outcome.status };
  return { status: outcome.status };
}

// ── Generate the costed estimate from a drawing's takeoff ─────────────────────

export async function generateTakeoffEstimateAction(input: {
  fileId: string;
  projectId: string;
}): Promise<{ error?: string; summary?: EstimateSummary }> {
  let access;
  try {
    access = await assertProjectAccess(input.projectId);
  } catch {
    return { error: "not_authenticated" };
  }
  if (!access) return { error: "missing_project_context" };
  if (!z.string().uuid().safeParse(input.fileId).success) {
    return { error: "validation_error" };
  }

  const { generateTakeoffEstimate } = await import("@/lib/drawing-intelligence/costing");
  const summary = await generateTakeoffEstimate({
    organizationId: access.org.organizationId,
    projectId: input.projectId,
    fileId: input.fileId,
  });

  revalidatePath(`/projects/${input.projectId}/drawing-intelligence`, "page");
  if (!summary.ok) return { error: summary.error ?? "estimate_failed" };
  return { summary };
}

// ── Retry a failed processing job ─────────────────────────────────────────────

const retryJobSchema = z.object({
  jobId: z.string().uuid("invalid_job_id"),
  projectId: z.string().uuid("invalid_project_id"),
});

export async function retryDrawingProcessingJobAction(input: {
  jobId: string;
  projectId: string;
}): Promise<{ error?: string }> {
  let access;
  try {
    access = await assertProjectAccess(input.projectId);
  } catch {
    return { error: "not_authenticated" };
  }
  if (!access) return { error: "missing_project_context" };
  const { org, supabase } = access;

  const parsed = retryJobSchema.safeParse(input);
  if (!parsed.success) return { error: "validation_error" };

  // Only failed (or cancelled) jobs can be retried — no duplicate records,
  // the same job row is re-queued with an incremented retry counter.
  const { data: job } = await supabase
    .from("drawing_processing_jobs")
    .select("id, status, retry_count, drawing_file_id")
    .eq("id", parsed.data.jobId)
    .eq("project_id", parsed.data.projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();

  if (!job) return { error: "missing_project_context" };
  if (job.status !== "failed" && job.status !== "cancelled") {
    return { error: "job_not_retryable" };
  }

  const { error: updateError } = await supabase
    .from("drawing_processing_jobs")
    .update({
      status: "pending",
      retry_count: job.retry_count + 1,
      error_message: null,
      started_at: null,
      completed_at: null,
    })
    .eq("id", job.id)
    .eq("organization_id", org.organizationId);

  if (updateError) {
    console.error("[drawing-intelligence] retry failed:", updateError);
    return { error: "processing_job_failed" };
  }

  // Reflect the re-queue on the parent file when it was marked failed
  if (job.drawing_file_id) {
    await supabase
      .from("drawing_files")
      .update({ processing_status: "pending" })
      .eq("id", job.drawing_file_id)
      .eq("organization_id", org.organizationId)
      .eq("processing_status", "failed");

    // Extraction-stage retries actually re-run the pipeline (fire-and-forget)
    const fileId = job.drawing_file_id;
    import("@/lib/drawing-intelligence/processing").then(({ processDrawingFile }) => {
      processDrawingFile({
        fileId,
        organizationId: org.organizationId,
        projectId: parsed.data.projectId,
      }).catch((error) => {
        console.error("[drawing-intelligence] retry processing failed:", error);
      });
    });
  }

  revalidatePath(`/projects/${parsed.data.projectId}/drawing-intelligence`, "page");
  return {};
}

// ── Archive (soft delete) a drawing file ──────────────────────────────────────

export async function archiveDrawingFileAction(input: {
  fileId: string;
  projectId: string;
}): Promise<{ error?: string }> {
  let access;
  try {
    access = await assertProjectAccess(input.projectId);
  } catch {
    return { error: "not_authenticated" };
  }
  if (!access) return { error: "missing_project_context" };
  const { org, supabase } = access;

  if (!z.string().uuid().safeParse(input.fileId).success) {
    return { error: "validation_error" };
  }

  const deletedAt = new Date().toISOString();
  const { error: fileError } = await supabase
    .from("drawing_files")
    .update({ deleted_at: deletedAt })
    .eq("id", input.fileId)
    .eq("project_id", input.projectId)
    .eq("organization_id", org.organizationId);

  if (fileError) {
    console.error("[drawing-intelligence] archive failed:", fileError);
    return { error: "processing_job_failed" };
  }

  // Cascade the soft delete to everything derived from the file — without the
  // document its intelligence is meaningless, so no tab should keep showing it.
  // The storage object is intentionally kept (soft-delete pattern, same as the
  // rest of the app).

  // Collect insight ids first (needed for the Living Graph node cleanup).
  const { data: insightRows } = await supabase
    .from("drawing_insights")
    .select("id")
    .eq("drawing_file_id", input.fileId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);
  const insightIds = (insightRows ?? []).map((row) => row.id);

  const cascade = (table: string) =>
    supabase
      .from(table)
      .update({ deleted_at: deletedAt })
      .eq("drawing_file_id", input.fileId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null);

  const results = await Promise.all([
    cascade("drawing_processing_jobs"),
    cascade("drawing_pages"),
    cascade("drawing_extractions"),
    cascade("drawing_insights"),
    cascade("drawing_evidence"),
    cascade("drawing_versions"),
  ]);
  for (const result of results) {
    if (result.error) {
      console.error("[drawing-intelligence] archive cascade failed:", result.error);
    }
  }

  // Living Graph cleanup (best effort): hide the drawing node and its insight
  // nodes. Edges have no deleted_at — graph queries filter by visible nodes.
  try {
    await supabase
      .from("process_nodes")
      .update({ deleted_at: deletedAt })
      .eq("project_id", input.projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .or(
        [
          `and(source_entity_type.eq.drawing_files,source_entity_id.eq.${input.fileId})`,
          insightIds.length > 0
            ? `and(source_entity_type.eq.drawing_insights,source_entity_id.in.(${insightIds.join(",")}))`
            : null,
        ].filter(Boolean).join(","),
      );
  } catch (error) {
    console.error("[drawing-intelligence] graph cleanup failed (non-fatal):", error);
  }

  revalidatePath(`/projects/${input.projectId}/drawing-intelligence`, "page");
  return {};
}

// ── Live processing progress (lightweight, polled by the progress gauge) ─────

export interface FileProcessingProgress {
  fileId: string;
  fileName: string;
  processingStatus: string;
  jobs: { job_type: string; status: string }[];
}

export async function getDrawingProcessingProgressAction(input: {
  projectId: string;
}): Promise<{ error?: string; files?: FileProcessingProgress[] }> {
  let access;
  try {
    access = await assertProjectAccess(input.projectId);
  } catch {
    return { error: "not_authenticated" };
  }
  if (!access) return { error: "missing_project_context" };
  const { org, supabase } = access;

  // Files uploaded/processed in the last hour OR still active — keeps the
  // payload tiny while covering everything the gauge needs.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: files } = await supabase
    .from("drawing_files")
    .select("id, file_name, drawing_number, processing_status, created_at")
    .eq("project_id", input.projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .or(`processing_status.in.(pending,processing),created_at.gte.${oneHourAgo}`)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!files || files.length === 0) return { files: [] };

  const { data: jobs } = await supabase
    .from("drawing_processing_jobs")
    .select("drawing_file_id, job_type, status")
    .in("drawing_file_id", files.map((f) => f.id))
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  return {
    files: files.map((file) => ({
      fileId: file.id,
      fileName: file.drawing_number ?? file.file_name,
      processingStatus: file.processing_status,
      jobs: (jobs ?? [])
        .filter((job) => job.drawing_file_id === file.id)
        .map((job) => ({ job_type: job.job_type, status: job.status })),
    })),
  };
}

// ── Insight review workflow (accept / dismiss / review / link) ───────────────

const insightStatusValues = ["open", "in_review", "accepted", "dismissed", "converted", "linked"] as const;

export async function updateDrawingInsightStatusAction(input: {
  insightId: string;
  projectId: string;
  status: string;
}): Promise<{ error?: string }> {
  let access;
  try {
    access = await assertProjectAccess(input.projectId);
  } catch {
    return { error: "not_authenticated" };
  }
  if (!access) return { error: "missing_project_context" };
  const { org, supabase } = access;

  const parsed = z
    .object({
      insightId: z.string().uuid(),
      status: z.enum(insightStatusValues),
    })
    .safeParse({ insightId: input.insightId, status: input.status });
  if (!parsed.success) return { error: "validation_error" };

  const { error } = await supabase
    .from("drawing_insights")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.insightId)
    .eq("project_id", input.projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (error) {
    console.error("[drawing-intelligence] insight status update failed:", error);
    return { error: "unexpected" };
  }

  revalidatePath(`/projects/${input.projectId}/drawing-intelligence`, "page");
  return {};
}

export async function linkDrawingInsightToTaskAction(input: {
  insightId: string;
  projectId: string;
  taskId: string;
}): Promise<{ error?: string }> {
  let access;
  try {
    access = await assertProjectAccess(input.projectId);
  } catch {
    return { error: "not_authenticated" };
  }
  if (!access) return { error: "missing_project_context" };
  const { org, supabase } = access;

  if (!z.string().uuid().safeParse(input.insightId).success || !z.string().uuid().safeParse(input.taskId).success) {
    return { error: "validation_error" };
  }

  // Task must belong to the same project/org
  const { data: task } = await supabase
    .from("roadmap_tasks")
    .select("id")
    .eq("id", input.taskId)
    .eq("project_id", input.projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();
  if (!task) return { error: "missing_project_context" };

  const { error } = await supabase
    .from("drawing_insights")
    .update({ linked_task_id: input.taskId, status: "linked" })
    .eq("id", input.insightId)
    .eq("project_id", input.projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (error) {
    console.error("[drawing-intelligence] insight link failed:", error);
    return { error: "unexpected" };
  }

  // Living Graph: insight → task edge (best effort)
  import("@/lib/graph/emit-event").then(async ({ emitProcessEdge }) => {
    const [{ data: insightNode }, { data: taskNode }] = await Promise.all([
      supabase.from("process_nodes").select("id")
        .eq("project_id", input.projectId)
        .eq("source_entity_type", "drawing_insights")
        .eq("source_entity_id", input.insightId)
        .is("deleted_at", null).limit(1).maybeSingle(),
      supabase.from("process_nodes").select("id")
        .eq("project_id", input.projectId)
        .eq("source_entity_type", "roadmap_tasks")
        .eq("source_entity_id", input.taskId)
        .is("deleted_at", null).limit(1).maybeSingle(),
    ]);
    if (insightNode && taskNode) {
      await emitProcessEdge({
        organizationId: org.organizationId,
        projectId: input.projectId,
        fromNodeId: insightNode.id,
        toNodeId: taskNode.id,
        edgeType: "affects",
        metadata: { relationship: "insight_affects_task", linked_manually: true },
      });
    }
  }).catch(() => { /* non-fatal */ });

  revalidatePath(`/projects/${input.projectId}/drawing-intelligence`, "page");
  return {};
}

// ── Drawing detail (lazy-loaded for the side panel) ──────────────────────────

export interface DrawingDetailResult {
  error?: string;
  file?: DrawingFile;
  pages?: DrawingPage[];
  extractions?: DrawingExtraction[];
  jobs?: DrawingProcessingJob[];
  evidence?: DrawingEvidence[];
}

export async function getDrawingDetailAction(input: {
  fileId: string;
  projectId: string;
}): Promise<DrawingDetailResult> {
  let access;
  try {
    access = await assertProjectAccess(input.projectId);
  } catch {
    return { error: "not_authenticated" };
  }
  if (!access) return { error: "missing_project_context" };
  const { org, supabase } = access;

  const [fileResult, pagesResult, extractionsResult, jobsResult, evidenceResult] = await Promise.all([
    supabase
      .from("drawing_files")
      .select("*")
      .eq("id", input.fileId)
      .eq("project_id", input.projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .single(),
    supabase
      .from("drawing_pages")
      .select("*")
      .eq("drawing_file_id", input.fileId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("page_number"),
    supabase
      .from("drawing_extractions")
      .select("*")
      .eq("drawing_file_id", input.fileId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("created_at"),
    supabase
      .from("drawing_processing_jobs")
      .select("*")
      .eq("drawing_file_id", input.fileId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("created_at"),
    supabase
      .from("drawing_evidence")
      .select("*")
      .eq("drawing_file_id", input.fileId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("page_number")
      .limit(200),
  ]);

  if (!fileResult.data) return { error: "missing_project_context" };

  return {
    file: fileResult.data as DrawingFile,
    pages: (pagesResult.data ?? []) as DrawingPage[],
    extractions: (extractionsResult.data ?? []) as DrawingExtraction[],
    jobs: (jobsResult.data ?? []) as DrawingProcessingJob[],
    evidence: (evidenceResult.data ?? []) as DrawingEvidence[],
  };
}
