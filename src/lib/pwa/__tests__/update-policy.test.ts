// ============================================================================
// PWA auto-update — policy guards
// Guards: PWA-AUTO-UPDATE
// ============================================================================
// An installed app must not run an old build forever, and must not reload
// someone's half-typed form to prove it. These assertions pin both halves.
// ============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BACKGROUND_THRESHOLD_MS,
  FOREGROUND_POLL_MS,
  decideUpdateAction,
  isComparableBuildId,
} from "@/lib/pwa/update-policy";

const ROOT = join(__dirname, "..", "..", "..", "..");
const source = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

describe("build id comparability", () => {
  it("refuses to compare the local development placeholder", () => {
    expect(isComparableBuildId("development")).toBe(false);
    expect(isComparableBuildId("")).toBe(false);
    expect(isComparableBuildId(null)).toBe(false);
    expect(isComparableBuildId(undefined)).toBe(false);
    expect(isComparableBuildId("5c2bffd")).toBe(true);
  });
});

describe("update decision (PWA-AUTO-UPDATE)", () => {
  const base = { currentBuildId: "aaa111", latestBuildId: "aaa111", wasBackgrounded: false };

  it("does nothing when the build is unchanged", () => {
    expect(decideUpdateAction(base)).toBe("none");
    expect(decideUpdateAction({ ...base, wasBackgrounded: true })).toBe("none");
  });

  it("reloads silently when the app returns from the background", () => {
    expect(
      decideUpdateAction({ ...base, latestBuildId: "bbb222", wasBackgrounded: true }),
    ).toBe("reload");
  });

  it("asks instead of reloading while the app is in active use", () => {
    expect(
      decideUpdateAction({ ...base, latestBuildId: "bbb222", wasBackgrounded: false }),
    ).toBe("prompt");
  });

  it("never reloads over unsaved work, even on the safe path", () => {
    expect(
      decideUpdateAction({
        ...base,
        latestBuildId: "bbb222",
        wasBackgrounded: true,
        hasUnsavedWork: true,
      }),
    ).toBe("prompt");
  });

  it("treats a failed check as no information — never as up-to-date, never as stale", () => {
    // A network failure must not reload the app and must not silence a real
    // update: both are expressed by declining to decide.
    expect(decideUpdateAction({ ...base, latestBuildId: null, wasBackgrounded: true })).toBe("none");
  });

  it("does nothing in local development, whatever the server says", () => {
    expect(
      decideUpdateAction({
        currentBuildId: "development",
        latestBuildId: "bbb222",
        wasBackgrounded: true,
      }),
    ).toBe("none");
  });

  it("uses intervals a human would recognise as reasonable", () => {
    expect(FOREGROUND_POLL_MS).toBeGreaterThanOrEqual(5 * 60 * 1000);
    // A two-second window-switch must not count as backgrounded.
    expect(BACKGROUND_THRESHOLD_MS).toBeGreaterThanOrEqual(30 * 1000);
  });
});

describe("the version endpoint is reachable and uncacheable", () => {
  it("is excluded from the locale/auth middleware", () => {
    // Without this the middleware rewrites it to /<locale>/api/version and the
    // auth guard bounces it to /login, so no install could ever self-update.
    expect(source("src/lib/i18n/unlocalized-paths.ts")).toContain("/api/version");
  });

  it("is never cached — a cached answer reads as 'no new version'", () => {
    const route = source("src/app/api/version/route.ts");
    expect(route).toContain("no-store");
    expect(route).toContain('dynamic = "force-dynamic"');
  });

  it("exposes only a build id", () => {
    const route = source("src/app/api/version/route.ts");
    expect(route).toContain("buildId");
    // No session, no org, no user data on a public endpoint.
    expect(route).not.toMatch(/getOrgContext|createClient|auth\.getUser/);
  });

  it("the build id is frozen at build time for server and client alike", () => {
    expect(source("next.config.ts")).toContain("NEXT_PUBLIC_BUILD_ID");
    expect(source("next.config.ts")).toContain("VERCEL_GIT_COMMIT_SHA");
  });
});

describe("the service worker still caches no application content", () => {
  // The whole update story depends on this: because the worker never serves a
  // cached HTML or JS response, a fresh navigation is always the new build.
  it("intercepts only navigation, and only to fall back to the offline page", () => {
    const sw = source("public/sw.js");
    expect(sw).toContain('request.mode !== "navigate"');
    expect(sw).toContain("skipWaiting");
    expect(sw).toContain("clients.claim");
    // No cache-first / stale-while-revalidate strategy for app assets.
    expect(sw).not.toMatch(/caches\.match\(request\)/);
  });
});
