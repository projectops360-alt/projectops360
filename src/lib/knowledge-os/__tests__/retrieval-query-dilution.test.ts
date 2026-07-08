// ============================================================================
// REG-021 / KNOWLEDGE-OS-RETRIEVAL-QUERY-DILUTION — retrieval ranking guards
// ============================================================================
// The reported P1: "explícame el bottleneck view" asked from the Projects list
// returned "no verified answer" although the bottleneck sheet exists and is
// embedded. Two causes, both guarded here:
//   1. The LEXICAL half received the context-blended query (question + module +
//      screen + pageTitle), so context words outranked the actual topic and the
//      correct sheet fell out of the top-N. → lexical must rank by the RAW
//      question (`lexicalQuery`), falling back to the blended query when empty.
//   2. The vector threshold 0.6 silently emptied the vector half for legitimate
//      cross-language asks (correct ES↔EN match measured ≈0.53). → default 0.45.
// Supabase admin + OpenAI are mocked; no network, no env.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

const { rpcCalls, mockEnv } = vi.hoisted(() => ({
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  mockEnv: { OPENAI_API_KEY: "" } as { OPENAI_API_KEY: string },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return { data: [], error: null };
    },
  }),
}));
vi.mock("@/lib/env", () => ({ env: mockEnv }));
vi.mock("openai", () => ({
  default: class {
    embeddings = { create: async () => ({ data: [{ embedding: [0.1, 0.2] }] }) };
  },
}));

import { retrieveKnowledge } from "../retrieval";

const OPTS = { organizationId: "org-1", language: "es" } as const;
const lexicalCall = () => rpcCalls.find((c) => c.fn === "match_knowledge_lexical");
const vectorCall = () => rpcCalls.find((c) => c.fn === "match_knowledge");

beforeEach(() => {
  rpcCalls.length = 0;
  mockEnv.OPENAI_API_KEY = "";
});

describe("lexical half ranks by the RAW question, never the blended context", () => {
  it("passes lexicalQuery (not the context-blended query) to match_knowledge_lexical", async () => {
    await retrieveKnowledge("explicame el bottleneck view Projects projects projects list", {
      ...OPTS,
      lexicalQuery: "explicame el bottleneck view",
    });
    const lex = lexicalCall();
    expect(lex).toBeDefined();
    const text = String(lex!.args.query_text);
    expect(text).toContain("bottleneck");
    // Screen-context pollution must NOT reach the lexical ranking.
    expect(text).not.toMatch(/projects list/i);
  });

  it("falls back to the main query when lexicalQuery is empty (vague/intent-only asks)", async () => {
    await retrieveKnowledge("how to use this screen team roles", { ...OPTS, lexicalQuery: "   " });
    const text = String(lexicalCall()!.args.query_text);
    expect(text).toContain("team");
  });
});

describe("vector threshold admits legitimate cross-language matches", () => {
  it("defaults match_threshold to 0.45 (a correct ES↔EN match measured ≈0.53; 0.6 dropped it)", async () => {
    mockEnv.OPENAI_API_KEY = "test-key";
    await retrieveKnowledge("explicame el bottleneck view", { ...OPTS, lexicalQuery: "explicame el bottleneck view" });
    const vec = vectorCall();
    expect(vec).toBeDefined();
    expect(vec!.args.match_threshold).toBe(0.45);
  });

  it("still honors an explicit vectorThreshold override", async () => {
    mockEnv.OPENAI_API_KEY = "test-key";
    await retrieveKnowledge("q", { ...OPTS, vectorThreshold: 0.7 });
    expect(vectorCall()!.args.match_threshold).toBe(0.7);
  });

  it("vector half is skipped without an OpenAI key (lexical-only degradation)", async () => {
    await retrieveKnowledge("q", OPTS);
    expect(vectorCall()).toBeUndefined();
    expect(lexicalCall()).toBeDefined();
  });
});
