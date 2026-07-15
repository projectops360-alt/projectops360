import type { ClassifiedActivity, ProcessActivityFamily, TemporalRole } from "./types";

const RULES: Array<{ pattern: RegExp; family: ProcessActivityFamily; temporalRole?: TemporalRole }> = [
  { pattern: /^Task(Created|Started|StatusChanged|Completed|Cancelled|Blocked|Unblocked|Reopened)$/i, family: "task" },
  { pattern: /^Milestone(Created|Started|StatusChanged|Achieved|Completed|Reopened)$/i, family: "milestone" },
  { pattern: /Dependency/i, family: "dependency" }, { pattern: /(Owner|Assignee|Responsibility)/i, family: "responsibility" },
  { pattern: /Phase/i, family: "phase" }, { pattern: /Risk/i, family: "risk" }, { pattern: /Decision/i, family: "decision" },
  { pattern: /(Approval|Submitted|Rejected)/i, family: "approval" }, { pattern: /(Rework|Reopened|Revision)/i, family: "rework" },
];

function temporalRole(eventType: string): TemporalRole {
  if (/(Created|Started)$/i.test(eventType)) return "start";
  if (/(Completed|Achieved|Cancelled)$/i.test(eventType)) return "complete";
  if (/(Unblocked|Approved|Rejected)$/i.test(eventType)) return "wait_end";
  if (/(Blocked|Submitted|Waiting)$/i.test(eventType)) return "wait_start";
  return "neutral";
}

export function classifyProcessActivity(eventType: string): ClassifiedActivity {
  const rule = RULES.find((candidate) => candidate.pattern.test(eventType));
  return { eventType, family: rule?.family ?? "other", temporalRole: rule?.temporalRole ?? temporalRole(eventType), canonical: !!rule };
}

export function buildProcessTaxonomy(eventTypes: readonly string[]): ClassifiedActivity[] {
  return [...new Set(eventTypes)].sort().map(classifyProcessActivity);
}
