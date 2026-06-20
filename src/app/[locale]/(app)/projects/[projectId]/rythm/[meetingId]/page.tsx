import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { getRythmMeeting, listAudioFiles } from "@/lib/rythm/meeting-service";
import { RythmMeetingDetail } from "@/components/rythm";

export const dynamic = "force-dynamic";

export default async function RythmMeetingPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string; meetingId: string }>;
}) {
  const { locale, projectId, meetingId } = await params;
  setRequestLocale(locale);

  const org = await getOrgContext();
  const supabase = await createClient();

  const meeting = await getRythmMeeting(supabase, org.organizationId, meetingId);
  if (!meeting || meeting.projectId !== projectId) notFound();

  const audioFiles = await listAudioFiles(supabase, org.organizationId, meetingId);

  return (
    <RythmMeetingDetail
      projectId={projectId}
      locale={locale}
      meeting={meeting}
      audioFiles={audioFiles}
    />
  );
}
