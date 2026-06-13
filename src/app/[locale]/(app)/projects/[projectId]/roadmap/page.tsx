import { redirect } from "next/navigation";
import { localizedHref } from "@/i18n/href";

export default async function RoadmapRedirectPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  redirect(localizedHref(locale, `/projects/${projectId}/execution-map`));
}