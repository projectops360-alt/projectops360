// ============================================================================
// Install-invitation coverage guard (guard: PWA-INSTALL-SURFACES)
// ============================================================================
// The banner was first mounted only in [locale]/layout.tsx. Anonymous visitors
// land on /landing (the site root redirects them there), which lives OUTSIDE
// that segment — so first-time visitors were never invited to install and the
// service worker never registered on first contact.
//
// Both surfaces must keep mounting it, and both i18n systems (next-intl for the
// app, react-i18next for the landing) must carry every key the copy contract
// requires. A missing key renders the raw key string to a user.
// ============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import appEn from "../../../../messages/en.json";
import appEs from "../../../../messages/es.json";
import landingEn from "../../landing/i18n/en.json";
import landingEs from "../../landing/i18n/es.json";

/** Every field of PwaInstallCopy. Keep in sync with pwa-install-copy.ts. */
const REQUIRED_KEYS = [
  "title",
  "body",
  "install",
  "later",
  "dismiss",
  "iosBody",
  "iosStepShare",
  "iosStepAdd",
] as const;

const ROOT = join(__dirname, "..", "..", "..", "..");

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("install invitation is mounted on every entry surface", () => {
  it("the authenticated app mounts it", () => {
    expect(source("src/app/[locale]/layout.tsx")).toContain(
      "<AppPwaInstallPrompt />",
    );
  });

  it("the public landing mounts it — this is where anonymous visitors arrive", () => {
    expect(source("src/app/landing/layout.tsx")).toContain(
      "<LandingPwaInstallPrompt />",
    );
  });

  it("the copy contract lists exactly the keys the wrappers pass", () => {
    const contract = source("src/components/pwa/pwa-install-copy.ts");
    for (const key of REQUIRED_KEYS) {
      expect(contract).toContain(`${key}:`);
    }
  });
});

describe("both i18n systems carry the install copy", () => {
  const catalogues = {
    "app / en": appEn.pwa,
    "app / es": appEs.pwa,
    "landing / en": landingEn.pwa,
    "landing / es": landingEs.pwa,
  } as Record<string, Record<string, string> | undefined>;

  for (const [name, catalogue] of Object.entries(catalogues)) {
    it(`${name} defines every key with a non-empty string`, () => {
      expect(catalogue).toBeDefined();
      for (const key of REQUIRED_KEYS) {
        expect(catalogue?.[key], `${name} is missing "${key}"`).toBeTruthy();
      }
    });
  }

  it("holds EN/ES key parity on both surfaces (UX-012)", () => {
    expect(Object.keys(appEn.pwa).sort()).toEqual(Object.keys(appEs.pwa).sort());
    expect(Object.keys(landingEn.pwa).sort()).toEqual(
      Object.keys(landingEs.pwa).sort(),
    );
  });

  it("keeps the two languages actually different (no untranslated copy)", () => {
    expect(appEn.pwa.install).not.toBe(appEs.pwa.install);
    expect(landingEn.pwa.install).not.toBe(landingEs.pwa.install);
  });
});
