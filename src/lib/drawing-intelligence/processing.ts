// ============================================================================
// ProjectOps360° — DrawingProcessingService (Prompt 3)
// ============================================================================
// Orchestrates the extraction pipeline for one drawing file:
//   download → PDF text → pages → title block → revision block → notes →
//   discipline → extractions + evidence + canonical JSON → statuses.
// Server-only. Idempotent: reprocessing soft-deletes the file's previous
// pages/extractions/evidence and rebuilds them.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { extractPdfText } from "./pdf-extraction";
import { getOcrProvider } from "./ocr";
import {
  extractTitleBlock,
  extractRevisionBlock,
  extractNotes,
  classifyDiscipline,
  CONFIDENCE_REVIEW_THRESHOLD,
  type ExtractedField,
  type RevisionEntry,
  type ExtractedNote,
} from "./extractors";
import type { CanonicalDrawingExtraction } from "@/types/drawing-intelligence";
import type { OrgContext } from "@/lib/auth";

/** Cost-aware processing depth.
 *  quick_scan: metadata + title block + revision + discipline + notes.
 *  standard_analysis: + deterministic insights + metadata version sync.
 *  deep_analysis: + AI enhancement (token cost) + version text-diff. */
export type ProcessingMode = "quick_scan" | "standard_analysis" | "deep_analysis";

export interface ProcessingOutcome {
  ok: boolean;
  status: "completed" | "needs_review" | "failed";
  stages: string[];
  error?: string;
}

type Supabase = ReturnType<typeof createAdminClient>;

// ── Job helpers ───────────────────────────────────────────────────────────────

