// ============================================================================
// Import progress — read endpoint
// ============================================================================
// WHY THIS IS A ROUTE HANDLER AND NOT A SERVER ACTION
//
// Server Actions are serialized by Next.js: only one runs at a time per
// client. Polling progress with an action therefore queued behind the very
// import it was meant to observe, so the panel sat on "Starting…" for the
// whole four minutes and only unblocked once the import had already finished.
//
// A route handler is an ordinary GET and shares no queue with the running
// action, so progress can actually be read while the import is in flight.
// ============================================================================

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import type { ImportProgress } from "@/lib/import-intelligence/progress";

export async function GET(request: Request): Promise<NextResponse> {
  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "job_id_required" }, { status: 400 });

  let org;
  try {
    org = await getOrgContext();
  } catch {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const supabase = createAdminClient();
  // Tenant scope is part of the lookup: a job id from another organization
  // simply does not resolve.
  const { data } = await supabase
    .from("project_import_jobs")
    .select("status, summary_json")
    .eq("id", jobId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: "job_not_found" }, { status: 404 });

  const summary = (data.summary_json ?? {}) as { progress?: ImportProgress };
  return NextResponse.json(
    { status: data.status as string, progress: summary.progress ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
