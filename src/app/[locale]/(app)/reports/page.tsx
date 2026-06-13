import { setRequestLocale } from "next-intl/server";
import { getOrgContext } from "@/lib/auth";
import { listSavedReportsAction } from "./actions";
import { ReportsClient } from "./reports-client";
import type { Locale } from "@/types/database";

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ report?: string }>;
}) {
  const { locale } = await params;
  const { report } = await searchParams;
  setRequestLocale(locale);
  await getOrgContext();

  const saved = await listSavedReportsAction();

  return <ReportsClient locale={locale as Locale} initialSavedReports={saved.reports ?? []} initialReportId={report ?? null} />;
}
