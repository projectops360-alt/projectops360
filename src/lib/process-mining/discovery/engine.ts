import { analyzeConformance } from "./conformance";
import { discoverCaseVariants, discoverDirectFollow } from "./direct-follow";
import { buildProcessTaxonomy } from "./taxonomy";
import { calculateTemporalMetrics } from "./temporal-metrics";
import type { DeclaredProcessModel, DiscoveryEvent, ProcessDiscoveryResult } from "./types";

export function discoverProcess(events: readonly DiscoveryEvent[], organizationId: string, projectId: string, model?: DeclaredProcessModel): ProcessDiscoveryResult {
  const scoped = events.filter((event) => event.organizationId === organizationId && event.projectId === projectId && event.lifecycleClass === "BUSINESS_EVENT" && !event.isCompensatingEvent);
  if (scoped.length !== events.length && events.some((event) => event.organizationId !== organizationId || event.projectId !== projectId)) throw new Error("process_discovery_scope_mismatch");
  const taxonomy = buildProcessTaxonomy(scoped.map((event) => event.eventType)); const cases = new Set(scoped.map((event) => event.caseId));
  return { organizationId, projectId, taxonomy, directFollow: discoverDirectFollow(scoped), variants: discoverCaseVariants(scoped), conformance: model ? analyzeConformance(scoped, model) : [], temporalMetrics: calculateTemporalMetrics(scoped), quality: { totalEvents: events.length, usedEvents: scoped.length, excludedEvents: events.length - scoped.length, unknownActivities: taxonomy.filter((item) => !item.canonical).length, cases: cases.size } };
}
