import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale, ProjectModule } from "@/types/database";
import { getEnabledModules } from "@/lib/execution/modules";
import { isGitHubIntelligenceFlagEnabled } from "@/lib/env";
import { ProjectTabs } from "@/components/layout/project-tabs";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);

  // Fetch the project title + type so tabs adapt to the project's modules
  let projectTitle = "";
  let enabledModules: ProjectModule[] | undefined;
  try {
    const org = await getOrgContext();
    const supabase = await createClient();
    const { data: project } = await supabase
      .from("projects")
      .select("slug, title_i18n, project_type, enabled_modules")
      .eq("id", projectId)
      .eq("organization_id", org.organizationId)
      .is("deleted_at", null)
      .single();
    if (project) {
      projectTitle = getI18nValue(project.title_i18n, locale as Locale) || project.slug;
      enabledModules = getEnabledModules(project);
      // GitHub Intelligence nav appears ONLY when the feature flag is ON AND the
      // project is a software project. Otherwise the module stays absent, so the
      // tab is hidden (flag OFF ⇒ unchanged navigation).
      const showGitHub =
        isGitHubIntelligenceFlagEnabled() && project.project_type === "software_development";
      enabledModules = showGitHub
        ? Array.from(new Set([...enabledModules, "github_intelligence" as const]))
        : enabledModules.filter((m) => m !== "github_intelligence");
    }
  } catch {
    // Not authenticated or fetch failed — tabs still render without the title
  }

  return (
    <div>
      <ProjectTabs
        projectId={projectId}
        locale={locale}
        projectTitle={projectTitle}
        enabledModules={enabledModules}
      />
      <div className="p-6">{children}</div>
    </div>
  );
}
