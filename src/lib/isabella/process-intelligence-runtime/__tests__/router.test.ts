// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-UI-REALTIME-FINAL-INTEGRATION — router
// ============================================================================

import { describe, it, expect } from "vitest";
import { routeIsabellaQuestion, resolveNodeScope, isEngineRoute } from "@/lib/isabella/process-intelligence-runtime/router";

const P = { hasProject: true } as const;

describe("deterministic routing", () => {
  it("help/how-to → product_help (RAG)", () => {
    expect(routeIsabellaQuestion("How do I create a project?", P).route).toBe("product_help");
    expect(routeIsabellaQuestion("¿Dónde veo los riesgos?", P).route).toBe("product_help");
  });
  it("task list/count/filter → factual_project_data", () => {
    expect(routeIsabellaQuestion("Dame todas las tareas sin milestone", P).route).toBe("factual_project_data");
    expect(routeIsabellaQuestion("list all blocked tasks", P).route).toBe("factual_project_data");
  });
  it("daily status / attention → daily_diagnosis", () => {
    expect(routeIsabellaQuestion("What is happening in this project today?", P).route).toBe("daily_diagnosis");
    expect(routeIsabellaQuestion("¿Qué necesita atención hoy?", P).route).toBe("daily_diagnosis");
    expect(routeIsabellaQuestion("how is this project doing?", P).route).toBe("daily_diagnosis");
  });
  it("why / cause → root_cause", () => {
    expect(routeIsabellaQuestion("Why is this milestone blocked?", P).route).toBe("root_cause");
    expect(routeIsabellaQuestion("¿Cuál es la causa raíz del retraso?", P).route).toBe("root_cause");
  });
  it("what should I do next → recommendation", () => {
    expect(routeIsabellaQuestion("What should I do next?", P).route).toBe("recommendation");
    expect(routeIsabellaQuestion("¿Qué debo hacer ahora?", P).route).toBe("recommendation");
  });
  it("status + recommendation in one ask → mixed", () => {
    expect(routeIsabellaQuestion("What is happening and what should I do next?", P).route).toBe("mixed");
  });
});

describe("scope + clarification", () => {
  it("resolves node scope safely (never coordinates)", () => {
    expect(resolveNodeScope({ id: "m1", type: "milestone" })).toEqual({ milestoneId: "m1" });
    expect(resolveNodeScope({ id: "t1", type: "task" })).toEqual({ taskId: "t1" });
    expect(resolveNodeScope({ id: "s1", type: "subtask" })).toEqual({ taskId: "s1" });
    expect(resolveNodeScope({ id: "p1", type: "project" })).toEqual({});
    expect(resolveNodeScope(undefined)).toEqual({});
  });
  it("engine route with a selected node uses that scope (no project needed)", () => {
    const d = routeIsabellaQuestion("Why is this blocked?", { hasProject: false, selectedNode: { id: "m1", type: "milestone" } });
    expect(d.route).toBe("root_cause");
    expect(d.needsClarification).toBe(false);
    expect(d.scope).toEqual({ milestoneId: "m1" });
  });
  it("engine route with NO scope → needs clarification", () => {
    const d = routeIsabellaQuestion("What should I do next?", { hasProject: false });
    expect(d.route).toBe("recommendation");
    expect(d.needsClarification).toBe(true);
  });
  it("isEngineRoute flags engine routes", () => {
    expect((["daily_diagnosis", "root_cause", "recommendation", "mixed"] as const).every(isEngineRoute)).toBe(true);
    expect(isEngineRoute("product_help")).toBe(false);
    expect(isEngineRoute("factual_project_data")).toBe(false);
  });
});
