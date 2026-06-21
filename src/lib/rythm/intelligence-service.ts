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
  IntelEvidence,
  OwnerAttribution,
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
  /** Ownership-resolution tiers (priority order). */
  speakerNames: string[]; // tier 1 — mapped speaker labels → names
  projectMembers: string[]; // tier 3 — project stakeholders/members
  attendees: string[]; // tier 4 — meeting attendees
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

  const [eventRes, projectRes, attendeesRes, stakeholdersRes, transcript, mappings] = await Promise.all([
    meeting.event_id
      ? supabase.from("project_events").select("title, start_datetime").eq("id", meeting.event_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("projects").select("title_i18n").eq("id", projectId).maybeSingle(),
    supabase.from("meeting_attendees").select("name").eq("organization_id", orgId).eq("meeting_id", meetingId),
    supabase.from("stakeholders").select("name").eq("organization_id", orgId).eq("project_id", projectId).is("deleted_at", null).limit(200),
    getMeetingTranscript(supabase, orgId, meetingId),
    getSpeakerMappings(supabase, orgId, meetingId, null),
  ]);

  const nameByLabel = new Map(mappings.map((m) => [m.originalSpeakerLabel, m.mappedParticipantName]));

  const speakerNames = mappings.map((m) => m.mappedParticipantName).filter(Boolean);
  const attendees = (attendeesRes.data ?? []).map((a) => a.name as string).filter(Boolean);
  const projectMembers = (stakeholdersRes.data ?? []).map((s) => s.name as string).filter(Boolean);
  const participantSet = new Set<string>([...speakerNames, ...attendees]);

  // Build a speaker-attributed transcript with second offsets ("[t=41] Efraín: ...").
  let attributedTranscript = "";
  if (transcript?.utterances?.length) {
    attributedTranscript = transcript.utterances
      .map((u) => {
        const secs = Math.floor((u.start ?? 0) / 1000);
        return `[t=${secs}] ${nameByLabel.get(u.speaker) ?? `Speaker ${u.speaker}`}: ${u.text}`;
      })
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
    speakerNames,
    projectMembers,
    attendees,
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
NEVER fabricate information. Dates must be ISO "YYYY-MM-DD" or null — never guess a date.
action_items.priority must be exactly "high", "medium", or "low".
The executive_summary is one short factual paragraph of project context (decisions, ownership, risks) — NOT a transcript recap.

OWNER (the responsible person), in priority order:
- For a first-person commitment ("I will...", "voy a...") the owner is the SPEAKER of that line.
- For "X will..." the owner is X (explicitly mentioned person).
- Use the EXACT participant name as written. If no clear person, use "".
- Do NOT pick a name from the participant list unless that person actually owns the item in the transcript.

EVIDENCE — every item MUST include:
- "source_speaker": the participant who spoke the supporting line.
- "source_timestamp": the integer seconds from the [t=...] tag at the start of that line.
- "source_excerpt": a short VERBATIM quote (<200 chars) from the transcript that supports the item.
Never fabricate evidence; if a field is unknown use "" or null.

Return ONLY valid JSON matching the schema. No prose, no markdown.

OUTPUT SCHEMA (every item also carries "source_speaker","source_timestamp","source_excerpt"):
{
  "decisions": [{"title":"","description":"","owner":"","confidence":0,"source_speaker":"","source_timestamp":null,"source_excerpt":""}],
  "commitments": [{"commitment":"","owner":"","target_date":null,"confidence":0,"source_speaker":"","source_timestamp":null,"source_excerpt":""}],
  "action_items": [{"task":"","owner":"","due_date":null,"priority":"high|medium|low","confidence":0,"source_speaker":"","source_timestamp":null,"source_excerpt":""}],
  "risks": [{"description":"","impact":"","owner":"","confidence":0,"source_speaker":"","source_timestamp":null,"source_excerpt":""}],
  "dependencies": [{"description":"","owner":"","confidence":0,"source_speaker":"","source_timestamp":null,"source_excerpt":""}],
  "milestones": [{"title":"","due_date":null,"confidence":0,"source_speaker":"","source_timestamp":null,"source_excerpt":""}],
  "blockers": [{"description":"","owner":"","confidence":0,"source_speaker":"","source_timestamp":null,"source_excerpt":""}],
  "assumptions": [{"description":"","confidence":0,"source_speaker":"","source_timestamp":null,"source_excerpt":""}],
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

function evidence(o: Record<string, unknown>): IntelEvidence {
  return {
    source_speaker: str(o.source_speaker) || null,
    source_timestamp:
      typeof o.source_timestamp === "number" && o.source_timestamp >= 0
        ? Math.floor(o.source_timestamp)
        : null,
    source_excerpt: str(o.source_excerpt).slice(0, 280) || null,
  };
}

function genericItem(o: Record<string, unknown>): IntelItem {
  return {
    ...evidence(o),
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
    .map((d) => ({ ...evidence(d), title: str(d.title), description: str(d.description), owner: str(d.owner), confidence: clamp01(d.confidence) }));

  const actionItems: IntelActionItem[] = arr(raw.action_items)
    .filter((a) => str(a.task))
    .map((a) => ({
      ...evidence(a),
      task: str(a.task),
      owner: str(a.owner),
      due_date: isoDateOrNull(a.due_date),
      priority: (["high", "medium", "low"].includes(String(a.priority)) ? a.priority : "medium") as IntelActionItem["priority"],
      confidence: clamp01(a.confidence),
    }));

  const risks: IntelRisk[] = arr(raw.risks)
    .filter((r) => str(r.description))
    .map((r) => ({ ...evidence(r), description: str(r.description), impact: str(r.impact), owner: str(r.owner), confidence: clamp01(r.confidence) }));

  const commitments: IntelCommitment[] = arr(raw.commitments)
    .filter((c) => str(c.commitment) || str(c.description))
    .map((c) => ({
      ...evidence(c),
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

// ── Ownership resolution (audit hierarchy) ────────────────────────────────────
// Priority: 1) speaker attribution mapping, 2) explicit person mention,
// 3) project member match, 4) meeting attendee match, 5) unknown.
// Never use the attendee list before speaker attribution.

function norm(s: string): string {
  return s.trim().toLowerCase();
}
function firstToken(s: string): string {
  return norm(s).split(/\s+/)[0] ?? "";
}
function matchName(name: string | null | undefined, list: string[]): string | null {
  const n = norm(name ?? "");
  if (!n) return null;
  for (const cand of list) {
    if (norm(cand) === n || firstToken(cand) === n || norm(cand) === firstToken(name ?? "")) return cand;
  }
  return null;
}

function resolveOne(
  owner: string,
  sourceSpeaker: string | null | undefined,
  excerpt: string | null | undefined,
  ctx: MeetingIntelligenceContext,
): { owner: string; attribution: OwnerAttribution } {
  const aiOwner = (owner ?? "").trim();
  const speaker = (sourceSpeaker ?? "").trim();
  const ex = (excerpt ?? "").toLowerCase();
  const firstPerson = /(^|\b)(i will|i'?ll|i am going to|i'?m going to|i can|voy a|me encargo|yo )/i.test(ex);

  const speakerInMap = matchName(speaker, ctx.speakerNames); // tier 1
  if (speakerInMap && (firstPerson || !aiOwner)) return { owner: speakerInMap, attribution: "speaker" };

  if (aiOwner) {
    const inSpk = matchName(aiOwner, ctx.speakerNames); // tier 1
    if (inSpk) return { owner: inSpk, attribution: "speaker" };
    const inMem = matchName(aiOwner, ctx.projectMembers); // tier 3
    if (inMem) return { owner: inMem, attribution: "project_member" };
    const inAtt = matchName(aiOwner, ctx.attendees); // tier 4
    if (inAtt) return { owner: inAtt, attribution: "attendee" };
    return { owner: aiOwner, attribution: "explicit" }; // tier 2 (explicit mention)
  }

  if (speakerInMap) return { owner: speakerInMap, attribution: "speaker" };
  return { owner: "", attribution: "unknown" }; // tier 5
}

function resolveOwnership(data: ExtractedIntelligence, ctx: MeetingIntelligenceContext): void {
  const apply = (items: Array<{ owner?: string; source_speaker?: string | null; source_excerpt?: string | null; owner_attribution?: OwnerAttribution }>) => {
    for (const it of items) {
      const r = resolveOne(it.owner ?? "", it.source_speaker, it.source_excerpt, ctx);
      it.owner = r.owner;
      it.owner_attribution = r.attribution;
    }
  };
  apply(data.decisions);
  apply(data.commitments);
  apply(data.actionItems);
  apply(data.risks);
  apply(data.dependencies);
  apply(data.milestones);
  apply(data.blockers);
  for (const a of data.assumptions) a.owner_attribution = a.owner ? a.owner_attribution : "unknown";
}

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
  const data = normalize(result.parsedJson, result.model || MODEL);
  resolveOwnership(data, ctx);
  return data;
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
