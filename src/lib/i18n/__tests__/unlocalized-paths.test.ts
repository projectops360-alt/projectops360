import { describe, expect, it } from "vitest";

import { isUnlocalizedPath } from "@/lib/i18n/unlocalized-paths";

describe("isUnlocalizedPath", () => {
  it.each([
    "/auth/callback",
    "/landing",
    "/project-friction-intelligence",
    "/how-to-detect-project-friction",
    "/process-mining-for-pmo",
    "/ai-pmo-portfolio-risk-management",
    "/sap-transformation-project-intelligence",
    "/project-bottleneck-detection-software",
    "/ai-project-blocker-detection",
    "/project-delay-root-cause-analysis",
    "/project-dependency-impact-analysis",
    "/project-rework-detection",
    "/project-execution-intelligence-software",
    "/transformation-management-office-software",
    "/pmo-systemic-bottleneck-analysis",
    "/planned-vs-actual-project-execution",
    "/sap-transformation-bottleneck-detection",
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
