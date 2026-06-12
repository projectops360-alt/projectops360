// ============================================================================
// ProjectOps360° — Drawing Source Event Abstraction (Prompt 5)
// ============================================================================
// Internal event contract decoupling external webhooks (Autodesk dm.version.
// added, future Procore/Drive events) from the ingestion pipeline. External
// payloads are mapped to DrawingSourceEvent by the webhook route, validated,
// and dispatched here.
// ============================================================================

import { z } from "zod";

export const drawingSourceEventSchema = z.object({
  type: z.enum([
    "file.created",
    "file.updated",
    "file.version.created",
    "file.deleted",
    "model.translated",
    "extraction.completed",
  ]),
  sourceSystem: z.enum(["autodesk_aps", "procore", "google_drive", "internal"]),
  organizationId: z.string().uuid(),
  projectId: z.string().uuid(),
  /** External lineage/file id in the source system */
  externalId: z.string().min(1).max(500),
  /** External version id when the event is version-scoped */
  externalVersionId: z.string().max(500).optional(),
  fileName: z.string().max(300).optional(),
  occurredAt: z.string().datetime().optional(),
});

export type DrawingSourceEvent = z.infer<typeof drawingSourceEventSchema>;

export interface EventDispatchResult {
  handled: boolean;
  action: string;
}

/**
 * Dispatch a validated source event. Today: records the event intent and
 * marks matching drawing_files for re-sync. File download/import from the
 * external source activates once connector credentials are configured —
 * we never fake a successful sync.
 */
export async function handleDrawingSourceEvent(
  event: DrawingSourceEvent,
): Promise<EventDispatchResult> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  switch (event.type) {
    case "file.version.created":
    case "file.updated": {
      // Mark the matching imported file as having a newer external version.
      const { data: existing } = await supabase
        .from("drawing_files")
        .select("id, metadata")
        .eq("organization_id", event.organizationId)
        .eq("project_id", event.projectId)
        .eq("source_external_id", event.externalId)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("drawing_files")
          .update({
            metadata: {
              ...existing.metadata,
              pending_external_version: event.externalVersionId ?? null,
              external_event_at: event.occurredAt ?? new Date().toISOString(),
            },
          })
          .eq("id", existing.id);
        return { handled: true, action: "marked_pending_version_sync" };
      }
      return { handled: false, action: "no_matching_file" };
    }

    case "file.deleted": {
      const { data: existing } = await supabase
        .from("drawing_files")
        .select("id")
        .eq("organization_id", event.organizationId)
        .eq("project_id", event.projectId)
        .eq("source_external_id", event.externalId)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("drawing_files")
          .update({ status: "archived" })
          .eq("id", existing.id);
        return { handled: true, action: "archived_external_file" };
      }
      return { handled: false, action: "no_matching_file" };
    }

    case "file.created":
      // Import requires a configured connector (download URL resolution).
      // TODO(prompt-5+): call connector.importFile() when credentials exist.
      return { handled: false, action: "import_requires_configured_connector" };

    case "model.translated":
      // TODO(prompt-5+): Model Derivative manifest → bim_* scaffolding.
      return { handled: false, action: "model_derivative_not_implemented" };

    case "extraction.completed":
      return { handled: true, action: "noop_internal_event" };
  }
}
