// ============================================================================
// ISABELLA-SCREEN-CONTEXT-EXPLANATION — deterministic screen/UI-label help
// ============================================================================
// P0: UI-meaning questions must be answered from screen context, never routed
// to Daily Diagnosis, and Resources "Unassigned" (role slot with no person) must
// never be conflated with a task without an owner.

import { describe, it, expect } from "vitest";
import {
  isScreenExplanationIntent,
  resolveScreenArea,
  answerScreenHelp,
} from "@/lib/isabella/screen-help";

const RESOURCES = { module: "project_team", screen: "project_participants", pathname: "/projects/p1/team" };
const TASK = { module: "workboard", screen: "task_detail", pathname: "/projects/p1/workboard" };
const PROCESS_MINING = { module: "process_mining", screen: "living_graph", pathname: "/projects/p1/execution-map/living-graph" };
const FINANCIAL = { module: "financial_control", screen: "financial_cockpit", pathname: "/projects/p1/budget" };

describe("intent detection", () => {
  it("detects UI-meaning questions (EN + ES, typos, seeded token)", () => {
    for (const q of [
      "Explain this screen",
      "explain_screen",
      "Explícame esta pantalla",
      "explícame qué significa member está unassigned",
      "explícame qué significa unassigned?",
      "qué significa unassigned",
      "What does Unassigned mean?",
      "What does Member mean?",
      "What does Permission mean?",
      "Explain this column",
      "Qué significa que member esté unassigned?",
    ]) {
      expect(isScreenExplanationIntent(q)).toBe(true);
    }
  });

  it("does NOT flag process/data questions as screen-help", () => {
    for (const q of [
      "¿Qué está pasando en este proyecto hoy?",
      "What should I do next?",
      "Dame todas las tareas sin responsable",
      "why is this milestone blocked?",
    ]) {
      expect(isScreenExplanationIntent(q)).toBe(false);
    }
  });
});

describe("area resolution", () => {
  it("resolves the participants screen to resources", () => {
    expect(resolveScreenArea(RESOURCES)).toBe("resources");
  });
  it("resolves task/workboard surfaces to task", () => {
    expect(resolveScreenArea(TASK)).toBe("task");
  });
  it("resolves Execution Map process surfaces to process_mining", () => {
    expect(resolveScreenArea(PROCESS_MINING)).toBe("process_mining");
    expect(resolveScreenArea({ pathname: "/projects/p1/execution-map/milestone-flow" })).toBe("process_mining");
    expect(resolveScreenArea({ pathname: "/projects/p1/execution-map/root-causes" })).toBe("process_mining");
  });
  it("resolves the integrated budget cockpit to financial", () => {
    expect(resolveScreenArea(FINANCIAL)).toBe("financial");
    expect(resolveScreenArea({ pathname: "/projects/p1/budget" })).toBe("financial");
  });
  it("missing context → unknown", () => {
    expect(resolveScreenArea(undefined)).toBe("unknown");
    expect(resolveScreenArea({})).toBe("unknown");
  });
});

describe("Resources 'Unassigned' explanation (A/B)", () => {
  it("explains a role slot with no person — NOT a task without owner (ES)", () => {
    const r = answerScreenHelp("explícame qué significa member está unassigned", RESOURCES, "es");
    expect(r.area).toBe("resources");
    expect(r.confident).toBe(true);
    expect(r.answer.toLowerCase()).toContain("rol");
    expect(r.answer.toLowerCase()).toMatch(/sin asignar|persona/);
    // It explicitly distinguishes the role slot from a task without owner …
    expect(r.answer.toLowerCase()).toMatch(/distinto|no de una tarea|no es una tarea/);
    // … but it is NOT the Daily Diagnosis answer (no daily/diagnosis framing).
    expect(r.answer.toLowerCase()).not.toMatch(/\bdaily\b|diagn[oó]stic|project status|milestones|daily focus/);
  });

  it("simple 'unassigned' on Resources → resources-specific explanation", () => {
    const r = answerScreenHelp("explícame qué significa unassigned", RESOURCES, "es");
    expect(r.area).toBe("resources");
    expect(r.term).toBe("unassigned");
    expect(r.answer.toLowerCase()).toContain("rol");
  });

  it("English member/permission/access terms resolve on Resources", () => {
    expect(answerScreenHelp("What does Member mean?", RESOURCES, "en").answer).toContain("Member");
    expect(answerScreenHelp("What does Permission mean?", RESOURCES, "en").answer).toContain("Permission");
    expect(answerScreenHelp("What does Access mean?", RESOURCES, "en").answer).toContain("Access");
  });
});

