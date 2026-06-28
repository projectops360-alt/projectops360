import { describe, it, expect } from "vitest";
import { buildPrompt, mapItems } from "../ai";

// ============================================================================
// REG-009 — ProjectOps Scribe anti-hallucination contract
// ============================================================================
// Scribe turns a captured note/dictation into STRUCTURED project intelligence.
// The protected behavior (see 10-regression-log.md → REG-009): the AI extracts
// ONLY what the capture supports, uses null for missing owner/date, keeps a
// verbatim source_excerpt per item, marks uncertain items needs_review, and
// NEVER creates entities without human approval. These tests fail if that
// contract is weakened. Pure — no AI call, no DB writes.
// ============================================================================

describe("REG-009 — Scribe prompt enforces anti-hallucination", () => {
  const prompt = buildPrompt("Diego will deliver the report by June 30.", "en");

  it("instructs the model to extract only supported info and never invent", () => {
    expect(prompt).toMatch(/Extract ONLY information explicitly supported/i);
    expect(prompt).toMatch(/NEVER invent owners, dates, decisions/i);
    expect(prompt).toMatch(/use null/i);
  });

  it("requires a verbatim source_excerpt for every item", () => {
    expect(prompt).toMatch(/verbatim "source_excerpt"/i);
  });

  it("requires needs_review for uncertain/inferred items", () => {
    expect(prompt).toMatch(/"needs_review": true whenever the item is uncertain/i);
  });

  it("never proposes to apply changes automatically (human approval required)", () => {
    expect(prompt).toMatch(/WITHOUT proposing to apply any change automatically/i);
  });

  it("resolves dates against today and forbids invented dates", () => {
    expect(prompt).toMatch(/Today's date is \d{4}-\d{2}-\d{2}/);
    expect(prompt).toMatch(/Never invent a date that is not implied/i);
  });

  it("embeds the capture text it was given", () => {
    expect(prompt).toContain("Diego will deliver the report by June 30.");
  });
});

describe("REG-009 — Scribe normalization never fabricates data", () => {
  it("defaults needs_review to TRUE when the model omits it (uncertain → review)", () => {
    const items = mapItems({
      action_items: [{ description: "Ship the report", source_excerpt: "ship the report" }],
    });
    expect(items).toHaveLength(1);
    expect(items[0].needs_review).toBe(true);
  });

  it("uses null for missing owner and due_date (no invention)", () => {
    const items = mapItems({
      action_items: [{ description: "Do X", source_excerpt: "do x", confidence: 0.4 }],
    });
    expect(items[0].suggested_owner).toBeNull();
    expect(items[0].suggested_due_date).toBeNull();
    expect(items[0].confidence).toBe(0.4);
  });

  it("preserves a verbatim source_excerpt and a named owner/date when stated", () => {
    const items = mapItems({
      action_items: [
        {
          description: "Deliver the compliance report",
          owner: "Diego",
          due_date: "2026-06-30",
          confidence: 0.9,
          needs_review: false,
          source_excerpt: "Diego will deliver the compliance report by June 30",
        },
      ],
    });
    expect(items[0].suggested_owner).toBe("Diego");
    expect(items[0].suggested_due_date).toBe("2026-06-30");
    expect(items[0].source_excerpt).toBe("Diego will deliver the compliance report by June 30");
    expect(items[0].needs_review).toBe(false);
  });

  it("drops items with no description (never creates an empty/hallucinated entity)", () => {
    const items = mapItems({
      action_items: [{ description: "", owner: "Z" }, { description: "   " }],
      decisions: [{ description: "" }],
    });
    expect(items).toHaveLength(0);
  });

  it("keeps each enumerated item separate (granularity, no collapsing)", () => {
    const items = mapItems({
      action_items: [
        { description: "Report A", source_excerpt: "A" },
        { description: "Report B", source_excerpt: "B" },
        { description: "Report C", source_excerpt: "C" },
      ],
    });
    expect(items.map((i) => i.description)).toEqual(["Report A", "Report B", "Report C"]);
  });

  it("maps decision_maker→owner and date→due_date for decisions", () => {
    const items = mapItems({
      decisions: [
        { description: "Adopt React 19", decision_maker: "Ana", date: "2026-06-01", source_excerpt: "we will adopt React 19" },
      ],
    });
    expect(items[0].item_type).toBe("decision");
    expect(items[0].suggested_owner).toBe("Ana");
    expect(items[0].suggested_due_date).toBe("2026-06-01");
  });

  it("proposes actions (create_/save_/flag_) — proposals for review, never auto-applied", () => {
    const items = mapItems({
      action_items: [{ description: "X", source_excerpt: "x" }],
      risks: [{ description: "R", source_excerpt: "r" }],
      blockers: [{ description: "B", source_excerpt: "b" }],
    });
    const actions = items.map((i) => i.proposed_action);
    expect(actions).toContain("create_task");
    expect(actions).toContain("create_risk");
    expect(actions).toContain("flag_blocker");
    // Proposals only — nothing here performs a write.
    for (const a of actions) expect(a).toMatch(/^(create_|save_|flag_|note_|answer_)/);
  });

  it("open questions are always needs_review with null owner/date", () => {
    const items = mapItems({
      open_questions: [{ question: "Who owns deployment?", reason: "unclear", source_excerpt: "who deploys?" }],
    });
    expect(items[0].item_type).toBe("open_question");
    expect(items[0].needs_review).toBe(true);
    expect(items[0].suggested_owner).toBeNull();
    expect(items[0].suggested_due_date).toBeNull();
  });

  it("ignores unknown sections (no keys outside the contract shape produce items)", () => {
    const items = mapItems({ random_section: [{ description: "should not appear" }] });
    expect(items).toHaveLength(0);
  });
});
