import { setRequestLocale } from "next-intl/server";
import { getOrgContext } from "@/lib/auth";
import { ImportClient } from "./import-client";
import type { Locale } from "@/types/database";

// Server actions inherit the time budget of the route they are invoked from,
// and importing a large plan writes thousands of rows. The default budget was
// not enough for a 274-task workbook: overrunning it KILLS the process before
// any catch can run, which stranded the job in 'importing' with no error and
// no way back (REG-048). Keep in step with IMPORT_MAX_DURATION_SECONDS in
// ./actions.ts, which sizes the projection deadline against this.
export const maxDuration = 800;

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
