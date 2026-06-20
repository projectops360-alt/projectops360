import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { listRythmMeetings } from "@/lib/rythm/meeting-service";
import { RythmDashboard } from "@/components/rythm";

export const dynamic = "force-dynamic";

export default async function RythmPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);

  const org = await getOrgContext();
  const supabase = await createClient();

  // Confirm the project belongs to the caller's org.
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();
  if (!project) notFound();

  const meetings = await listRythmMeetings(supabase, org.organizationId, projectId);

  return <RythmDashboard projectId={projectId} locale={locale} meetings={meetings} />;
}
