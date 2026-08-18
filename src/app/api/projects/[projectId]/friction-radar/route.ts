import { NextResponse, type NextRequest } from "next/server";
import { isFrictionRadarEnabledForProject } from "@/lib/friction-radar/flag";
import { loadFrictionRadarFromProduction } from "@/lib/friction-radar/load-production";
import type { Locale } from "@/types/database";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  if (!UUID_RE.test(projectId) || !isFrictionRadarEnabledForProject(projectId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: PRIVATE_HEADERS });
  }
  const locale: Locale = request.nextUrl.searchParams.get("locale") === "es" ? "es" : "en";
  const result = await loadFrictionRadarFromProduction(projectId, locale);
  if (result.status === "unauthorized") {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: PRIVATE_HEADERS });
  }
  if (result.status === "error") {
    return NextResponse.json({ error: "read_failed" }, { status: 503, headers: PRIVATE_HEADERS });
  }
  return NextResponse.json(
    {
      projectId,
      projectTitle: result.projectTitle,
      radar: result.radar,
      signals: result.signals,
      signalGaps: result.signalGaps,
      evidenceEvents: result.evidenceEvents,
      counts: {
        milestones: result.milestoneCount,
        tasks: result.taskCount,
        events: result.eventCount,
        dependencies: result.dependencyCount,
        timeEntries: result.timeEntryCount,
        rejectedEvidence: result.rejectedEvidenceCount,
      },
    },
    { headers: PRIVATE_HEADERS },
  );
}
