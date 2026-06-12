import { redirect } from "next/navigation";

export default async function RoadmapRedirectPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  redirect(`/${locale}/projects/${projectId}/execution-map`);
}