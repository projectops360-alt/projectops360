import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("landing pricing source", () => {
  it("loads commercial values from the plans table", () => {
    const landingPage = readSource("src/app/landing/page.tsx");
    expect(landingPage).toContain("await connection()");
    expect(landingPage).toContain("getPublicPricingPlans");
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
        pricing: {
          trialCta: string;
          plans: Record<string, Record<string, unknown>>;
        };
      };

      Object.values(messages.pricing.plans).forEach((plan) => {
        expect(plan).not.toHaveProperty("price");
        expect(plan).not.toHaveProperty("features");
        expect(plan).not.toHaveProperty("cta");
      });
      expect(messages.pricing.trialCta).toBe(
        locale === "es" ? "Probar 14 días" : "Try 14 days",
      );
    },
  );

  it("does not read a translated price in the pricing component", () => {
    const pricing = readSource("src/components/landing/pricing.tsx");
    expect(pricing).not.toMatch(
      /pricing\.plans\.\$\{[^}]+\}\.price/,
    );
    expect(pricing).toContain("plan.capabilities.map");
    expect(pricing).toContain('t("pricing.trialCta")');
  });

  it("keeps the desktop hero left-aligned and uses the branded favicon", () => {
    const hero = readSource("src/components/landing/hero.tsx");
    const layout = readSource("src/app/layout.tsx");

    expect(hero).toContain("lg:items-start lg:text-left");
    expect(hero).toContain("lg:justify-start");
    expect(layout).toContain('/favicon.ico');
    expect(layout).toContain('/apple-icon.png');
  });
});
