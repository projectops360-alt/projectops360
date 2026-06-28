// ============================================================================
// ProjectOps360° — Project Export & Blueprint Generator — shared types
// ============================================================================
// CAP — Project Export. Two modes:
//   • full_archive    — the project AS EXECUTED (evidence + traceability).
//   • starter_blueprint — a clean reusable template (execution history reset).
// Pure, client-safe types shared by the server builders, the route handler and
// the Export modal. No server imports here. See PD-011 (product-decision-log).
// ============================================================================

export const EXPORT_SCHEMA_VERSION = "1.0" as const;
export const APP_VERSION = "0.1.0" as const;

export type ExportMode = "full_archive" | "starter_blueprint";
export type PrivacyMode = "evidence_preserved" | "privacy_safe_reset";

/** Canonical entity keys an export can include — used in the manifest. */
export type ExportEntity =
  | "project_profile" | "charter" | "delivery_framework"
  | "milestones" | "tasks" | "dependencies"
  | "risks" | "decisions" | "action_items" | "communications"
  | "meetings" | "transcripts" | "project_memory" | "documents"
  | "stakeholders" | "team_roles" | "budget" | "closeout"
  | "lessons_learned" | "traceability" | "audit_trail"
  | "phases" | "task_templates" | "risk_templates" | "role_templates"
  | "document_checklist" | "setup_checklist";

// ── Options ─────────────────────────────────────────────────────────────────

export interface FullArchiveOptions {
  includeProjectMemory: boolean;
  includeTranscripts: boolean;
  includeDocuments: boolean;
  includeAuditTrail: boolean;
  includeCloseout: boolean;
  includeTraceability: boolean;
}

export interface BlueprintOptions {
  keepMilestones: boolean;
  keepTasks: boolean;
  keepDependencies: boolean;
  keepRoles: boolean;
  keepRiskTemplates: boolean;
  keepDocumentChecklist: boolean;
  includeLessonsLearned: boolean;
  /** Privacy-safe resets — always on by default; here for explicitness/tests. */
  resetDates: boolean;
  resetOwnersToRoles: boolean;
  resetStatusesToPlanned: boolean;
  removeSensitiveEvidence: boolean;
}

export type ExportOptions =
  | { mode: "full_archive"; options: FullArchiveOptions }
  | { mode: "starter_blueprint"; options: BlueprintOptions };

export const DEFAULT_FULL_ARCHIVE_OPTIONS: FullArchiveOptions = {
  includeProjectMemory: true,
  includeTranscripts: false, // sensitive — opt-in
  includeDocuments: true,
  includeAuditTrail: false, // sensitive — opt-in
  includeCloseout: true,
  includeTraceability: true,
};

export const DEFAULT_BLUEPRINT_OPTIONS: BlueprintOptions = {
  keepMilestones: true,
  keepTasks: true,
  keepDependencies: true,
  keepRoles: true,
  keepRiskTemplates: true,
  keepDocumentChecklist: true,
  includeLessonsLearned: false, // optional guidance — opt-in
  resetDates: true,
  resetOwnersToRoles: true,
  resetStatusesToPlanned: true,
  removeSensitiveEvidence: true,
};

// ── Manifest (TASK 6) ───────────────────────────────────────────────────────

export interface ExportManifest {
  exportId: string;
  projectId: string;
  projectName: string;
  exportMode: ExportMode;
  exportedBy: string;
  exportedAt: string;
  appVersion: string;
  schemaVersion: string;
  privacyMode: PrivacyMode;
  includedEntities: ExportEntity[];
  excludedEntities: ExportEntity[];
  sourceProjectStatus: string;
  warnings: string[];
}

/** One file in the export package (the ZIP is built from these). */
export interface ExportFile {
  /** Path inside the ZIP, e.g. "tasks.csv". */
  name: string;
  /** UTF-8 text or raw bytes. */
  data: string | Uint8Array;
}

export interface ExportPackage {
  filename: string;
  manifest: ExportManifest;
  files: ExportFile[];
}
