// ============================================================================
// Project module visibility + AI-Native Project Execution™ type
// ============================================================================
// Guards the new project type (future platform prep): it must be a valid,
// selectable/storable ProjectType with sensible default modules, and must not
// change the behavior of existing types (backward compatibility).
// ============================================================================

import { describe, it, expect } from "vitest";
import { DEFAULT_MODULES, getEnabledModules, isModuleEnabled } from "@/lib/execution/modules";
import type { Project } from "@/types/database";

describe("AI-Native Project Execution project type", () => {
  it("is registered in DEFAULT_MODULES", () => {
    expect(DEFAULT_MODULES.ai_native_execution).toBeDefined();
    expect(DEFAULT_MODULES.ai_native_execution.length).toBeGreaterThan(0);
  });

  it("gets the core experience by default (incl. ai_recommendations + living_graph)", () => {
    const modules = getEnabledModules({ project_type: "ai_native_execution", enabled_modules: null } as Pick<
      Project,
      "project_type" | "enabled_modules"
    >);
    expect(modules).toContain("ai_recommendations");
    expect(modules).toContain("living_graph");
    expect(modules).toContain("overview");
  });

  it("respects an explicit enabled_modules list (identify-only; no forced AI modules)", () => {
    const modules = getEnabledModules({
      project_type: "ai_native_execution",
      enabled_modules: ["overview", "tasks"],
    } as Pick<Project, "project_type" | "enabled_modules">);
    expect(modules).toEqual(["overview", "tasks"]);
    expect(isModuleEnabled(
      { project_type: "ai_native_execution", enabled_modules: ["overview", "tasks"] } as Pick<
        Project,
        "project_type" | "enabled_modules"
      >,
      "reports",
    )).toBe(false);
  });

  it("does not change existing types (backward compatibility)", () => {
    expect(getEnabledModules({ project_type: "general", enabled_modules: null } as Pick<
      Project,
      "project_type" | "enabled_modules"
    >)).toEqual(DEFAULT_MODULES.general);
    expect(getEnabledModules({ project_type: "software_development", enabled_modules: null } as Pick<
      Project,
      "project_type" | "enabled_modules"
    >)).toEqual(DEFAULT_MODULES.software_development);
  });
});
