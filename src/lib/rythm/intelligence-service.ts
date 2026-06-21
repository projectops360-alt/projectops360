// ============================================================================
// intelligence-service — Rythm Meeting Intelligence engine (SERVER-ONLY)
// ============================================================================
// Turns a meeting transcript into STRUCTURED project knowledge (decisions,
// action items, risks, blockers, assumptions, dependencies, milestones,
// commitments) via OpenAI. This is an extraction engine, NOT a summarizer.
// Imports OpenAiProvider which reads OPENAI_API_KEY — never client-imported.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { OpenAiProvider } from "@/lib/ai";
import { getI18nValue } from "@/types/database";
import type { Locale, I18nField, AgendaSection } from "@/types/database";
import { getMeetingTranscript } from "./transcription-service";
import { getSpeakerMappings } from "./speaker-service";
import type {
  RythmIntelligence,
  IntelDecision,
  IntelActionItem,
  IntelRisk,
  IntelItem,
} from "./types";

type DB = SupabaseClient;
const TABLE = "project_rythm_intelligence";
const MODEL = "gpt-4o-mini";

// ── Meeting context ─────────────────────────────────────────────────────────

export interface MeetingIntelligenceContext {
  projectId: string;
  meetingId: string;
  projectName: string;
  meetingTitle: string;
  meetingDate: string | null;
  objective: string | null;
  expectedOutcome: string | null;
  agenda: AgendaSection[];
  attributedTranscript: string;
  hasTranscript: boolean;
}

/** Gathers everything the engine needs (metadata + agenda + attributed transcript). */
export async function getMeetingIntelligenceContext(
  supabase: DB,
  orgId: string,
  projectId: string,
  meetingId: string,
  locale: Locale,
): Promise<MeetingIntelligenceContext | null> {
  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, event_id, objective, expected_outcome, agenda_json, project_id")
    .eq("id", meetingId)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!meeting || meeting.project_id !== projectId) return null;

  const [eventRes, projectRes, transcript, mappings] = await Promise.all([
    meeting.event_id
      ? supabase.from("project_events").select("title, start_datetime").eq("id", meeting.event_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("projects").select("title_i18n").eq("id", projectId).maybeSingle(),
    getMeetingTranscript(supabase, orgId, meetingId),
    getSpeakerMappings(supabase, orgId, meetingId, null),
  ]);

  const nameByLabel = new Map(mappings.map((m) => [m.originalSpeakerLabel, m.mappedParticipantName]));

  // Build a speaker-attributed transcript ("Efraín: ...").
  let attributedTranscript = "";
  if (transcript?.utterances?.length) {
    attributedTranscript = transcript.utterances
      .map((u) => `${nameByLabel.get(u.speaker) ?? `Speaker ${u.speaker}`}: ${u.text}`)
      .join("\n");
  } else if (transcript?.transcriptText) {
    attributedTranscript = transcript.transcriptText;
  }

  return {
    projectId,
    meetingId,
    projectName: getI18nValue(projectRes.data?.title_i18n as I18nField, locale) || "Project",
    meetingTitle: (eventRes.data?.title as string) || "Meeting",
    meetingDate: (eventRes.data?.start_datetime as string) ?? null,
    objective: meeting.objective ?? null,
    expectedOutcome: meeting.expected_outcome ?? null,
    agenda: (meeting.agenda_json ?? []) as AgendaSection[],
    attributedTranscript,
    hasTranscript: attributedTranscript.trim().length > 0,
  };
}

// ── Prompt ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a Principal PMO intelligence engine for ProjectOps360°.
Your job is to convert a meeting transcript into STRUCTURED, ACTIONABLE project knowledge.
This is NOT a meeting summary feature — extract concrete project intelligence.

EXTRACTION PRIORITIES (in order):
1. Explicit commitments ("I will...", "we agreed to...")
2. Named owners (use the real participant names from the transcript)
3. Dates and deadlines
4. Risks
5. Dependencies
6. Decisions

