// ============================================================================
// ProjectOps360° — Living Graph demo dataset
// ============================================================================
// Deterministic sample graph used ONLY when a project has no process events
// yet and the user explicitly opts into demo mode. Demonstrates the full
// visual language: 4 milestones, 20 tasks, blockers, documents, decisions,
// rework loops, a critical chain, traceability gaps and SOP candidates.
// Never mixed with production data — the UI labels it clearly as a demo.
// ============================================================================

import type {
  LivingGraphData,
  LivingGraphNode,
  LivingGraphEdge,
  LivingGraphEvent,
  LivingGraphRiskLevel,
} from "@/types/living-graph";
import type { ProcessNodeType, ProcessEdgeType } from "@/types/database";

const DAY = 86_400_000;
const BASE = new Date("2026-03-02T09:00:00Z").getTime();

const MILESTONES = [
  { key: "m1", label: "M1 — Discovery & Setup", icon: "setup", status: "completed", progress: 100 },
  { key: "m2", label: "M2 — Core Build", icon: "shield_database", status: "completed", progress: 100 },
  { key: "m3", label: "M3 — Integration & QA", icon: "loop", status: "in_progress", progress: 55 },
  { key: "m4", label: "M4 — Launch", icon: "rocket", status: "planned", progress: 0 },
] as const;

const TASK_TITLES = [
  "Define scope & success metrics",
  "Stakeholder interviews",
  "Architecture decision record",
  "Provision environments",
  "Database schema v1",
  "Auth & roles",
  "Core domain services",
  "API contract",
  "UI shell & navigation",
  "Design system tokens",
  "Feature: workspace CRUD",
  "Feature: reporting",
  "Integration: billing",
  "Integration: notifications",
  "E2E test suite",
  "Performance pass",
  "Security review",
  "UAT round 1",
  "Launch checklist",
  "Go-live runbook",
];

interface DemoNodeSeed {
  id: string;
  type: ProcessNodeType;
  label: string;
  milestone: number; // index into MILESTONES
  day: number; // offset from BASE
  status?: string;
  progress?: number;
  blocked?: boolean;
  risk?: LivingGraphRiskLevel;
  critical?: boolean;
  durationDays?: number;
  description?: string | null;
}

function makeNode(seed: DemoNodeSeed, projectId: string): LivingGraphNode {
  const m = MILESTONES[seed.milestone];
  const occurredAt = new Date(BASE + seed.day * DAY).toISOString();
  return {
    id: `demo:${seed.id}`,
    projectId,
    nodeType: seed.type,
    sourceEntityType: seed.type === "milestone_gate" ? "milestones" : "roadmap_tasks",
    sourceEntityId: `demo-entity-${seed.id}`,
    label: seed.label,
    description: seed.description ?? null,
    status: seed.status ?? null,
    progress: seed.progress ?? null,
    startDate: new Date(BASE + seed.day * DAY).toISOString(),
    endDate: new Date(BASE + (seed.day + (seed.durationDays ?? 2)) * DAY).toISOString(),
    durationDays: seed.durationDays ?? 2,
    occurredAt,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    riskLevel: seed.risk ?? "low",
    isBlocked: seed.blocked ?? false,
    isCritical: seed.critical ?? false,
    milestoneId: `demo-milestone-${m.key}`,
    milestoneLabel: m.label,
    milestoneOrder: seed.milestone,
    traceabilityScore: null,
    metadata: { demo: true, milestone_icon: m.icon },
  };
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  edgeType: ProcessEdgeType,
  projectId: string,
  weight = 1,
): LivingGraphEdge {
  return {
    id: `demo-edge:${id}`,
    projectId,
    sourceNodeId: `demo:${source}`,
    targetNodeId: `demo:${target}`,
    edgeType,
    weight,
    lagDays: null,
    isCritical: false,
    riskLevel: edgeType === "blocked" ? "high" : null,
    metadata: { demo: true },
  };
}