async function setJobStatus(
  supabase: Supabase,
  fileId: string,
  jobType: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from("drawing_processing_jobs")
    .update(patch)
    .eq("drawing_file_id", fileId)
    .eq("job_type", jobType)
    .is("deleted_at", null);
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

export async function processDrawingFile(input: {
  fileId: string;
  organizationId: string;
  projectId: string;
  /** When present, the AI interpretation enhancement is enabled (Prompt 4) */
  orgContext?: OrgContext;
  /** Cost-aware depth; falls back to the mode stored at upload, then standard */
  mode?: ProcessingMode;
}): Promise<ProcessingOutcome> {
  const supabase = createAdminClient();
  const stages: string[] = [];
  const { fileId, organizationId, projectId } = input;
  const pipelineStart = Date.now();

  // Load the file record (org-scoped)
  const { data: file } = await supabase
    .from("drawing_files")
    .select("*")
    .eq("id", fileId)
    .eq("organization_id", organizationId)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .single();

  if (!file) {
    return { ok: false, status: "failed", stages, error: "file_not_found" };
  }

  const mode: ProcessingMode =
    input.mode ??
    ((file.metadata as Record<string, unknown>)?.processing_mode as ProcessingMode | undefined) ??
    "standard_analysis";

  // Concurrency guard: if another run is already processing this file
  // (e.g. the post-upload background run + a manual "Run extraction" click),
  // skip — concurrent runs caused duplicated insights. A stale lock older
  // than 3 minutes is ignored (crashed run).
  if (file.processing_status === "processing") {
    const { data: activeJob } = await supabase
      .from("drawing_processing_jobs")
      .select("started_at")
      .eq("drawing_file_id", fileId)
      .eq("job_type", "page_split")
      .eq("status", "processing")
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    const startedAt = activeJob?.started_at ? new Date(activeJob.started_at).getTime() : 0;
    if (startedAt > Date.now() - 3 * 60 * 1000) {
      return { ok: true, status: "completed", stages: ["skipped_already_processing"] };
    }
  }

  const fail = async (error: string, message?: string): Promise<ProcessingOutcome> => {
    await supabase
      .from("drawing_files")
      .update({ processing_status: "failed" })
      .eq("id", fileId);
    await setJobStatus(supabase, fileId, "page_split", {
      status: "failed",
      error_message: message ?? error,
      completed_at: new Date().toISOString(),
      processing_metadata_json: { stages },
    });
    return { ok: false, status: "failed", stages, error };
  };

  // Only PDFs run through the text pipeline today. Images go straight to the
  // OCR plug point; CAD/BIM formats wait for Autodesk APS.
  if (file.file_type !== "pdf") {
    const ocr = getOcrProvider();
    const isImage = file.file_type === "png" || file.file_type === "jpg";
    const reason = isImage
      ? ocr.isAvailable()
        ? "image_ocr_not_implemented"
        : "ocr_unavailable"
      : "awaiting_aps_connector";
    await supabase
      .from("drawing_files")
      .update({ processing_status: "needs_review", metadata: { ...file.metadata, skip_reason: reason } })
      .eq("id", fileId);
    await setJobStatus(supabase, fileId, "ocr_extraction", {
      status: "needs_review",
      error_message: reason,
      completed_at: new Date().toISOString(),
    });
    return { ok: true, status: "needs_review", stages: [reason] };
  }

  // Mark file + page_split job as processing
  const startedAt = new Date().toISOString();
  await supabase.from("drawing_files").update({ processing_status: "processing" }).eq("id", fileId);
  await setJobStatus(supabase, fileId, "page_split", { status: "processing", started_at: startedAt });

  // 1. Download from storage
  if (!file.storage_path) return fail("storage_error", "missing storage_path");
  // storage_path is the full object key (includes the "drawings/" folder
  // prefix required by the bucket policies) — use it verbatim
  const { data: blob, error: downloadError } = await supabase.storage
    .from("drawings")
    .download(file.storage_path);
  if (downloadError || !blob) {
    return fail("storage_error", downloadError?.message ?? "download failed");
  }
  stages.push("pdf_loaded");

  // 2. Extract per-page text
  const buffer = new Uint8Array(await blob.arrayBuffer());
  const extraction = await extractPdfText(buffer);
  if (!extraction.ok) {
    return fail(extraction.error, extraction.message);
  }
  stages.push("pages_detected");

  // 3. Idempotency: clear previous derived rows for this file
  const wipeAt = new Date().toISOString();
  await Promise.all([
    supabase.from("drawing_pages").update({ deleted_at: wipeAt }).eq("drawing_file_id", fileId).is("deleted_at", null),
    supabase.from("drawing_extractions").update({ deleted_at: wipeAt }).eq("drawing_file_id", fileId).is("deleted_at", null),
    supabase.from("drawing_evidence").update({ deleted_at: wipeAt }).eq("drawing_file_id", fileId).is("deleted_at", null),
  ]);

  // 4. OCR fallback path for scanned PDFs
  const ocr = getOcrProvider();
  if (extraction.isLikelyScanned && !ocr.isAvailable()) {
    // Create page shells so the page count is visible, then stop honestly.
    await insertPages(supabase, file, extraction.pages.map((p) => ({ ...p, text: "" })));
    stages.push("ocr_fallback_unavailable");
    await supabase
      .from("drawing_files")
      .update({ processing_status: "needs_review" })
      .eq("id", fileId);
    await setJobStatus(supabase, fileId, "page_split", {
      status: "completed",
      completed_at: new Date().toISOString(),
      processing_metadata_json: { stages, total_pages: extraction.totalPages },
    });
    await setJobStatus(supabase, fileId, "ocr_extraction", {
      status: "needs_review",
      error_message: "scanned_pdf_ocr_unavailable",
      completed_at: new Date().toISOString(),
    });
    return { ok: true, status: "needs_review", stages };
  }
  stages.push("text_extracted");

  // 5. Page records
  const pageIds = await insertPages(supabase, file, extraction.pages);
  stages.push("pages_stored");

  // 6. Heuristic extraction (title block is searched on every page; the best
  //    match wins — title blocks repeat per sheet)
  const fileNameForFallback = file.original_file_name ?? file.file_name;
  let bestTitleBlock: { fields: ExtractedField[]; values: Record<string, string>; confidence: number; pageNumber: number } | null = null;
  const allRevisions: RevisionEntry[] = [];
  const allNotes: ExtractedNote[] = [];
  const extractionRows: Record<string, unknown>[] = [];
  const evidenceRows: Record<string, unknown>[] = [];

  for (const page of extraction.pages) {
    const pageId = pageIds.get(page.pageNumber) ?? null;

    const tb = extractTitleBlock(page.text, page.pageNumber, fileNameForFallback);
    if (tb.fields.length > 0 && (!bestTitleBlock || tb.confidence > bestTitleBlock.confidence)) {
      bestTitleBlock = { ...tb, pageNumber: page.pageNumber };
    }

    const revisions = extractRevisionBlock(page.text, page.pageNumber);
    allRevisions.push(...revisions);
    if (revisions.length > 0) {
      extractionRows.push({
        organization_id: organizationId,
        project_id: projectId,
        drawing_file_id: fileId,
        drawing_page_id: pageId,
        extraction_type: "revision_block",
        extracted_json: { entries: revisions },
        confidence_score: avg(revisions.map((r) => r.confidence_score)),
        evidence_json: { page_number: page.pageNumber },
        model_used: "heuristic/v1",
        extraction_status: "completed",
      });
    }

    const notes = extractNotes(page.text, page.pageNumber);
    allNotes.push(...notes);
    if (notes.length > 0) {
      const byCategory = new Map<string, ExtractedNote[]>();
      for (const note of notes) {
        byCategory.set(note.category, [...(byCategory.get(note.category) ?? []), note]);
      }
      for (const [category, categoryNotes] of byCategory) {
        extractionRows.push({
          organization_id: organizationId,
          project_id: projectId,
          drawing_file_id: fileId,
          drawing_page_id: pageId,
          extraction_type: category === "keynotes" ? "keynotes" : "general_notes",
          extracted_json: { category, notes: categoryNotes },
          confidence_score: avg(categoryNotes.map((n) => n.confidence_score)),
          evidence_json: { page_number: page.pageNumber },
          model_used: "heuristic/v1",
          extraction_status: "completed",
        });
        for (const note of categoryNotes) {
          evidenceRows.push({
            organization_id: organizationId,
            project_id: projectId,
            drawing_file_id: fileId,
            drawing_page_id: pageId,
            related_entity_type: "drawing_extraction_note",
            related_entity_id: fileId, // note-level rows trace back to the file
            evidence_type: "text",
            page_number: note.page_number,
            text_excerpt: note.evidence.text_excerpt,
            confidence_score: note.confidence_score,
          });
        }
      }
    }
  }

  // Title block extraction row + evidence
  if (bestTitleBlock) {
    const tbPageId = pageIds.get(bestTitleBlock.pageNumber) ?? null;
    const lowConfidence = bestTitleBlock.confidence < CONFIDENCE_REVIEW_THRESHOLD;
    extractionRows.push({
      organization_id: organizationId,
      project_id: projectId,
      drawing_file_id: fileId,
      drawing_page_id: tbPageId,
      extraction_type: "title_block",
      extracted_json: { fields: bestTitleBlock.fields, values: bestTitleBlock.values },
      confidence_score: bestTitleBlock.confidence,
      evidence_json: { page_number: bestTitleBlock.pageNumber },
      model_used: "heuristic/v1",
      extraction_status: lowConfidence ? "needs_review" : "completed",
    });
    for (const field of bestTitleBlock.fields) {
      evidenceRows.push({
        organization_id: organizationId,
        project_id: projectId,
        drawing_file_id: fileId,
        drawing_page_id: tbPageId,
        related_entity_type: "drawing_title_block_field",
        related_entity_id: fileId,
        evidence_type: "text",
        page_number: field.evidence.page_number,
        text_excerpt: `${field.field}: ${field.evidence.text_excerpt}`,
        confidence_score: field.confidence_score,
      });
    }
    stages.push("title_block_extracted");
  }
  if (allRevisions.length > 0) stages.push("revision_block_extracted");
  if (allNotes.length > 0) stages.push("notes_extracted");

  // 7. Discipline classification
  const firstPage = extraction.pages[0];
  const discipline = classifyDiscipline({
    drawingNumber: bestTitleBlock?.values.drawing_number ?? file.drawing_number,
    title: bestTitleBlock?.values.drawing_title ?? file.drawing_title,
    fileName: fileNameForFallback,
    pageText: firstPage?.text ?? "",
    pageNumber: firstPage?.pageNumber ?? 1,
  });

  // 8. Persist extraction + evidence rows
  if (extractionRows.length > 0) {
    const { error } = await supabase.from("drawing_extractions").insert(extractionRows);
    if (error) console.error("[drawing-processing] extraction insert failed:", error);
  }
  if (evidenceRows.length > 0) {
    const { error } = await supabase.from("drawing_evidence").insert(evidenceRows);
    if (error) console.error("[drawing-processing] evidence insert failed:", error);
  }
  stages.push("evidence_stored");

  // 9. Canonical JSON + file metadata update
  const values = bestTitleBlock?.values ?? {};
  const overallConfidence = round2(
    avg(
      [
        bestTitleBlock?.confidence ?? 0,
        discipline.confidence_score,
        allRevisions.length > 0 ? avg(allRevisions.map((r) => r.confidence_score)) : 0,
      ].filter((c) => c > 0),
    ),
  );

  const canonical: CanonicalDrawingExtraction = {
    drawing: {
      drawing_number: values.drawing_number ?? file.drawing_number ?? "",
      title: values.drawing_title ?? file.drawing_title ?? "",
      discipline: discipline.discipline === "Unknown" ? "" : discipline.discipline,
      revision: values.revision ?? file.revision ?? "",
      date: values.revision_date ?? values.issue_date ?? "",
    },
    pages: extraction.pages.map((page) => ({
      page_number: page.pageNumber,
      sheet_number: page.pageNumber === bestTitleBlock?.pageNumber ? (values.sheet_number ?? "") : "",
      title_block: page.pageNumber === bestTitleBlock?.pageNumber ? values : {},
      revision_block: allRevisions.filter((r) => r.evidence.page_number === page.pageNumber) as unknown[],
      notes: allNotes.filter((n) => n.page_number === page.pageNumber && n.category !== "keynotes") as unknown[],
      symbols: [],
      detected_elements: [],
      risks: [],
      rfi_candidates: [],
      submittal_requirements: [],
      quantity_takeoff: [],
      schedule_impacts: [],
      cost_impacts: [],
      evidence: allNotes
        .filter((n) => n.page_number === page.pageNumber)
        .map((n) => ({ page_number: n.page_number, text_excerpt: n.evidence.text_excerpt, confidence_score: n.confidence_score })),
    })),
  };

  const needsReview =
    overallConfidence > 0 && overallConfidence < CONFIDENCE_REVIEW_THRESHOLD;
  const finalStatus: "completed" | "needs_review" =
    needsReview || !bestTitleBlock ? "needs_review" : "completed";

  await supabase
    .from("drawing_files")
    .update({
      drawing_number: values.drawing_number ?? file.drawing_number,
      drawing_title: values.drawing_title ?? file.drawing_title,
      revision: values.revision ?? file.revision,
      revision_date: parseDateSafe(values.revision_date) ?? file.revision_date,
      discipline: discipline.discipline === "Unknown" ? file.discipline : discipline.discipline,
      processing_status: finalStatus,
      metadata: {
        ...file.metadata,
        canonical_extraction: canonical,
        extraction_confidence: overallConfidence,
        total_pages: extraction.totalPages,
        discipline_method: discipline.method,
      },
    })
    .eq("id", fileId);
  stages.push("metadata_updated");

  // 10. Job statuses: page_split + ocr_extraction done; ai_interpretation
  //     stays pending for Prompt 4.
  const completedAt = new Date().toISOString();
  await setJobStatus(supabase, fileId, "page_split", {
    status: "completed",
    started_at: startedAt,
    completed_at: completedAt,
    processing_metadata_json: {
      stages,
      total_pages: extraction.totalPages,
      // Cost-aware tracking
      processing_mode: mode,
      pages_processed: extraction.totalPages,
      processing_duration_ms: Date.now() - pipelineStart,
      estimated_ocr_cost: 0, // OCR provider not configured
    },
  });
  await setJobStatus(supabase, fileId, "ocr_extraction", {
    status: extraction.isLikelyScanned ? "needs_review" : "completed",
    started_at: startedAt,
    completed_at: completedAt,
    error_message: extraction.isLikelyScanned ? "scanned_pdf_ocr_unavailable" : null,
    processing_metadata_json: {
      method: "pdf_text_layer",
      extraction_confidence: overallConfidence,
    },
  });

  // 11. Interpretation + version sync, gated by processing mode (cost-aware).
  //     quick_scan stops here: metadata/title block/revision/notes only.
  if (mode !== "quick_scan") {
    try {
      const { runDrawingInterpretation } = await import("./interpretation-service");
      const interpretation = await runDrawingInterpretation({
        fileId,
        organizationId,
        projectId,
        // AI enhancement (token cost) only in deep_analysis
        orgContext: mode === "deep_analysis" ? input.orgContext : undefined,
      });
      if (interpretation.ok) stages.push("insights_generated");
    } catch (error) {
      console.error("[drawing-processing] interpretation stage failed:", error);
    }

    try {
      const { syncDrawingVersion } = await import("./version-sync");
      const versionSync = await syncDrawingVersion({ fileId, organizationId, projectId });
      if (versionSync.versionRecorded) stages.push("version_recorded");
    } catch (error) {
      console.error("[drawing-processing] version sync failed:", error);
    }
  } else {
    // quick_scan: leave the interpretation job pending, clearly marked cheap
    await setJobStatus(supabase, fileId, "ai_interpretation", {
      processing_metadata_json: { skipped_reason: "quick_scan_mode" },
    });
  }

  return { ok: true, status: finalStatus, stages };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function insertPages(
  supabase: Supabase,
  file: { id: string; organization_id: string; project_id: string },
  pages: { pageNumber: number; text: string }[],
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (pages.length === 0) return map;
  const { data } = await supabase
    .from("drawing_pages")
    .insert(
      pages.map((page) => ({
        organization_id: file.organization_id,
        drawing_file_id: file.id,
        project_id: file.project_id,
        page_number: page.pageNumber,
      })),
    )
    .select("id, page_number");
  for (const row of data ?? []) {
    map.set(row.page_number, row.id);
  }
  return map;
}

function avg(values: number[]): number {
  return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Convert loose date strings (06/01/2026, 2026-06-01) to ISO date or null */
function parseDateSafe(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}
