"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  meetingBelongsToProject,
  listAudioFiles,
  registerAudioFile,
  createProcessingJob,
} from "@/lib/rythm/meeting-service";
import type { RythmAudioFile } from "@/lib/rythm/types";

// ── Schemas ────────────────────────────────────────────────────────────────────

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

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "invalid_input";
}

// ── listRythmAudioAction ───────────────────────────────────────────────────────

export async function listRythmAudioAction(input: {
  meetingId: string;
}): Promise<{ audioFiles?: RythmAudioFile[]; error?: string }> {
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
    const audioFiles = await listAudioFiles(supabase, org.organizationId, parsed.data.meetingId);
    return { audioFiles };
  } catch (err) {
    console.error("listRythmAudioAction failed:", err);
    return { error: "list_failed" };
  }
}

// ── registerRythmAudioAction ───────────────────────────────────────────────────
// Called by rythmStorageService AFTER the object lands in the bucket.
// Inserts the audio row (status=ready_for_transcription) and enqueues a queued
// transcription job. The Rhythm Center owns the meeting's own status, so we do
// NOT touch meetings.meeting_status here.

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
    const ok = await meetingBelongsToProject(
      supabase,
      org.organizationId,
      parsed.data.projectId,
      parsed.data.meetingId,
    );
    if (!ok) return { error: "meeting_not_found" };

    const audio = await registerAudioFile(supabase, org.organizationId, org.userId, parsed.data);

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

    revalidatePath(`/projects/${parsed.data.projectId}/rhythm`);
    return { audioFileId: audio.id };
  } catch (err) {
    console.error("registerRythmAudioAction failed:", err);
    return { error: "register_failed" };
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
