// ============================================================================
// ISABELLA-TASK-REPORT-VERIFIED-PROJECT-DATA — guards
// ============================================================================
// Protects Isabella's deterministic task report: EN/ES (+ typo/mixed-language)
// intent detection, deterministic title-desc sorting with a stable tie-breaker,
// a VERIFIED (never low-confidence) report answer, honest empty/no-project/
// unauthorized/unavailable states, and the hard rule that Isabella never
// answers "no tengo una respuesta verificada" when project data exists.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  buildTaskReportGuideAnswer,
  detectTaskReportIntent,
  sortTaskReportRows,
  type TaskReportData,
  type TaskReportOutcome,
  type TaskReportRow,
} from "@/lib/isabella/task-report";

const EXPERT = { key: "isabella", displayName: "Isabella", title: "AI Advisor" };
const NO_VERIFIED_ES = "no tengo una respuesta verificada";

let seq = 0;
function row(overrides: Partial<TaskReportRow> = {}): TaskReportRow {
  seq += 1;
  return {
    id: overrides.id ?? `t-${seq}`,
    title: overrides.title ?? `Task ${seq}`,
    status: overrides.status ?? "not_started",
    milestoneId: overrides.milestoneId ?? null,
    milestoneTitle: overrides.milestoneTitle ?? null,
    priority: overrides.priority ?? "p2",
    ownerId: overrides.ownerId ?? null,
    ownerName: overrides.ownerName ?? null,
    dueDate: overrides.dueDate ?? null,
    updatedAt: overrides.updatedAt ?? "2026-07-01T00:00:00.000Z",
    createdAt: overrides.createdAt ?? "2026-07-01T00:00:00.000Z",
    isBlocked: overrides.isBlocked ?? false,
    blockerReason: overrides.blockerReason ?? null,
    isSubtask: false,
  };
}

// ── Intent detection ─────────────────────────────────────────────────────────

describe("detectTaskReportIntent", () => {
  it("detects the exact reported bug (mixed Spanish, typos, title desc)", () => {
    const intent = detectTaskReportIntent(
      "isabell anecesito un reporte con todas la tareas por title ordenado por desc",
    );
    expect(intent).toEqual({ sortBy: "title", sortDirection: "desc" });
  });

  it("detects Spanish report intents", () => {
    for (const q of [
      "necesito un reporte con todas las tareas",
      "reporte de tareas",
      "lista todas las tareas",
      "muéstrame todas las tareas",
      "dame la tabla de tareas",
    ]) {
      expect(detectTaskReportIntent(q), q).not.toBeNull();
    }
  });

  it("detects English report intents", () => {
    for (const q of ["show all tasks", "task report", "all tasks by title desc", "list all tasks"]) {
      expect(detectTaskReportIntent(q), q).not.toBeNull();
    }
  });

  it("resolves sort field aliases (title/status/priority/milestone/due)", () => {
    expect(detectTaskReportIntent("reporte de tareas por título")?.sortBy).toBe("title");
    expect(detectTaskReportIntent("reporte de tareas por nombre")?.sortBy).toBe("title");
    expect(detectTaskReportIntent("task report by name")?.sortBy).toBe("title");
    expect(detectTaskReportIntent("reporte de tareas por estado")?.sortBy).toBe("status");
    expect(detectTaskReportIntent("task report by status")?.sortBy).toBe("status");
    expect(detectTaskReportIntent("reporte de tareas por prioridad")?.sortBy).toBe("priority");
    expect(detectTaskReportIntent("reporte de tareas por hito")?.sortBy).toBe("milestone");
    expect(detectTaskReportIntent("reporte de tareas por fecha de entrega")?.sortBy).toBe("due");
  });

  it("resolves direction aliases (desc/asc, descendente/ascendente, z-a/a-z)", () => {
    expect(detectTaskReportIntent("all tasks title descending")?.sortDirection).toBe("desc");
    expect(detectTaskReportIntent("reporte de tareas por título descendente")?.sortDirection).toBe("desc");
    expect(detectTaskReportIntent("all tasks z-a")?.sortDirection).toBe("desc");
    expect(detectTaskReportIntent("reporte de tareas ascendente")?.sortDirection).toBe("asc");
    expect(detectTaskReportIntent("all tasks a-z")?.sortDirection).toBe("asc");
  });

  it("defaults to title ascending when unspecified", () => {
    expect(detectTaskReportIntent("reporte de tareas")).toEqual({
      sortBy: "title",
      sortDirection: "asc",
    });
  });

  it("does NOT hijack non-report questions that merely mention tasks", () => {
    for (const q of [
      "¿cómo creo una tarea?",
      "how do I create a task?",
      "show me how tasks work",
      "¿de dónde viene esta tarea?",
      "explícame esta pantalla",
      "",
    ]) {
      expect(detectTaskReportIntent(q), q).toBeNull();
    }
  });
});

