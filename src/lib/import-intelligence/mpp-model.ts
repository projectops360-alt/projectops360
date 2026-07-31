// ============================================================================
// ProjectOps360° — Microsoft Project (.mpp) → ParsedFile (pure)
// ============================================================================
// The .mpp binary is decoded to MPXJ's JSON by a Java converter running in a
// Vercel Sandbox (see docker/mpp-converter). Everything from that JSON onwards
// is plain TypeScript, testable without a JVM — which is the point of splitting
// it here: the one piece CI cannot run is kept to "read file, write JSON".
//
// This module deliberately produces TABLES rather than canonical entities. The
// importer already knows how to read a task table — column synonyms, status and
// priority normalisation, dependency phrases, project-type detection, the AI
// pass. Emitting entities directly would fork all of that into a second,
// .mpp-only path that would then drift.
// ============================================================================

import type { ParsedFile, ParsedTable } from "@/types/import-intelligence";

/** The subset of MPXJ's JSON this mapper relies on. */
export interface MpxjTask {
  id?: number;
  unique_id?: number;
  name?: string;
  wbs?: string;
  outline_number?: string;
  outline_level?: number;
  parent_task_unique_id?: number;
  /** Seconds. MPXJ normalises every duration unit to this. */
  duration?: number;
  work?: number;
  start?: string;
  finish?: string;
  milestone?: boolean;
  summary?: boolean;
  critical?: boolean;
  predecessors?: { predecessor_task_unique_id?: number; type?: string }[];
}

export interface MpxjResource {
  unique_id?: number;
  id?: number;
  name?: string;
  type?: string;
}

export interface MpxjAssignment {
  task_unique_id?: number;
  /** Absent when the assignment carries no resource — common in real files. */
  resource_unique_id?: number;
  work?: number;
}

export interface MpxjProject {
  property_values?: Record<string, unknown>;
  tasks?: MpxjTask[];
  resources?: MpxjResource[];
  assignments?: MpxjAssignment[];
}

/**
 * Hours in a working day, used only to render a duration a human recognises.
 *
 * MPXJ reports seconds; Microsoft Project shows "0.5 days" for the same value
 * because a day is 8 working hours, not 24. Printing 4h as "0.17 days" would
 * silently disagree with the plan the user is looking at. The project calendar
 * can define something else, but no real plan in the wild has been seen to,
 * and guessing per-calendar would make the number unpredictable.
 */
const WORKING_HOURS_PER_DAY = 8;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Seconds → working days, to two decimals. */
export function secondsToDays(seconds: number | undefined | null): number | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
  return round2(seconds / 3600 / WORKING_HOURS_PER_DAY);
}

/** Seconds → hours, to two decimals. */
export function secondsToHours(seconds: number | undefined | null): number | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
  return round2(seconds / 3600);
}

/** MPXJ emits `2013-06-06T09:00:00.0`; the importer wants a plain date. */
export function toDateOnly(value: string | undefined | null): string {
  if (!value) return "";
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match ? match[1] : "";
}

/**
 * The outline level at which this plan's phases live.
 *
 * Not a constant, because plans wrap their work differently: the SAP plan this
 * was built against nests everything under a single "Proyecto …" task, so its
 * five phases sit at level 2, while a plan without that wrapper puts them at
 * level 1. Taking "the top-level ancestor" would have called the wrapper the
 * phase and given every task the same one.
 *
 * The rule that survives both shapes: phases are the shallowest level that
 * actually BRANCHES. A level holding one task is a container, not a phase.
 */
export function detectPhaseLevel(tasks: MpxjTask[]): number {
  const countByLevel = new Map<number, number>();
  for (const t of tasks) {
    const level = t.outline_level ?? 0;
    if (level <= 0) continue; // the project summary row
    countByLevel.set(level, (countByLevel.get(level) ?? 0) + 1);
  }
  if (countByLevel.size === 0) return 1;
  const levels = [...countByLevel.keys()].sort((a, b) => a - b);
  for (const level of levels) {
    if ((countByLevel.get(level) ?? 0) > 1) return level;
  }
  // A single chain all the way down: treat the shallowest as the phase.
  return levels[0];
}

/**
 * The phase a task belongs to: the name of its ancestor at the phase level.
 *
 * Walks `parent_task_unique_id` rather than slicing `outline_number` prefixes,
 * because a plan can carry a hand-edited WBS whose numbering no longer matches
 * the real hierarchy. The parent chain is what MS Project itself uses.
 */
export function resolvePhase(
  task: MpxjTask,
  byUniqueId: Map<number, MpxjTask>,
  phaseLevel: number,
): string {
  const level = task.outline_level ?? 0;
  // A phase is not inside itself, and nothing above it has one.
  if (level <= phaseLevel) return "";

  const seen = new Set<number>();
  let current = task;
  while (current.parent_task_unique_id != null) {
    const parent = byUniqueId.get(current.parent_task_unique_id);
    // A malformed file can point a task at itself or form a cycle; stop rather
    // than hang the import.
    if (!parent || parent.unique_id == null || seen.has(parent.unique_id)) break;
    seen.add(parent.unique_id);
    current = parent;
    if ((current.outline_level ?? 0) <= phaseLevel) break;
  }
  return current === task ? "" : (current.name ?? "").trim();
}

