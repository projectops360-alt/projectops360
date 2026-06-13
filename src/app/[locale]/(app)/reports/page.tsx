import { setRequestLocale } from "next-intl/server";
import { getOrgContext } from "@/lib/auth";
import { listSavedReportsAction, listProjectsForReportsAction } from "./actions";
import { ReportsClient } from "./reports-client";
import type { Locale } from "@/types/database";

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ report?: string; project?: string }>;
}) {
  const { locale } = await params;
  const { report, project } = await searchParams;
  setRequestLocale(locale);
  await getOrgContext();

  const [saved, projects] = await Promise.all([
    listSavedReportsAction(),
    listProjectsForReportsAction(locale),
  ]);

  return (
    <ReportsClient
      locale={locale as Locale}
      initialSavedReports={saved.reports ?? []}
      initialReportId={report ?? null}
      initialProjects={projects.projects ?? []}
      initialProjectId={project ?? null}
    />
  );
}
