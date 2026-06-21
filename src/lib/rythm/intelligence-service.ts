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
  IntelCommitment,
  IntelItem,
} from "./types";

type DB = SupabaseClient;
const TABLE = "project_rythm_intelligence";
const MODEL = "gpt-4o-mini";

// ── Meeting context ─────────────────────────────────────────────────────────

export interface MeetingIntelligenceContext {
  projectId: string;
  meetingId: string;
  transcriptId: string | null;
  projectName: string;
  meetingTitle: string;
  meetingDate: string | null;
  objective: string | null;
  expectedOutcome: string | null;
  agenda: AgendaSection[];
  notes: string;
  participants: string[];
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
    .select("id, event_id, objective, expected_outcome, agenda_json, notes_i18n, project_id")
    .eq("id", meetingId)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!meeting || meeting.project_id !== projectId) return null;

  const [eventRes, projectRes, attendeesRes, transcript, mappings] = await Promise.all([
    meeting.event_id
      ? supabase.from("project_events").select("title, start_datetime").eq("id", meeting.event_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("projects").select("title_i18n").eq("id", projectId).maybeSingle(),
    supabase.from("meeting_attendees").select("name").eq("organization_id", orgId).eq("meeting_id", meetingId),
    getMeetingTranscript(supabase, orgId, meetingId),
    getSpeakerMappings(supabase, orgId, meetingId, null),
  ]);

  const nameByLabel = new Map(mappings.map((m) => [m.originalSpeakerLabel, m.mappedParticipantName]));

  // Participants = mapped speaker names + named attendees (deduped).
  const participantSet = new Set<string>();
  for (const m of mappings) if (m.mappedParticipantName) participantSet.add(m.mappedParticipantName);
  for (const a of attendeesRes.data ?? []) if (a.name) participantSet.add(a.name as string);

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
    transcriptId: transcript?.id ?? null,
    projectName: getI18nValue(projectRes.data?.title_i18n as I18nField, locale) || "Project",
    meetingTitle: (eventRes.data?.title as string) || "Meeting",
    meetingDate: (eventRes.data?.start_datetime as string) ?? null,
    objective: meeting.objective ?? null,
    expectedOutcome: meeting.expected_outcome ?? null,
    agenda: (meeting.agenda_json ?? []) as AgendaSection[],
    notes: getI18nValue(meeting.notes_i18n as I18nField, locale) || "",
    participants: Array.from(participantSet),
    attributedTranscript,
    hasTranscript: attributedTranscript.trim().length > 0,
  };
}

// ── Prompt ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the ProjectOps360° Meeting Intelligence Engine — a PMO analyst, NOT a meeting summarizer.
Convert a project conversation into STRUCTURED project-management intelligence. Do not over-focus on summaries.

EXTRACT IN THIS PRIORITY ORDER (decisions first, the executive summary LAST):
1. DECISIONS
2. COMMITMENTS
3. ACTION ITEMS
4. RISKS
5. DEPENDENCIES
6. MILESTONES
7. BLOCKERS
8. ASSUMPTIONS
9. EXECUTIVE SUMMARY (generate this last, after everything else)

WHAT COUNTS AS EACH (be generous but never fabricate):

DECISION — participants agree on a direction, approve a solution, prioritize work, choose a vendor/tool/approach, or approve a timeline.
  e.g. "We will prioritize the Rythm module." / "We will use AssemblyAI." / "Let's perform browser compatibility testing." → these MUST become decisions.

COMMITMENT — someone commits to completing work, delivering something, meeting a deadline, or performing a future task.
  e.g. "I will configure the credentials." / "We will complete integration before sprint end." / "We will finish testing next week." → these MUST become commitments.

ACTION ITEM — requires an owner + an action (due date optional).
  e.g. "Matteo will review the workflow." / "Efrain will configure credentials."

RISK — compatibility, schedule, dependency, technical, or staffing risks.
  e.g. "Browser compatibility for audio recording."

DEPENDENCY — vendors, APIs, integrations, external approvals, third-party services.
  e.g. "AssemblyAI integration."

