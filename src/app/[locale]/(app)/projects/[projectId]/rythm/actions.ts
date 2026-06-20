"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  createRythmMeeting,
  getRythmMeeting,
  registerAudioFile,
  updateMeetingStatus,
  createProcessingJob,
} from "@/lib/rythm/meeting-service";
import type { RythmMeetingStatus } from "@/lib/rythm/types";

// ── Schemas ────────────────────────────────────────────────────────────────────

const participantSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(200).optional(),
  role: z.string().max(120).optional(),
});

const createMeetingSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1, "titleRequired").max(200).transform((s) => s.trim()),
  meetingType: z.enum(["in_person", "video_call", "uploaded_audio"]),
  meetingPlatform: z.string().max(120).optional().nullable(),
  meetingUrl: z.string().max(500).optional().nullable(),
  meetingDate: z.string().optional().nullable(),
  participants: z.array(participantSchema).max(100).optional().default([]),
});

const registerAudioSchema = z.object({
  projectId: z.string().uuid(),
  meetingId: z.string().uuid(),
  storagePath: z.string().min(1).max(1000),
  fileName: z.string().min(1).max(300),
  fileType: z.string().min(1).max(120),
  fileSize: z.number().int().nonnegative().optional().nullable(),
  durationSeconds: z.number().int().nonnegative().optional().nullable(),
  source: z.enum(["browser_recording", "manual_upload"]),
});

const meetingStatusValues = [
  "draft",
  "recording",
  "audio_uploaded",
  "ready_for_transcription",
  "transcribing",
  "transcribed",
  "summary_ready",
  "failed",
] as const;

const updateStatusSchema = z.object({
  projectId: z.string().uuid(),
  meetingId: z.string().uuid(),
  status: z.enum(meetingStatusValues),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "invalid_input";
}

// ── createRythmMeetingAction ───────────────────────────────────────────────────

export async function createRythmMeetingAction(input: {
  projectId: string;
  title: string;
  meetingType: string;
  meetingPlatform?: string | null;
  meetingUrl?: string | null;
  meetingDate?: string | null;
  participants?: { name: string; email?: string; role?: string }[];
}): Promise<{ meetingId?: string; error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const parsed = createMeetingSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  try {
    const meeting = await createRythmMeeting(supabase, org.organizationId, org.userId, parsed.data);

    await logAudit({
      org,
      projectId: parsed.data.projectId,
      action: "create",
      entityType: "rythm_meeting",
      entityId: meeting.id,
      metadata: { meeting_type: meeting.meetingType, title: meeting.title },
    });

    revalidatePath(`/projects/${parsed.data.projectId}/rythm`);
    return { meetingId: meeting.id };
  } catch (err) {
    console.error("createRythmMeetingAction failed:", err);
    return { error: "create_failed" };
  }
}

// ── registerRythmAudioAction ───────────────────────────────────────────────────
// Called by rythmStorageService AFTER the object lands in the bucket.
// Inserts the audio row, advances meeting + audio status to
// ready_for_transcription, and enqueues a queued transcription job.

export async function registerRythmAudioAction(input: {
  projectId: string;
  meetingId: string;
  storagePath: string;
  fileName: string;
  fileType: string;
  fileSize?: number | null;
  durationSeconds?: number | null;
  source: "browser_recording" | "manual_upload";
}): Promise<{ audioFileId?: string; error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const parsed = registerAudioSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();

  try {
    // Defence in depth: the meeting must belong to the caller's org + project.
    const meeting = await getRythmMeeting(supabase, org.organizationId, parsed.data.meetingId);
    if (!meeting || meeting.projectId !== parsed.data.projectId) {
      return { error: "meeting_not_found" };
    }

    const audio = await registerAudioFile(supabase, org.organizationId, org.userId, parsed.data);

    // Status logic: audio saved → meeting ready_for_transcription.
    await updateMeetingStatus(
      supabase,
      org.organizationId,
      parsed.data.meetingId,
      "ready_for_transcription",
    );

    // Enqueue the transcription job (no worker drains it yet — see TODO below).
    // TODO(Rythm): a background worker consumes queued 'transcription' jobs,
    // calls AssemblyAI, writes project_rythm_transcripts, then enqueues
    // 'summary' (OpenAI) + 'embedding' jobs to feed Project Memory.
    await createProcessingJob(supabase, org.organizationId, {
      meetingId: parsed.data.meetingId,
      audioFileId: audio.id,
      projectId: parsed.data.projectId,
      jobType: "transcription",
    });

    await logAudit({
      org,
      projectId: parsed.data.projectId,
      action: "create",
      entityType: "rythm_audio_file",
      entityId: audio.id,
      metadata: { meeting_id: parsed.data.meetingId, source: parsed.data.source },
    });

    revalidatePath(`/projects/${parsed.data.projectId}/rythm`);
    revalidatePath(`/projects/${parsed.data.projectId}/rythm/${parsed.data.meetingId}`);
    return { audioFileId: audio.id };
  } catch (err) {
    console.error("registerRythmAudioAction failed:", err);
    return { error: "register_failed" };
  }
}

// ── updateRythmMeetingStatusAction ─────────────────────────────────────────────
// Used by the recorder to flip the meeting to 'recording' when capture starts.

export async function updateRythmMeetingStatusAction(input: {
  projectId: string;
  meetingId: string;
  status: RythmMeetingStatus;
}): Promise<{ error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const parsed = updateStatusSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  try {
    await updateMeetingStatus(
      supabase,
      org.organizationId,
      parsed.data.meetingId,
      parsed.data.status,
    );
    revalidatePath(`/projects/${parsed.data.projectId}/rythm/${parsed.data.meetingId}`);
    return {};
  } catch (err) {
    console.error("updateRythmMeetingStatusAction failed:", err);
    return { error: "update_failed" };
  }
}

// ── getRythmAudioUrlAction ─────────────────────────────────────────────────────
// Issues a short-lived signed URL so the browser can play a private object.

export async function getRythmAudioUrlAction(input: {
  audioFileId: string;
}): Promise<{ url?: string; error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }

  const parsed = z.object({ audioFileId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createClient();
  try {
    const { data: audio, error } = await supabase
      .from("project_rythm_audio_files")
      .select("storage_bucket, storage_path")
      .eq("organization_id", org.organizationId)
      .eq("id", parsed.data.audioFileId)
      .maybeSingle();

    if (error || !audio) return { error: "audio_not_found" };

    const { data: signed, error: signError } = await supabase.storage
      .from(audio.storage_bucket)
      .createSignedUrl(audio.storage_path, 60 * 60); // 1 hour

    if (signError || !signed) return { error: "sign_failed" };
    return { url: signed.signedUrl };
  } catch (err) {
    console.error("getRythmAudioUrlAction failed:", err);
    return { error: "sign_failed" };
  }
}
