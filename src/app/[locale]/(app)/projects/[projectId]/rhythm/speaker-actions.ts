"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import {
  getSpeakerMappings,
  saveSpeakerMappings,
  resetSpeakerMappings,
  getSpeakerOptions,
} from "@/lib/rythm/speaker-service";
import { logRythmActivity } from "@/lib/rythm/activity-log";
import type { RythmSpeakerMapping, RythmSpeakerOption } from "@/lib/rythm/types";

const mappingSchema = z.object({
  originalSpeakerLabel: z.string().min(1).max(40),
  mappedParticipantName: z.string().max(200),
  mappedParticipantEmail: z.string().max(200).optional().nullable(),
});

// ── getSpeakerDataAction ───────────────────────────────────────────────────────

export async function getSpeakerDataAction(input: {
  projectId: string;
  meetingId: string;
  transcriptId: string | null;
}): Promise<{ mappings?: RythmSpeakerMapping[]; options?: RythmSpeakerOption[]; error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = z
    .object({
      projectId: z.string().uuid(),
      meetingId: z.string().uuid(),
      transcriptId: z.string().uuid().nullable(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createClient();
  try {
    const [mappings, options] = await Promise.all([
      getSpeakerMappings(supabase, org.organizationId, parsed.data.meetingId, parsed.data.transcriptId),
      getSpeakerOptions(supabase, org.organizationId, parsed.data.meetingId, parsed.data.projectId),
    ]);
    return { mappings, options };
  } catch (err) {
    console.error("getSpeakerDataAction failed:", err);
    return { error: "list_failed" };
  }
}

// ── saveSpeakerMappingsAction ──────────────────────────────────────────────────

export async function saveSpeakerMappingsAction(input: {
  projectId: string;
  meetingId: string;
  transcriptId: string | null;
  mappings: { originalSpeakerLabel: string; mappedParticipantName: string; mappedParticipantEmail?: string | null }[];
}): Promise<{ ok?: boolean; error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = z
    .object({
      projectId: z.string().uuid(),
      meetingId: z.string().uuid(),
      transcriptId: z.string().uuid().nullable(),
      mappings: z.array(mappingSchema).max(50),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createClient();
  try {
    const result = await saveSpeakerMappings(supabase, org.organizationId, org.userId, {
      projectId: parsed.data.projectId,
      meetingId: parsed.data.meetingId,
      transcriptId: parsed.data.transcriptId,
      mappings: parsed.data.mappings,
    });
    if (!result.ok) return { error: result.errorKey ?? "save_failed" };

    await logRythmActivity(supabase, org.organizationId, {
      projectId: parsed.data.projectId,
      meetingId: parsed.data.meetingId,
      action: "speaker_mapping_saved",
      details: { count: parsed.data.mappings.filter((m) => m.mappedParticipantName.trim()).length },
      userId: org.userId,
    });
    revalidatePath(`/projects/${parsed.data.projectId}/rhythm`);
    return { ok: true };
  } catch (err) {
    console.error("saveSpeakerMappingsAction failed:", err);
    return { error: "save_failed" };
  }
}

// ── resetSpeakerMappingsAction ─────────────────────────────────────────────────

export async function resetSpeakerMappingsAction(input: {
  projectId: string;
  meetingId: string;
  transcriptId: string | null;
}): Promise<{ ok?: boolean; error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  const parsed = z
    .object({
      projectId: z.string().uuid(),
      meetingId: z.string().uuid(),
      transcriptId: z.string().uuid().nullable(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createClient();
  try {
    await resetSpeakerMappings(supabase, org.organizationId, parsed.data.meetingId, parsed.data.transcriptId);
    await logRythmActivity(supabase, org.organizationId, {
      projectId: parsed.data.projectId,
      meetingId: parsed.data.meetingId,
      action: "speaker_mapping_reset",
      userId: org.userId,
    });
    revalidatePath(`/projects/${parsed.data.projectId}/rhythm`);
    return { ok: true };
  } catch (err) {
    console.error("resetSpeakerMappingsAction failed:", err);
    return { error: "reset_failed" };
  }
}