/** Build the full demo dataset. Pure and deterministic. */
export function buildDemoGraphData(projectId: string): LivingGraphData {
  const seeds: DemoNodeSeed[] = [];

  // Milestone gates
  MILESTONES.forEach((m, i) => {
    seeds.push({
      id: m.key,
      type: "milestone_gate",
      label: m.label,
      milestone: i,
      day: i * 14,
      status: m.status,
      progress: m.progress,
      durationDays: 14,
    });
  });

  // 20 tasks, 5 per milestone, chained
  TASK_TITLES.forEach((title, i) => {
    const milestone = Math.floor(i / 5);
    const done = milestone <= 1 || (milestone === 2 && i % 5 < 2);
    seeds.push({
      id: `t${i}`,
      type: "task_transition",
      label: title,
      milestone,
      day: milestone * 14 + (i % 5) * 2.5,
      status: done ? "done" : milestone === 2 ? "in_progress" : "not_started",
      progress: done ? 100 : milestone === 2 ? 45 : 0,
      durationDays: 1 + (i % 4),
      critical: i % 5 === 2, // one critical chain member per milestone
      risk: i === 12 || i === 16 ? "high" : i % 7 === 0 ? "medium" : "low",
    });
  });

  // 3 blockers
  seeds.push(
    { id: "b1", type: "blocker_event", label: "Billing sandbox unavailable", milestone: 2, day: 31, blocked: true, risk: "high", durationDays: 3, status: "blocked" },
    { id: "b2", type: "blocker_event", label: "Pending security sign-off", milestone: 2, day: 33, blocked: true, risk: "high", durationDays: 2, status: "blocked" },
    { id: "b3", type: "blocker_event", label: "Missing UAT test data", milestone: 3, day: 44, blocked: true, risk: "medium", durationDays: 1, status: "blocked" },
  );

  // 3 documents + 2 decisions (evidence)
  seeds.push(
    { id: "d1", type: "document_link", label: "Architecture Decision Record", milestone: 0, day: 3, status: "done", durationDays: 1 },
    { id: "d2", type: "document_link", label: "API contract v2", milestone: 1, day: 17, status: "done", durationDays: 1 },
    { id: "d3", type: "document_link", label: "Launch runbook", milestone: 3, day: 45, status: "done", durationDays: 1 },
    { id: "dec1", type: "decision_cascade", label: "Decision: managed billing provider", milestone: 1, day: 16, status: "done", durationDays: 1 },
    { id: "dec2", type: "decision_cascade", label: "Decision: phased rollout", milestone: 3, day: 43, status: "done", durationDays: 1 },
  );

  const nodes = seeds.map((seed) => makeNode(seed, projectId));

  const edges: LivingGraphEdge[] = [];
  // Milestone gates enable their tasks
  for (let i = 0; i < 20; i++) {
    edges.push(makeEdge(`m-t${i}`, MILESTONES[Math.floor(i / 5)].key, `t${i}`, "enabled", projectId));
  }
  // Task chains (caused) inside each milestone + cross-milestone handoffs
  for (let i = 0; i < 19; i++) {
    edges.push(
      makeEdge(
        `t${i}-t${i + 1}`,
        `t${i}`,
        `t${i + 1}`,
        (i + 1) % 5 === 0 ? "accelerated" : "caused",
        projectId,
        i % 5 === 2 ? 3 : 1, // heavier flow on the critical chain
      ),
    );
  }
  // Rework loops (delayed back-edges)
  edges.push(makeEdge("rework1", "t14", "t8", "delayed", projectId, 2));
  edges.push(makeEdge("rework2", "t17", "t11", "delayed", projectId, 1));
  // Blockers block tasks
  edges.push(makeEdge("b1-t12", "b1", "t12", "blocked", projectId));
  edges.push(makeEdge("b2-t16", "b2", "t16", "blocked", projectId));
  edges.push(makeEdge("b3-t17", "b3", "t17", "blocked", projectId));
  // Evidence links (informed)
  edges.push(makeEdge("d1-t2", "d1", "t2", "informed", projectId));
  edges.push(makeEdge("d2-t7", "d2", "t7", "informed", projectId));
  edges.push(makeEdge("d3-t19", "d3", "t19", "informed", projectId));
  edges.push(makeEdge("dec1-t12", "dec1", "t12", "informed", projectId));
  edges.push(makeEdge("dec2-t18", "dec2", "t18", "informed", projectId));

  const events: LivingGraphEvent[] = [...nodes]
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
    .map((n) => ({
      id: `demo-event:${n.id}`,
      projectId,
      eventType: n.nodeType,
      entityType: n.sourceEntityType,
      entityId: n.sourceEntityId,
      nodeId: n.id,
      label: n.label,
      occurredAt: n.occurredAt,
      inDegree: 0,
      outDegree: 0,
      metadata: { demo: true },
    }));

  return { nodes, edges, events, generatedAt: new Date().toISOString() };
}
