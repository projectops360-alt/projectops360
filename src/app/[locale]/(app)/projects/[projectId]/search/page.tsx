import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { SearchClient } from "./search-client";
import type { SearchPageTranslations } from "./search-client";

export default async function SearchPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("projects");
  const tSearch = await getTranslations("projects.search");
  const org = await getOrgContext();
  const supabase = await createClient();

  // Verify project exists and belongs to org
  const { data: project } = await supabase
    .from("projects")
    .select("id, slug, title_i18n")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();

  if (!project) {
    notFound();
  }

  const projectTitle = getI18nValue(project.title_i18n, locale as Locale) || project.slug;

  const translations: SearchPageTranslations = {
    title: tSearch("title"),
    placeholder: tSearch("placeholder"),
    button: tSearch("button"),
    noResults: tSearch("noResults"),
    noResultsDescription: tSearch("noResultsDescription"),
    typeToSearch: tSearch("typeToSearch"),
    resultCount: tSearch("resultCount"),
    viewDetail: tSearch("viewDetail"),
    filters: {
      all: tSearch("filters.all"),
      communication: tSearch("filters.communication"),
      meeting: tSearch("filters.meeting"),
      decision: tSearch("filters.decision"),
      document: tSearch("filters.document"),
      task: tSearch("filters.task"),
      memory: locale === "es" ? "Memoria" : "Memory",
    },
    entityLabels: {
      communication: tSearch("communication"),
      meeting: tSearch("meeting"),
      decision: tSearch("decision"),
      document: tSearch("document"),
      task: tSearch("task"),
      memory: locale === "es" ? "Memoria" : "Memory",
    },
    semanticMatch: tSearch("semanticMatch"),
  };

  return (
    <SearchClient
      projectId={projectId}
      locale={locale}
      projectTitle={projectTitle}
      backLabel={t("detail.back")}
      translations={translations}
    />
  );
}