RULES:
- NEVER invent information. Only extract what is supported by the transcript.
- If you are uncertain about an item, set its "confidence" below 0.5.
- "confidence" is a number from 0.0 to 1.0.
- Owners must be real names mentioned in the transcript; use "" if none is stated.
- due_date must be an ISO date "YYYY-MM-DD" or null. Never guess a date.
- action_items.priority must be exactly "high", "medium", or "low".
- The executive_summary is one short paragraph of factual project context (not a transcript recap).
- Return ONLY valid JSON matching the schema. No prose, no markdown.

OUTPUT SCHEMA:
{
  "executive_summary": "",
  "decisions": [{"title":"","description":"","owner":"","confidence":0.0}],
  "action_items": [{"task":"","owner":"","due_date":null,"priority":"high|medium|low","confidence":0.0}],
  "risks": [{"description":"","impact":"","owner":"","confidence":0.0}],
  "blockers": [{"description":"","owner":"","confidence":0.0}],
  "assumptions": [{"description":"","confidence":0.0}],
  "dependencies": [{"description":"","owner":"","confidence":0.0}],
  "milestones": [{"title":"","due_date":null,"confidence":0.0}],
  "commitments": [{"description":"","owner":"","confidence":0.0}]
}`;

function buildUserPrompt(ctx: MeetingIntelligenceContext): string {
  const agenda = ctx.agenda.length
    ? ctx.agenda.map((s) => `- ${s.title}${s.content ? `: ${s.content}` : ""}`).join("\n")
    : "(none)";
  return [
    `MEETING TITLE: ${ctx.meetingTitle}`,
    `MEETING DATE: ${ctx.meetingDate ?? "(unknown)"}`,
    `PROJECT: ${ctx.projectName}`,
    `OBJECTIVE: ${ctx.objective ?? "(none)"}`,
    `EXPECTED OUTCOME: ${ctx.expectedOutcome ?? "(none)"}`,
    ``,
    `AGENDA:`,
    agenda,
    ``,
    `TRANSCRIPT (speaker-attributed):`,
    ctx.attributedTranscript || "(empty)",
  ].join("\n");
}

// ── Normalization ─────────────────────────────────────────────────────────────

function clamp01(n: unknown): number {
  return typeof n === "number" ? Math.min(1, Math.max(0, n)) : 0.5;
}
function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function isoDateOrNull(v: unknown): string | null {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}
function arr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}

interface ExtractedIntelligence {
  executiveSummary: string;
  decisions: IntelDecision[];
  actionItems: IntelActionItem[];
  risks: IntelRisk[];
  blockers: IntelItem[];
  assumptions: IntelItem[];
  dependencies: IntelItem[];
  milestones: IntelItem[];
  commitments: IntelItem[];
  confidenceScore: number;
  model: string;
}

function genericItem(o: Record<string, unknown>): IntelItem {
  return {
    title: str(o.title) || undefined,
    description: str(o.description) || undefined,
    owner: str(o.owner) || undefined,
    due_date: isoDateOrNull(o.due_date),
    confidence: clamp01(o.confidence),
  };
}

function normalize(raw: Record<string, unknown>, model: string): ExtractedIntelligence {
  const decisions: IntelDecision[] = arr(raw.decisions)
    .filter((d) => str(d.title) || str(d.description))
    .map((d) => ({ title: str(d.title), description: str(d.description), owner: str(d.owner), confidence: clamp01(d.confidence) }));

  const actionItems: IntelActionItem[] = arr(raw.action_items)
    .filter((a) => str(a.task))
    .map((a) => ({
      task: str(a.task),
      owner: str(a.owner),
      due_date: isoDateOrNull(a.due_date),
      priority: (["high", "medium", "low"].includes(String(a.priority)) ? a.priority : "medium") as IntelActionItem["priority"],
      confidence: clamp01(a.confidence),
    }));

  const risks: IntelRisk[] = arr(raw.risks)
    .filter((r) => str(r.description))
    .map((r) => ({ description: str(r.description), impact: str(r.impact), owner: str(r.owner), confidence: clamp01(r.confidence) }));

  const mapGeneric = (key: string) => arr(raw[key]).filter((o) => str(o.title) || str(o.description)).map(genericItem);

  const all = [...decisions, ...actionItems, ...risks].map((x) => x.confidence);
  const confidenceScore = all.length ? all.reduce((s, c) => s + c, 0) / all.length : 0.5;

  return {
    executiveSummary: str(raw.executive_summary),
    decisions,
    actionItems,
    risks,
    blockers: mapGeneric("blockers"),
    assumptions: mapGeneric("assumptions"),
    dependencies: mapGeneric("dependencies"),
    milestones: mapGeneric("milestones"),
    commitments: mapGeneric("commitments"),
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    model,
  };
}

// ── Engine ────────────────────────────────────────────────────────────────────

export async function extractIntelligence(
  ctx: MeetingIntelligenceContext,
): Promise<ExtractedIntelligence> {
  const provider = new OpenAiProvider();
  const result = await provider.generate(SYSTEM_PROMPT, buildUserPrompt(ctx), {
    model: MODEL,
    temperature: 0.1,
    maxTokens: 3000,
    jsonMode: true,
  });
  if (!result.parsedJson) throw new Error("ai_invalid_json");
  return normalize(result.parsedJson, result.model || MODEL);
}

// ── Persistence ─────────────────────────────────────────────────────────────

export async function upsertIntelligence(
  supabase: DB,
  orgId: string,
  userId: string | null,
  ctx: MeetingIntelligenceContext,
  data: ExtractedIntelligence,
): Promise<void> {
  const { error } = await supabase.from(TABLE).upsert(
    {
      organization_id: orgId,
      project_id: ctx.projectId,
      meeting_id: ctx.meetingId,
      executive_summary: data.executiveSummary,
      decisions: data.decisions,
      action_items: data.actionItems,
      risks: data.risks,
      blockers: data.blockers,
      assumptions: data.assumptions,
      dependencies: data.dependencies,
      milestones: data.milestones,
      commitments: data.commitments,
      confidence_score: data.confidenceScore,
      model: data.model,
      generated_at: new Date().toISOString(),
      created_by: userId,
    },
    { onConflict: "meeting_id" },
  );
  if (error) throw error;
}

// ── Read view ─────────────────────────────────────────────────────────────────

interface IntelRow {
  id: string;
  meeting_id: string;
  executive_summary: string | null;
  decisions: IntelDecision[] | null;
  action_items: IntelActionItem[] | null;
  risks: IntelRisk[] | null;
  blockers: IntelItem[] | null;
  assumptions: IntelItem[] | null;
  dependencies: IntelItem[] | null;
  milestones: IntelItem[] | null;
  commitments: IntelItem[] | null;
  confidence_score: number | null;
  model: string | null;
  generated_at: string;
}

export async function getMeetingIntelligence(
  supabase: DB,
  orgId: string,
  meetingId: string,
): Promise<RythmIntelligence | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "id, meeting_id, executive_summary, decisions, action_items, risks, blockers, assumptions, dependencies, milestones, commitments, confidence_score, model, generated_at",
    )
    .eq("organization_id", orgId)
    .eq("meeting_id", meetingId)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as IntelRow;
  return {
    id: r.id,
    meetingId: r.meeting_id,
    executiveSummary: r.executive_summary,
    decisions: r.decisions ?? [],
    actionItems: r.action_items ?? [],
    risks: r.risks ?? [],
    blockers: r.blockers ?? [],
    assumptions: r.assumptions ?? [],
    dependencies: r.dependencies ?? [],
    milestones: r.milestones ?? [],
    commitments: r.commitments ?? [],
    confidenceScore: r.confidence_score,
    model: r.model,
    generatedAt: r.generated_at,
  };
}

export async function intelligenceExists(
  supabase: DB,
  orgId: string,
  meetingId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from(TABLE)
    .select("id")
    .eq("organization_id", orgId)
    .eq("meeting_id", meetingId)
    .maybeSingle();
  return !!data;
}
