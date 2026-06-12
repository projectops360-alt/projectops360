import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { Settings, Users, Shield, Calendar, Clock, Globe } from "lucide-react";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);

  const org = await getOrgContext();
  const supabase = await createClient();

  // Fetch the project with metadata
  const { data: project } = await supabase
    .from("projects")
    .select("id, slug, title_i18n, status, start_date, target_end_date, created_at")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();

  if (!project) {
    notFound();
  }

  const t = await getTranslations("projects");
  const isEs = locale === "es";
  const base = `/${locale}/projects/${projectId}`;

  // Fetch stakeholder count
  const { count: stakeholderCount } = await supabase
    .from("stakeholders")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-foreground">
          <Settings className="h-5 w-5 inline-block mr-2 text-muted-foreground" />
          {isEs ? "Configuración del Proyecto" : "Project Settings"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isEs
            ? "Gestiona stakeholders, auditoría y metadatos del proyecto."
            : "Manage stakeholders, audit trail, and project metadata."}
        </p>
      </div>

      {/* Quick links: Stakeholders + Audit Log */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href={`${base}/stakeholders`}
          className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-brand-500/40 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
              <Users className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400">
                {t("detail.stakeholders")}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {stakeholderCount ?? 0} {isEs ? "stakeholders registrados" : "stakeholders registered"}
              </p>
            </div>
          </div>
        </Link>

        <Link
          href={`${base}/audit`}
          className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-brand-500/40 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
              <Shield className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400">
                {t("audit.title")}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("audit.viewAudit")}
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* Project metadata */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">
          {isEs ? "Metadatos del Proyecto" : "Project Metadata"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {project.start_date && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {isEs ? "Fecha de inicio" : "Start date"}
              </div>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {new Date(project.start_date).toLocaleDateString(locale, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          )}
          {project.target_end_date && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {isEs ? "Fecha objetivo" : "Target end date"}
              </div>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {new Date(project.target_end_date).toLocaleDateString(locale, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          )}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Globe className="h-3.5 w-3.5" />
              {isEs ? "Creado" : "Created"}
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {new Date(project.created_at).toLocaleDateString(locale, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
