import { setRequestLocale } from "next-intl/server";
import { getOrgContext } from "@/lib/auth";
import { listSavedReportsAction } from "./actions";
import { ReportsClient } from "./reports-client";
import type { Locale } from "@/types/database";

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await getOrgContext();

  const saved = await listSavedReportsAction();

  return <ReportsClient locale={locale as Locale} initialSavedReports={saved.reports ?? []} />;
}
