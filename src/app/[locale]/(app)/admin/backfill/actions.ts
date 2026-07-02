"use server";

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getOrgContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getI18nValue, type I18nField, type Locale } from "@/types/database";
import { backfillProject, type BackfillReport } from "@/lib/events/backfill";
import { canRunBackfill } from "@/lib/events/backfill-access";
import {
  computeQualityReport, computeReplayReadiness, computeOrgMemoryReport,
  type QualityReport, type ReplayReadiness, type OrgMemoryReport,
} from "@/lib/events/backfill-reports";

export interface BackfillProjectResult {
  projectId: string;
  title: string;
  report: BackfillReport;
  quality: QualityReport;
  replay: ReplayReadiness;
}

export interface BackfillRunResult {
  error?: string;
  executionId?: string;
  mode?: "dry_run" | "execute";
  startedAt?: string;
  completedAt?: string;
  projects?: BackfillProjectResult[];
  orgMemory?: OrgMemoryReport;
}

const inputSchema = z.object({
  mode: z.enum(["dry_run", "execute"]),
  scope: z.enum(["project", "organization"]),
  projectId: z.string().uuid().optional(),
  reason: z.string().max(500).optional().default(""),
});

function titleOf(p: { slug: string; title_i18n: unknown }, locale: string): string {
  return getI18nValue(p.title_i18n as I18nField, locale as Locale) || p.slug;
}

/**
 * The single approved mechanism for executing Historical Backfill. RBAC-gated to
 * org owners/admins (or platform-admin allowlist). Manual SQL is never the path.
 * Dry Run never writes. Execute records an immutable BackfillCompleted audit
 * event (actor + reason + executionId) per project. Idempotent and safe.
 */
export async function runBackfillAction(input: unknown): Promise<BackfillRunResult> {
  let ctx;
  try { ctx = await getOrgContext(); } catch { return { error: "not_authenticated" }; }
  if (!canRunBackfill({ role: ctx.role, email: ctx.email })) return { error: "forbidden" };

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };
  const { mode, scope, projectId, reason } = parsed.data;
  if (scope === "project" && !projectId) return { error: "project_required" };
  if (mode === "execute" && !reason.trim()) return { error: "reason_required" };

  const executionId = randomUUID();
  const startedAt = new Date().toISOString();
  const supabase = createAdminClient();

  let targets: { id: string; title: string }[] = [];
  if (scope === "project") {
    const { data } = await supabase
      .from("projects").select("id, slug, title_i18n")
      .eq("id", projectId!).eq("organization_id", ctx.organizationId).is("deleted_at", null).maybeSingle();
    if (!data) return { error: "project_not_found" };
    targets = [{ id: data.id, title: titleOf(data, ctx.locale) }];
  } else {
    const { data } = await supabase
      .from("projects").select("id, slug, title_i18n")
      .eq("organization_id", ctx.organizationId).is("deleted_at", null)
      .order("created_at", { ascending: true }).limit(500);
    targets = (data ?? []).map((p) => ({ id: p.id, title: titleOf(p, ctx.locale) }));
  }

  const reports: BackfillReport[] = [];
  const projects: BackfillProjectResult[] = [];
  for (const t of targets) {
    const report = await backfillProject(t.id, ctx.organizationId, {
      dryRun: mode === "dry_run",
      actorUserId: ctx.userId,
      reason,
      executionId,
    });
    reports.push(report);
    projects.push({
      projectId: t.id, title: t.title, report,
      quality: computeQualityReport(report),
      replay: computeReplayReadiness(report),
    });
  }

  return {
    executionId, mode, startedAt, completedAt: new Date().toISOString(),
    projects, orgMemory: computeOrgMemoryReport(reports),
  };
}
