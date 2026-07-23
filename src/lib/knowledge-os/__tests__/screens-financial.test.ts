import { describe, expect, it } from "vitest";
import { resolveScreen } from "../screens";

describe("financial setup screen resolution", () => {
  it("resolves a project budget route as Financial Setup", () => {
    const screen = resolveScreen("/projects/project-1/budget", "en");

    expect(screen?.module).toBe("financial_control");
    expect(screen?.screen).toBe("financial_setup");
    expect(screen?.screen).not.toBe("projects_list");
    expect(screen?.components.join(" ")).toMatch(/rate|planned hours/i);
  });

  it("localizes the Financial Setup context to Spanish", () => {
    const screen = resolveScreen("/es/projects/project-1/budget", "es");

    expect(screen?.pageTitle).toBe("Configuración financiera");
    expect(screen?.workflow).toMatch(/estimado de costos PMO/i);
  });
});
