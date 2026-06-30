import { describe, it, expect } from "vitest";
import {
  buildProvenanceSummary,
  classifyScribeSource,
  formatProvenanceForPrompt,
  scribeItemTypeToTarget,
  sourceTypeLabel,
  type ScribeDerivedRow,
} from "../engine";
import type { EntityProvenance } from "../types";

// ── classifyScribeSource ─────────────────────────────────────────────────────
describe("classifyScribeSource", () => {
  it("maps voice dictation to a voice note", () => {
    expect(classifyScribeSource("voice_dictation", "projectops_scribe")).toBe("scribe_voice_note");
  });
  it("maps typed/pasted Scribe captures to a note", () => {
    expect(classifyScribeSource("pasted_transcript", "projectops_scribe")).toBe("scribe_note");
    expect(classifyScribeSource("manual_note", "projectops_scribe")).toBe("scribe_note");
    expect(classifyScribeSource("status_update", "projectops_scribe")).toBe("scribe_note");
  });
  it("never throws on null/unknown values", () => {
    expect(classifyScribeSource(null, null)).toBe("scribe_note");
    expect(classifyScribeSource(undefined, undefined)).toBe("scribe_note");
  });
});

// ── scribeItemTypeToTarget ───────────────────────────────────────────────────
describe("scribeItemTypeToTarget", () => {
  it("maps action items to tasks", () => {
    expect(scribeItemTypeToTarget("action_item")).toBe("task");
  });
  it("maps decisions and risks directly", () => {
    expect(scribeItemTypeToTarget("decision")).toBe("decision");
    expect(scribeItemTypeToTarget("risk")).toBe("risk");
  });
  it("collapses issues/blockers/questions into follow-ups", () => {
    expect(scribeItemTypeToTarget("issue")).toBe("follow_up");
    expect(scribeItemTypeToTarget("blocker")).toBe("follow_up");
    expect(scribeItemTypeToTarget("open_question")).toBe("follow_up");
    expect(scribeItemTypeToTarget("follow_up")).toBe("follow_up");
  });
  it("returns null for unknown item types", () => {
    expect(scribeItemTypeToTarget("banana")).toBeNull();
  });
});

// ── buildProvenanceSummary ───────────────────────────────────────────────────
function row(p: Partial<ScribeDerivedRow>): ScribeDerivedRow {
  return {
    sourceType: "scribe_voice_note",
    targetType: "task",
    createdEntityId: "e1",
    status: "approved",
    ...p,
  };
}

const noGaps = { tasksWithoutSource: 0, decisionsWithoutSource: 0, risksWithoutSource: 0 };

describe("buildProvenanceSummary", () => {
  it("counts 12 tasks derived from voice notes (the headline question)", () => {
    const scribe = Array.from({ length: 12 }, (_, i) =>
      row({ createdEntityId: `task-${i}`, sourceType: "scribe_voice_note", targetType: "task" }),
    );
    const summary = buildProvenanceSummary({
      projectId: "p1",
      scribe,
      meeting: { tasks: 0, decisions: 0, risks: 0, followUps: 0 },
      gaps: noGaps,
      now: "2026-06-29T00:00:00.000Z",
    });
    expect(summary.totals.tasksFromVoiceNotes).toBe(12);
    expect(summary.totals.tasksFromScribe).toBe(12);
    expect(summary.bySourceType.scribe_voice_note?.tasks).toBe(12);
  });

  it("ignores extractions that never created an entity (memory-only)", () => {
    const summary = buildProvenanceSummary({
      projectId: "p1",
      scribe: [row({ createdEntityId: null }), row({ createdEntityId: "t1" })],
      meeting: { tasks: 0, decisions: 0, risks: 0, followUps: 0 },
      gaps: noGaps,
    });
    expect(summary.totals.tasksFromVoiceNotes).toBe(1);
  });

  it("ignores rejected extractions (never inflate counts)", () => {
    const summary = buildProvenanceSummary({
      projectId: "p1",
      scribe: [row({ status: "rejected", createdEntityId: "t1" }), row({ status: "approved", createdEntityId: "t2" })],
      meeting: { tasks: 0, decisions: 0, risks: 0, followUps: 0 },
      gaps: noGaps,
    });
    expect(summary.totals.tasksFromVoiceNotes).toBe(1);
  });

  it("separates voice notes from typed notes and counts decisions/risks", () => {
    const summary = buildProvenanceSummary({
      projectId: "p1",
      scribe: [
        row({ sourceType: "scribe_voice_note", targetType: "task", createdEntityId: "t1" }),
        row({ sourceType: "scribe_note", targetType: "decision", createdEntityId: "d1" }),
        row({ sourceType: "scribe_note", targetType: "risk", createdEntityId: "r1" }),
      ],
      meeting: { tasks: 0, decisions: 0, risks: 0, followUps: 0 },
      gaps: noGaps,
    });
    expect(summary.bySourceType.scribe_voice_note?.tasks).toBe(1);
    expect(summary.bySourceType.scribe_note?.decisions).toBe(1);
    expect(summary.bySourceType.scribe_note?.risks).toBe(1);
    expect(summary.totals.decisionsFromScribe).toBe(1);
    expect(summary.totals.risksFromScribe).toBe(1);
  });

  it("counts decisions derived from meetings", () => {
    const summary = buildProvenanceSummary({
      projectId: "p1",
      scribe: [],
      meeting: { tasks: 0, decisions: 6, risks: 0, followUps: 0 },
      gaps: noGaps,
    });
    expect(summary.totals.decisionsFromMeetings).toBe(6);
    expect(summary.bySourceType.meeting?.decisions).toBe(6);
    expect(summary.totals.aiDerivedTotal).toBe(6);
  });

  it("surfaces traceability gaps without inventing sources", () => {
    const summary = buildProvenanceSummary({
      projectId: "p1",
      scribe: [],
      meeting: { tasks: 0, decisions: 0, risks: 0, followUps: 0 },
      gaps: { tasksWithoutSource: 3, decisionsWithoutSource: 1, risksWithoutSource: 2 },
    });
    expect(summary.traceabilityGaps.tasksWithoutSource).toBe(3);
    expect(summary.traceabilityGaps.decisionsWithoutSource).toBe(1);
    expect(summary.traceabilityGaps.risksWithoutSource).toBe(2);
    // Gaps never inflate the derived totals.
    expect(summary.totals.aiDerivedTotal).toBe(0);
  });
});