describe("Explain this screen (C)", () => {
  it("explains the Resources participants screen, not Open Projects", () => {
    const r = answerScreenHelp("Explain this screen", RESOURCES, "en");
    expect(r.area).toBe("resources");
    expect(r.confident).toBe(true);
    expect(r.answer).toContain("Who participates in this project");
    expect(r.answer).toContain("Member");
    expect(r.answer.toLowerCase()).not.toContain("open projects");
    expect(r.answer.toLowerCase()).not.toMatch(/projects list|browse .* projects/);
  });
});

describe("Task owner unassigned (D) — distinct domain", () => {
  it("explains a task with no owner, not a project role slot", () => {
    const r = answerScreenHelp("qué significa owner unassigned?", TASK, "es");
    expect(r.area).toBe("task");
    expect(r.confident).toBe(true);
    expect(r.answer.toLowerCase()).toMatch(/tarea/);
    expect(r.answer.toLowerCase()).toContain("owner");
  });
});

describe("Process Mining screen/program context", () => {
  it("explains the three readable levels and preserves the causality boundary", () => {
    const result = answerScreenHelp("Explain this screen", PROCESS_MINING, "en");
    expect(result.area).toBe("process_mining");
    expect(result.confident).toBe(true);
    expect(result.answer).toMatch(/Task cases/);
    expect(result.answer).toMatch(/Process/);
    expect(result.answer).toMatch(/Full audit/);
    expect(result.answer).toMatch(/temporal order is not causality/i);
  });

  it("explains full audit from canonical events, not visual layout", () => {
    const result = answerScreenHelp("What does Full audit mean?", PROCESS_MINING, "en");
    expect(result.term).toBe("full_audit");
    expect(result.answer).toMatch(/canonical event ledger/i);
    expect(result.answer).toMatch(/caused_by/);
  });

  it("describes statistical root cause as association, not confirmed cause", () => {
    const result = answerScreenHelp(
      "Explain this screen",
      { module: "process_mining", screen: "root_causes", pathname: "/projects/p1/execution-map/root-causes" },
      "en",
    );
    expect(result.answer).toMatch(/statistical associations/i);
    expect(result.answer).toMatch(/not a confirmed cause/i);
  });
});

describe("Financial control screen context", () => {
  it("explains the integrated PMO cockpit without inventing a second budget", () => {
    const result = answerScreenHelp("Explain this screen", FINANCIAL, "en");
    expect(result.area).toBe("financial");
    expect(result.confident).toBe(true);
    expect(result.answer).toMatch(/PMO view integrated/i);
    expect(result.answer).toMatch(/neither a second budget nor another Gantt/i);
    expect(result.answer).toMatch(/explain, compare, and trace/i);
  });

  it("preserves cash-flow and human-approval boundaries", () => {
    const payment = answerScreenHelp("What does payment mean?", FINANCIAL, "en");
    const queue = answerScreenHelp("What does approval queue mean?", FINANCIAL, "en");
    expect(payment.term).toBe("payment");
    expect(payment.answer).toMatch(/cash/i);
    expect(payment.answer).toMatch(/separately from cost recognition/i);
    expect(queue.term).toBe("approval_queue");
    expect(queue.answer).toMatch(/cannot approve, post, release, reopen, or execute/i);
  });
});

describe("Safety when screen context is missing/ambiguous (I)", () => {
  it("returns a clarification and is NOT confident (no Verified 100%)", () => {
    const r = answerScreenHelp("What does Unassigned mean?", undefined, "en");
    expect(r.area).toBe("unknown");
    expect(r.confident).toBe(false);
    expect(r.answer.toLowerCase()).toContain("screen context");
    expect(r.answer.toLowerCase()).toContain("participants");
  });
});
