import { orderedCaseEvents } from "./direct-follow";
import type { CaseConformance, ConformanceDeviation, DeclaredProcessModel, DiscoveryEvent } from "./types";

export function analyzeConformance(events: readonly DiscoveryEvent[], model: DeclaredProcessModel): CaseConformance[] {
  const allowed = new Set(model.allowedTransitions.map(([source, target]) => `${source}\0${target}`));
  return [...orderedCaseEvents(events)].map(([caseId, rows]) => {
    const deviations: ConformanceDeviation[] = []; const signature = rows.map((row) => row.eventType);
    if (signature[0] && !model.allowedStarts.includes(signature[0])) deviations.push({ caseId, type: "invalid_start", activity: signature[0], sourceActivity: null, targetActivity: null });
    const end = signature.at(-1); if (end && !model.allowedEnds.includes(end)) deviations.push({ caseId, type: "invalid_end", activity: end, sourceActivity: null, targetActivity: null });
    signature.forEach((source, index) => { const target = signature[index + 1]; if (target && !allowed.has(`${source}\0${target}`)) deviations.push({ caseId, type: "illegal_transition", activity: null, sourceActivity: source, targetActivity: target }); });
    for (const activity of model.requiredActivities) if (!signature.includes(activity)) deviations.push({ caseId, type: "missing_required_activity", activity, sourceActivity: null, targetActivity: null });
    const opportunities = Math.max(1, signature.length + model.requiredActivities.length); return { caseId, conformant: deviations.length === 0, fitness: Math.max(0, Math.round((1 - deviations.length / opportunities) * 10000) / 10000), deviations };
  }).sort((a, b) => a.caseId.localeCompare(b.caseId));
}
