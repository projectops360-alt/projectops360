import { describe, it, expect, afterEach } from "vitest";
import { isGitHubIntelligenceFlagEnabled } from "@/lib/env";
import { isSoftwareProjectType, SOFTWARE_PROJECT_TYPE } from "../project-type";
import { getEnabledModules } from "@/lib/execution/modules";
import { TAB_ITEMS } from "@/components/layout/project-tabs-config";
import type { Project } from "@/types/database";

const original = process.env.GITHUB_INTELLIGENCE_ENABLED;
afterEach(() => {
  if (original === undefined) delete process.env.GITHUB_INTELLIGENCE_ENABLED;
  else process.env.GITHUB_INTELLIGENCE_ENABLED = original;
});

describe("feature flag (default OFF)", () => {
  it("is OFF unless explicitly 'true'", () => {
    delete process.env.GITHUB_INTELLIGENCE_ENABLED;
    expect(isGitHubIntelligenceFlagEnabled()).toBe(false);
    process.env.GITHUB_INTELLIGENCE_ENABLED = "false";
    expect(isGitHubIntelligenceFlagEnabled()).toBe(false);
    process.env.GITHUB_INTELLIGENCE_ENABLED = "1";
    expect(isGitHubIntelligenceFlagEnabled()).toBe(false);
    process.env.GITHUB_INTELLIGENCE_ENABLED = "true";
    expect(isGitHubIntelligenceFlagEnabled()).toBe(true);
  });
});

describe("software-project gating", () => {
  it("only 'software_development' qualifies", () => {
    expect(SOFTWARE_PROJECT_TYPE).toBe("software_development");
    expect(isSoftwareProjectType("software_development")).toBe(true);
    expect(isSoftwareProjectType("general")).toBe(false);
    expect(isSoftwareProjectType("residential_construction")).toBe(false);
    expect(isSoftwareProjectType(null)).toBe(false);
  });

  it("github_intelligence is NOT a default module for any project type", () => {
    // Nav only appears when the layout explicitly injects the module (flag ON +
    // software). It must never be a default, so non-software projects can never
    // surface it.
    for (const type of ["software_development", "general", "residential_construction", "ai_native_execution"] as const) {
      const modules = getEnabledModules({ project_type: type, enabled_modules: null } as Pick<Project, "project_type" | "enabled_modules">);
      expect(modules).not.toContain("github_intelligence");
    }
  });
});

describe("navigation entry", () => {
  it("exists and is gated by the github_intelligence module", () => {
    const item = TAB_ITEMS.find((t) => t.titleKey === "githubIntelligence");
    expect(item).toBeTruthy();
    expect(item!.module).toBe("github_intelligence");
    expect(item!.href).toBe("/projects/[projectId]/github");
  });
});