/** Column headers chosen to match the importer's existing synonym table. */
export const MPP_TASK_HEADERS = [
  "WBS",
  "Task Name",
  "Phase",
  "Duration",
  "Hours",
  "Start",
  "Finish",
  "Predecessors",
  "Assigned To",
  "Milestone",
] as const;

export const MPP_RESOURCE_HEADERS = ["Name", "Role"] as const;

/**
 * Turn one MPXJ project into the tables the importer already understands.
 *
 * Summary rows are kept: they are the phases, and the extractor uses them to
 * group. The project summary row (outline level 0) is dropped — it is the file
 * itself, not work.
 */
export function mpxjToParsedFile(project: MpxjProject, fileName: string): ParsedFile {
  const allTasks = project.tasks ?? [];
  const byUniqueId = new Map<number, MpxjTask>();
  for (const t of allTasks) if (t.unique_id != null) byUniqueId.set(t.unique_id, t);

  // Display ids, so "Predecessors" reads like it does in MS Project (the
  // sequential id a user sees) instead of MPXJ's internal unique_id.
  const displayIdByUniqueId = new Map<number, number>();
  for (const t of allTasks) {
    if (t.unique_id != null && t.id != null) displayIdByUniqueId.set(t.unique_id, t.id);
  }

  const resourceByUniqueId = new Map<number, MpxjResource>();
  for (const r of project.resources ?? []) {
    if (r.unique_id != null) resourceByUniqueId.set(r.unique_id, r);
  }

  // Resource names per task. Assignments frequently carry no resource at all —
  // a plan can budget effort by phase without naming anyone — so this map is
  // often empty and the column simply stays blank.
  const resourceNamesByTask = new Map<number, string[]>();
  for (const a of project.assignments ?? []) {
    if (a.task_unique_id == null || a.resource_unique_id == null) continue;
    const name = (resourceByUniqueId.get(a.resource_unique_id)?.name ?? "").trim();
    if (!name) continue;
    const list = resourceNamesByTask.get(a.task_unique_id) ?? [];
    if (!list.includes(name)) list.push(name);
    resourceNamesByTask.set(a.task_unique_id, list);
  }

  const phaseLevel = detectPhaseLevel(allTasks);

  const rows: string[][] = [];
  for (const t of allTasks) {
    const name = (t.name ?? "").trim();
    if (!name) continue;
    if ((t.outline_level ?? 0) <= 0) continue; // the project summary row

    const days = secondsToDays(t.duration);
    const hours = secondsToHours(t.work);
    const preds = (t.predecessors ?? [])
      .map((p) => p.predecessor_task_unique_id)
      .filter((id): id is number => id != null)
      .map((id) => displayIdByUniqueId.get(id) ?? id)
      .join(", ");

    rows.push([
      t.outline_number ?? t.wbs ?? (t.id != null ? String(t.id) : ""),
      name,
      resolvePhase(t, byUniqueId, phaseLevel),
      days == null ? "" : String(days),
      hours == null ? "" : String(hours),
      toDateOnly(t.start),
      toDateOnly(t.finish),
      preds,
      (t.unique_id != null ? resourceNamesByTask.get(t.unique_id) : undefined)?.join(", ") ?? "",
      t.milestone ? "Yes" : "",
    ]);
  }

  const tables: ParsedTable[] = [
    { name: "Tasks", headers: [...MPP_TASK_HEADERS], rows },
  ];

  const resourceRows = (project.resources ?? [])
    .map((r) => [(r.name ?? "").trim(), (r.type ?? "").trim()])
    .filter((r) => r[0].length > 0);
  if (resourceRows.length > 0) {
    tables.push({ name: "Resources", headers: [...MPP_RESOURCE_HEADERS], rows: resourceRows });
  }

  const props = project.property_values ?? {};
  const title = str(props["project_title"]) || str(props["name"]) || fileName;

  return {
    fileType: "mpp",
    // The text dump is what the AI pass reads when the table alone is ambiguous.
    rawText: [title, ...rows.map((r) => `${r[0]} ${r[1]}`)].join("\n"),
    rawJson: project,
    tables,
    metadata: {
      source: "microsoft-project",
      projectTitle: title,
      author: str(props["author"]),
      company: str(props["company"]),
      taskCount: rows.length,
      resourceCount: resourceRows.length,
      /** Recorded so a reader knows how "Duration" was derived. */
      workingHoursPerDay: WORKING_HOURS_PER_DAY,
      /** Which outline level this plan uses for phases. */
      phaseLevel,
    },
  };
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
