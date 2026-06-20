// ============================================================================
// Rythm activity log — audit trail writer
// ============================================================================
// Never throws: an audit-log failure must not break the user's action.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RythmActivityAction } from "./types";

export interface RythmActivityInput {
  projectId: string;
  meetingId?: string | null;
  audioFileId?: string | null;
  jobId?: string | null;
  action: RythmActivityAction;
  details?: Record<string, unknown>;
  userId?: string | null;
}

export async function logRythmActivity(
  supabase: SupabaseClient,
  orgId: string,
  input: RythmActivityInput,
): Promise<void> {
  try {
    const { error } = await supabase.from("project_rythm_activity_log").insert({
      organization_id: orgId,
      project_id: input.projectId,
      meeting_id: input.meetingId ?? null,
      audio_file_id: input.audioFileId ?? null,
      job_id: input.jobId ?? null,
      action: input.action,
      details: input.details ?? {},
      created_by: input.userId ?? null,
    });
    if (error) console.error("rythm activity log failed:", error.message);
  } catch (err) {
    console.error("rythm activity log error:", err);
  }
}
