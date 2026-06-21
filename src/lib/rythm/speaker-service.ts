// ============================================================================
// rythmSpeakerService — map generic speaker labels to real participants
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RythmSpeakerMapping,
  RythmSpeakerOption,
  RythmTranscriptUtterance,
  SpeakerMappingInput,
} from "./types";

type DB = SupabaseClient;
const TRANS = "project_rythm_transcripts";
const MAP = "project_rythm_speaker_mappings";

// ── getDetectedSpeakers ────────────────────────────────────────────────────────
// Distinct speaker labels from a transcript's utterances, in first-seen order.

export async function getDetectedSpeakers(
  supabase: DB,
  orgId: string,
  transcriptId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from(TRANS)
    .select("utterances")
    .eq("organization_id", orgId)
    .eq("id", transcriptId)
    .maybeSingle();
  if (error || !data) return [];
  const utterances = (Array.isArray(data.utterances) ? data.utterances : []) as RythmTranscriptUtterance[];
  return detectedSpeakersFromUtterances(utterances);
}

/** Pure helper — distinct speaker labels in first-seen order. */
export function detectedSpeakersFromUtterances(utterances: RythmTranscriptUtterance[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of utterances) {
    if (u.speaker && !seen.has(u.speaker)) {
      seen.add(u.speaker);
      out.push(u.speaker);
    }
  }
  return out;
}

// ── getSpeakerMappings ─────────────────────────────────────────────────────────

const MAP_COLS =
  "id, meeting_id, transcript_id, original_speaker_label, mapped_participant_name, mapped_participant_email, confidence, created_at";

interface MapRow {
  id: string;
  meeting_id: string;
  transcript_id: string | null;
  original_speaker_label: string;
  mapped_participant_name: string;
  mapped_participant_email: string | null;
  confidence: string;
  created_at: string;
}

function mapMapping(row: MapRow): RythmSpeakerMapping {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    transcriptId: row.transcript_id,
    originalSpeakerLabel: row.original_speaker_label,
    mappedParticipantName: row.mapped_participant_name,
    mappedParticipantEmail: row.mapped_participant_email,
    confidence: row.confidence,
    createdAt: row.created_at,
  };
}

export async function getSpeakerMappings(
  supabase: DB,
  orgId: string,
  meetingId: string,
  transcriptId: string | null,
): Promise<RythmSpeakerMapping[]> {
  let query = supabase
    .from(MAP)
    .select(MAP_COLS)
    .eq("organization_id", orgId)
    .eq("meeting_id", meetingId);
  query = transcriptId ? query.eq("transcript_id", transcriptId) : query.is("transcript_id", null);
  const { data, error } = await query;
  if (error) throw error;
  return (data as MapRow[]).map(mapMapping);
}

// ── saveSpeakerMappings (clean replace) ────────────────────────────────────────

export async function saveSpeakerMappings(
  supabase: DB,
  orgId: string,
  userId: string | null,
  params: { projectId: string; meetingId: string; transcriptId: string | null; mappings: SpeakerMappingInput[] },
): Promise<{ ok: boolean; errorKey?: string }> {
  const valid = params.mappings.filter((m) => m.mappedParticipantName.trim().length > 0);
  if (params.mappings.length > 0 && valid.length === 0)
    return { ok: false, errorKey: "errorEmptyName" };

  await resetSpeakerMappings(supabase, orgId, params.meetingId, params.transcriptId);

  if (valid.length === 0) return { ok: true };

  const rows = valid.map((m) => ({
    organization_id: orgId,
    project_id: params.projectId,
    meeting_id: params.meetingId,
    transcript_id: params.transcriptId,
    original_speaker_label: m.originalSpeakerLabel,
    mapped_participant_name: m.mappedParticipantName.trim(),
    mapped_participant_email: m.mappedParticipantEmail?.trim() || null,
    confidence: "manual",
    created_by: userId,
  }));

  const { error } = await supabase.from(MAP).insert(rows);
  if (error) return { ok: false, errorKey: "save_failed" };
  return { ok: true };
}

// ── resetSpeakerMappings ───────────────────────────────────────────────────────

export async function resetSpeakerMappings(
  supabase: DB,
  orgId: string,
  meetingId: string,
  transcriptId: string | null,
): Promise<void> {
  let query = supabase.from(MAP).delete().eq("organization_id", orgId).eq("meeting_id", meetingId);
  query = transcriptId ? query.eq("transcript_id", transcriptId) : query.is("transcript_id", null);
  const { error } = await query;
  if (error) throw error;
}

// ── getSpeakerOptions (attendees + project stakeholders) ───────────────────────

export async function getSpeakerOptions(
  supabase: DB,
  orgId: string,
  meetingId: string,
  projectId: string,
): Promise<RythmSpeakerOption[]> {
  const [attendeesRes, stakeholdersRes] = await Promise.all([
    supabase
      .from("meeting_attendees")
      .select("name, stakeholder_id")
      .eq("organization_id", orgId)
      .eq("meeting_id", meetingId),
    supabase
      .from("stakeholders")
      .select("name")
      .eq("organization_id", orgId)
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .limit(200),
  ]);

  const out: RythmSpeakerOption[] = [];
  const seen = new Set<string>();

  const pushName = (name: string | null | undefined, source: RythmSpeakerOption["source"]) => {
    const n = (name ?? "").trim();
    if (!n || seen.has(n.toLowerCase())) return;
    seen.add(n.toLowerCase());
    out.push({ name: n, email: null, source });
  };

  // Attendees first (meeting-specific suggestions), then project stakeholders.
  // Attendees linked only via stakeholder_id surface through the stakeholders list.
  for (const a of attendeesRes.data ?? []) pushName(a.name, "attendee");
  for (const s of stakeholdersRes.data ?? []) pushName(s.name, "stakeholder");

  return out;
}

// ── applySpeakerMappingsToUtterances (pure) ────────────────────────────────────

export function applySpeakerMappingsToUtterances(
  utterances: RythmTranscriptUtterance[],
  mappings: RythmSpeakerMapping[],
): Array<RythmTranscriptUtterance & { mappedName: string | null }> {
  const byLabel = new Map(mappings.map((m) => [m.originalSpeakerLabel, m.mappedParticipantName]));
  return utterances.map((u) => ({ ...u, mappedName: byLabel.get(u.speaker) ?? null }));
}
