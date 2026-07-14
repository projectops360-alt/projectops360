import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WRITERS = {
  roadmap: "src/app/[locale]/(app)/projects/[projectId]/roadmap/actions.ts",
  dependencies: "src/app/[locale]/(app)/projects/[projectId]/execution-map/dependency-actions.ts",
  delivery: "src/app/[locale]/(app)/projects/[projectId]/delivery/actions.ts",
  importIntelligence: "src/lib/import-intelligence/execute.ts",
  templates: "src/lib/execution/template-service.ts",
  phase0Sync: "src/lib/sync/phase0-sync.ts",
  subtasks: "src/lib/subtasks/actions.ts",
  team: "src/app/[locale]/(app)/team/actions.ts",
} as const;

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("mining-ready writer coverage", () => {
  it.each(Object.entries(WRITERS))("routes %s through the controlled capture gateway", (_name, path) => {
    const contents = source(path);
    expect(contents).toContain("captureProcessMiningEvents");
    expect(contents).not.toContain('.from("project_event_log")');
    expect(contents).not.toContain('.from("project_event_objects")');
  });

  it("covers semantic task, milestone and dependency lifecycle changes", () => {
    const roadmap = source(WRITERS.roadmap);
    for (const builder of [
      "buildTaskCreatedEvents",
      "buildTaskMutationEvents",
      "buildTaskDeletedEvent",
      "buildMilestoneCreatedEvents",
      "buildMilestoneStatusTransitionEvent",
      "buildMilestoneDeletedEvent",
      "buildTaskDependencyEvent",
    ]) {
      expect(roadmap, builder).toContain(builder);
    }

    expect(source(WRITERS.dependencies)).toContain("buildTaskDependencyEvent");
    for (const path of [WRITERS.delivery, WRITERS.importIntelligence, WRITERS.templates, WRITERS.phase0Sync]) {
      expect(source(path)).toContain("buildTaskCreatedEvents");
      expect(source(path)).toContain("buildMilestoneCreatedEvents");
    }
    expect(source(WRITERS.subtasks)).toContain("buildTaskStatusTransitionEvent");
    expect(source(WRITERS.team)).toContain("buildTaskMutationEvents");
  });
});
