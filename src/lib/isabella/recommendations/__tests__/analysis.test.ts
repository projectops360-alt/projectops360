// ============================================================================
// ISABELLA-RECOMMENDATION-NEXT-BEST-ACTION-ENGINE — categories/candidates/
// scoring/dedupe/evidence/engine/formatter
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  assembleRecommendationPlan,
  generateRecommendationCandidates,
  mapFindingToRecommendationCategory,
  derivePriority,
  dedupeRecommendations,
  validateRecommendationEvidence,
  filterEvidenceBacked,
  formatRecommendationPlanForIsabella,
} from "@/lib/isabella/recommendations";
import { assembleRootCauseAnalysis } from "@/lib/isabella/root-cause";
import type { IsabellaRootCauseAnalysis, RootCauseFinding } from "@/lib/isabella/root-cause/types";
import type { IsabellaProcessContext, IsabellaTaskContext, IsabellaTaskSummary } from "@/lib/isabella/process-context/types";
import type { IsabellaEvidencePacket } from "@/lib/isabella/process-intelligence/types";

// ── fixtures ────────────────────────────────────────────────────────────────
function packet(o: Partial<IsabellaEvidencePacket> = {}): IsabellaEvidencePacket {
  return { evidenceId: "e1", evidenceType: "blocker", sourceKind: "risk_decision_approval_blocker", sourceId: "task:t1", projectId: "p1", organizationId: "org1", title: "QA", summary: "Blocked: env down", citationLabel: "Recorded blocker", citationRef: "blocker:t1", confidence: "high", visibility: "project", ...o };
}
function task(o: Partial<IsabellaTaskSummary> = {}): IsabellaTaskSummary {
  return { taskId: o.taskId ?? "t", title: o.title ?? "Task", status: o.status ?? "not_started", priority: "p2", milestoneId: o.milestoneId ?? "m1", milestoneTitle: "Phase 5", ownerId: o.ownerId ?? null, ownerName: null, dueDate: o.dueDate ?? null, parentTaskId: null, isSubtask: false, blockedReason: o.blockedReason ?? null, updatedAt: null, citationRef: `task:${o.taskId ?? "t"}` };
}
function tctx(o: Partial<IsabellaTaskContext> = {}): IsabellaTaskContext {
  return { totalVisibleTasks: o.totalVisibleTasks ?? 0, tasks: o.tasks ?? [], subtasks: [], byStatus: o.byStatus ?? {}, byPriority: {}, withoutMilestoneCount: o.withoutMilestoneCount ?? 0, withoutOwnerCount: o.withoutOwnerCount ?? 0, overdueCount: o.overdueCount ?? 0, blockedCount: o.blockedCount ?? 0 };
}
function ctx(o: Partial<IsabellaProcessContext> = {}): IsabellaProcessContext {
  return { scope: { projectId: "p1", organizationId: "org1", userId: "u1", locale: "en" }, project: { projectId: "p1", name: "Tower A", citationRef: "project:p1" }, snapshotAt: "2026-07-15T00:00:00Z", included: ["project", "tasks", "milestones", "blockers"], evidencePackets: o.evidencePackets ?? [], citations: o.citations ?? [], taskContext: o.taskContext, milestoneContext: o.milestoneContext, processSignals: o.processSignals, limitations: o.limitations ?? [], status: o.status ?? "ready", message: o.message };
}
function finding(o: Partial<RootCauseFinding> = {}): RootCauseFinding {
  return { id: o.id ?? "f-x", label: o.label ?? "x", classification: o.classification ?? "possible_cause", constraintType: o.constraintType ?? "milestone_assignment_gap", severity: o.severity ?? "watch", confidence: o.confidence ?? "low", explanation: o.explanation ?? "why", affectedEntities: o.affectedEntities ?? [{ type: "task", title: "T", safeRef: "task:t" }], evidenceRefs: o.evidenceRefs ?? [], limitations: o.limitations };
}

