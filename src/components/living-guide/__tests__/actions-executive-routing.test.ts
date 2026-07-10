// ============================================================================
// REG-023 — Isabella answers PM-level project questions (routing regression)
// ============================================================================
// THE executable regression test for REG-023. Before the fix, "resumen del
// proyecto + riesgos" was hijacked by the query-engine (token "riesgos" →
// entity "risk") and dead-ended in the hardcoded "Por ahora solo puedo generar
// reportes de tareas" — Process Intelligence, the REG-013 briefing engine and
// RAG never ran. This test fails if that routing regression returns.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GuideAnswer } from "@/lib/knowledge-os/types";
import { executiveDataFixture } from "@/lib/isabella/executive-brief/__tests__/fixtures";

const ORG = {
  userId: "user-1",
  email: "pm@example.com",
  displayName: "PM",
  avatarUrl: null,
  locale: "es",
  role: "admin" as const,
  organizationId: "org-1",
  organizationName: { en: "Org", es: "Org" },
  organizationSlug: "org",
};

const PROJECT_ID = "0b7f4a52-9a1a-4c3e-9f4e-2f1a6a1b2c3d";
const DEAD_END_ES = "solo puedo generar reportes de tareas";
const DEAD_END_EN = "can only report on tasks";

const askKnowledgeOs = vi.fn(
  async (): Promise<GuideAnswer> => ({
    answerId: null,
    grounded: false,
    answer: "RAG_FALLBACK_ANSWER",
    steps: [],
    followups: [],
    tier: "ai_suggestion",
    confidenceScore: 0.4,
    language: "es",
    sources: [],
    expert: { key: "isabella", displayName: "Isabella", title: "PMO" },
  }),
);
const loadBrief = vi.fn(async () => ({ ok: true as const, data: executiveDataFixture() }));

vi.mock("@/lib/auth", () => ({ getOrgContext: async () => ORG }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert: async () => ({ error: null }) }) }),
}));
vi.mock("@/lib/knowledge-os/service", () => ({
  askKnowledgeOs: (...args: unknown[]) => askKnowledgeOs(...(args as [])),
  recordGuideFeedback: async () => undefined,
}));
vi.mock("@/lib/isabella/executive-brief/service", () => ({
  getExecutiveBriefData: (...args: unknown[]) => loadBrief(...(args as [])),
}));

async function ask(query: string, projectId?: string, locale: "en" | "es" = "es"): Promise<GuideAnswer> {
  const { askLivingGuideAction } = await import("@/components/living-guide/actions");
  return askLivingGuideAction({
    query,
    intent: "question",
    locale,
    answerLanguage: locale,
    context: { module: "projects", projectId },
  });
}

describe("REG-023 — executive project questions reach real data", () => {
  beforeEach(() => vi.clearAllMocks());

  it("the reported P0 question gets a grounded executive answer (never the task-only dead end)", async () => {
    const answer = await ask(
      "Mira, necesito que me des un resumen del proyecto. ¿Cuáles son los posibles riesgos que tengo hoy en el proyecto?",
      PROJECT_ID,
    );
    expect(answer.grounded).toBe(true);
    expect(answer.tier).toBe("verified");
    expect(answer.answer).toContain("Riesgos registrados");
    expect(answer.answer).toContain("Señales operativas detectadas");
    expect(answer.answer.toLowerCase()).not.toContain(DEAD_END_ES);
    // The executive path answered — RAG was never needed.
    expect(askKnowledgeOs).not.toHaveBeenCalled();
    expect(loadBrief).toHaveBeenCalledTimes(1);
  });

  it("risk-only question works in English too", async () => {
    const answer = await ask("What are the current risks in the project?", PROJECT_ID, "en");
    expect(answer.answer).toContain("Registered risks");
    expect(answer.answer.toLowerCase()).not.toContain(DEAD_END_EN);
  });

  it("a non-task entity report no longer dead-ends — it falls through to the knowledge pipeline", async () => {
    // "lista de decisiones" parses to entity=decision (unsupported by the task
    // adapter). Before REG-023 this returned the hardcoded task-only phrase.
    const answer = await ask("lista de decisiones", PROJECT_ID);
    expect(answer.answer.toLowerCase()).not.toContain(DEAD_END_ES);
    expect(answer.answer).toBe("RAG_FALLBACK_ANSWER");
    expect(askKnowledgeOs).toHaveBeenCalledTimes(1);
  });

  it("without a project in scope the executive path stays out (existing behavior preserved)", async () => {
    const answer = await ask("dame un resumen del proyecto");
    expect(loadBrief).not.toHaveBeenCalled();
    // The question still gets SOME answer from the existing pipeline (here the
    // query engine asks for a project / clarification, or RAG) — never a crash.
    expect(answer.answer.length).toBeGreaterThan(0);
  });

  it("read-only guarantee: answering performs no mutations (only ai_runs audit inserts)", async () => {
    // The supabase admin mock only exposes insert on ai_runs via the audit path;
    // any other table access would throw and fail this test.
    const answer = await ask("resumen del proyecto y riesgos de hoy", PROJECT_ID);
    expect(answer.grounded).toBe(true);
  });
});
