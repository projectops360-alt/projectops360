import { describe, it, expect } from "vitest";
import { canExportFullArchive, canExportBlueprint, canExport, canIncludeSensitiveEvidence } from "../rbac";
import { buildManifest } from "../manifest";
import { toCsv } from "../csv";
import { createZip, crc32 } from "../zip";
import {
  taskToTemplate, milestoneToPhase, riskToTemplate, memoryToLessons, ROLE_PLACEHOLDER,
  type SourceTask, type SourceMilestone, type SourceRisk, type SourceMemoryItem,
} from "../transform";
import { buildFullArchive } from "../full-archive";
import { buildBlueprint } from "../blueprint";
import type { ProjectBundle } from "../gather";
import { DEFAULT_FULL_ARCHIVE_OPTIONS, DEFAULT_BLUEPRINT_OPTIONS } from "../types";

// CAP — Project Export & Blueprint Generator

// ── RBAC ─────────────────────────────────────────────────────────────────────
describe("export RBAC", () => {
  it("Full Archive is PMO/Admin/Owner only (acceptance #9)", () => {
    expect(canExportFullArchive("owner")).toBe(true);
    expect(canExportFullArchive("admin")).toBe(true);
    expect(canExportFullArchive("member")).toBe(false);
    expect(canExportFullArchive("viewer")).toBe(false);
  });
  it("Blueprint allows PM (member) but never viewer", () => {
    expect(canExportBlueprint("member")).toBe(true);
    expect(canExportBlueprint("viewer")).toBe(false);
  });
  it("canExport routes by mode", () => {
    expect(canExport("member", "full_archive")).toBe(false);
    expect(canExport("member", "starter_blueprint")).toBe(true);
    expect(canExport("viewer", "starter_blueprint")).toBe(false);
  });
  it("sensitive evidence requires owner/admin", () => {
    expect(canIncludeSensitiveEvidence("member")).toBe(false);
    expect(canIncludeSensitiveEvidence("admin")).toBe(true);
  });
});

// ── Manifest ─────────────────────────────────────────────────────────────────
describe("export manifest (TASK 6)", () => {
  it("sets privacy mode by export mode and dedupes entities", () => {
    const m = buildManifest({
      exportId: "e1", projectId: "p1", projectName: "Mobile App", mode: "full_archive",
      exportedBy: "ada@x.io", exportedAt: "2026-06-28T00:00:00Z",
      includedEntities: ["tasks", "tasks", "risks"], excludedEntities: ["transcripts"],
      sourceProjectStatus: "completed", warnings: [],
    });
    expect(m.privacyMode).toBe("evidence_preserved");
    expect(m.includedEntities).toEqual(["tasks", "risks"]);
    expect(m.schemaVersion).toBe("1.0");
    expect(m.exportedBy).toBe("ada@x.io");
  });
  it("blueprint manifest is privacy_safe_reset; included entities never appear as excluded", () => {
    const m = buildManifest({
      exportId: "e2", projectId: "p1", projectName: "X", mode: "starter_blueprint",
      exportedBy: "x", exportedAt: "t", includedEntities: ["phases"], excludedEntities: ["phases", "project_memory"],
      sourceProjectStatus: "completed", warnings: [],
    });
    expect(m.privacyMode).toBe("privacy_safe_reset");
    expect(m.excludedEntities).toContain("project_memory");
    expect(m.excludedEntities).not.toContain("phases");
  });
});

// ── CSV ──────────────────────────────────────────────────────────────────────
describe("csv serializer", () => {
  it("quotes commas/quotes/newlines and renders null as empty", () => {
    const csv = toCsv([{ a: "x,y", b: 'he said "hi"', c: null }], ["a", "b", "c"]);
    expect(csv).toBe('a,b,c\r\n"x,y","he said ""hi""",');
  });
});