// A ready analysis with an explicit blocker + owner + milestone + overdue gaps.
function richAnalysis(status: IsabellaProcessContext["status"] = "ready"): { context: IsabellaProcessContext; analysis: IsabellaRootCauseAnalysis } {
  const context = ctx({
    status,
    processSignals: { blockedCount: 1, advancedFindingsAvailable: false, packets: [packet()] },
    taskContext: tctx({ totalVisibleTasks: 5, blockedCount: 1, withoutOwnerCount: 2, withoutMilestoneCount: 1, overdueCount: 1, tasks: [task({ taskId: "a", blockedReason: "env down" }), task({ taskId: "b", dueDate: "2026-07-01" }), task({ taskId: "c", ownerId: null }), task({ taskId: "d", milestoneId: null })] }),
    citations: [{ sourceLabel: "Workboard", entityType: "task", entityTitle: "QA", confidence: "verified" }],
    limitations: ["Risk evidence is not available in this layer yet."],
  });
  return { context, analysis: assembleRootCauseAnalysis(context, undefined, undefined, "en") };
}

// ── category mapping ─────────────────────────────────────────────────────────
describe("category mapping", () => {
  it("maps supported constraints and never fabricates unsupported ones", () => {
    expect(mapFindingToRecommendationCategory(finding({ constraintType: "explicit_blocker" }))).toBe("resolve_explicit_blocker");
    expect(mapFindingToRecommendationCategory(finding({ constraintType: "ownership_gap" }))).toBe("assign_owner");
    expect(mapFindingToRecommendationCategory(finding({ constraintType: "milestone_assignment_gap" }))).toBe("assign_milestone");
    expect(mapFindingToRecommendationCategory(finding({ constraintType: "overdue_constraint" }))).toBe("recover_overdue_work");
    expect(mapFindingToRecommendationCategory(finding({ constraintType: "stalled_progress" }))).toBe("reduce_execution_uncertainty");
    // future / unsupported → null (no fabrication)
    for (const t of ["sequencing_gap", "decision_delay", "approval_delay", "external_dependency", "capacity_signal", "evidence_gap"] as const) {
      expect(mapFindingToRecommendationCategory(finding({ constraintType: t }))).toBeNull();
    }
  });
  it("validate_dependency ONLY with real dependency evidence (never synthetic milestone_chain)", () => {
    expect(mapFindingToRecommendationCategory(finding({ constraintType: "dependency_constraint", evidenceRefs: [] }))).toBeNull();
    expect(mapFindingToRecommendationCategory(finding({ constraintType: "dependency_constraint", evidenceRefs: ["dep:real"] }))).toBe("validate_dependency");
  });
});

// ── candidate generation ───────────────────────────────────────────────────
describe("candidate generation (evidence-backed)", () => {
  it("creates a candidate per supported finding + investigation gap", () => {
    const { analysis } = richAnalysis();
    const cats = generateRecommendationCandidates(analysis, undefined, "en").map((c) => c.category);
    expect(cats).toContain("resolve_explicit_blocker");
    expect(cats).toContain("assign_owner");
    expect(cats).toContain("assign_milestone");
    expect(cats).toContain("recover_overdue_work");
    expect(cats).toContain("investigate_evidence_gap");
  });
  it("consumes recommendationHandoffHints: only handed-off findings are eligible", () => {
    const { analysis } = richAnalysis();
    expect(analysis.recommendationHandoffHints.length).toBeGreaterThan(0);
    // Restrict the handoff to a single finding → only that finding produces a candidate.
    const only = analysis.findings[0];
    const narrowed = { ...analysis, recommendationHandoffHints: [{ reason: "x", findingIds: [only.id], evidenceRefs: [], allowedForRecommendationEngine: true as const }] };
    const cats = generateRecommendationCandidates(narrowed, undefined, "en").filter((c) => c.category !== "investigate_evidence_gap" && c.category !== "stabilize_milestone").map((c) => c.sourceFindingIds[0]);
    expect(new Set(cats)).toEqual(new Set([only.id]));
  });
  it("does not fabricate dependency recommendations from synthetic milestone_chain", () => {
    const { analysis } = richAnalysis();
    const cats = generateRecommendationCandidates(analysis, undefined, "en").map((c) => c.category);
    expect(cats).not.toContain("validate_dependency");
  });
});

