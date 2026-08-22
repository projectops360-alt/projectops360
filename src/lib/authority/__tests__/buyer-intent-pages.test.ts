import { describe, expect, it } from "vitest";

import { buyerIntentPages } from "@/lib/authority/buyer-intent-pages";

describe("buyerIntentPages", () => {
  const entries = Object.entries(buyerIntentPages);

  it("publishes exactly ten additional buyer-intent pages", () => {
    expect(entries).toHaveLength(10);
  });

  it("keeps every page substantive and evidence-oriented", () => {
    for (const [slug, page] of entries) {
      expect(slug.length).toBeGreaterThan(10);
      expect(page.metaDescription.length).toBeGreaterThan(90);
      expect(page.signals.length).toBeGreaterThanOrEqual(6);
      expect(page.method.length).toBeGreaterThanOrEqual(6);
      expect(page.faq.length).toBeGreaterThanOrEqual(5);
      expect(page.related.length).toBeGreaterThanOrEqual(3);
      expect(page.answer.toLowerCase()).not.toContain("guarantee");
    }
  });

  it("keeps buyer-intent slugs unique", () => {
    const slugs = entries.map(([slug]) => slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
