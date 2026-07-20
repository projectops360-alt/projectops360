import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("landing pricing source", () => {
  it("loads commercial values from the plans table", () => {
    expect(readSource("src/app/landing/page.tsx")).toContain(
      "getPublicPricingPlans",
    );
    expect(readSource("src/lib/billing/public-plans.ts")).toContain(
      '.from("plans")',
    );
  });

  it.each(["en", "es"])(
    "does not duplicate %s prices in translation files",
    (locale) => {
      const messages = JSON.parse(
        readSource(`src/components/landing/i18n/${locale}.json`),
      ) as {
        pricing: { plans: Record<string, Record<string, unknown>> };
      };

      Object.values(messages.pricing.plans).forEach((plan) => {
        expect(plan).not.toHaveProperty("price");
      });
    },
  );

  it("does not read a translated price in the pricing component", () => {
    expect(readSource("src/components/landing/pricing.tsx")).not.toMatch(
      /pricing\.plans\.\$\{[^}]+\}\.price/,
    );
  });
});