MILESTONE — sprint-completion goals, release goals, integration completion, deployment targets.
  e.g. "Complete AssemblyAI integration before sprint end."

CONFIDENCE (0.0–1.0):
- 0.90–1.00 explicitly stated.
- 0.70–0.89 strong inference.
- below 0.70 possible but uncertain.
NEVER fabricate information. Owners must be real names from the meeting; use "" if none is stated.
Dates must be ISO "YYYY-MM-DD" or null — never guess a date.
action_items.priority must be exactly "high", "medium", or "low".
The executive_summary is one short factual paragraph of project context (decisions, ownership, risks) — NOT a transcript recap.
Return ONLY valid JSON matching the schema. No prose, no markdown.

OUTPUT SCHEMA:
{
  "decisions": [{"title":"","description":"","owner":"","confidence":0}],
  "commitments": [{"commitment":"","owner":"","target_date":null,"confidence":0}],
  "action_items": [{"task":"","owner":"","due_date":null,"priority":"high|medium|low","confidence":0}],
  "risks": [{"description":"","impact":"","owner":"","confidence":0}],
  "dependencies": [{"description":"","owner":"","confidence":0}],
  "milestones": [{"title":"","due_date":null,"confidence":0}],
  "blockers": [{"description":"","owner":"","confidence":0}],
  "assumptions": [{"description":"","confidence":0}],
  "executive_summary": ""
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
    `PARTICIPANTS: ${ctx.participants.length ? ctx.participants.join(", ") : "(unknown)"}`,
    ``,
    `AGENDA:`,
    agenda,
    ``,
    `MEETING NOTES:`,
    ctx.notes || "(none)",
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
  commitments: IntelCommitment[];
  actionItems: IntelActionItem[];
  risks: IntelRisk[];
  dependencies: IntelItem[];
  milestones: IntelItem[];
  blockers: IntelItem[];
  assumptions: IntelItem[];
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

  const commitments: IntelCommitment[] = arr(raw.commitments)
    .filter((c) => str(c.commitment) || str(c.description))
    .map((c) => ({
      commitment: str(c.commitment) || str(c.description),
      owner: str(c.owner),
      target_date: isoDateOrNull(c.target_date ?? c.due_date),
      confidence: clamp01(c.confidence),
    }));

  const mapGeneric = (key: string) =>
    arr(raw[key]).filter((o) => str(o.title) || str(o.description)).map(genericItem);

  const all = [...decisions, ...commitments, ...actionItems, ...risks].map((x) => x.confidence);
  const confidenceScore = all.length ? all.reduce((s, c) => s + c, 0) / all.length : 0.5;

  return {
    executiveSummary: str(raw.executive_summary),
    decisions,
    commitments,
    actionItems,
    risks,
    dependencies: mapGeneric("dependencies"),
    milestones: mapGeneric("milestones"),
    blockers: mapGeneric("blockers"),
    assumptions: mapGeneric("assumptions"),
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
      applied_at: null, // (re)generation resets the applied state
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
  commitments: IntelCommitment[] | null;
  blockers: IntelItem[] | null;
  assumptions: IntelItem[] | null;
  dependencies: IntelItem[] | null;
  milestones: IntelItem[] | null;
  confidence_score: number | null;
  model: string | null;
  generated_at: string;
  applied_at: string | null;
}

export async function getMeetingIntelligence(
  supabase: DB,
  orgId: string,
  meetingId: string,
): Promise<RythmIntelligence | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "id, meeting_id, executive_summary, decisions, action_items, risks, commitments, blockers, assumptions, dependencies, milestones, confidence_score, model, generated_at, applied_at",
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
    commitments: r.commitments ?? [],
    blockers: r.blockers ?? [],
    assumptions: r.assumptions ?? [],
    dependencies: r.dependencies ?? [],
    milestones: r.milestones ?? [],
    confidenceScore: r.confidence_score,
    model: r.model,
    generatedAt: r.generated_at,
    appliedAt: r.applied_at,
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
