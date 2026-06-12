import { describe, it, expect } from "vitest";
import { PROJECT_TEMPLATES, getTemplateForType } from "../templates";
import { calculateCriticalPath } from "../critical-path";
import { DEFAULT_MODULES, getEnabledModules } from "../modules";
import { TASK_TO_UNIVERSAL_STATUS } from "../constants";
import type { TaskStatus } from "@/types/database";

describe("project templates", () => {
  const templates = Object.values(PROJECT_TEMPLATES);

  it("provides software, data center, and residential templates", () => {
    expect(getTemplateForType("software_development")).not.toBeNull();
    expect(getTemplateForType("data_center_construction")).not.toBeNull();
    expect(getTemplateForType("residential_construction")).not.toBeNull();
    expect(getTemplateForType("general")).toBeNull();
  });

  it("has unique task keys and resolvable dependencies in every template", () => {
    for (const template of templates) {
      const keys = template.phases.flatMap((p) => p.tasks.map((t) => t.key));
      expect(new Set(keys).size).toBe(keys.length);
      const keySet = new Set(keys);
      for (const phase of template.phases) {
        for (const task of phase.tasks) {
          for (const dep of task.depends_on ?? []) {
            expect(keySet.has(dep)).toBe(true);
          }
        }
      }
    }
  });

  it("has bilingual titles everywhere", () => {
    for (const template of templates) {
      expect(template.name_i18n.en).toBeTruthy();
      expect(template.name_i18n.es).toBeTruthy();
      for (const phase of template.phases) {
        expect(phase.title_i18n.en).toBeTruthy();
        expect(phase.title_i18n.es).toBeTruthy();
        for (const task of phase.tasks) {
          expect(task.title_i18n.en).toBeTruthy();
          expect(task.title_i18n.es).toBeTruthy();
        }
      }
    }
  });

  it("schedules every template without cycles via the CPM engine", () => {
    for (const template of templates) {
      const tasks = template.phases.flatMap((p) =>
        p.tasks.map((t) => ({
          id: t.key,
          start_date: null,
          end_date: null,
          duration_days: t.estimated_duration_days,
          estimate_hours: null,
          status: "not_started" as const,
        })),
      );
      const deps = template.phases.flatMap((p) =>
        p.tasks.flatMap((t) =>
          (t.depends_on ?? []).map((d) => ({
            predecessor_id: d,
            successor_id: t.key,
            dependency_type: "finish_to_start" as const,
            lag_days: 0,
          })),
        ),
      );
      const result = calculateCriticalPath(tasks, deps, [], "2026-06-15");
      expect(result.cycleTaskIds).toHaveLength(0);
      expect(result.criticalTaskIds.length).toBeGreaterThan(0);
      expect(result.projectDurationDays).toBeGreaterThan(0);
    }
  });
});

describe("module visibility", () => {
  it("hides construction modules for software projects but keeps core", () => {
    const modules = DEFAULT_MODULES.software_development;
    expect(modules).toContain("critical_path");
    expect(modules).toContain("budget");
    expect(modules).toContain("materials"); // tools & licenses
    expect(modules).not.toContain("rfis");
    expect(modules).not.toContain("drawing_intelligence");
  });

  it("emphasizes construction modules for data center projects", () => {
    const modules = DEFAULT_MODULES.data_center_construction;
    for (const m of ["materials", "equipment", "rfis", "submittals", "procurement", "drawing_intelligence", "critical_path"] as const) {
      expect(modules).toContain(m);
    }
  });

  it("lets an explicit enabled_modules list override the defaults", () => {
    const modules = getEnabledModules({
      project_type: "software_development",
      enabled_modules: ["overview", "tasks", "rfis"],
    });
    expect(modules).toEqual(["overview", "tasks", "rfis"]);
  });
});

describe("universal status mapping", () => {
  it("maps every task status to a universal status", () => {
    const allStatuses: TaskStatus[] = [
      "not_started", "prompt_ready", "sent_to_ai", "in_progress",
      "implemented", "tested", "done", "blocked", "deferred",
    ];
    for (const s of allStatuses) {
      expect(TASK_TO_UNIVERSAL_STATUS[s]).toBeTruthy();
    }
    expect(TASK_TO_UNIVERSAL_STATUS.not_started).toBe("planned");
    expect(TASK_TO_UNIVERSAL_STATUS.prompt_ready).toBe("ready");
    expect(TASK_TO_UNIVERSAL_STATUS.done).toBe("completed");
    expect(TASK_TO_UNIVERSAL_STATUS.tested).toBe("completed");
  });
});
