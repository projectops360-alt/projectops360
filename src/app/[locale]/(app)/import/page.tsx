import { setRequestLocale } from "next-intl/server";
import { getOrgContext } from "@/lib/auth";
import { ImportClient } from "./import-client";
import type { Locale } from "@/types/database";

export default async function ImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { locale } = await params;
  const { projectId } = await searchParams;
  setRequestLocale(locale);

  const org = await getOrgContext();

  return (
    <ImportClient
      locale={locale as Locale}
      organizationId={org.organizationId}
      preselectedProjectId={projectId ?? null}
    />
  );
}
