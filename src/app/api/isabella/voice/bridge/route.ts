// ============================================================================
// ProjectOps360° — Isabella Voice Context Bridge · endpoint (server-only)
// ============================================================================
// ISABELLA-VOICE-REALTIME-BRIDGE
//
// POST → executes ONE ask_isabella tool call from the realtime speech model.
// Identity is NEVER taken from the body: askLivingGuideAction re-stamps
// user/org/role from the trusted session cookie and runs Isabella's existing
// pipeline (deterministic query engine → tool-use gateway → process
// intelligence → provenance → RAG) with all RBAC / tenant isolation / project
// scope checks intact. The voice layer adds NO new data access and NO writes.
// Flag OFF → 404. No session → 401. Every call is audited in ai_runs.
// ============================================================================

import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { askLivingGuideAction } from "@/components/living-guide/actions";
import { isIsabellaVoiceEnabled } from "@/lib/isabella/voice/flag";
import { runVoiceBridge } from "@/lib/isabella/voice/bridge";
import { persistVoiceAudit } from "@/lib/isabella/voice/audit";
import type { VoiceBridgeRequest } from "@/lib/isabella/voice/types";
import { readLimitedJson, RequestBodyError } from "@/lib/http/request-body";

const MAX_REQUEST_BYTES = 128 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  if (!isIsabellaVoiceEnabled()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let org;
  try {
    org = await getOrgContext();
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await readLimitedJson(request, MAX_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ ok: false, error: error.code }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const start = Date.now();
  const result = await runVoiceBridge(body, { ask: askLivingGuideAction });

  const req = (body ?? {}) as Partial<VoiceBridgeRequest>;
  await persistVoiceAudit(
    org,
    {
      event: "voice_bridge_call",
      context: typeof req.context === "object" ? req.context : undefined,
      questionLength: typeof req.question === "string" ? req.question.length : 0,
      recentTurns: Array.isArray(req.recentConversation) ? req.recentConversation.length : 0,
    },
    result.ok
      ? {
          ok: true,
          tier: result.tier,
          grounded: result.grounded,
          truncated: result.truncated,
          answerLength: result.answer.length,
          executionMs: Date.now() - start,
        }
      : { ok: false, error: result.error, executionMs: Date.now() - start },
  );

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
