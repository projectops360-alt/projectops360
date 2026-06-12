import { createAdminClient } from "@/lib/supabase/admin";
import type { AuditAction } from "@/types/database";

// ── Types ───────────────────────────────────────────────────────────────────────

interface LogAuditInput {
  org: {
    organizationId: string;
    userId: string;
  };
  projectId?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

// ── logAudit ────────────────────────────────────────────────────────────────────

/**
 * Insert an audit log entry after a critical record change.
 *
 * IMPORTANT: This function never throws. If the insert fails, the error is
 * logged to console but the parent operation continues. Audit logging must
 * never break the user's action.
 */
export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    const supabase = createAdminClient();

    const { error } = await supabase.from("audit_logs").insert({
      organization_id: input.org.organizationId,
      project_id: input.projectId ?? null,
      actor_user_id: input.org.userId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      metadata: input.metadata ?? {},
    });

    if (error) {
      console.error("Audit log insert failed:", error.message);
    }
  } catch (err) {
    console.error("Audit log error:", err);
  }
}