// ── evidence validation ────────────────────────────────────────────────────
describe("evidence validation", () => {
  it("rejects a candidate with no evidence, no source and no declared gap", () => {
    const bad = { dedupeKey: "assign_owner", category: "assign_owner" as const, title: "t", rationale: "r", expectedOutcome: "o", expectedImpact: "improve_accountability" as const, priority: "medium" as const, urgency: "today" as const, effort: "low" as const, confidence: "low" as const, affectedEntities: [], sourceFindingIds: [], sourceConstraintIds: [], sourceEvidenceChainIds: [], evidenceRefs: [] };
    expect(validateRecommendationEvidence(bad).valid).toBe(false);
    expect(filterEvidenceBacked([bad])).toHaveLength(0);
  });
  it("accepts an investigate_evidence_gap with declared missing evidence", () => {
    const gap = { dedupeKey: "investigate_evidence_gap", category: "investigate_evidence_gap" as const, title: "t", rationale: "r", expectedOutcome: "o", expectedImpact: "reduce_uncertainty" as const, priority: "low" as const, urgency: "this_week" as const, effort: "low" as const, confidence: "unavailable" as const, affectedEntities: [], sourceFindingIds: [], sourceConstraintIds: [], sourceEvidenceChainIds: [], evidenceRefs: [], missingEvidence: ["risk source unavailable"] };
    expect(validateRecommendationEvidence(gap).valid).toBe(true);
  });
});

// ── scoring / ranking ──────────────────────────────────────────────────────
describe("scoring / ranking (deterministic)", () => {
  it("blocked+strong → critical; weak possible cause → not critical", () => {
    expect(derivePriority(finding({ constraintType: "explicit_blocker", classification: "confirmed_cause", severity: "blocked", confidence: "high" }))).toBe("critical");
    expect(derivePriority(finding({ constraintType: "milestone_assignment_gap", classification: "possible_cause", severity: "watch", confidence: "low" }))).not.toBe("critical");
  });
  it("direct blocker ranks above cleanup, and ordering is deterministic", () => {
    const { analysis } = richAnalysis();
    const plan1 = assembleRecommendationPlan(richAnalysis().context, analysis, undefined, "en");
    const plan2 = assembleRecommendationPlan(richAnalysis().context, richAnalysis().analysis, undefined, "en");
    expect(plan1.recommendations[0].category).toBe("resolve_explicit_blocker");
    expect(plan1.recommendations.map((r) => r.id)).toEqual(plan2.recommendations.map((r) => r.id));
    const blockerIdx = plan1.recommendations.findIndex((r) => r.category === "resolve_explicit_blocker");
    const gapIdx = plan1.recommendations.findIndex((r) => r.category === "investigate_evidence_gap");
    expect(blockerIdx).toBeLessThan(gapIdx);
  });
});

// ── dedupe / grouping ──────────────────────────────────────────────────────
describe("dedupe / grouping", () => {
  it("merges same-category candidates and preserves evidenceRefs + count", () => {
    const mk = (ref: string, title: string) => ({ dedupeKey: "assign_owner", category: "assign_owner" as const, title, rationale: "r", expectedOutcome: "o", expectedImpact: "improve_accountability" as const, priority: "medium" as const, urgency: "today" as const, effort: "low" as const, confidence: "low" as const, affectedEntities: [{ type: "task" as const, title, safeRef: ref }], sourceFindingIds: ["f-owner"], sourceConstraintIds: ["c-ownership_gap"], sourceEvidenceChainIds: [], evidenceRefs: [ref] });
    const merged = dedupeRecommendations([mk("task:a", "A"), mk("task:b", "B"), mk("task:c", "C")]);
    expect(merged).toHaveLength(1);
    expect(merged[0].affectedEntities).toHaveLength(3);
    expect(new Set(merged[0].evidenceRefs)).toEqual(new Set(["task:a", "task:b", "task:c"]));
  });
  it("groups final recommendations by priority", () => {
    const plan = assembleRecommendationPlan(richAnalysis().context, richAnalysis().analysis, undefined, "en");
    expect(plan.recommendationGroups.length).toBeGreaterThan(0);
    const ids = plan.recommendationGroups.flatMap((g) => g.recommendations);
    expect(new Set(ids)).toEqual(new Set(plan.recommendations.map((r) => r.id)));
  });
});

