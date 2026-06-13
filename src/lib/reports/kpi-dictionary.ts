// ============================================================================
// ProjectOps360° — KPI Dictionary (pure metadata)
// ============================================================================
// Plain-language definitions of the metrics used across reports, so users
// know exactly what each number means and how it's computed.
// ============================================================================

export interface KpiDefinition {
  id: string;
  name: string;
  category: "Project" | "Task" | "Schedule" | "Budget" | "Resource" | "Material" | "Risk" | "AI";
  description: string;
  formula: string;
  sourceDataset: string;
  interpretation: string;
  caution?: string;
}

export const KPIS: KpiDefinition[] = [
  {
    id: "overall_progress",
    name: "Overall Progress %",
    category: "Project",
    description: "How much of the project's work is complete.",
    formula: "Completed tasks ÷ Total tasks × 100",
    sourceDataset: "Project Health",
    interpretation: "Higher is better. Read alongside schedule health — progress without dates can hide delays.",
    caution: "Counts tasks equally regardless of size or effort.",
  },
  {
    id: "blocked_tasks",
    name: "Blocked Tasks",
    category: "Task",
    description: "Tasks currently on hold by an explicit blocker.",
    formula: "Count of tasks with status = Blocked",
    sourceDataset: "Task Execution",
    interpretation: "Any blocked task on the critical path is urgent.",
  },
  {
    id: "overdue_tasks",
    name: "Overdue Tasks",
    category: "Task",
    description: "Open tasks past their planned finish date.",
    formula: "Count of tasks where Planned Finish < today AND status not in (Done, Tested)",
    sourceDataset: "Task Execution",
    interpretation: "A rising count signals slippage.",
    caution: "Only meaningful once tasks have planned dates.",
  },
  {
    id: "readiness",
    name: "Task Readiness",
    category: "Task",
    description: "Whether a task can actually start (owner, predecessors, materials, approvals).",
    formula: "1 − weighted sum of unmet prerequisites",
    sourceDataset: "Task Execution",
    interpretation: "Use it to pick what can move today.",
  },
  {
    id: "total_float",
    name: "Total Float (days)",
    category: "Schedule",
    description: "How long a task can slip without delaying the project.",
    formula: "Latest Start − Earliest Start",
    sourceDataset: "Task Execution",
    interpretation: "Float ≤ 0 means the task is on the critical path.",
  },
  {
    id: "cost_variance",
    name: "Cost Variance",
    category: "Budget",
    description: "How far a budget item is trending from its estimate.",
    formula: "Forecast (or Actual) Cost − Estimated Cost",
    sourceDataset: "Budget Performance",
    interpretation: "Positive variance = trending over budget.",
  },
  {
    id: "variance_pct",
    name: "Variance %",
    category: "Budget",
    description: "Cost variance relative to the estimate.",
    formula: "Variance ÷ Estimated Cost × 100",
    sourceDataset: "Budget Performance",
    interpretation: "Normalizes overruns so small and large lines are comparable.",
    caution: "Undefined when the estimate is zero.",
  },
  {
    id: "utilization",
    name: "Utilization %",
    category: "Resource",
    description: "How loaded a resource is versus its capacity.",
    formula: "Assigned hours ÷ Available hours × 100",
    sourceDataset: "Resource Capacity",
    interpretation: "Over 100% means over-allocated.",
  },
  {
    id: "labor_gap",
    name: "Labor Gap",
    category: "Resource",
    description: "Shortfall between required and available workers for a week/trade.",
    formula: "Required workers − Available workers",
    sourceDataset: "Labor Availability",
    interpretation: "Positive gaps on critical work are the priority.",
  },
  {
    id: "materials_required_week",
    name: "Materials Required This Week",
    category: "Material",
    description: "Materials whose required-by date falls within 7 days.",
    formula: "Count of materials where Required By ≤ today + 7 days",
    sourceDataset: "Material Requirements",
    interpretation: "Drives near-term procurement urgency.",
  },
  {
    id: "risk_score",
    name: "Risk Score",
    category: "Risk",
    description: "Combined probability and impact of a risk.",
    formula: "Probability × Impact (severity)",
    sourceDataset: "Risk Register",
    interpretation: "Focus mitigation on the highest scores first.",
  },
  {
    id: "ai_confidence",
    name: "AI Confidence %",
    category: "AI",
    description: "How confident the AI is in an extracted or suggested item.",
    formula: "Model-reported confidence × 100",
    sourceDataset: "Material Requirements / Risk Register",
    interpretation: "Anything below ~70% should be reviewed before acting.",
    caution: "Confidence is not correctness — always verify low-confidence items.",
  },
];

export function listKpis(): KpiDefinition[] {
  return KPIS;
}
