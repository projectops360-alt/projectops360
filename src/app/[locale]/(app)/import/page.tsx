import { setRequestLocale } from "next-intl/server";
import { getOrgContext } from "@/lib/auth";
import { ImportClient } from "./import-client";
import type { Locale } from "@/types/database";

// Server actions inherit the time budget of the route they are invoked from,
// and importing a large plan writes thousands of rows. Overrunning the budget
// KILLS the process before any catch can run, which stranded a job in
// 'importing' with no error and no way back (REG-048).
//
// 300 is the CEILING, not a preference: Vercel rejects the deployment outright
// ("maxDuration between 1 and 300 for plan hobby"), so more time cannot be
// bought here. The budget is therefore spent on the user's data first and the
// derived projections are cut short — see IMPORT_MAX_DURATION_SECONDS in
// ./actions.ts, which sizes the projection deadline against this value.
export const maxDuration = 300;

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
