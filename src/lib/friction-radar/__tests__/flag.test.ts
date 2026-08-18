import { afterEach, describe, expect, it, vi } from "vitest";
import { isFrictionRadarEnabledForProject } from "../flag";

const PROJECT = "a40a7436-c63f-4e3b-94cd-041447ee54d4";

afterEach(() => vi.unstubAllEnvs());

describe("Friction Radar controlled rollout flag", () => {
  it("is default OFF", () => {
    vi.stubEnv("FRICTION_RADAR_ENABLED", "");
    vi.stubEnv("FRICTION_RADAR_PROJECT_IDS", PROJECT);
    expect(isFrictionRadarEnabledForProject(PROJECT)).toBe(false);
  });

  it("requires both the global switch and exact project allowlist", () => {
    vi.stubEnv("FRICTION_RADAR_ENABLED", "true");
    vi.stubEnv("FRICTION_RADAR_PROJECT_IDS", PROJECT);
    expect(isFrictionRadarEnabledForProject(PROJECT)).toBe(true);
    expect(isFrictionRadarEnabledForProject("00000000-0000-0000-0000-000000000000")).toBe(false);
  });

  it("allows all in preview but rejects all in Vercel production", () => {
    vi.stubEnv("FRICTION_RADAR_ENABLED", "true");
    vi.stubEnv("FRICTION_RADAR_PROJECT_IDS", "all");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(isFrictionRadarEnabledForProject(PROJECT)).toBe(true);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(isFrictionRadarEnabledForProject(PROJECT)).toBe(false);
  });
});
