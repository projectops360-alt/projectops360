// ============================================================================
// ProjectOps360° — Drawing Ingestion Pipeline (Prompt 2)
// ============================================================================
// Pure helpers shared by the upload UI (client) and server actions:
// file validation rules, supported formats, metadata inference and the
// pipeline stage model. No I/O here — storage and DB writes live in the
// server actions and the upload component.
// ============================================================================

// ── Supported formats ─────────────────────────────────────────────────────────

/** Extension → logical file type. PDF is the main working path for the MVP;
 *  DWG/RVT/IFC are accepted at metadata level and wait for Autodesk APS. */
export const SUPPORTED_DRAWING_FORMATS: Record<string, { fileType: string; mimeTypes: string[] }> = {
  pdf: { fileType: "pdf", mimeTypes: ["application/pdf"] },
  dwg: { fileType: "dwg", mimeTypes: ["application/acad", "image/vnd.dwg", "application/octet-stream"] },
  rvt: { fileType: "rvt", mimeTypes: ["application/octet-stream"] },
  ifc: { fileType: "ifc", mimeTypes: ["application/x-step", "text/plain", "application/octet-stream"] },
  png: { fileType: "png", mimeTypes: ["image/png"] },
  jpg: { fileType: "jpg", mimeTypes: ["image/jpeg"] },
  jpeg: { fileType: "jpg", mimeTypes: ["image/jpeg"] },
};

export const SUPPORTED_EXTENSIONS = Object.keys(SUPPORTED_DRAWING_FORMATS);

/** Max upload size in bytes (50 MB). Mirrors the storage bucket expectation. */
export const MAX_DRAWING_FILE_SIZE = 50 * 1024 * 1024;

// ── Validation ────────────────────────────────────────────────────────────────

export type DrawingValidationError =
  | "unsupported_file_type"
  | "file_too_large"
  | "empty_file";

/** Validate a candidate drawing file. Pure — usable on client and server.
 *  Server actions re-run this so client-side metadata is never trusted alone. */
export function validateDrawingFile(input: {
  fileName: string;
  fileSize: number;
}): { ok: true; extension: string; fileType: string } | { ok: false; error: DrawingValidationError } {
  const extension = (input.fileName.split(".").pop() ?? "").toLowerCase();
  const format = SUPPORTED_DRAWING_FORMATS[extension];
  if (!format) {
    return { ok: false, error: "unsupported_file_type" };
  }
  if (input.fileSize <= 0) {
    return { ok: false, error: "empty_file" };
  }
  if (input.fileSize > MAX_DRAWING_FILE_SIZE) {
    return { ok: false, error: "file_too_large" };
  }
  return { ok: true, extension, fileType: format.fileType };
}

// ── Metadata inference ────────────────────────────────────────────────────────

/** Best-effort drawing number / revision inference from common file naming
 *  conventions, e.g. "A-101_R3.pdf", "S-201 Rev B - Foundation Plan.pdf".
 *  Always overridable later by title-block extraction (Prompt 3). */
export function inferDrawingMetadata(fileName: string): {
  drawing_number: string | null;
  revision: string | null;
} {
  const base = fileName.replace(/\.[^.]+$/, "");

  // Drawing number: discipline letter(s) + separator + digits, at the start
  const numberMatch = base.match(/^([A-Z]{1,3}[-_ ]?\d{2,4}(?:\.\d+)?)/i);
  // Revision: "R3", "Rev B", "rev.2" anywhere after the number
  const revisionMatch = base.match(/(?:^|[-_ ])(?:rev\.?\s*|r)([A-Z0-9]{1,3})(?:[-_ ]|$)/i);

  return {
    drawing_number: numberMatch ? numberMatch[1].replace(/[_ ]/g, "-").toUpperCase() : null,
    revision: revisionMatch ? revisionMatch[1].toUpperCase() : null,
  };
}

// ── Pipeline stage model ──────────────────────────────────────────────────────
// The ingestion pipeline is modeled as one job per stage. Synchronous stages
// complete during upload; asynchronous stages stay pending until their engine
// exists (OCR/AI arrive with Prompt 3). Designed to move to background
// workers later: each stage is an independent, idempotent job row.

export const PIPELINE_JOB_TYPES = [
  "ingest", // upload received, validated, stored, record created (synchronous today)
  "page_split", // PDF page extraction (Prompt 3 — needs a PDF dependency)
  "ocr_extraction", // OCR / text extraction (Prompt 3)
  "ai_interpretation", // AI insight generation (Prompt 3+)
] as const;

export type PipelineJobType = (typeof PIPELINE_JOB_TYPES)[number];

/** Storage path convention: drawings/{orgId}/{projectId}/{uuid}-{fileName}.
 *  First segment must match the bucket policy folder check. */
export function buildDrawingStoragePath(
  organizationId: string,
  projectId: string,
  fileName: string,
  uuid: string,
): string {
  // Strip characters that are unsafe for storage keys
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `drawings/${organizationId}/${projectId}/${uuid}-${safeName}`;
}
