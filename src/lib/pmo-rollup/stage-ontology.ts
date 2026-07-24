import type {
  PmoProjectFact,
  PmoStageDefinition,
  PmoStageId,
} from "./contracts";

export const PMO_STAGE_ONTOLOGY_VERSION = "1.0.0";

export const DEFAULT_PMO_STAGE_ONTOLOGY: readonly PmoStageDefinition[] = [
  {
    id: "initiate",
    label: "Initiate",
    description: "Evaluation, justification, sponsorship, feasibility, and initial authorization.",
    whyItMatters: "Confirms that the organization should invest before detailed planning begins.",
    includedActivities: ["intake", "business_case", "feasibility", "initial_estimate", "charter_approval"],
    entryCriteria: ["A request or opportunity exists."],
    exitCriteria: ["A governed go/no-go and charter decision exists."],
    mappingRules: [],
    version: PMO_STAGE_ONTOLOGY_VERSION,
  },
  {
    id: "plan",
    label: "Plan",
    description: "Definition of scope, schedule, baseline, budget, resources, risk, procurement, and controls.",
    whyItMatters: "Creates the approved reference against which execution can be controlled.",
    includedActivities: ["scope", "schedule", "baseline", "budget", "resource_plan", "risk_plan", "procurement"],
    entryCriteria: ["The project is authorized to plan."],
    exitCriteria: ["Execution and control baselines are approved."],
    mappingRules: [
      { source: "project-status", equals: "planning", stageId: "plan", priority: 10 },
    ],
    version: PMO_STAGE_ONTOLOGY_VERSION,
  },
  {
    id: "execute",
    label: "Execute",
    description: "Production of deliverables and consumption of resources.",
    whyItMatters: "Shows where approved plans become actual work, cost, and outcomes.",
    includedActivities: ["work_execution", "task_progression", "deliverables", "vendor_work", "actual_costs"],
    entryCriteria: ["Execution is authorized and resources are available."],
    exitCriteria: ["Deliverables are complete or formally transitioned."],
    mappingRules: [
      { source: "project-status", equals: "active", stageId: "execute", priority: 10 },
    ],
    version: PMO_STAGE_ONTOLOGY_VERSION,
  },
  {
    id: "control",
    label: "Control",
    description: "Comparison of plan and actuals with corrective action, forecasting, and governance.",
    whyItMatters: "Makes variance, exposure, and required intervention visible.",
    includedActivities: ["status_control", "evm", "change_control", "risk_monitoring", "forecast", "corrective_action"],
    entryCriteria: ["A baseline and execution evidence exist."],
    exitCriteria: ["Variances are accepted, corrected, or transferred to closure."],
    mappingRules: [
      { source: "project-status", equals: "on_hold", stageId: "control", priority: 10 },
    ],
    version: PMO_STAGE_ONTOLOGY_VERSION,
  },
  {
    id: "close",
    label: "Close",
    description: "Formal acceptance, handover, financial closure, release, learning, and archive.",
    whyItMatters: "Confirms completion and preserves accountable outcomes and lessons.",
    includedActivities: ["acceptance", "handover", "financial_closure", "resource_release", "lessons_learned", "archive"],
    entryCriteria: ["Delivery is complete or termination is authorized."],
    exitCriteria: ["Closure evidence and ownership transfer are complete."],
    mappingRules: [
      { source: "project-status", equals: "completed", stageId: "close", priority: 10 },
      { source: "project-status", equals: "cancelled", stageId: "close", priority: 10 },
    ],
    version: PMO_STAGE_ONTOLOGY_VERSION,
  },
  {
    id: "unmapped",
    label: "Unmapped / Needs Classification",
    description: "Project state or process activity that has no approved macro-stage mapping.",
    whyItMatters: "Prevents silent data loss and exposes ontology maintenance work.",
    includedActivities: [],
    entryCriteria: ["No approved mapping rule matched."],
    exitCriteria: ["A governed mapping is added or an explicit stage is assigned."],
    mappingRules: [],
    version: PMO_STAGE_ONTOLOGY_VERSION,
  },
] as const;

export function resolveProjectStage(
  project: PmoProjectFact,
  definitions: readonly PmoStageDefinition[] = DEFAULT_PMO_STAGE_ONTOLOGY,
): { stageId: PmoStageId; source: "explicit" | "project-status" | "unmapped" } {
  if (project.currentStageId) {
    return { stageId: project.currentStageId, source: "explicit" };
  }

  const rule = definitions
    .flatMap((definition) => definition.mappingRules)
    .filter((candidate) =>
      candidate.source === "project-status" && candidate.equals === project.status)
    .sort((left, right) => right.priority - left.priority)[0];

  return rule
    ? { stageId: rule.stageId, source: "project-status" }
    : { stageId: "unmapped", source: "unmapped" };
}
