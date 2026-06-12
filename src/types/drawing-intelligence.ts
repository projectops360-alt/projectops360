// ============================================================================
// ProjectOps360° — Drawing Intelligence Types (Foundation)
// ============================================================================
// Mirrors supabase/migrations/20260705000000_create_drawing_intelligence.sql.
// Drawing Intelligence is an AI engine that reads construction drawings and
// turns them into structured project knowledge (risks, RFIs, submittals,
// quantities, schedule/cost impacts) with full evidence traceability.
// It is intentionally separate from generic Documents (file storage).
// ============================================================================

// ── Shared unions ─────────────────────────────────────────────────────────────

/** Lifecycle status of a drawing file within the project set */
export type DrawingFileStatus = "active" | "superseded" | "archived";

/** Background processing status (files, extractions, jobs) */
export type DrawingProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "needs_review"
  | "cancelled";

/** Where a drawing file came from. Open set — no vendor lock-in. */
export type DrawingSourceSystem =
  | "manual_upload"
  | "autodesk_aps"
  | "procore"
  | "google_drive"
  | "local"
  | (string & {});

/** Known extraction types. Open set — future engines may add more. */
export type DrawingExtractionType =
  | "title_block"
  | "revision_block"
  | "general_notes"
  | "keynotes"
  | "symbols"
  | "rooms"
  | "levels"
  | "equipment"
  | "doors"
  | "windows"
  | "mep_elements"
  | "structural_elements"
  | "quantity_takeoff"
  | "material_takeoff"
  | "submittal_requirements"
  | "inspection_requirements"
  | "rfi_candidates"
  | "risk_candidates"
  | "schedule_impacts"
  | "cost_impacts"
  | (string & {});

/** AI interpretation categories */
export type DrawingInsightType =
  | "risk"
  | "rfi_candidate"
  | "submittal_requirement"
  | "inspection_requirement"
  | "schedule_impact"
  | "cost_impact"
  | "missing_information"
  | "contradiction"
  | "scope_gap"
  | "coordination_issue"
  | "version_change"
  | "decision_required";

export type DrawingInsightSeverity = "low" | "medium" | "high" | "critical";

/** open = suggested; in_review = needs review; accepted/dismissed by the user;
 *  converted = became another record; linked = attached to a task/milestone. */
export type DrawingInsightStatus =
  | "open"
  | "in_review"
  | "accepted"
  | "dismissed"
  | "converted"
  | "linked"
  | "actioned"
  | "resolved";

export type DrawingEvidenceType = "text" | "region" | "symbol" | "table" | "image_crop";

/** Known background job types. Open set. */
export type DrawingJobType =
  | "ingest"
  | "page_split"
  | "title_block_extraction"
  | "insight_generation"
  | "version_compare"
  | (string & {});

// ── Table row types ───────────────────────────────────────────────────────────

