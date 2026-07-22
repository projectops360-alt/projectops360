// ============================================================================
// ProjectOps360° — Drawing Source Webhook Endpoint (Prompt 5)
// ============================================================================
// POST /api/webhooks/drawings
// Receives external drawing events (Autodesk dm.* webhooks or internal
// emitters), verifies the shared secret, validates the payload (zod) and
// dispatches through the internal event abstraction. Without
// DRAWING_WEBHOOK_SECRET configured the endpoint refuses (503) — honest,
// never silently accepts unverified payloads.
// ============================================================================

import { NextResponse } from "next/server";
import {
  drawingSourceEventSchema,
  handleDrawingSourceEvent,
} from "@/lib/drawing-intelligence/connectors/events";
import { readLimitedJson, RequestBodyError } from "@/lib/http/request-body";

const MAX_REQUEST_BYTES = 256 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.DRAWING_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "webhook_not_configured", detail: "Set DRAWING_WEBHOOK_SECRET to enable this endpoint." },
      { status: 503 },
    );
  }

  // Verify shared secret (constant-time-ish comparison is overkill for a
  // random 32+ char token, but never log the provided value)
  const provided = request.headers.get("x-webhook-secret");
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await readLimitedJson(request, MAX_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = drawingSourceEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues.map((issue) => issue.path.join(".")) },
      { status: 400 },
    );
  }

  try {
    const result = await handleDrawingSourceEvent(parsed.data);
    return NextResponse.json(result, { status: result.handled ? 200 : 202 });
  } catch (error) {
    console.error("[drawings-webhook] dispatch failed:", error);
    return NextResponse.json({ error: "dispatch_failed" }, { status: 500 });
  }
}
