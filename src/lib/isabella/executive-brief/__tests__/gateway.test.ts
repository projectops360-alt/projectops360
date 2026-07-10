// ============================================================================
// Isabella Executive Brief (REG-023) — gateway contract
// ============================================================================
// Binds the routing boundary: answers ONLY detected executive questions with a
// project in scope; everything else returns null so the existing pipeline is
// unchanged. Permission denials are said honestly; failures fall through
// (never a dead end, never a crash); audit is best-effort.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AskGuideInput } from "@/lib/knowledge-os/types";
import { maybeAnswerWithExecutiveBrief } from "@/lib/isabella/executive-brief/gateway";
import { executiveDataFixture, EXPERT } from "./fixtures";

const auditInsert = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert: auditInsert }) }),
}));

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

function input(query: string, projectId?: string): AskGuideInput {
  return {
    query,
    intent: "question",
    locale: "es",
    answerLanguage: "es",
    context: { module: "projects", projectId },
  };
}

describe("maybeAnswerWithExecutiveBrief", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null for non-executive questions (pipeline unchanged)", async () => {
    const loadBrief = vi.fn();
    const res = await maybeAnswerWithExecutiveBrief(ORG, input("tareas sin milestone", PROJECT_ID), EXPERT, { loadBrief });
    expect(res).toBeNull();
    expect(loadBrief).not.toHaveBeenCalled();
  });

  it("returns null without a projectId (org-level questions keep their owners)", async () => {
    const loadBrief = vi.fn();
    const res = await maybeAnswerWithExecutiveBrief(ORG, input("dame un resumen del proyecto"), EXPERT, { loadBrief });
    expect(res).toBeNull();
    expect(loadBrief).not.toHaveBeenCalled();
  });

  it("answers the P0 multi-intent question with real data + audit", async () => {
    const loadBrief = vi.fn(async () => ({ ok: true as const, data: executiveDataFixture() }));
    const res = await maybeAnswerWithExecutiveBrief(
      ORG,
      input("necesito un resumen del proyecto y cuáles son los posibles riesgos que tengo hoy", PROJECT_ID),
      EXPERT,
      { loadBrief },
    );
    expect(res).not.toBeNull();
    expect(res!.grounded).toBe(true);
    expect(res!.answer).toContain("Riesgos registrados");
    expect(res!.answer).toContain("Señales operativas detectadas");
    // Observability: one structured audit row with goals + tools.
    expect(auditInsert).toHaveBeenCalledTimes(1);
    const row = auditInsert.mock.calls[0][0] as {
      model: string;
      input_snapshot: { detectedGoals: string[] };
      output_snapshot: { executiveBrief: { tools: string[]; status: string } };
    };
    expect(row.model).toBe("isabella-executive-brief");
    expect(row.input_snapshot.detectedGoals).toEqual(["project_summary", "risk_outlook"]);
    expect(row.output_snapshot.executiveBrief.tools).toEqual([
      "get_project_executive_brief",
      "get_project_risk_outlook",
    ]);
    expect(row.output_snapshot.executiveBrief.status).toBe("answered");
  });

  it("tells the user honestly when they lack access to the project", async () => {
    const loadBrief = vi.fn(async () => ({ ok: false as const, reason: "not_authorized" as const }));
    const res = await maybeAnswerWithExecutiveBrief(ORG, input("resumen del proyecto", PROJECT_ID), EXPERT, { loadBrief });
    expect(res).not.toBeNull();
    expect(res!.answer).toContain("No tienes acceso a los datos de ese proyecto");
  });

  it("falls through (null) on service unavailability — never a dead end", async () => {
    const loadBrief = vi.fn(async () => ({ ok: false as const, reason: "unavailable" as const }));
    const res = await maybeAnswerWithExecutiveBrief(ORG, input("resumen del proyecto", PROJECT_ID), EXPERT, { loadBrief });
    expect(res).toBeNull();
  });

  it("never throws when the service itself throws", async () => {
    const loadBrief = vi.fn(async () => {
      throw new Error("db exploded at /secret/path.ts");
    });
    const res = await maybeAnswerWithExecutiveBrief(ORG, input("resumen del proyecto", PROJECT_ID), EXPERT, { loadBrief });
    expect(res).toBeNull();
  });

  it("answers in English when the conversation language is English", async () => {
    const loadBrief = vi.fn(async () => ({ ok: true as const, data: executiveDataFixture() }));
    const res = await maybeAnswerWithExecutiveBrief(
      ORG,
      { ...input("give me a project summary and today's risks", PROJECT_ID), locale: "en", answerLanguage: "en" },
      EXPERT,
      { loadBrief },
    );
    expect(res!.language).toBe("en");
    expect(res!.answer).toContain("Registered risks");
  });

  it("audit failure never breaks the answer (best-effort)", async () => {
    auditInsert.mockRejectedValueOnce(new Error("audit down"));
    const loadBrief = vi.fn(async () => ({ ok: true as const, data: executiveDataFixture() }));
    const res = await maybeAnswerWithExecutiveBrief(ORG, input("resumen del proyecto", PROJECT_ID), EXPERT, { loadBrief });
    expect(res).not.toBeNull();
  });
});
