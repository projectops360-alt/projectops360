import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { ArrowLeft, Shield } from "lucide-react";
import type { AuditLog } from "@/types/database";

// ── Action badge colors ───────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  create:
    "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800",
  update:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
  delete:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800",
};

// ── Page ────────────────────────────────────────────────────────────────────────

export default async function AuditLogPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("projects");
  const tAudit = await getTranslations("projects.audit");
  const org = await getOrgContext();
  const supabase = await createClient();

  // Verify project exists
  const { data: project } = await supabase
    .from("projects")
    .select("id, slug")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();

  if (!project) {
    notFound();
  }

  // Fetch recent audit logs
  const { data: auditLogs } = await supabase
    .from("audit_logs")
    .select("id, actor_user_id, action, entity_type, entity_id, metadata, created_at")
    .eq("organization_id", org.organizationId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Fetch actor profiles for display names
  const actorIds = [...new Set((auditLogs ?? []).map((l: { actor_user_id: string }) => l.actor_user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", actorIds);

  const profileMap = new Map(
    (profiles ?? []).map((p: { id: string; display_name: string | null }) => [p.id, p.display_name]),
  );

  // Entity type label helper
  const entityLabel = (type: string): string => {
    const key = `entity_${type}` as Parameters<typeof tAudit>[0];
    try {
      return tAudit(key);
    } catch {
      return type;
    }
  };

  // Action label helper
  const actionLabel = (action: string): string => {
    const key = `action_${action}` as Parameters<typeof tAudit>[0];
    try {
      return tAudit(key);
    } catch {
      return action;
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href={`/${locale}/projects/${projectId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("detail.back")}
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-brand-600 dark:text-brand-400" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tAudit("title")}</h1>
          <p className="text-sm text-muted-foreground">{tAudit("description")}</p>
        </div>
      </div>

      {/* Audit entries */}
      {!auditLogs || auditLogs.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-sm text-muted-foreground">{tAudit("noRecords")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(auditLogs as AuditLog[]).map((log) => {
            const actorName = profileMap.get(log.actor_user_id) || tAudit("unknownActor");
            const color = ACTION_COLORS[log.action] || ACTION_COLORS.update;
            const meta = log.metadata as Record<string, unknown>;
            const title = typeof meta.title === "string" ? meta.title : null;

            return (
              <div
                key={log.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
              >
                {/* Action badge */}
                <span
                  className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${color}`}
                >
                  {actionLabel(log.action)}
                </span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">
                      {entityLabel(log.entity_type)}
                    </span>
                    {title && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-sm text-muted-foreground truncate">
                          {title}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>
                      {tAudit("by")} {actorName}
                    </span>
                    <span>·</span>
                    <span>
                      {new Date(log.created_at).toLocaleDateString(locale, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {/* Metadata pills for links */}
                  {log.entity_type === "traceability_links" && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {typeof meta.link_type === "string" && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                          {String(meta.link_type)}
                        </span>
                      )}
                      {typeof meta.source_type === "string" && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                          {String(meta.source_type)} → {String(meta.target_type ?? "")}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Source pill for AI extractions */}
                  {meta.source === "ai_extraction" && (
                    <span className="mt-1.5 inline-flex rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                      AI
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}