// ── formatProvenanceForPrompt ────────────────────────────────────────────────
function entity(p: Partial<EntityProvenance>): EntityProvenance {
  return {
    found: true,
    entity: { type: "task", id: "t1", title: "Review final design" },
    sourceType: "scribe_voice_note",
    sourceExcerpt: "Carlos debe revisar el diseño final mañana",
    sourceRecord: { kind: "memory_item", id: "m1", title: "Field note", href: "/projects/p1/memory" },
    approval: { status: "approved", approvedByName: "Efrain Prada", approvedAt: "2026-06-28T10:00:00.000Z" },
    provenanceIncomplete: false,
    ...p,
  };
}

describe("formatProvenanceForPrompt", () => {
  const summary = buildProvenanceSummary({
    projectId: "p1",
    scribe: [{ sourceType: "scribe_voice_note", targetType: "task", createdEntityId: "t1", status: "approved" }],
    meeting: { tasks: 0, decisions: 6, risks: 0, followUps: 0 },
    gaps: { tasksWithoutSource: 3, decisionsWithoutSource: 0, risksWithoutSource: 0 },
  });

  it("renders deterministic counts the model must use", () => {
    const facts = formatProvenanceForPrompt(summary, null, "en");
    expect(facts).toMatch(/never invent a source/i);
    expect(facts).toMatch(/voice notes: 1/);
    expect(facts).toMatch(/meetings: 6/);
    expect(facts).toMatch(/3 tasks/);
  });

  it("cites the source, excerpt and approver for a selected item", () => {
    const facts = formatProvenanceForPrompt(null, entity({}), "en");
    expect(facts).toMatch(/voice note/i);
    expect(facts).toMatch(/Efrain Prada/);
    expect(facts).toMatch(/Carlos debe revisar/);
  });

  it("instructs honesty when the selected item has no source", () => {
    const facts = formatProvenanceForPrompt(null, entity({ found: false, sourceType: "unknown" }), "en");
    expect(facts).toMatch(/no linked source record|source is unknown/i);
    expect(facts).toMatch(/do not infer/i);
  });

  it("works in Spanish", () => {
    const facts = formatProvenanceForPrompt(summary, entity({ found: false, sourceType: "unknown" }), "es");
    expect(facts).toMatch(/DATOS DE PROCEDENCIA/);
    expect(facts).toMatch(/No infieras la fuente|origen es desconocido/i);
  });
});

// ── sourceTypeLabel ──────────────────────────────────────────────────────────
describe("sourceTypeLabel", () => {
  it("is bilingual and distinguishes voice from note", () => {
    expect(sourceTypeLabel("scribe_voice_note", "en")).toMatch(/voice note/i);
    expect(sourceTypeLabel("scribe_voice_note", "es")).toMatch(/voz/i);
    expect(sourceTypeLabel("meeting", "es")).toMatch(/reuni/i);
    expect(sourceTypeLabel("unknown", "en")).toMatch(/unknown/i);
  });
});