export interface DrawingFile {
  id: string;
  organization_id: string;
  project_id: string;
  file_name: string;
  original_file_name: string | null;
  file_type: string | null;
  file_extension: string | null;
  mime_type: string | null;
  file_size: number | null;
  storage_path: string | null;
  source_system: DrawingSourceSystem;
  source_external_id: string | null;
  source_version_id: string | null;
  drawing_number: string | null;
  drawing_title: string | null;
  discipline: string | null;
  revision: string | null;
  revision_date: string | null;
  status: DrawingFileStatus;
  processing_status: DrawingProcessingStatus;
  uploaded_by: string | null;
  metadata: Record<string, unknown>;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DrawingPage {
  id: string;
  organization_id: string;
  drawing_file_id: string;
  project_id: string;
  page_number: number;
  sheet_number: string | null;
  sheet_name: string | null;
  title_block_json: Record<string, unknown>;
  revision_block_json: Record<string, unknown>;
  detected_scale: string | null;
  detected_orientation: string | null;
  width: number | null;
  height: number | null;
  image_preview_path: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DrawingExtraction {
  id: string;
  organization_id: string;
  drawing_file_id: string;
  drawing_page_id: string | null;
  project_id: string;
  extraction_type: DrawingExtractionType;
  extracted_text: string | null;
  extracted_json: Record<string, unknown>;
  confidence_score: number | null;
  source_coordinates_json: Record<string, unknown>;
  evidence_json: Record<string, unknown>;
  model_used: string | null;
  extraction_status: DrawingProcessingStatus;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DrawingInsight {
  id: string;
  organization_id: string;
  project_id: string;
  drawing_file_id: string | null;
  drawing_page_id: string | null;
  insight_type: DrawingInsightType;
  title: string;
  description: string | null;
  severity: DrawingInsightSeverity;
  confidence_score: number | null;
  evidence_json: Record<string, unknown>;
  recommended_action: string | null;
  linked_task_id: string | null;
  linked_risk_id: string | null;
  linked_rfi_id: string | null;
  linked_submittal_id: string | null;
  linked_schedule_item_id: string | null;
  status: DrawingInsightStatus;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DrawingVersion {
  id: string;
  organization_id: string;
  project_id: string;
  drawing_file_id: string;
  previous_drawing_file_id: string | null;
  drawing_number: string | null;
  previous_revision: string | null;
  current_revision: string | null;
  changed_pages_json: unknown[];
  detected_deltas_json: unknown[];
  summary: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DrawingProcessingJob {
  id: string;
  organization_id: string;
  project_id: string;
  drawing_file_id: string | null;
  job_type: DrawingJobType;
  status: DrawingProcessingStatus;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  retry_count: number;
  processing_metadata_json: Record<string, unknown>;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DrawingEvidence {
  id: string;
  organization_id: string;
  project_id: string;
  drawing_file_id: string;
  drawing_page_id: string | null;
  related_entity_type: string;
  related_entity_id: string;
  evidence_type: DrawingEvidenceType;
  page_number: number | null;
  coordinates_json: Record<string, unknown>;
  text_excerpt: string | null;
  image_crop_path: string | null;
  confidence_score: number | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Canonical extraction JSON ─────────────────────────────────────────────────
// The contract future extraction engines must populate. Stored in
// drawing_extractions.extracted_json / drawing_files.metadata as appropriate.

export interface CanonicalDrawingHeader {
  drawing_number: string;
  title: string;
  discipline: string;
  revision: string;
  date: string;
}

export interface CanonicalEvidenceRef {
  page_number: number;
  coordinates?: { x: number; y: number; width: number; height: number };
  text_excerpt?: string;
  image_crop_path?: string;
  confidence_score?: number;
}

export interface CanonicalDrawingPage {
  page_number: number;
  sheet_number: string;
  title_block: Record<string, unknown>;
  /** Object in the Prompt 1 skeleton; populated as an array of revision rows
   *  by the extraction engine (Prompt 3 canonical example). */
  revision_block: Record<string, unknown> | unknown[];
  notes: unknown[];
  symbols: unknown[];
  detected_elements: unknown[];
  risks: unknown[];
  rfi_candidates: unknown[];
  submittal_requirements: unknown[];
  quantity_takeoff: unknown[];
  schedule_impacts: unknown[];
  cost_impacts: unknown[];
  evidence: CanonicalEvidenceRef[];
}

/** Canonical structure produced by every future extraction engine. */
export interface CanonicalDrawingExtraction {
  drawing: CanonicalDrawingHeader;
  pages: CanonicalDrawingPage[];
}

/** Empty canonical skeleton — useful for seeding and engine scaffolding. */
export function emptyCanonicalExtraction(
  header: Partial<CanonicalDrawingHeader> = {},
): CanonicalDrawingExtraction {
  return {
    drawing: {
      drawing_number: header.drawing_number ?? "",
      title: header.title ?? "",
      discipline: header.discipline ?? "",
      revision: header.revision ?? "",
      date: header.date ?? "",
    },
    pages: [],
  };
}
