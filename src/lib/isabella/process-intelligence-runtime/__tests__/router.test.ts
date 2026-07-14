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
  it("current Process Mining facts → process_mining_summary", () => {
    expect(routeIsabellaQuestion("¿Cuántos eventos canónicos y casos tenemos?", P).route).toBe("process_mining_summary");
    expect(routeIsabellaQuestion("Show the Process Mining integrity status", P).route).toBe("process_mining_summary");
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

// ISABELLA-INTENT-FALLBACK-TO-KNOWLEDGE — a knowledge / "how it works" question
// must route to product_help (Knowledge OS / RAG), NEVER daily_diagnosis. This is
// the reported P0: with Process Intelligence on, "¿cómo funciona el living graph?"
// returned the Daily Diagnosis briefing.
describe("knowledge / how-it-works routing (never Daily Diagnosis)", () => {
  it("'how it works / what is / para qué sirve' → product_help (EN/ES)", () => {
    for (const q of [
      "¿cómo funciona el living graph?",
      "how does the workboard work",
      "qué es el execution map",
      "what is the Execution Map?",
      "¿para qué sirve el workboard?",
      "explain the Living Graph",
      "what is Process Mining?",
      "how does Process Mining work?",
    ]) {
      const d = routeIsabellaQuestion(q, P);
      expect(d.route, q).toBe("product_help");
      expect(d.route, q).not.toBe("daily_diagnosis");
    }
  });
  it("'¿por qué se llama living graph?' → product_help, not root_cause", () => {
    const d = routeIsabellaQuestion("¿por qué se llama living graph?", P);
    expect(d.route).toBe("product_help");
    expect(d.route).not.toBe("root_cause");
  });
  it("but 'cómo va el proyecto' still → daily_diagnosis (no regression)", () => {
    expect(routeIsabellaQuestion("cómo va el proyecto", P).route).toBe("daily_diagnosis");
    expect(routeIsabellaQuestion("What needs my attention?", P).route).toBe("daily_diagnosis");
  });
});

// ISABELLA-SCREEN-CONTEXT-EXPLANATION — UI/screen questions MUST take priority
// over the engines and never leak into Daily Diagnosis (the reported P0).
describe("screen-context explanation priority", () => {
  const RES = { ...P, screenContext: { module: "project_team", screen: "project_participants", pathname: "/projects/p1/team" } };
  const TASK = { ...P, screenContext: { module: "workboard", screen: "task_detail", pathname: "/projects/p1/workboard" } };
  const PROCESS = { ...P, screenContext: { module: "process_mining", screen: "living_graph", pathname: "/projects/p1/execution-map/living-graph" } };

  it("A · Resources + 'member está unassigned' → screen_context_explanation (not daily_diagnosis)", () => {
    const d = routeIsabellaQuestion("explícame qué significa member está unassigned", RES);
    expect(d.route).toBe("screen_context_explanation");
    expect(d.route).not.toBe("daily_diagnosis");
  });
  it("B · Resources + 'explícame qué significa unassigned' → screen_context_explanation", () => {
    expect(routeIsabellaQuestion("explícame qué significa unassigned", RES).route).toBe("screen_context_explanation");
  });
  it("C · Resources + 'Explain this screen' → screen_context_explanation", () => {
    expect(routeIsabellaQuestion("Explain this screen", RES).route).toBe("screen_context_explanation");
  });
  it("D · Task detail + 'owner unassigned' → screen_context_explanation (task domain)", () => {
    expect(routeIsabellaQuestion("qué significa owner unassigned?", TASK).route).toBe("screen_context_explanation");
  });
  it("routes even without a resolvable screen (safety), never to an engine", () => {
    const d = routeIsabellaQuestion("What does Unassigned mean?", { hasProject: true });
    expect(d.route).toBe("screen_context_explanation");
    expect(isEngineRoute(d.route)).toBe(false);
  });
  it("Process Mining screen explanations stay deterministic", () => {
    expect(routeIsabellaQuestion("Explain this screen", PROCESS).route).toBe("screen_context_explanation");
  });
  it("UI question is never treated as an engine route", () => {
    expect(isEngineRoute("screen_context_explanation")).toBe(false);
  });
});

// Guardrail: the pre-existing engine/factual/help routes still work (E/F/G/H).
describe("existing routes still work after screen-help was added", () => {
  it("E · daily status → daily_diagnosis", () => {
    expect(routeIsabellaQuestion("¿Qué está pasando en este proyecto hoy?", P).route).toBe("daily_diagnosis");
  });
  it("F · recommendation → recommendation", () => {
    expect(routeIsabellaQuestion("¿Qué debería revisar primero?", P).route).toBe("recommendation");
  });
  it("G · factual data → factual_project_data", () => {
    expect(routeIsabellaQuestion("Dame todas las tareas sin responsable", P).route).toBe("factual_project_data");
  });
  it("H · how-to → product_help", () => {
    expect(routeIsabellaQuestion("¿Cómo agrego un participante?", P).route).toBe("product_help");
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
    expect(isEngineRoute("process_mining_summary")).toBe(false);
  });
});
