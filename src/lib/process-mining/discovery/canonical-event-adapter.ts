import type { LivingGraphCanonicalEvent } from "@/types/living-graph";
import type { DiscoveryEvent } from "./types";

export interface CanonicalDiscoveryInput {
  events: DiscoveryEvent[];
  excludedEventIds: string[];
}

export function adaptCanonicalEventsForDiscovery(
  canonicalEvents: readonly LivingGraphCanonicalEvent[],
): CanonicalDiscoveryInput {
  const events: DiscoveryEvent[] = [];
  const excludedEventIds: string[] = [];

  for (const event of canonicalEvents) {
    if (!event.caseId || !event.recordedAt || !event.lifecycleClass) {
      excludedEventIds.push(event.eventId);
      continue;
    }

    events.push({
      eventId: event.eventId,
      organizationId: event.organizationId,
      projectId: event.projectId,
      caseId: event.caseId,
      eventType: event.eventType,
      eventCategory: event.eventCategory,
      occurredAt: event.occurredAt,
      recordedAt: event.recordedAt,
      sequenceNumber: event.sequenceNumber,
      lifecycleClass: event.lifecycleClass,
      isCompensatingEvent: event.isCompensatingEvent,
    });
  }

  return { events, excludedEventIds };
}