// ── Deterministic sorting ─────────────────────────────────────────────────────

describe("sortTaskReportRows", () => {
  it("sorts by title descending, case-insensitively", () => {
    const rows = [
      row({ id: "a", title: "apple" }),
      row({ id: "b", title: "Banana" }),
      row({ id: "c", title: "cherry" }),
    ];
    const out = sortTaskReportRows(rows, "title", "desc").map((r) => r.title);
    expect(out).toEqual(["cherry", "Banana", "apple"]);
  });

  it("sorts by title ascending, case-insensitively", () => {
    const rows = [row({ title: "Zebra" }), row({ title: "alpha" }), row({ title: "mango" })];
    const out = sortTaskReportRows(rows, "title", "asc").map((r) => r.title);
    expect(out).toEqual(["alpha", "mango", "Zebra"]);
  });

  it("tie-breaks deterministically by createdAt DESC then id ASC", () => {
    const rows = [
      row({ id: "z", title: "Same", createdAt: "2026-01-01T00:00:00.000Z" }),
      row({ id: "a", title: "Same", createdAt: "2026-06-01T00:00:00.000Z" }),
      row({ id: "m", title: "Same", createdAt: "2026-06-01T00:00:00.000Z" }),
    ];
    const out = sortTaskReportRows(rows, "title", "desc").map((r) => r.id);
    // newest createdAt first (a & m tie → id ASC: a before m), then older z last
    expect(out).toEqual(["a", "m", "z"]);
  });

  it("keeps missing values last regardless of direction", () => {
    const rows = [
      row({ id: "has", dueDate: "2026-07-10" }),
      row({ id: "none", dueDate: null }),
    ];
    expect(sortTaskReportRows(rows, "due", "asc").map((r) => r.id)).toEqual(["has", "none"]);
    expect(sortTaskReportRows(rows, "due", "desc").map((r) => r.id)).toEqual(["has", "none"]);
  });

  it("does not mutate the input array", () => {
    const rows = [row({ title: "b" }), row({ title: "a" })];
    const before = rows.map((r) => r.title);
    sortTaskReportRows(rows, "title", "asc");
    expect(rows.map((r) => r.title)).toEqual(before);
  });

  it("is replay-stable (same input → same output)", () => {
    const rows = [row({ title: "b" }), row({ title: "a" }), row({ title: "c" })];
    const a = sortTaskReportRows(rows, "title", "desc").map((r) => r.id);
    const b = sortTaskReportRows(rows, "title", "desc").map((r) => r.id);
    expect(a).toEqual(b);
  });
});

// ── VERIFIED report answer ─────────────────────────────────────────────────────

function reportData(overrides: Partial<TaskReportData> = {}): TaskReportData {
  const rows =
    overrides.rows ??
    sortTaskReportRows(
      [
        row({ title: "Zoning review", status: "in_progress", priority: "p1", milestoneTitle: "Design" }),
        row({ title: "Anchor bolts", status: "done", priority: "p2", ownerName: "Carla" }),
      ],
      "title",
      "desc",
    );
  return {
    projectName: "Tower A",
    rows,
    total: overrides.total ?? rows.length,
    displayed: overrides.displayed ?? rows.length,
    truncated: overrides.truncated ?? false,
    sortBy: overrides.sortBy ?? "title",
    sortDirection: overrides.sortDirection ?? "desc",
  };
}

