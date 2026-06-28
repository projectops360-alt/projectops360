// ============================================================================
// ProjectOps360° — Project Export — orchestration service (server)
// ============================================================================
// gather (read-only) → build (full archive | blueprint) → manifest → package.
// Never writes to the source project. The route handler adds RBAC + audit log.
// ============================================================================

import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { gatherProjectBundle } from "./gather";
import { buildFullArchive } from "./full-archive";
import { buildBlueprint } from "./blueprint";
import { buildManifest } from "./manifest";
import {
  DEFAULT_FULL_ARCHIVE_OPTIONS, DEFAULT_BLUEPRINT_OPTIONS,
  type ExportMode, type ExportOptions, type ExportPackage,
} from "./types";

export interface ExportContext {
  organizationId: string;
  userId: string;
  userLabel: string; // email/display for the manifest's exportedBy
  role: "owner" | "admin" | "member" | "viewer";
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "project";
}

export async function buildExportPackage(
  ctx: ExportContext,
  projectId: string,
  exportArg: ExportOptions,
  locale: Locale,
): Promise<ExportPackage> {
  const bundle = await gatherProjectBundle(ctx.organizationId, projectId);
  const projectName =
    getI18nValue((bundle.project?.title_i18n as never) ?? null, locale) ||
    String(bundle.project?.slug ?? "Project");
  const sourceProjectStatus = String(bundle.project?.status ?? "unknown");
  const loc: "en" | "es" = locale === "es" ? "es" : "en";
  const canIncludeSensitive = ctx.role === "owner" || ctx.role === "admin";

  const result =
    exportArg.mode === "full_archive"
      ? buildFullArchive(bundle, exportArg.options, { projectName, locale: loc, canIncludeSensitive })
      : buildBlueprint(bundle, exportArg.options, { projectName });

  const exportId =
    (globalThis.crypto?.randomUUID?.() as string | undefined) ?? `exp_${Date.now()}`;
  const exportedAt = new Date().toISOString();

  const manifest = buildManifest({
    exportId, projectId, projectName, mode: exportArg.mode,
    exportedBy: ctx.userLabel, exportedAt,
    includedEntities: result.included, excludedEntities: result.excluded,
    sourceProjectStatus, warnings: result.warnings,
  });

  const files = [...result.files, { name: "export-manifest.json", data: JSON.stringify(manifest, null, 2) }];
  const tag = exportArg.mode === "full_archive" ? "archive" : "blueprint";
  const filename = `${slugify(projectName)}-${tag}-${exportedAt.slice(0, 10)}.zip`;

  return { filename, manifest, files };
}

/** Resolve the default options for a mode (used when the caller omits flags). */
export function defaultOptionsFor(mode: ExportMode): ExportOptions {
  return mode === "full_archive"
    ? { mode, options: DEFAULT_FULL_ARCHIVE_OPTIONS }
    : { mode, options: DEFAULT_BLUEPRINT_OPTIONS };
}
