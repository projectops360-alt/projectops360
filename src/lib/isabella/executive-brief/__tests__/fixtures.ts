// ============================================================================
// Isabella Executive Brief (REG-023) — shared test fixtures
// ============================================================================

import type { ProjectBriefing } from "@/lib/project-briefing/types";
import type { ExecutiveBriefData, RegisteredRisk } from "@/lib/isabella/executive-brief/types";

export const EXPERT = { key: "isabella", displayName: "Isabella", title: "PMO Director" };

export function briefingFixture(overrides: Partial<ProjectBriefing> = {}): ProjectBriefing {
  return {
    projectId: "0b7f4a52-9a1a-4c3e-9f4e-2f1a6a1b2c3d",
    projectName: "Torre Norte",
    generatedAt: "2026-07-09T12:00:00.000Z",
    scope: "full",
    healthBand: "watch",
    overview: {
      percentComplete: 62,
      totalTasks: 40,
      activeTasks: 15,
      completedTasks: 25,
      inProgressTasks: 8,
      overdueTasks: 3,
      milestonesTotal: 5,
      milestonesInProgress: 2,
      nextMilestone: { title: "Production Readiness", date: "2026-08-01" },
      milestoneHealth: { planned: 2, in_progress: 2, completed: 1, blocked: 0, deferred: 0, at_risk: 1 },
    },
    execution: { activeBlockers: 2, waitingOnDependency: 1, atRiskMilestones: 1, overdue: 3 },
    capacity: { unassignedActive: 3, missingEstimateActive: 2, evaluable: true },
    risks: { open: 2, high: 1, available: true },
    memory: {
      recentDecisions: [{ id: "d1", title: "Cambiar proveedor de acero", date: "2026-07-01", kind: "decision" }],
      unresolvedActions: [{ id: "a1", title: "Confirmar credenciales", date: "2026-07-10", kind: "action" }],
      recentNotes: [],
      available: true,
    },
    good: [],
    attention: [
      { key: "active_blockers", count: 2, severity: "high" },
      { key: "overdue", count: 3, severity: "medium" },
    ],
    recommended: ["review_blockers"],
    verify: ["workboard"],
    dataGaps: [],
    ...overrides,
  };
}

export function registeredRisksFixture(): RegisteredRisk[] {
  return [
    {
      title: "Integración con proveedor externo",
      category: "external",
      probability: "high",
      impact: "high",
      severity: "high",
      status: "open",
    },
    {
      title: "Aprobación de seguridad pendiente",
      category: "permit",
      probability: "medium",
      impact: "high",
      severity: "medium",
      status: "mitigating",
    },
  ];
}

export function executiveDataFixture(overrides: Partial<ExecutiveBriefData> = {}): ExecutiveBriefData {
  return { briefing: briefingFixture(), registeredRisks: registeredRisksFixture(), ...overrides };
}
