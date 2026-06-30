"use server";

// ============================================================================
// Evidence Provenance — UI server action (PD-012)
// ============================================================================
// Thin wrapper over the provenance service. Authorization (org scope + role +
// excerpt redaction for viewers) happens inside getEntityProvenance from the
// trusted session; the client-supplied ids are lookup keys only.
// ============================================================================

import { getEntityProvenance } from "@/lib/provenance/service";
import { getProjectProvenanceSummary } from "@/lib/provenance/service";
import type { EntityProvenanceResult, ProjectProvenanceResult } from "@/lib/provenance/types";
import type { Locale } from "@/types/database";

export async function getEntityProvenanceAction(input: {
  entityType: string;
  entityId: string;
  projectId: string;
  locale: Locale;
}): Promise<EntityProvenanceResult> {
  return getEntityProvenance(input.entityType, input.entityId, input.projectId, input.locale);
}

export async function getProjectProvenanceSummaryAction(
  projectId: string,
): Promise<ProjectProvenanceResult> {
  return getProjectProvenanceSummary(projectId);
}
