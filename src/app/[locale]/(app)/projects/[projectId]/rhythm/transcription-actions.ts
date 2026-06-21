"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import {
  submitTranscription,
  pollTranscription,
  getMeetingTranscript,
} from "@/lib/rythm/transcription-service";
import { logRythmActivity } from "@/lib/rythm/activity-log";
import type { RythmTranscript } from "@/lib/rythm/types";

// ── submitTranscriptionAction (Queue Transcription / Retry) ────────────────────

export async function submitTranscriptionAction(input: {
  audioFileId: string;
  isRetry?: boolean;
}): Promise<{ ok?: boolean; jobId?: string; error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = z
    .object({ audioFileId: z.string().uuid(), isRetry: z.boolean().optional() })
    .safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createClient();
  try {
    const result = await submitTranscription(
      supabase,
      org.organizationId,
      org.userId,
      parsed.data.audioFileId,
    );

    if (result.projectId) {
      if (parsed.data.isRetry) {
        await logRythmActivity(supabase, org.organizationId, {
          projectId: result.projectId,
          meetingId: result.meetingId,
          audioFileId: parsed.data.audioFileId,
          jobId: result.jobId ?? null,
          action: "transcription_retried",
          userId: org.userId,
        });
      }
      await logRythmActivity(supabase, org.organizationId, {
        projectId: result.projectId,
        meetingId: result.meetingId,
        audioFileId: parsed.data.audioFileId,
        jobId: result.jobId ?? null,
        action: result.ok ? "transcription_started" : "transcription_failed",
        details: result.ok ? { provider: "assemblyai" } : { error: result.errorKey },
        userId: org.userId,
      });
      revalidatePath(`/projects/${result.projectId}/rhythm`);
    }

    if (!result.ok) return { error: result.errorKey ?? "queue_failed" };
    return { ok: true, jobId: result.jobId };
  } catch (err) {
    console.error("submitTranscriptionAction failed:", err);
    return { error: "queue_failed" };
  }
}

// ── pollTranscriptionAction (client polls while processing) ────────────────────

export async function pollTranscriptionAction(input: {
  jobId: string;
}): Promise<{ status: "processing" | "completed" | "failed"; error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { status: "failed", error: "not_authenticated" };
  }
  const parsed = z.object({ jobId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { status: "failed", error: "invalid_input" };

  const supabase = await createClient();
  try {
    const result = await pollTranscription(supabase, org.organizationId, parsed.data.jobId);

    if ((result.status === "completed" || result.status === "failed") && result.projectId) {
      await logRythmActivity(supabase, org.organizationId, {
        projectId: result.projectId,
        meetingId: result.meetingId,
        jobId: parsed.data.jobId,
        action: result.status === "completed" ? "transcription_completed" : "transcription_failed",
        details: result.status === "failed" ? { error: result.error ?? result.errorKey } : {},
        userId: org.userId,
      });
      revalidatePath(`/projects/${result.projectId}/rhythm`);
    }

    return { status: result.status, error: result.error ?? result.errorKey };
  } catch (err) {
    console.error("pollTranscriptionAction failed:", err);
    return { status: "processing" }; // transient — let the client poll again
  }
}

// ── getMeetingTranscriptAction (viewer) ────────────────────────────────────────

export async function getMeetingTranscriptAction(input: {
  meetingId: string;
}): Promise<{ transcript?: RythmTranscript | null; error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = z.object({ meetingId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createClient();
  try {
    const transcript = await getMeetingTranscript(supabase, org.organizationId, parsed.data.meetingId);
    return { transcript };
  } catch (err) {
    console.error("getMeetingTranscriptAction failed:", err);
    return { error: "list_failed" };
  }
}
