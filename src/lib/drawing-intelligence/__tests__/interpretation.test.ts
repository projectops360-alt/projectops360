import { describe, it, expect } from "vitest";
import { interpretDrawingContent, type InterpretationContext } from "../interpretation";
import type { ExtractedNote, RevisionEntry } from "../extractors";

function note(text: string, id = "N1", page = 1, confidence = 0.87): ExtractedNote {
  return {
    note_id: id,
    text,
    category: "general_notes",
    page_number: page,
    confidence_score: confidence,
    evidence: { page_number: page, text_excerpt: text.slice(0, 120) },
  };
}

function ctx(overrides: Partial<InterpretationContext>): InterpretationContext {
  return {
    fileName: "A-101_R3.pdf",
    drawingNumber: "A-101",
    discipline: "Architectural",
    currentRevision: "3",
    notes: [],
    revisions: [],
    tasks: [],
    milestones: [],
    ...overrides,
  };
}

describe("interpretDrawingContent", () => {
  it("generates an RFI candidate from a coordination note with evidence", () => {
    const insights = interpretDrawingContent(
      ctx({ notes: [note("CONTRACTOR SHALL FIELD VERIFY ALL DIMENSIONS PRIOR TO FABRICATION.")] }),
    );
    const rfi = insights.find((i) => i.insight_type === "rfi_candidate");
    expect(rfi).toBeDefined();
    expect(rfi!.evidence).toHaveLength(1);
    expect(rfi!.evidence[0].text_excerpt).toContain("FIELD VERIFY");
    expect(rfi!.recommended_action).toBe("create_draft_rfi");
    expect(rfi!.payload.status).toBe("suggested");
  });

  it("generates a submittal requirement from a shop drawing note", () => {
    const insights = interpretDrawingContent(
      ctx({ notes: [note("SUBMIT SHOP DRAWINGS FOR ALL STRUCTURAL STEEL CONNECTIONS.")] }),
    );
    const submittal = insights.find((i) => i.insight_type === "submittal_requirement");
    expect(submittal).toBeDefined();
    expect(submittal!.payload.discipline).toBe("Architectural");
  });

  it("generates an inspection requirement from a testing note", () => {
    const insights = interpretDrawingContent(
      ctx({ notes: [note("ALL FIRESTOPPING SHALL BE INSPECTED BY THE AHJ PRIOR TO COVER.")] }),
    );
    expect(insights.some((i) => i.insight_type === "inspection_requirement")).toBe(true);
  });

  it("marks high-severity insights as needs_review (human-in-the-loop)", () => {
    const insights = interpretDrawingContent(
      ctx({ notes: [note("LONG-LEAD EQUIPMENT: ORDER PRIOR TO START OF CONSTRUCTION.")] }),
    );
    const schedule = insights.find((i) => i.insight_type === "schedule_impact");
    expect(schedule).toBeDefined();
    expect(schedule!.needs_review).toBe(true);
    // unknown delay is never invented
    expect(schedule!.payload.estimated_delay_days).toBeNull();
  });

  it("links insights to tasks via conservative word overlap", () => {
    const insights = interpretDrawingContent(
      ctx({
        notes: [note("COORDINATE WITH ELECTRICAL PANEL INSTALLATION BEFORE CLOSING WALLS.")],
        tasks: [
          { id: "t1", title: "Electrical panel installation", status: "in_progress", milestone_id: "m1" },
          { id: "t2", title: "Paint lobby", status: "not_started", milestone_id: null },
        ],
      }),
    );
    const linked = insights.find((i) => i.linked_task_id === "t1");
    expect(linked).toBeDefined();
    expect(linked!.linked_milestone_id).toBe("m1");
  });

  it("generates a revision risk when active work exists", () => {
    const revision: RevisionEntry = {
      revision: "3",
      revision_date: "06/01/2026",
      description: "REVISED MECHANICAL ROOM LAYOUT",
      issued_by: "LDP",
      confidence_score: 0.85,
      evidence: { page_number: 1, text_excerpt: "3 06/01/2026 REVISED MECHANICAL ROOM LAYOUT" },
    };
    const insights = interpretDrawingContent(
      ctx({
        revisions: [revision],
        tasks: [{ id: "t1", title: "Mechanical room rough-in", status: "in_progress", milestone_id: null }],
      }),
    );
    const risk = insights.find((i) => i.insight_type === "risk");
    expect(risk).toBeDefined();
    expect(risk!.severity).toBe("high");
    expect(risk!.needs_review).toBe(true);
    expect(risk!.recommended_action).toBe("compare_against_previous_revision");
    expect(insights.some((i) => i.insight_type === "schedule_impact")).toBe(true);
  });

  it("does not generate a revision risk without active tasks", () => {
    const revision: RevisionEntry = {
      revision: "2",
      revision_date: null,
      description: null,
      issued_by: null,
      confidence_score: 0.75,
      evidence: { page_number: 1, text_excerpt: "2" },
    };
    const insights = interpretDrawingContent(
      ctx({ revisions: [revision], tasks: [{ id: "t1", title: "Done task", status: "done", milestone_id: null }] }),
    );
    expect(insights.filter((i) => i.insight_type === "risk")).toHaveLength(0);
  });

  it("produces nothing from neutral notes (no unsupported conclusions)", () => {
    const insights = interpretDrawingContent(
      ctx({ notes: [note("ALL WALLS TYPE W1 UNLESS NOTED OTHERWISE.")] }),
    );
    expect(insights).toHaveLength(0);
  });

  it("deduplicates same type + excerpt", () => {
    const duplicated = note("SUBMIT SHOP DRAWINGS FOR APPROVAL.");
    const insights = interpretDrawingContent(ctx({ notes: [duplicated, { ...duplicated, note_id: "N2" }] }));
    expect(insights.filter((i) => i.insight_type === "submittal_requirement")).toHaveLength(1);
  });
});