// ── ZIP ──────────────────────────────────────────────────────────────────────
describe("store-only zip writer", () => {
  it("produces a valid ZIP with local headers, central dir and EOCD", () => {
    const zip = createZip([{ name: "a.txt", data: "hello" }, { name: "b.json", data: "{}" }]);
    // Local file header signature.
    expect([zip[0], zip[1], zip[2], zip[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    // EOCD signature present near the end.
    const tail = Array.from(zip.slice(zip.length - 22, zip.length - 18));
    expect(tail).toEqual([0x50, 0x4b, 0x05, 0x06]);
    // EOCD total-entries field = 2.
    const dv = new DataView(zip.buffer, zip.byteLength - 22);
    expect(dv.getUint16(10, true)).toBe(2);
  });
  it("crc32 matches the known value for 'hello'", () => {
    expect(crc32(new TextEncoder().encode("hello")) >>> 0).toBe(0x3610a686);
  });
});

// ── Blueprint transforms (resets) ───────────────────────────────────────────
const srcTask = (over: Partial<SourceTask> = {}): SourceTask => ({
  id: "t1", milestone_id: "m1", title: "Build API", description: "d", status: "done", priority: "high",
  estimate_hours: 8, acceptance_criteria: "ac", order_index: 2, assigned_to: "user-123",
  start_date: "2026-01-01", end_date: "2026-01-05", completed_at: "2026-01-04", actual_hours: 10, ...over,
});

describe("blueprint transforms reset execution history (acceptance #5/#6)", () => {
  it("task → template: status planned, dates blank, owner → role placeholder", () => {
    const t = taskToTemplate(srcTask());
    expect(t.status).toBe("planned");
    expect(t.startDate).toBeNull();
    expect(t.endDate).toBeNull();
    expect(t.ownerRole).toBe(ROLE_PLACEHOLDER);
    // Structure preserved.
    expect(t.title).toBe("Build API");
    expect(t.phaseKey).toBe("m1");
    expect(t.estimateHours).toBe(8);
    // No actuals leak.
    expect(JSON.stringify(t)).not.toContain("user-123");
    expect(JSON.stringify(t)).not.toContain("2026-01-04");
  });
  it("does NOT mutate the source task (no-mutation rule TASK 7)", () => {
    const src = srcTask();
    taskToTemplate(src);
    expect(src.status).toBe("done");
    expect(src.assigned_to).toBe("user-123");
    expect(src.start_date).toBe("2026-01-01");
  });
  it("milestone → phase: status planned, dates reset", () => {
    const ms: SourceMilestone = { id: "m1", title: "Phase 1", description: null, status: "completed", order_index: 0, start_date: "2026-01-01", target_date: "2026-02-01", completed_date: "2026-01-30" };
    const p = milestoneToPhase(ms);
    expect(p.status).toBe("planned");
    expect(p.startDate).toBeNull();
    expect(p.targetDate).toBeNull();
    expect(p.title).toBe("Phase 1");
  });
  it("risk → template: reset to identified, owner/resolution dropped", () => {
    const r: SourceRisk = { id: "r1", title: "Vendor delay", category: "schedule", probability: "high", impact: "high", severity: "high", status: "resolved", mitigation_plan: "buffer", owner_user_id: "u9" };
    const t = riskToTemplate(r);
    expect(t.status).toBe("identified");
    expect(t.mitigationPlan).toBe("buffer");
    expect(JSON.stringify(t)).not.toContain("u9");
  });
  it("memory → lessons: only high/critical, summary only (no raw content)", () => {
    const items: SourceMemoryItem[] = [
      { title: "Big lesson", summary: "Keep buffers", ai_classification: "lesson", importance_level: "high" },
      { title: "Trivia", summary: "minor", ai_classification: "note", importance_level: "low" },
    ];
    const lessons = memoryToLessons(items);
    expect(lessons).toHaveLength(1);
    expect(lessons[0].title).toBe("Big lesson");
  });
});

// ── Builders over a bundle ───────────────────────────────────────────────────
function bundle(): ProjectBundle {
  return {
    project: { id: "p1", title_i18n: { en: "Mobile App" }, status: "completed", project_type: "software" },
    milestones: [{ id: "m1", title: "Phase 1", status: "completed", order_index: 0, start_date: "2026-01-01", target_date: "2026-02-01", completed_date: "2026-01-30" }],
    tasks: [{ id: "t1", milestone_id: "m1", title: "Build API", status: "done", order_index: 0, assigned_to: "user-123", start_date: "2026-01-01", completed_at: "2026-01-04", estimate_hours: 8 }],
    dependencies: [{ predecessor_id: "t1", successor_id: "t2", dependency_type: "finish_to_start" }],
    risks: [{ id: "r1", title: "Vendor delay", category: "schedule", severity: "high", status: "open", owner_user_id: "u9", mitigation_plan: "buffer" }],
    decisions: [{ id: "d1", title_i18n: { en: "Use Postgres" }, status: "approved" }],
    actionItems: [{ id: "a1", status: "completed" }],
    communications: [{ id: "c1" }],
    meetings: [{ id: "mt1", transcript: "SECRET TRANSCRIPT", title_i18n: { en: "Kickoff" } }],
    memory: [{ id: "pm1", title: "Lesson", summary: "buffers", importance_level: "high", ai_classification: "lesson", content: "RAW PRIVATE CONTENT" }],
    documents: [{ id: "doc1", title_i18n: { en: "Spec" }, document_type: "spec" }],
    stakeholders: [{ id: "s1", name: "Jane Client", influence: "high", interest: "high" }],
    budget: [{ id: "b1", actual_cost: 1000 }],
    closeout: { executiveSummary: "Done well" },
    warnings: [],
  };
}

describe("Full Archive builder (acceptance #4)", () => {
  it("includes project metadata, tasks, milestones, risks, decisions, closeout", () => {
    const r = buildFullArchive(bundle(), DEFAULT_FULL_ARCHIVE_OPTIONS, { projectName: "Mobile App", locale: "en", canIncludeSensitive: true });
    const names = r.files.map((f) => f.name);
    expect(names).toContain("project.json");
    expect(names).toContain("tasks.csv");
    expect(names).toContain("milestones.csv");
    expect(names).toContain("risks.csv");
    expect(names).toContain("decisions.csv");
    expect(names).toContain("closeout-report.json");
    expect(r.included).toContain("traceability");
  });
  it("excludes transcripts unless allowed, and strips them from meetings.json", () => {
    const r = buildFullArchive(bundle(), { ...DEFAULT_FULL_ARCHIVE_OPTIONS, includeTranscripts: false }, { projectName: "X", locale: "en", canIncludeSensitive: true });
    expect(r.excluded).toContain("transcripts");
    const meetings = r.files.find((f) => f.name === "meetings.json")!;
    expect(String(meetings.data)).not.toContain("SECRET TRANSCRIPT");
  });
  it("strips Project Memory when the role lacks permission even if requested", () => {
    const r = buildFullArchive(bundle(), { ...DEFAULT_FULL_ARCHIVE_OPTIONS, includeProjectMemory: true }, { projectName: "X", locale: "en", canIncludeSensitive: false });
    expect(r.excluded).toContain("project_memory");
    expect(r.files.find((f) => f.name === "project-memory.json")).toBeUndefined();
  });
});

describe("Starter Blueprint builder (acceptance #5/#6)", () => {
  it("emits blueprint.json + checklists and resets execution data", () => {
    const r = buildBlueprint(bundle(), DEFAULT_BLUEPRINT_OPTIONS, { projectName: "Mobile App" });
    const names = r.files.map((f) => f.name);
    expect(names).toContain("blueprint.json");
    expect(names).toContain("task-templates.csv");
    expect(names).toContain("starter-checklist.md");
    const bp = JSON.parse(String(r.files.find((f) => f.name === "blueprint.json")!.data));
    expect(bp.taskTemplates[0].status).toBe("planned");
    expect(bp.taskTemplates[0].ownerRole).toBe(ROLE_PLACEHOLDER);
    expect(bp.phases[0].status).toBe("planned");
  });
  it("NEVER carries raw memory, transcripts, owner identities, or actual dates by default", () => {
    const r = buildBlueprint(bundle(), DEFAULT_BLUEPRINT_OPTIONS, { projectName: "X" });
    const blob = r.files.map((f) => String(f.data)).join("\n");
    expect(blob).not.toContain("RAW PRIVATE CONTENT");
    expect(blob).not.toContain("SECRET TRANSCRIPT");
    expect(blob).not.toContain("user-123");
    expect(blob).not.toContain("2026-01-04");
    expect(r.excluded).toContain("project_memory");
    expect(r.excluded).toContain("transcripts");
  });
  it("preserves phase/task/dependency structure", () => {
    const r = buildBlueprint(bundle(), DEFAULT_BLUEPRINT_OPTIONS, { projectName: "X" });
    const bp = JSON.parse(String(r.files.find((f) => f.name === "blueprint.json")!.data));
    expect(bp.phases).toHaveLength(1);
    expect(bp.taskTemplates).toHaveLength(1);
    expect(bp.dependencies).toHaveLength(1);
    expect(bp.dependencies[0].predecessorKey).toBe("t1");
  });
});