// ── engine states ──────────────────────────────────────────────────────────
describe("engine states", () => {
  it("missing/unauthorized/unavailable/empty → no recommendations, no generic advice", () => {
    for (const status of ["missing_context", "unauthorized", "unavailable", "empty"] as const) {
      const c = ctx({ status, message: "m" });
      const a = assembleRootCauseAnalysis(c, undefined, undefined, "en");
      const plan = assembleRecommendationPlan(c, a, undefined, "en");
      expect(plan.status).toBe(status);
      expect(plan.recommendations).toHaveLength(0);
    }
  });
  it("ready context with findings → recommendations with full traceability", () => {
    const plan = assembleRecommendationPlan(richAnalysis().context, richAnalysis().analysis, undefined, "en");
    expect(plan.status).toBe("ready");
    expect(plan.recommendations.length).toBeGreaterThan(0);
    for (const r of plan.recommendations) {
      expect(r.confidence).toBeTruthy();
      expect(r.humanApprovalRequired).toBe(true);
      expect(r.executableNow).toBe(false);
      expect(r.evidenceRefs.length > 0 || r.sourceFindingIds.length > 0 || r.missingEvidence !== undefined).toBe(true);
      if (r.sourceFindingIds.length > 0) expect(r.sourceEvidenceChainIds.length).toBeGreaterThan(0);
    }
  });
  it("partial context caps recommendation confidence to at most medium", () => {
    const { context, analysis } = richAnalysis("partial");
    const plan = assembleRecommendationPlan(context, analysis, undefined, "en");
    expect(plan.status).toBe("partial");
    for (const r of plan.recommendations) expect(r.confidence).not.toBe("high");
  });
});

// ── formatter ──────────────────────────────────────────────────────────────
describe("formatter (bilingual, advisory)", () => {
  const plan = assembleRecommendationPlan(richAnalysis().context, richAnalysis().analysis, undefined, "es");
  const es = formatRecommendationPlanForIsabella(plan, "es");
  const en = formatRecommendationPlanForIsabella(assembleRecommendationPlan(richAnalysis().context, richAnalysis().analysis, undefined, "en"), "en");
  it("includes priority, urgency, impact, rationale, confidence and limitations", () => {
    expect(es).toContain("Recomendaciones de siguiente mejor acción");
    expect(es).toMatch(/Prioridad|Crítica|Alta|Media|Baja/i);
    expect(es).toMatch(/Urgencia/);
    expect(es).toMatch(/Impacto esperado/);
    expect(es).toMatch(/Por qué/);
    expect(es).toMatch(/Confianza/);
    expect(es).toMatch(/Limitaciones/);
  });
  it("states not executed automatically and never claims it acted / guaranteed", () => {
    expect(es).toMatch(/no se ejecutaron automáticamente/i);
    expect(en).toMatch(/not executed automatically/i);
    for (const text of [es.toLowerCase(), en.toLowerCase()]) {
      expect(text).not.toMatch(/i assigned|i moved|i fixed|i changed|asigné|moví|arreglé|cambié/);
      expect(text).not.toMatch(/will solve|guaranteed|garantiza|resolverá el problema/);
    }
  });
  it("requires human approval on every listed action", () => {
    expect(es).toMatch(/Requiere aprobación humana/);
    expect(en).toMatch(/Requires human approval/);
  });
});
