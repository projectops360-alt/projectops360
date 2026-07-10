// ============================================================================
// Isabella Voice — API route integration (ISABELLA-VOICE-REALTIME-BRIDGE)
// ============================================================================
// Integration contract of the two voice endpoints, with the pipeline mocked:
//   • flag OFF → both endpoints are DARK (404) — no auth probe, no OpenAI call,
//   • no session → 401,
//   • session endpoint returns the ephemeral secret and NEVER the real API key,
//   • bridge endpoint runs the question through Isabella and returns speakable
//     text; invalid bodies are rejected.
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ORG = {
  userId: "user-1",
  email: "pm@example.com",
  displayName: "PM",
  avatarUrl: null,
  locale: "en",
  role: "admin" as const,
  organizationId: "org-1",
  organizationName: { en: "Org", es: "Org" },
  organizationSlug: "org",
};

const getOrgContext = vi.fn();
const askLivingGuideAction = vi.fn();
const auditInsert = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));

vi.mock("@/lib/auth", () => ({ getOrgContext: () => getOrgContext() }));
vi.mock("@/components/living-guide/actions", () => ({
  askLivingGuideAction: (input: unknown) => askLivingGuideAction(input),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert: auditInsert }) }),
}));

const ENV_KEYS = ["ISABELLA_VOICE_ENABLED", "OPENAI_API_KEY"] as const;
const saved: Record<string, string | undefined> = {};

function postJson(body: unknown): Request {
  return new Request("http://localhost/api/isabella/voice/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BRIDGE_BODY = {
  question: "How many overdue tasks are there?",
  locale: "en",
  context: { module: "workboard" },
};

describe("isabella voice routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    getOrgContext.mockResolvedValue(ORG);
    askLivingGuideAction.mockResolvedValue({
      answerId: null,
      grounded: true,
      answer: "There are **2 overdue tasks**.",
      steps: [],
      followups: [],
      tier: "verified",
      confidenceScore: 1,
      language: "en",
      sources: [],
      expert: { key: "isabella", displayName: "Isabella", title: "PMO Director" },
    });
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    vi.unstubAllGlobals();
  });

  async function loadRoutes() {
    const session = await import("../session/route");
    const bridge = await import("../bridge/route");
    return { session, bridge };
  }

  it("both endpoints are dark (404) when the flag is OFF — nothing else runs", async () => {
    delete process.env.ISABELLA_VOICE_ENABLED;
    const { session, bridge } = await loadRoutes();

    const s = await session.POST(postJson({ locale: "en", context: {} }));
    const b = await bridge.POST(postJson(VALID_BRIDGE_BODY));
    expect(s.status).toBe(404);
    expect(b.status).toBe(404);
    expect(getOrgContext).not.toHaveBeenCalled();
    expect(askLivingGuideAction).not.toHaveBeenCalled();
  });

  it("requires an authenticated session (401)", async () => {
    process.env.ISABELLA_VOICE_ENABLED = "true";
    getOrgContext.mockRejectedValue(new Error("no session"));
    const { session, bridge } = await loadRoutes();

    expect((await session.POST(postJson({ locale: "en", context: {} }))).status).toBe(401);
    expect((await bridge.POST(postJson(VALID_BRIDGE_BODY))).status).toBe(401);
    expect(askLivingGuideAction).not.toHaveBeenCalled();
  });

  it("session endpoint mints an ephemeral secret and never leaks the API key", async () => {
    process.env.ISABELLA_VOICE_ENABLED = "true";
    process.env.OPENAI_API_KEY = "sk-real-secret-key";
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ value: "ek_ephemeral_123", expires_at: 1234567890 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { session } = await loadRoutes();
    const res = await session.POST(postJson({ locale: "es", context: { module: "workboard" } }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.clientSecret).toBe("ek_ephemeral_123");
    expect(JSON.stringify(data)).not.toContain("sk-real-secret-key");

    // The upstream call carried the single-tool session config.
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(String(init.body)) as {
      session: { tools: Array<{ name: string }>; audio: { output: { voice: string } } };
    };
    expect(sent.session.tools.map((t) => t.name)).toEqual(["ask_isabella"]);
  });

  it("session endpoint returns 503 when no OpenAI key is configured", async () => {
    process.env.ISABELLA_VOICE_ENABLED = "true";
    delete process.env.OPENAI_API_KEY;
    const { session } = await loadRoutes();
    expect((await session.POST(postJson({ locale: "en", context: {} }))).status).toBe(503);
  });

  it("bridge endpoint answers through Isabella's pipeline with speakable text + audit", async () => {
    process.env.ISABELLA_VOICE_ENABLED = "true";
    const { bridge } = await loadRoutes();

    const res = await bridge.POST(postJson(VALID_BRIDGE_BODY));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      ok: true,
      answer: "There are 2 overdue tasks.",
      tier: "verified",
      grounded: true,
    });
    expect(askLivingGuideAction).toHaveBeenCalledTimes(1);
    // Audit row persisted (best-effort ai_runs insert).
    expect(auditInsert).toHaveBeenCalledTimes(1);
    const row = auditInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({ model: "isabella-voice", organization_id: "org-1", user_id: "user-1" });
  });

  it("bridge endpoint rejects invalid bodies (422) without calling the pipeline", async () => {
    process.env.ISABELLA_VOICE_ENABLED = "true";
    const { bridge } = await loadRoutes();
    const res = await bridge.POST(postJson({ question: "", locale: "en", context: {} }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("invalid_request");
    expect(askLivingGuideAction).not.toHaveBeenCalled();
  });
});
