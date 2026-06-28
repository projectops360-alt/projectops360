// ============================================================================
// ProjectOps360° — Project Export download route (CAP — Project Export)
// ============================================================================
// GET /[locale]/projects/[projectId]/export?mode=full_archive|starter_blueprint&...
// Server-side RBAC (never trust hidden buttons), read-only build, audit log,
// returns a .zip attachment. Full Archive → owner/admin; Blueprint → owner/admin/
// member (PM). Viewers are always rejected.
// ============================================================================

import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import type { Locale } from "@/types/database";
import { buildExportPackage, type ExportContext } from "@/lib/project-export/service";
import { createZip } from "@/lib/project-export/zip";
import { canExport } from "@/lib/project-export/rbac";
import {
  DEFAULT_FULL_ARCHIVE_OPTIONS, DEFAULT_BLUEPRINT_OPTIONS,
  type ExportMode, type ExportOptions,
} from "@/lib/project-export/types";

export const dynamic = "force-dynamic";

function bool(v: string | null, dflt: boolean): boolean {
  if (v === null) return dflt;
  return v === "1" || v === "true";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ locale: string; projectId: string }> },
) {
  const { locale, projectId } = await params;
  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") ?? "full_archive") as ExportMode;
  if (mode !== "full_archive" && mode !== "starter_blueprint") {
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
  }

  const org = await getOrgContext();

  // RBAC — enforced here, not just in the UI.
  if (!canExport(org.role, mode)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Project must exist within the caller's organization.
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects").select("id")
    .eq("id", projectId).eq("organization_id", org.organizationId).is("deleted_at", null)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Parse options (defaults applied; query overrides).
  const exportArg: ExportOptions =
    mode === "full_archive"
      ? {
          mode,
          options: {
            includeProjectMemory: bool(url.searchParams.get("memory"), DEFAULT_FULL_ARCHIVE_OPTIONS.includeProjectMemory),
            includeTranscripts: bool(url.searchParams.get("transcripts"), DEFAULT_FULL_ARCHIVE_OPTIONS.includeTranscripts),
            includeDocuments: bool(url.searchParams.get("documents"), DEFAULT_FULL_ARCHIVE_OPTIONS.includeDocuments),
            includeAuditTrail: bool(url.searchParams.get("audit"), DEFAULT_FULL_ARCHIVE_OPTIONS.includeAuditTrail),
            includeCloseout: bool(url.searchParams.get("closeout"), DEFAULT_FULL_ARCHIVE_OPTIONS.includeCloseout),
            includeTraceability: bool(url.searchParams.get("traceability"), DEFAULT_FULL_ARCHIVE_OPTIONS.includeTraceability),
          },
        }
      : {
          mode,
          options: {
            keepMilestones: bool(url.searchParams.get("milestones"), DEFAULT_BLUEPRINT_OPTIONS.keepMilestones),
            keepTasks: bool(url.searchParams.get("tasks"), DEFAULT_BLUEPRINT_OPTIONS.keepTasks),
            keepDependencies: bool(url.searchParams.get("dependencies"), DEFAULT_BLUEPRINT_OPTIONS.keepDependencies),
            keepRoles: bool(url.searchParams.get("roles"), DEFAULT_BLUEPRINT_OPTIONS.keepRoles),
            keepRiskTemplates: bool(url.searchParams.get("risks"), DEFAULT_BLUEPRINT_OPTIONS.keepRiskTemplates),
            keepDocumentChecklist: bool(url.searchParams.get("docchecklist"), DEFAULT_BLUEPRINT_OPTIONS.keepDocumentChecklist),
            includeLessonsLearned: bool(url.searchParams.get("lessons"), DEFAULT_BLUEPRINT_OPTIONS.includeLessonsLearned),
            resetDates: true,
            resetOwnersToRoles: true,
            resetStatusesToPlanned: true,
            removeSensitiveEvidence: true,
          },
        };

  const ctx: ExportContext = {
    organizationId: org.organizationId,
    userId: org.userId,
    userLabel: org.displayName || org.email || org.userId,
    role: org.role,
  };

  try {
    const pkg = await buildExportPackage(ctx, projectId, exportArg, locale as Locale);
    const zip = createZip(pkg.files);

    await logAudit({
      org: { organizationId: org.organizationId, userId: org.userId },
      projectId,
      action: "export",
      entityType: "project_export",
      entityId: pkg.manifest.exportId,
      metadata: {
        exportMode: mode,
        includedEntities: pkg.manifest.includedEntities,
        excludedEntities: pkg.manifest.excludedEntities,
        privacyMode: pkg.manifest.privacyMode,
        fileCount: pkg.files.length,
        sizeBytes: zip.byteLength,
        warnings: pkg.manifest.warnings,
        success: true,
      },
    });

    return new NextResponse(zip as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${pkg.filename}"`,
        "Content-Length": String(zip.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[project-export] failed:", err);
    await logAudit({
      org: { organizationId: org.organizationId, userId: org.userId },
      projectId, action: "export", entityType: "project_export", entityId: "failed",
      metadata: { exportMode: mode, success: false, error: String(err) },
    });
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }
}
