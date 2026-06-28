// ============================================================================
// ProjectOps360° — Project Export — manifest builder (pure)
// ============================================================================

import {
  EXPORT_SCHEMA_VERSION, APP_VERSION,
  type ExportEntity, type ExportManifest, type ExportMode, type PrivacyMode,
} from "./types";

export interface BuildManifestInput {
  exportId: string;
  projectId: string;
  projectName: string;
  mode: ExportMode;
  exportedBy: string;
  exportedAt: string;
  includedEntities: ExportEntity[];
  excludedEntities: ExportEntity[];
  sourceProjectStatus: string;
  warnings: string[];
}

/** Build the export-manifest.json contents. Privacy mode follows the export mode. */
export function buildManifest(i: BuildManifestInput): ExportManifest {
  const privacyMode: PrivacyMode =
    i.mode === "full_archive" ? "evidence_preserved" : "privacy_safe_reset";
  return {
    exportId: i.exportId,
    projectId: i.projectId,
    projectName: i.projectName,
    exportMode: i.mode,
    exportedBy: i.exportedBy,
    exportedAt: i.exportedAt,
    appVersion: APP_VERSION,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    privacyMode,
    includedEntities: dedupe(i.includedEntities),
    excludedEntities: dedupe(i.excludedEntities).filter((e) => !i.includedEntities.includes(e)),
    sourceProjectStatus: i.sourceProjectStatus,
    warnings: i.warnings,
  };
}

function dedupe<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}
