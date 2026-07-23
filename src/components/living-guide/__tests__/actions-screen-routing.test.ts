import { beforeEach, describe, expect, it, vi } from "vitest";

const askKnowledgeOs = vi.fn();

vi.mock("@/lib/auth", () => ({
  getOrgContext: async () => ({
    userId: "user-1",
    email: "pmo@example.com",
    displayName: "PMO",
    avatarUrl: null,
    locale: "es",
    role: "admin",
    organizationId: "org-1",
    organizationName: { en: "Org", es: "Org" },
    organizationSlug: "org",
  }),
}));

vi.mock("@/lib/knowledge-os/service", () => ({
  askKnowledgeOs: (...args: unknown[]) => askKnowledgeOs(...args),
  recordGuideFeedback: vi.fn(),
}));

describe("Living Guide screen routing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("answers Financial Setup directly before project briefing or RAG", async () => {
    const { askLivingGuideAction } = await import("@/components/living-guide/actions");
    const answer = await askLivingGuideAction({
      query: "Explain this screen",
      intent: "question",
      locale: "en",
      answerLanguage: "en",
      context: {
        module: "financial_control",
        screen: "financial_setup",
        pathname: "/projects/project-1/budget",
        projectId: "project-1",
      },
    });

    expect(answer.grounded).toBe(true);
    expect(answer.answer).toContain("Financial setup");
    expect(answer.answer).not.toContain("Projects list");
    expect(askKnowledgeOs).not.toHaveBeenCalled();
  });

  it("recognizes the Spanish wording used in the Isabella panel", async () => {
    const { askLivingGuideAction } = await import("@/components/living-guide/actions");
    const answer = await askLivingGuideAction({
      query: "Hola Isabella, explícame qué es esta pantalla",
      intent: "question",
      locale: "es",
      answerLanguage: "es",
      context: {
        module: "financial_control",
        screen: "financial_setup",
        pathname: "/es/projects/project-1/budget",
        projectId: "project-1",
      },
    });

    expect(answer.grounded).toBe(true);
    expect(answer.answer).toContain("configuración financiera");
    expect(askKnowledgeOs).not.toHaveBeenCalled();
  });
});
