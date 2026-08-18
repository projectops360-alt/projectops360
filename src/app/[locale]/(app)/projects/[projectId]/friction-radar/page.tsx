import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { FrictionRadarClient } from "@/components/friction-radar/friction-radar-client";
import { loadFrictionRadarFromProduction } from "@/lib/friction-radar/load-production";
import type { Locale } from "@/types/database";
import { isFrictionRadarEnabledForProject } from "@/lib/friction-radar/flag";

export default async function FrictionRadarPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale: rawLocale, projectId } = await params;
  const locale: Locale = rawLocale === "es" ? "es" : "en";
  setRequestLocale(locale);

  if (!isFrictionRadarEnabledForProject(projectId)) notFound();

  // The loader uses the authenticated SSR client, organization scope and RLS.
  // It is a SELECT-only projection and returns unauthorized without disclosing
  // whether a foreign project exists.
  const result = await loadFrictionRadarFromProduction(projectId, locale);
  if (result.status === "unauthorized") notFound();
  if (result.status === "error") throw new Error("friction_radar_read_failed");

  const taskTitles = Object.fromEntries(
    result.taskEvidence.map((task) => [task.taskId, task.title]),
  );

  return (
    <FrictionRadarClient
      projectId={projectId}
      projectTitle={result.projectTitle}
      locale={locale}
      generatedAt={new Date().toISOString()}
      milestoneCount={result.milestoneCount}
      eventCount={result.eventCount}
      taskCount={result.taskCount}
      dependencyCount={result.dependencyCount}
      timeEntryCount={result.timeEntryCount}
      rejectedEvidenceCount={result.rejectedEvidenceCount}
      signals={result.signals}
      gaps={result.signalGaps}
      milestoneTitles={Object.fromEntries(result.milestones.map((milestone) => [milestone.id, milestone.title]))}
      evidenceEvents={result.evidenceEvents}
      topSignalIds={result.radar.topSignalIds}
      taskTitles={taskTitles}
      sourceAudit={result.sourceAudit}
      limitations={result.limitations}
    />
  );
}
