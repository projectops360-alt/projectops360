// ============================================================================
// ProjectOps360° — EKI automated evidence evaluation endpoint
// ============================================================================
// GET /api/eki/evaluate
//
// Invoked by Vercel Cron (see vercel.json). Claims every EvidenceBinding that is
// due, evaluates it, recalculates its control and raises or recurs findings —
// then closes the run so the sweep is visible afterwards.
//
// This endpoint is the smallest thing that makes the Macrophase 2 engine
// autonomous. It deliberately does NOT accept an organization from the caller:
// a scheduled sweep covers every tenant, and letting a request name one would
// give an unauthenticated caller a way to single out somebody else's controls.
// ============================================================================

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  evaluatorSecret,
  extractSecret,
  isAutomatedEvaluationEnabled,
  secretMatches,
} from "@/lib/eki-evidence/automation-flag";
import { EkiEvaluator, scheduledRunKey } from "@/lib/eki-evidence/evaluator";

// A sweep reads and writes per binding; it must never be served from a cache.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<NextResponse> {
  // Flag OFF answers 404 rather than 403: an endpoint that is not enabled should
  // not confirm that it exists.
  if (!isAutomatedEvaluationEnabled()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const expected = evaluatorSecret();
  if (!expected) {
    // Honest refusal. Running unauthenticated would let anyone drive every
    // tenant's evaluation cadence.
    return NextResponse.json(
      { error: "evaluator_not_configured", detail: "Set EKI_EVALUATOR_SECRET to enable scheduled evaluation." },
      { status: 503 },
    );
  }

  if (!secretMatches(extractSecret(request.headers), expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const evaluator = new EkiEvaluator(createAdminClient());

  try {
    const summary = await evaluator.sweep({
      // Truncated to the minute, so an at-least-once scheduler delivering the
      // same tick twice resolves to one run instead of two competing sweeps.
      runKey: scheduledRunKey(new Date()),
      trigger: "scheduled",
      // Platform-wide. Never narrowed by request input.
      organizationId: null,
      // The scheduler has no human actor and does not borrow one.
      requestedBy: null,
    });

    return NextResponse.json(
      {
        runId: summary.runId,
        duplicate: summary.duplicate,
        status: summary.status,
        claimed: summary.claimed,
        evaluated: summary.evaluated,
        failed: summary.failed,
        superseded: summary.superseded,
      },
      { status: 200 },
    );
  } catch (error) {
    // The message is not echoed. A sweep failure can carry database detail, and
    // this endpoint is reachable by anyone holding the token.
    void error;
    return NextResponse.json({ error: "sweep_failed" }, { status: 500 });
  }
}
