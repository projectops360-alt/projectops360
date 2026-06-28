import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PRODUCT_BRAIN_PACKAGES,
  REQUIRED_PB_SLUGS,
} from "@/lib/knowledge-os/seeds/product-brain-knowledge";

const bySlug = new Map(PRODUCT_BRAIN_PACKAGES.map((p) => [p.slug, p]));

describe("Dr. Isabella — Product Brain knowledge corpus", () => {
  it("every package is bilingual, scoped to product_intelligence, with a source ref", () => {
    for (const p of PRODUCT_BRAIN_PACKAGES) {
      expect(p.domain).toBe("product_intelligence");
      expect(p.en.title.trim()).toBeTruthy();
      expect(p.en.body.trim()).toBeTruthy();
      expect(p.es.title.trim()).toBeTruthy();
      expect(p.es.body.trim()).toBeTruthy();
      expect(p.sourceRef.trim()).toBeTruthy();
      expect(["verified", "best_practice", "ai_suggestion"]).toContain(p.tier);
    }
  });

  it("every package body carries a Source: and a Verify: line (citation + verification)", () => {
    for (const p of PRODUCT_BRAIN_PACKAGES) {
      expect(p.en.body).toMatch(/Source:/);
      expect(p.en.body).toMatch(/Verify:/);
      expect(p.es.body).toMatch(/Fuente:/);
      expect(p.es.body).toMatch(/Verifica:/);
    }
  });

  it("slugs are unique", () => {
    expect(new Set(REQUIRED_PB_SLUGS).size).toBe(REQUIRED_PB_SLUGS.length);
  });

  // ── Seed QA facts (TASK 10): the corpus must state the correct answers ──────
  const facts: Array<[string, RegExp]> = [
    ["pi-critical-path-source-of-truth", /Living Graph/i],
    ["pi-critical-path-source-of-truth", /must NOT maintain a separate Critical Path engine/i],
    ["pi-workboard-task-cards", /avatar.*initials|initials/i],
    ["pi-workboard-task-cards", /Unassigned/i],
    ["pi-blocked-vs-waiting", /explicit.*impediment/i],
    ["pi-blocked-vs-waiting", /never inferred from dependencies/i],
    ["pi-completed-not-blockers", /NEVER an active blocker/i],
    ["pi-projectops-scribe", /Project Memory capture assistant/i],
    ["pi-project-memory", /permanent project evidence store/i],
    ["pi-variance-baseline", /approved baseline/i],
    ["pi-timeline-playback", /real project history/i],
    ["pi-whatif-sandbox", /sandbox/i],
    ["pi-whatif-sandbox", /No real project data changes unless/i],
    ["pi-focus-mode", /protagonist/i],
    ["pi-living-graph-saved-layouts", /Save Layout/i],
    ["pi-living-graph-saved-layouts", /does NOT change tasks, dependencies/i],
    ["pi-living-graph-saved-layouts", /reset to auto-layout/i],
    ["pi-reg-008", /stale is_blocked flag/i],
    ["pi-reg-009", /ProjectOps Scribe/i],
    ["pi-reg-010", /rollup inconsistency/i],
    ["pi-verify-false-blockers", /Mobile App Design/i],
    ["pi-verify-false-blockers", /0 blocked/i],
    ["pi-product-brain-gap", /does not define/i],
    ["pi-isabella-project-briefing", /project-aware/i],
    ["pi-isabella-project-briefing", /no AI call on open/i],
    ["pi-isabella-project-briefing", /generic guide prompt/i],
    ["pi-isabella-briefing-no-invention", /never invents/i],
    ["pi-isabella-briefing-no-invention", /NEVER counted as active blockers/i],
    ["pi-isabella-briefing-no-invention", /don't have enough data/i],
  ];

  it.each(facts)("%s states the expected fact", (slug, re) => {
    const pkg = bySlug.get(slug);
    expect(pkg, `missing package ${slug}`).toBeDefined();
    expect(pkg!.en.body).toMatch(re);
  });

  // ── DB seed and code must not drift ─────────────────────────────────────────
  it("the generated migration contains every package slug (no drift)", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20260817000000_knowledge_product_brain.sql"),
      "utf8",
    );
    for (const slug of REQUIRED_PB_SLUGS) {
      expect(sql, `slug ${slug} missing from migration`).toContain(`'${slug}'`);
    }
  });
});
