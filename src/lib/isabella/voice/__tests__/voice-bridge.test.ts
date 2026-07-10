// ============================================================================
// Isabella Voice Context Bridge — security + behavior contract
// ============================================================================
// ISABELLA-VOICE-REALTIME-BRIDGE. The bridge is the ONLY path from the speech
// model into Isabella. These tests bind:
//   • strict validation (no oversized/foreign payloads reach the pipeline),
//   • identity is NEVER taken from the voice payload (no identity fields pass),
//   • the answer is speech-sanitized and bounded,
//   • every failure maps to a safe code (never a throw, never internals).
// ============================================================================

import { describe, it, expect, vi } from "vitest";
import { runVoiceBridge } from "@/lib/isabella/voice/bridge";
import type { AskGuideInput, GuideAnswer } from "@/lib/knowledge-os/types";

const PROJECT_ID = "0b7f4a52-9a1a-4c3e-9f4e-2f1a6a1b2c3d";

function guideAnswer(overrides: Partial<GuideAnswer> = {}): GuideAnswer {
  return {
    answerId: null,
    grounded: true,
    answer: "You have **3 overdue tasks** — see [Workboard](/board).",
    steps: [],
    followups: [],
    tier: "verified",
    confidenceScore: 1,
    language: "en",
    sources: [],
    expert: { key: "isabella", displayName: "Isabella", title: "PMO Director" },
    ...overrides,
  };
}

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    question: "How many overdue tasks does this project have?",
    locale: "en",
    context: { projectId: PROJECT_ID, module: "workboard", pageTitle: "Workboard" },
    ...overrides,
  };
}

describe("runVoiceBridge — validation", () => {
  it("rejects a missing/empty question without calling Isabella", async () => {
    const ask = vi.fn();
    expect(await runVoiceBridge(validBody({ question: "" }), { ask })).toEqual({
      ok: false,
      error: "invalid_request",
    });
    expect(await runVoiceBridge(null, { ask })).toEqual({ ok: false, error: "invalid_request" });
    expect(ask).not.toHaveBeenCalled();
  });

  it("rejects an oversized question (bounded input)", async () => {
    const ask = vi.fn();
    const res = await runVoiceBridge(validBody({ question: "x".repeat(601) }), { ask });
    expect(res).toEqual({ ok: false, error: "invalid_request" });
    expect(ask).not.toHaveBeenCalled();
  });

  it("rejects unknown fields (strict schema — no smuggled payloads)", async () => {
    const ask = vi.fn();
    const res = await runVoiceBridge(validBody({ sql: "DROP TABLE tasks" }), { ask });
    expect(res).toEqual({ ok: false, error: "invalid_request" });
    expect(ask).not.toHaveBeenCalled();
  });

  // REGRESSION (prod 2026-07-09): once the spoken conversation grew, EVERY
  // bridge call 422'd because Isabella's own transcripts exceeded the per-turn
  // bound and the whole body was rejected — voice answered "there was a
  // problem" for questions the text panel answered fine. Auxiliary metadata
  // must DEGRADE (truncate/drop), never fail the turn.
  it("accepts oversized recentConversation transcripts (audit-only → truncated, not rejected)", async () => {
    let received: AskGuideInput | null = null;
    const ask = vi.fn(async (input: AskGuideInput) => {
      received = input;
      return guideAnswer();
    });
    const res = await runVoiceBridge(
      validBody({
        recentConversation: [
          { role: "assistant", text: "A very long spoken answer. ".repeat(40) }, // ~1080 chars
          { role: "user", text: "¿Qué es el Living Graph?" },
        ],
      }),
      { ask },
    );
    expect(res.ok).toBe(true);
    expect(received).not.toBeNull();
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("degrades an improvised intent label to a normal question instead of rejecting", async () => {
    let received: AskGuideInput | null = null;
    const ask = vi.fn(async (input: AskGuideInput) => {
      received = input;
      return guideAnswer();
    });
    const res = await runVoiceBridge(validBody({ intentHint: "explain" }), { ask });
    expect(res.ok).toBe(true);
    expect(received!.intent).toBe("question");
  });

  it("degrades a malformed recentConversation instead of rejecting the turn", async () => {
    const ask = vi.fn(async () => guideAnswer());
    const res = await runVoiceBridge(
      validBody({ recentConversation: [{ role: "system", text: "nope" }] }),
      { ask },
    );
    expect(res.ok).toBe(true);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-uuid projectId", async () => {
    const ask = vi.fn();
    const res = await runVoiceBridge(
      validBody({ context: { projectId: "not-a-uuid" } }),
      { ask },
    );
    expect(res).toEqual({ ok: false, error: "invalid_request" });
    expect(ask).not.toHaveBeenCalled();
  });
});

describe("runVoiceBridge — identity & scope", () => {
  it("never forwards client-claimed identity into the pipeline input", async () => {
    let received: AskGuideInput | null = null;
    const ask = vi.fn(async (input: AskGuideInput) => {
      received = input;
      return guideAnswer();
    });

    // Strict schema already rejects identity fields at the top level; this
    // asserts the built AskGuideInput carries NO identity either — the pipeline
    // re-stamps user/org/role from the trusted session (like the text panel).
    const res = await runVoiceBridge(validBody(), { ask });
    expect(res.ok).toBe(true);
    expect(received).not.toBeNull();
    expect(received!.context.userId).toBeUndefined();
    expect(received!.context.organizationId).toBeUndefined();
    expect(received!.context.role).toBeUndefined();
    expect(received!.context.provenanceFacts).toBeUndefined();
    expect(received!.context.executionFacts).toBeUndefined();
    expect(received!.context.projectId).toBe(PROJECT_ID);
    expect(received!.query).toBe("How many overdue tasks does this project have?");
    expect(received!.intent).toBe("question");
  });

  it("passes the intent hint through when provided", async () => {
    let received: AskGuideInput | null = null;
    const ask = vi.fn(async (input: AskGuideInput) => {
      received = input;
      return guideAnswer();
    });
    await runVoiceBridge(validBody({ intentHint: "explain_screen" }), { ask });
    expect(received!.intent).toBe("explain_screen");
  });
});

describe("runVoiceBridge — answers & failures", () => {
  it("returns a speech-sanitized answer with tier + grounded metadata", async () => {
    const ask = vi.fn(async () => guideAnswer());
    const res = await runVoiceBridge(validBody(), { ask });
    expect(res).toEqual({
      ok: true,
      answer: "You have 3 overdue tasks — see Workboard.",
      language: "en",
      tier: "verified",
      grounded: true,
      truncated: false,
    });
  });

  it("bounds very long answers and flags truncation", async () => {
    const ask = vi.fn(async () =>
      guideAnswer({ answer: "A long verified sentence about milestones. ".repeat(80) }),
    );
    const res = await runVoiceBridge(validBody(), { ask });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.truncated).toBe(true);
      expect(res.answer.length).toBeLessThanOrEqual(1200);
    }
  });

  it("maps pipeline throws (e.g. unauthorized session) to a safe code", async () => {
    const ask = vi.fn(async () => {
      throw new Error("relation tasks does not exist at /very/secret/path.ts:42");
    });
    const res = await runVoiceBridge(validBody(), { ask });
    expect(res).toEqual({ ok: false, error: "unavailable" });
  });

  it("never returns an empty spoken answer", async () => {
    const ask = vi.fn(async () => guideAnswer({ answer: "   " }));
    const res = await runVoiceBridge(validBody(), { ask });
    expect(res).toEqual({ ok: false, error: "unavailable" });
  });
});