describe("buildTaskReportGuideAnswer — verified report", () => {
  it("produces a VERIFIED (not low-confidence) answer with scope, sort and count", () => {
    const ans = buildTaskReportGuideAnswer({ ok: true, data: reportData() }, "es", EXPERT);
    expect(ans.tier).toBe("verified");
    expect(ans.tier).not.toBe("ai_suggestion");
    expect(ans.grounded).toBe(true);
    expect(ans.confidenceScore).toBe(1);
    expect(ans.answer.toLowerCase()).not.toContain(NO_VERIFIED_ES);
    expect(ans.answer).toContain("Tower A");
    expect(ans.answer).toContain("título"); // ES orthography preserved
    expect(ans.answer).toContain("descendente (Z → A)");
    expect(ans.answer).toContain("Total: 2 tareas");
  });

  it("lists every authorized task and renders missing optional fields honestly", () => {
    const ans = buildTaskReportGuideAnswer({ ok: true, data: reportData() }, "en", EXPERT);
    expect(ans.answer).toContain("Zoning review");
    expect(ans.answer).toContain("Anchor bolts");
    expect(ans.answer).toContain("Carla"); // resolved owner
    expect(ans.answer).toContain("—"); // honest placeholder for the ownerless / dateless row
    expect(ans.answer).toContain("| # | Title | Status | Milestone | Priority | Owner | Due |");
  });

  it("attributes the answer to live project-task data (verified source)", () => {
    const ans = buildTaskReportGuideAnswer({ ok: true, data: reportData() }, "en", EXPERT);
    expect(ans.sources).toHaveLength(1);
    expect(ans.sources[0].tier).toBe("verified");
    expect(ans.sources[0].slug).toBe("project-tasks");
  });

  it("offers sort follow-ups that re-trigger the report intent", () => {
    const ans = buildTaskReportGuideAnswer({ ok: true, data: reportData() }, "es", EXPERT);
    expect(ans.followups.length).toBeGreaterThan(0);
    for (const f of ans.followups) {
      expect(detectTaskReportIntent(f), f).not.toBeNull();
    }
  });

  it("notes truncation only when the report was actually truncated", () => {
    const truncated = buildTaskReportGuideAnswer(
      { ok: true, data: reportData({ total: 120, displayed: 50, truncated: true }) },
      "es",
      EXPERT,
    );
    expect(truncated.answer).toContain("Mostrando las primeras 50 de 120");

    const whole = buildTaskReportGuideAnswer({ ok: true, data: reportData() }, "es", EXPERT);
    expect(whole.answer).not.toContain("Mostrando las primeras");
  });
});

// ── Honest empty / error / unauthorized states ─────────────────────────────────

describe("buildTaskReportGuideAnswer — honest non-report states", () => {
  it("empty project → clear no-tasks message, never a fabricated table", () => {
    const data = reportData({ rows: [], total: 0, displayed: 0 });
    const ans = buildTaskReportGuideAnswer({ ok: true, data }, "es", EXPERT);
    expect(ans.answer).toContain("no tiene tareas visibles");
    expect(ans.answer).not.toContain("| # |");
    expect(ans.answer.toLowerCase()).not.toContain(NO_VERIFIED_ES);
  });

  it("no project context → asks the user to open/select a project", () => {
    const outcome: TaskReportOutcome = { ok: false, reason: "no_project" };
    expect(buildTaskReportGuideAnswer(outcome, "es", EXPERT).answer).toContain("selecciones un proyecto");
    expect(buildTaskReportGuideAnswer(outcome, "en", EXPERT).answer).toContain("select a project");
  });

  it("unauthorized → denial, no data, no invented tasks", () => {
    const outcome: TaskReportOutcome = { ok: false, reason: "not_authorized" };
    const ans = buildTaskReportGuideAnswer(outcome, "es", EXPERT);
    expect(ans.answer).toContain("No tienes permiso");
    expect(ans.answer).not.toContain("| # |");
    expect(ans.sources).toHaveLength(0);
  });

  it("retrieval failure → app-data error, never a hallucinated report", () => {
    const outcome: TaskReportOutcome = { ok: false, reason: "unavailable" };
    const ans = buildTaskReportGuideAnswer(outcome, "es", EXPERT);
    expect(ans.answer).toContain("no pude cargar las tareas");
    expect(ans.answer).not.toContain("| # |");
    expect(ans.answer.toLowerCase()).not.toContain(NO_VERIFIED_ES);
  });
});
