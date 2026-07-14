import { describe, expect, it } from "vitest";
import { projectSubroute, resolveScreen } from "../screens";

describe("Process Mining screen intelligence", () => {
  it("recognizes the Execution Map route family", () => {
    expect(projectSubroute("/projects/p1/execution-map/living-graph")).toBe("execution-map");
    for (const path of [
      "/projects/p1/execution-map",
      "/projects/p1/execution-map/living-graph",
      "/projects/p1/execution-map/milestone-flow",
      "/projects/p1/execution-map/variants",
      "/projects/p1/execution-map/root-causes",
      "/projects/p1/execution-map/kpis",
    ]) {
      const screen = resolveScreen(path, "en");
      expect(screen?.module, path).toBe("process_mining");
      expect(screen?.screen, path).toBe("process_mining_layer");
      expect(screen?.components.join(" "), path).toMatch(/Task cases/);
    }
  });

  it("keeps the screen contract explicit about canonical versus derived truth", () => {
    const screen = resolveScreen("/es/projects/p1/execution-map/root-causes", "es");
    expect(screen?.workflow).toMatch(/sin convertir el diseno visual en verdad/i);
    expect(screen?.components.join(" ")).toMatch(/estadistico/i);
  });
});
