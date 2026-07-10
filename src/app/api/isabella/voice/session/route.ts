// ============================================================================
// ProjectOps360° — Isabella Voice · session endpoint (server-only)
// ============================================================================
// ISABELLA-VOICE-REALTIME-BRIDGE
//
// POST → mints a SHORT-LIVED OpenAI Realtime client secret for the
// authenticated user, with Isabella's persona instructions and exactly ONE
// tool (ask_isabella). The permanent OPENAI_API_KEY never reaches the browser.
// Flag OFF → 404 (endpoint is dark). No session → 401. No key → 503.
// Every session start is audited (best-effort) in ai_runs.
// ============================================================================

import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { env } from "@/lib/env";
import { isIsabellaVoiceEnabled } from "@/lib/isabella/voice/flag";
import { voiceSessionRequestSchema } from "@/lib/isabella/voice/schemas";
import {
  buildRealtimeSessionConfig,
  DEFAULT_REALTIME_MODEL,
  DEFAULT_REALTIME_VOICE,
} from "@/lib/isabella/voice/tool-contract";
import { persistVoiceAudit } from "@/lib/isabella/voice/audit";
import type { VoiceSessionResponse } from "@/lib/isabella/voice/types";

const OPENAI_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";

export async function POST(request: Request): Promise<NextResponse> {
  if (!isIsabellaVoiceEnabled()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let org;
  try {
    org = await getOrgContext();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = voiceSessionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const model = env.ISABELLA_VOICE_MODEL || DEFAULT_REALTIME_MODEL;
  const voice = env.ISABELLA_VOICE_NAME || DEFAULT_REALTIME_VOICE;
  const config = buildRealtimeSessionConfig({
    locale: parsed.data.locale,
    context: parsed.data.context,
    model,
    voice,
  });

  let upstream: Response;
  try {
    upstream = await fetch(OPENAI_CLIENT_SECRETS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
      cache: "no-store",
    });
  } catch {
    await persistVoiceAudit(org, { event: "voice_session_created", context: parsed.data.context }, { ok: false, error: "upstream_unreachable" });
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }

  if (!upstream.ok) {
    // Never leak upstream error bodies (they can include request echoes).
    await persistVoiceAudit(org, { event: "voice_session_created", context: parsed.data.context }, { ok: false, error: `upstream_${upstream.status}` });
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }

  const data = (await upstream.json()) as { value?: string; expires_at?: number };
  if (!data.value) {
    await persistVoiceAudit(org, { event: "voice_session_created", context: parsed.data.context }, { ok: false, error: "no_client_secret" });
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }

  await persistVoiceAudit(org, { event: "voice_session_created", context: parsed.data.context }, { ok: true });

  const res: VoiceSessionResponse = {
    clientSecret: data.value,
    expiresAt: data.expires_at ?? null,
    model,
    voice,
  };
  return NextResponse.json(res);
}
