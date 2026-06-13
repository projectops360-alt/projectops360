import { setRequestLocale, getTranslations } from "next-intl/server";
import { localizedHref } from "@/i18n/href";
import Link from "next/link";
import { DraftingCompass, FolderKanban, ArrowRight, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function GlobalDrawingIntelligencePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("drawingIntelligence");
  const org = await getOrgContext();
  const supabase = await createClient();

  // Projects + drawing file counts in parallel. drawing_files may not exist
  // until the migration is applied — errors degrade to zero counts.
  const [projectsResult, filesResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id, slug, title_i18n")
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("drawing_files")
      .select("id, project_id")
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null),
  ]);

  const projects = projectsResult.data ?? [];
  const countByProject = new Map<string, number>();
  for (const file of filesResult.data ?? []) {
    countByProject.set(file.project_id, (countByProject.get(file.project_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <DraftingCompass className="h-6 w-6 text-brand-600 dark:text-brand-400" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h1>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t("subtitle")}</p>
        <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-700 dark:text-brand-300">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          {t("notStorageNote")}
        </p>
      </div>

      {/* Project selector */}
      {projects.length > 0 ? (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">{t("global.selectProject")}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const title = getI18nValue(project.title_i18n, locale as Locale) || project.slug;
              const count = countByProject.get(project.id) ?? 0;
              return (
                <Link
                  key={project.id}
                  href={localizedHref(locale, `/projects/${project.id}/drawing-intelligence`)}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-brand-500/40 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
                    <FolderKanban className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground">
                      {count > 0
                        ? t("global.drawingsCount", { count })
                        : t("global.noDrawings")}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <DraftingCompass className="mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t("global.noProjects")}</p>
        </div>
      )}
    </div>
  );
}
