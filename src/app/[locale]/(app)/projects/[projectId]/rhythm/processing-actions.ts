"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import {
  prepareAudioForTranscription,
  queueTranscriptionJob,
  getProcessingJobs,
  retryProcessingJob,
  cancelProcessingJob,
} from "@/lib/rythm/processing-service";
import { logRythmActivity } from "@/lib/rythm/activity-log";
import type { RythmProcessingJob } from "@/lib/rythm/types";

const idSchema = z.object({ audioFileId: z.string().uuid() });
const jobSchema = z.object({ jobId: z.string().uuid() });
const meetingSchema = z.object({ meetingId: z.string().uuid() });

// ── prepareAudioForTranscriptionAction ─────────────────────────────────────────

export async function prepareAudioForTranscriptionAction(input: {
  audioFileId: string;
}): Promise<{ ok?: boolean; error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createClient();
  try {
    const result = await prepareAudioForTranscription(supabase, org.organizationId, parsed.data.audioFileId);

    if (result.audio) {
      await logRythmActivity(supabase, org.organizationId, {
        projectId: result.audio.projectId,
        meetingId: result.audio.meetingId,
        audioFileId: result.audio.id,
        action: result.ok ? "audio_prepared" : "validation_failed",
        details: result.ok ? {} : { error: result.errorKey, markedFailed: result.markedFailed ?? false },
        userId: org.userId,
      });
      revalidatePath(`/projects/${result.audio.projectId}/rhythm`);
    }

    if (!result.ok) return { error: result.errorKey ?? "prepare_failed" };
    return { ok: true };
  } catch (err) {
    console.error("prepareAudioForTranscriptionAction failed:", err);
    return { error: "prepare_failed" };
  }
}

// ── queueTranscriptionAction ───────────────────────────────────────────────────

export async function queueTranscriptionAction(input: {
  audioFileId: string;
}): Promise<{ ok?: boolean; jobId?: string; error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createClient();
  try {
    const result = await queueTranscriptionJob(
      supabase,
      org.organizationId,
      org.userId,
      parsed.data.audioFileId,
    );

    if (result.projectId) {
      await logRythmActivity(supabase, org.organizationId, {
        projectId: result.projectId,
        meetingId: result.meetingId,
        audioFileId: parsed.data.audioFileId,
        jobId: result.jobId ?? null,
        action: result.ok ? "transcription_queued" : "validation_failed",
        details: result.ok ? { provider: "assemblyai" } : { error: result.errorKey },
        userId: org.userId,
      });
      revalidatePath(`/projects/${result.projectId}/rhythm`);
    }

    if (!result.ok) return { error: result.errorKey ?? "queue_failed" };
    return { ok: true, jobId: result.jobId };
  } catch (err) {
    console.error("queueTranscriptionAction failed:", err);
    return { error: "queue_failed" };
  }
}

// ── retryProcessingJobAction ───────────────────────────────────────────────────

export async function retryProcessingJobAction(input: {
  jobId: string;
}): Promise<{ ok?: boolean; error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = jobSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createClient();
  try {
    const result = await retryProcessingJob(supabase, org.organizationId, parsed.data.jobId);
    if (result.ok && result.projectId) {
      await logRythmActivity(supabase, org.organizationId, {
        projectId: result.projectId,
        meetingId: result.meetingId,
        audioFileId: result.audioFileId ?? null,
        jobId: parsed.data.jobId,
        action: "job_retried",
        userId: org.userId,
      });
      revalidatePath(`/projects/${result.projectId}/rhythm`);
    }
    if (!result.ok) return { error: result.errorKey ?? "retry_failed" };
    return { ok: true };
  } catch (err) {
    console.error("retryProcessingJobAction failed:", err);
    return { error: "retry_failed" };
  }
}

// ── cancelProcessingJobAction ──────────────────────────────────────────────────

export async function cancelProcessingJobAction(input: {
  jobId: string;
}): Promise<{ ok?: boolean; error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = jobSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createClient();
  try {
    const result = await cancelProcessingJob(supabase, org.organizationId, parsed.data.jobId);
    if (result.ok && result.projectId) {
      await logRythmActivity(supabase, org.organizationId, {
        projectId: result.projectId,
        meetingId: result.meetingId,
        audioFileId: result.audioFileId ?? null,
        jobId: parsed.data.jobId,
        action: "job_cancelled",
        userId: org.userId,
      });
      revalidatePath(`/projects/${result.projectId}/rhythm`);
    }
    if (!result.ok) return { error: result.errorKey ?? "cancel_failed" };
    return { ok: true };
  } catch (err) {
    console.error("cancelProcessingJobAction failed:", err);
    return { error: "cancel_failed" };
  }
}

// ── listProcessingJobsAction ───────────────────────────────────────────────────

export async function listProcessingJobsAction(input: {
  meetingId: string;
}): Promise<{ jobs?: RythmProcessingJob[]; error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = meetingSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createClient();
  try {
    const jobs = await getProcessingJobs(supabase, org.organizationId, parsed.data.meetingId);
    return { jobs };
  } catch (err) {
    console.error("listProcessingJobsAction failed:", err);
    return { error: "list_failed" };
  }
}
