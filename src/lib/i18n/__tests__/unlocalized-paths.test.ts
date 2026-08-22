import { describe, expect, it } from "vitest";

import { isUnlocalizedPath } from "@/lib/i18n/unlocalized-paths";

describe("isUnlocalizedPath", () => {
  it.each([
    "/auth/callback",
    "/landing",
    "/project-friction-intelligence",
    "/how-to-detect-project-friction",
    "/navigator-preview",
  ])("bypasses locale rewriting for %s", (pathname) => {
    expect(isUnlocalizedPath(pathname)).toBe(true);
  });

  it.each(["/login", "/es/login", "/projects", "/api/webhooks/drawings"])(
    "keeps normal middleware handling for %s",
    (pathname) => {
      expect(isUnlocalizedPath(pathname)).toBe(false);
    },
  );
});
