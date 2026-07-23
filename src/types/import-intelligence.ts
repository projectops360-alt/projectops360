// ============================================================================
// ProjectOps360° — Project Import Intelligence Types
// ============================================================================
// Entities for 20260710000000_project_import_intelligence.sql plus the
// canonical import schema every parsed file is normalized into.
// ============================================================================

import type { ProjectType } from "./execution";

// ── Job lifecycle ───────────────────────────────────────────────────────────

export type ImportMode = "create_new" | "merge_existing";

export type ImportJobStatus =
  | "uploaded"
  | "analyzing"
  | "mapped"
  | "needs_review"
  | "ready_to_import"
  | "importing"
  | "imported"
  | "failed"
  | "cancelled";

export type ImportFileType = "xlsx" | "csv" | "json" | "docx" | "pdf" | "txt" | "md";

export interface ProjectImportJob {
  id: string;
  organization_id: string;
  project_id: string | null;
  import_mode: ImportMode;
  source_file_name: string;
  source_file_type: ImportFileType | null;
  source_mime_type: string | null;
  source_file_size: number | null;
  storage_path: string | null;
  detected_project_type: string | null;
  selected_project_type: string | null;
  status: ImportJobStatus;
  confidence_score: number | null;
  summary_json: Record<string, unknown>;
  error_message: string | null;
  created_by: string | null;
  completed_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Extracted entities ──────────────────────────────────────────────────────

export type ImportEntityType =
  | "project"
  | "phase"
  | "milestone"
  | "work_package"
  | "task"
  | "dependency"
  | "resource"
  | "person"
  | "team"
  | "role"
  | "skill"
  | "material"
  | "equipment"
  | "budget_item"
  | "cost_item"
  | "risk"
  | "issue"
  | "rfi"
  | "submittal"
  | "procurement_item"
  | "schedule_item"
  | "document_reference"
  | "drawing_reference"
  | "decision"
  | "charter";

export type ImportValidationStatus =
  | "valid"
  | "needs_review"
  | "invalid"
  | "duplicate"
  | "missing_required_data";

export interface ProjectImportEntity {
  id: string;
  organization_id: string;
  import_job_id: string;
  entity_type: ImportEntityType;
  source_order: number | null;
  source_key: string | null;
  extracted_json: Record<string, unknown>;
  normalized_json: Record<string, unknown>;
  confidence_score: number | null;
  source_reference: string | null;
  validation_status: ImportValidationStatus;
  validation_warnings_json: string[];
  will_import: boolean;
  user_modified: boolean;
  imported_entity_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ImportValidationSeverity = "info" | "warning" | "error" | "blocker";

export interface ProjectImportValidationResult {
  id: string;
  organization_id: string;
  import_job_id: string;
  severity: ImportValidationSeverity;
  validation_type: string;
  message: string;
  affected_entity_type: string | null;
  affected_entity_id: string | null;
  recommended_action: string | null;
  created_at: string;
}

// ── Canonical import schema ─────────────────────────────────────────────────
// Every parsed file is normalized into this shape before any DB write.

export interface CanonicalProject {
  name: string;
  description: string;
  project_type: ProjectType | "";
  start_date: string;
  target_finish_date: string;
  budget: number | null;
  location: string;
  status: string;
}

export interface CanonicalTask {
  source_id: string;
  name: string;
  description: string;
  phase: string;
  milestone: string;
  status: string;
  priority: string;
  planned_start: string;
  planned_finish: string;
  duration_days: number | null;
  estimated_hours: number | null;
  assigned_to: string;
  required_materials: string[];
  cost_code: string;
  location: string;
  discipline: string;
  trade: string;
  confidence_score: number;
  source_reference: string;
  /** Internal AI execution prompt (UX-014: stored, never a user-facing editor field). */
  prompt_body?: string;
}

export interface CanonicalMilestone {
  source_id: string;
  name: string;
  description: string;
  phase: string;
  target_date: string;
  status: string;
  confidence_score: number;
  source_reference: string;
}

export interface CanonicalDependency {
  predecessor_source_id: string;
  successor_source_id: string;
  dependency_type: "finish_to_start" | "start_to_start" | "finish_to_finish" | "start_to_finish";
  lag_days: number;
  inferred: boolean;
  confidence_score: number;
  source_reference: string;
}

export interface CanonicalResource {
  source_id: string;
  name: string;
  resource_type: string; // person | crew | team | role | equipment | vendor | …
  trade: string;
  skills: string[];
  cost_rate: number | null;
  confidence_score: number;
  source_reference: string;
}

export interface CanonicalMaterial {
  source_id: string;
  name: string;
  quantity: number | null;
  unit: string;
  unit_cost: number | null;
  total_cost: number | null;
  supplier: string;
  lead_time_days: number | null;
  required_by_task_source_id: string;
  required_by_date: string;
  confidence_score: number;
  source_reference: string;
}

export interface CanonicalBudgetItem {
  source_id: string;
  name: string;
  category: string;
  cost_code: string;
  estimated_cost: number | null;
  committed_cost: number | null;
  actual_cost: number | null;
  linked_task_source_id: string;
  confidence_score: number;
  source_reference: string;
}

export interface CanonicalRisk {
  source_id: string;
  title: string;
  description: string;
  probability: string;
  impact: string;
  severity: string;
  mitigation: string;
  linked_task_source_id: string;
  confidence_score: number;
  source_reference: string;
}

export interface CanonicalCharter {
  /** Keys are `project_charters` text columns (CharterFieldKey). Values keep
   *  the source language — imported content is never auto-translated. */
  fields: Record<string, string>;
  confidence_score: number;
  source_reference: string;
}

export interface CanonicalImport {
  project: CanonicalProject;
  charter: CanonicalCharter | null;
  milestones: CanonicalMilestone[];
  tasks: CanonicalTask[];
  dependencies: CanonicalDependency[];
  resources: CanonicalResource[];
  materials: CanonicalMaterial[];
  budget_items: CanonicalBudgetItem[];
  risks: CanonicalRisk[];
  /** Sheets/tables that could not be classified and were not imported. */
  unparsed_tables: string[];
}

// ── Parsed file (intermediate representation) ───────────────────────────────

export interface ParsedTable {
  /** Sheet name (XLSX), file name (CSV), heading (DOCX), or 'table N'. */
  name: string;
  headers: string[];
  rows: string[][];
}

export interface ParsedFile {
  fileType: ImportFileType;
  /** Full plain text (DOCX/PDF/TXT/MD; sheet dump for XLSX). */
  rawText: string;
  /** Parsed JSON when fileType is json. */
  rawJson: unknown | null;
  tables: ParsedTable[];
  metadata: Record<string, unknown>;
}
