import { setRequestLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { ProjectListClient } from "./project-list-client";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("projects");
  const org = await getOrgContext();
  const supabase = await createClient();

  // Fetch projects scoped to the current organization
  const { data: projects } = await supabase
    .from("projects")
    .select("id, slug, title_i18n, description_i18n, status, project_type, enabled_modules, start_date, target_end_date, created_by, created_at, updated_at, organization_id, deleted_at")
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const validProjects = projects ?? [];

  // Resolve status labels for each project
  const projectsWithLabels = validProjects.map((project) => ({
    ...project,
    statusLabel: t(`status.${project.status}` as Parameters<typeof t>[0]),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      {/* Client-side list with dialog */}
      <ProjectListClient
        projects={projectsWithLabels}
        locale={locale}
        emptyTitle={t("empty")}
        emptyDescription={t("emptyDescription")}
        createLabel={t("create")}
      />
    </div>
  );
}