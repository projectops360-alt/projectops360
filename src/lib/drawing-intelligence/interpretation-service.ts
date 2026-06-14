// ============================================================================
// ProjectOps360° — Drawing Interpretation Service (Prompt 4)
// ============================================================================
// Runs after extraction: deterministic engine first, optional AI enhancement
// (existing AI service, structured JSON) second. AI output is validated with
// the same evidence-first rule — any insight whose evidence excerpt is not
// verbatim-traceable to the extracted content is dropped, never stored.
// Persists drawing_insights + drawing_evidence and connects the Living Graph.
// Server-only.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { emitProcessNode, emitProcessEdge } from "@/lib/graph/emit-event";
import {
  interpretDrawingContent,
  INSIGHT_REVIEW_THRESHOLD,
  type InsightCandidate,
  type InterpretationContext,
} from "./interpretation";
import type { ExtractedNote, RevisionEntry } from "./extractors";
import type { OrgContext } from "@/lib/auth";
import type { DrawingInsightSeverity, DrawingInsightType } from "@/types/drawing-intelligence";

export interface InterpretationOutcome {
  ok: boolean;
  insightsCreated: number;
  takeoffRowsCreated: number;
  aiUsed: boolean;
  error?: string;
}

/** Validated material/quantity takeoff row coming from the AI enhancement. */
export interface TakeoffCandidate {
  extraction_type: "material_takeoff" | "quantity_takeoff";
  category: string;
  item: string;
  specification: string;
  unit: string | null;
  quantity: number | null;
  location: string | null;
  sheet_ref: string | null;
  code_reference: string | null;
  status: string | null;
  confidence_score: number;
  evidence: { page_number: number; text_excerpt: string }[];
}

type Supabase = ReturnType<typeof createAdminClient>;

/** Full extracted text for one drawing page. */
interface PageText {
  page: number;
  text: string;
}

/** Characters of drawing text per AI call. Small, focused chunks extract far
 *  more reliably than one large blob: a 44k-char dump made gpt-4o-mini return
 *  empty, while ~5k focused input produced a full takeoff. We chunk the sheet
 *  text and run the model per chunk, then merge + dedupe. */
const CHUNK_CHARS = 7000;
/** Cost guard: never fan out beyond this many AI calls for one drawing. */
const MAX_CHUNKS = 14;
/** Chunk AI calls run concurrently (bounded) so wall-clock stays low instead
 *  of summing N sequential round-trips. */
const AI_CONCURRENCY = 5;

/** Run `fn` over items with bounded concurrency, preserving input order. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

const VALID_TYPES = new Set<string>([
  "risk", "rfi_candidate", "submittal_requirement", "inspection_requirement",
  "schedule_impact", "cost_impact", "missing_information", "contradiction",
  "decision_required",
]);
const VALID_SEVERITIES = new Set<string>(["low", "medium", "high", "critical"]);
const HIGH_IMPACT_TYPES = new Set<string>(["cost_impact", "schedule_impact", "contradiction", "risk"]);
const VALID_TAKEOFF_TYPES = new Set<string>(["material_takeoff", "quantity_takeoff"]);
const VALID_TAKEOFF_STATUS = new Set<string>(["new", "existing", "demo", "relocated"]);

// ── Main entry ────────────────────────────────────────────────────────────────

export async function runDrawingInterpretation(input: {
  fileId: string;
  organizationId: string;
  projectId: string;
  /** When present, the AI enhancement runs through the existing AI service
   *  (logged in ai_runs). Background runs pass nothing → deterministic only. */
  orgContext?: OrgContext;
}): Promise<InterpretationOutcome> {
  const supabase = createAdminClient();
  const { fileId, organizationId, projectId } = input;
  const startedAt = new Date().toISOString();

  await setJob(supabase, fileId, { status: "processing", started_at: startedAt });

  // ── Load drawing + extracted content + project context ──────────────────
  const [fileResult, extractionsResult, tasksResult, milestonesResult, pagesResult] = await Promise.all([
    supabase.from("drawing_files").select("*").eq("id", fileId)
      .eq("organization_id", organizationId).is("deleted_at", null).single(),
    supabase.from("drawing_extractions").select("*").eq("drawing_file_id", fileId)
      .eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("roadmap_tasks").select("id, title, status, milestone_id")
      .eq("project_id", projectId).eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("milestones").select("id, title, status")
      .eq("project_id", projectId).eq("organization_id", organizationId).is("deleted_at", null),
    // Full per-page sheet text — the source for material takeoff. The heuristic
    // "notes" only capture the general-notes block; materials/assemblies live in
    // the sheet text and must reach the AI (and the evidence-validation corpus).
    supabase.from("drawing_pages").select("page_number, extracted_text").eq("drawing_file_id", fileId)
      .eq("organization_id", organizationId).is("deleted_at", null).order("page_number", { ascending: true }),
  ]);

  const file = fileResult.data;
  if (!file) {
    await setJob(supabase, fileId, { status: "failed", error_message: "file_not_found", completed_at: new Date().toISOString() });
    return { ok: false, insightsCreated: 0, takeoffRowsCreated: 0, aiUsed: false, error: "file_not_found" };
  }

  const extractions = extractionsResult.data ?? [];
  const notes: ExtractedNote[] = extractions
    .filter((e) => e.extraction_type === "general_notes" || e.extraction_type === "keynotes")
    .flatMap((e) => ((e.extracted_json as { notes?: ExtractedNote[] }).notes ?? []));
  const revisions: RevisionEntry[] = extractions
    .filter((e) => e.extraction_type === "revision_block")
    .flatMap((e) => ((e.extracted_json as { entries?: RevisionEntry[] }).entries ?? []));

  // Full sheet text per page (drives material takeoff + evidence validation).
  const pageTexts: PageText[] = (pagesResult.data ?? [])
    .filter((p): p is { page_number: number; extracted_text: string } =>
      typeof p.extracted_text === "string" && p.extracted_text.trim().length > 0)
    .map((p) => ({ page: p.page_number, text: p.extracted_text }))
    .sort((a, b) => a.page - b.page);

  const ctx: InterpretationContext = {
    fileName: file.original_file_name ?? file.file_name,
    drawingNumber: file.drawing_number,
    discipline: file.discipline,
    currentRevision: file.revision,
    notes,
    revisions,
    tasks: tasksResult.data ?? [],
    milestones: milestonesResult.data ?? [],
  };

  // ── 1. Deterministic engine (always) ─────────────────────────────────────
  let candidates = interpretDrawingContent(ctx);

  // ── 2. Optional AI enhancement (validated evidence-first) ────────────────
  // Cost controls: AI is skipped without orgContext (background runs), when
  // there is no meaningful extracted text, and for duplicates (blocked at
  // registration). Token cost is recorded on the job row.
  let aiUsed = false;
  let aiCostUsd: number | null = null;
  let aiModel: string | null = null;
  let takeoffCandidates: TakeoffCandidate[] = [];
  if (input.orgContext && (pageTexts.length > 0 || notes.length > 0) && process.env.OPENAI_API_KEY) {
    // Chunk the sheet text into focused pieces — one large blob makes the model
    // return nothing; small chunks extract reliably. Run per chunk, merge.
    const chunks = buildChunks(pageTexts, ctx.notes);
    const org = input.orgContext;
    // Run chunks concurrently (bounded) — sequential calls made the AI step
    // feel hung; parallel keeps wall-clock to roughly one round-trip per batch.
    const enhancements = await mapWithConcurrency(chunks, AI_CONCURRENCY, (chunk) =>
      runAiEnhancement(org, file.id, ctx, chunk).catch((error) => {
        console.error("[drawing-interpretation] AI chunk failed (continuing):", error);
        return { candidates: [] as InsightCandidate[], takeoff: [] as TakeoffCandidate[], costUsd: null as number | null, model: null as string | null };
      }),
    );

    const seenTakeoff = new Set<string>();
    let costSum = 0;
    for (const enhancement of enhancements) {
      if (enhancement.model) aiModel = enhancement.model;
      if (typeof enhancement.costUsd === "number") costSum += enhancement.costUsd;
      candidates = mergeCandidates(candidates, enhancement.candidates);
      for (const row of enhancement.takeoff) {
        const key = `${row.category}|${row.item}|${row.specification}`.toLowerCase();
        if (seenTakeoff.has(key)) continue;
        seenTakeoff.add(key);
        takeoffCandidates.push(row);
      }
      if (enhancement.candidates.length > 0 || enhancement.takeoff.length > 0) aiUsed = true;
    }
    aiCostUsd = costSum > 0 ? costSum : null;
  }

  // ── 3. Idempotency: refresh unreviewed insights, keep user-reviewed ones ──
  const { data: existing } = await supabase
    .from("drawing_insights")
    .select("id, insight_type, title, status")
    .eq("drawing_file_id", fileId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  const kept = (existing ?? []).filter((i) => !["open", "in_review"].includes(i.status));
  const keptKeys = new Set(kept.map((i) => `${i.insight_type}|${i.title}`));
  const staleIds = (existing ?? [])
    .filter((i) => ["open", "in_review"].includes(i.status))
    .map((i) => i.id);
  if (staleIds.length > 0) {
    await supabase
      .from("drawing_insights")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", staleIds);
  }

  const toInsert = candidates.filter((c) => !keptKeys.has(`${c.insight_type}|${c.title}`));

  // ── 4. Persist insights + evidence ───────────────────────────────────────
  let insightsCreated = 0;
  const insightIds: { id: string; candidate: InsightCandidate }[] = [];

  for (const candidate of toInsert) {
    const { data: row, error } = await supabase
      .from("drawing_insights")
      .insert({
        organization_id: organizationId,
        project_id: projectId,
        drawing_file_id: fileId,
        insight_type: candidate.insight_type,
        title: candidate.title.slice(0, 300),
        description: candidate.description,
        severity: candidate.severity,
        confidence_score: candidate.confidence_score,
        evidence_json: {
          evidence: candidate.evidence,
          // linked_milestone_id has no dedicated column — preserved in payload
          payload: { ...candidate.payload, linked_milestone_id: candidate.linked_milestone_id },
        },
        recommended_action: candidate.recommended_action,
        linked_task_id: candidate.linked_task_id,
        status: candidate.needs_review ? "in_review" : "open",
      })
      .select("id")
      .single();

    if (error || !row) {
      console.error("[drawing-interpretation] insight insert failed:", error);
      continue;
    }
    insightsCreated++;
    insightIds.push({ id: row.id, candidate });

    // Evidence rows (insight-granular traceability)
    if (candidate.evidence.length > 0) {
      await supabase.from("drawing_evidence").insert(
        candidate.evidence.map((ev) => ({
          organization_id: organizationId,
          project_id: projectId,
          drawing_file_id: fileId,
          related_entity_type: "drawing_insight",
          related_entity_id: row.id,
          evidence_type: "text",
          page_number: ev.page_number,
          text_excerpt: ev.text_excerpt,
          confidence_score: candidate.confidence_score,
        })),
      );
    }
  }

  // ── 5. Persist material/quantity takeoff extractions ─────────────────────
  // Idempotency mirrors insights: AI-generated takeoff rows are refreshed on
  // every run (previous AI rows soft-deleted, heuristic rows untouched).
  let takeoffRowsCreated = 0;
  if (takeoffCandidates.length > 0) {
    takeoffRowsCreated = await persistTakeoffRows(supabase, {
      organizationId, projectId, fileId, candidates: takeoffCandidates, model: aiModel,
    });
  }

  // ── 6. Living Graph: drawing node + insight nodes + edges ────────────────
  try {
    await connectLivingGraph(supabase, { organizationId, projectId, file, insightIds });
  } catch (error) {
    console.error("[drawing-interpretation] graph emission failed:", error);
  }

  await setJob(supabase, fileId, {
    status: "completed",
    completed_at: new Date().toISOString(),
    processing_metadata_json: {
      insights_created: insightsCreated,
      takeoff_rows_created: takeoffRowsCreated,
      ai_used: aiUsed,
      method: aiUsed ? "heuristic+ai" : "heuristic",
      // Cost-aware tracking
      estimated_ai_token_cost: aiCostUsd,
      model_used: aiModel,
      processing_duration_ms: Date.now() - new Date(startedAt).getTime(),
    },
  });

  return { ok: true, insightsCreated, takeoffRowsCreated, aiUsed };
}

// ── Takeoff persistence ───────────────────────────────────────────────────────

async function persistTakeoffRows(
  supabase: Supabase,
  input: {
    organizationId: string;
    projectId: string;
    fileId: string;
    candidates: TakeoffCandidate[];
    model: string | null;
  },
): Promise<number> {
  const { organizationId, projectId, fileId, candidates, model } = input;

  // Refresh AI-generated rows only — heuristic engines use other model tags.
  await supabase
    .from("drawing_extractions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("drawing_file_id", fileId)
    .eq("organization_id", organizationId)
    .in("extraction_type", ["material_takeoff", "quantity_takeoff"])
    .like("model_used", "ai/%")
    .is("deleted_at", null);

  let created = 0;
  for (const row of candidates) {
    const { data: inserted, error } = await supabase
      .from("drawing_extractions")
      .insert({
        organization_id: organizationId,
        project_id: projectId,
        drawing_file_id: fileId,
        extraction_type: row.extraction_type,
        extracted_text: `${row.category} — ${row.item}: ${row.specification}`,
        extracted_json: {
          category: row.category,
          item: row.item,
          specification: row.specification,
          unit: row.unit,
          quantity: row.quantity,
          location: row.location,
          sheet_ref: row.sheet_ref,
          code_reference: row.code_reference,
          status: row.status,
        },
        confidence_score: row.confidence_score,
        evidence_json: { evidence: row.evidence },
        model_used: `ai/${model ?? "unknown"}`,
        extraction_status: "completed",
      })
      .select("id")
      .single();

    if (error || !inserted) {
      console.error("[drawing-interpretation] takeoff insert failed:", error);
      continue;
    }
    created++;

    if (row.evidence.length > 0) {
      await supabase.from("drawing_evidence").insert(
        row.evidence.map((ev) => ({
          organization_id: organizationId,
          project_id: projectId,
          drawing_file_id: fileId,
          related_entity_type: "drawing_extraction",
          related_entity_id: inserted.id,
          evidence_type: "text",
          page_number: ev.page_number,
          text_excerpt: ev.text_excerpt,
          confidence_score: row.confidence_score,
        })),
      );
    }
  }
  return created;
}

// ── AI enhancement ────────────────────────────────────────────────────────────

/** Split the sheet text into focused, model-sized chunks (≤ CHUNK_CHARS each),
 *  capped at MAX_CHUNKS. Each chunk carries its sheet label so the AI can cite
 *  the page. Falls back to the notes block when no page text exists. */
function buildChunks(pageTexts: PageText[], notes: ExtractedNote[]): string[] {
  if (pageTexts.length === 0) {
    const notesBlock = notes.map((n) => `[p.${n.page_number} ${n.note_id}] ${n.text}`).join("\n").trim();
    return notesBlock ? [notesBlock.slice(0, CHUNK_CHARS)] : [];
  }
  const chunks: string[] = [];
  let cur = "";
  const flush = () => { if (cur.trim()) chunks.push(cur.trim()); cur = ""; };
  for (const p of pageTexts) {
    if (chunks.length >= MAX_CHUNKS) break;
    const header = `===== SHEET p.${p.page} =====\n`;
    const text = p.text;
    if (header.length + text.length > CHUNK_CHARS) {
      flush();
      for (let i = 0; i < text.length && chunks.length < MAX_CHUNKS; i += CHUNK_CHARS) {
        chunks.push(header + text.slice(i, i + CHUNK_CHARS));
      }
      continue;
    }
    if (cur.length + header.length + text.length > CHUNK_CHARS) flush();
    cur += header + text + "\n\n";
  }
  flush();
  return chunks.slice(0, MAX_CHUNKS);
}

/** True when a takeoff candidate isn't a real, quantifiable material — i.e.
 *  a fastening/nailing schedule row or a pure specification/code statement.
 *  These pollute the takeoff and have no quantity, so they're dropped. */
function isNonMaterial(item: string, spec: string): boolean {
  const itemL = item.toLowerCase();
  const specL = spec.toLowerCase();
  const text = `${itemL} ${specL}`;

  // Fastening / Nailing Schedule rows (IBC Table 2304.10.1) pair a CONNECTION
  // (e.g. "rafter to plate", "collar tie", "subfloor to joist") with a fastener
  // callout (e.g. "3-10d (3\" x 0.128\")", "16d", "toe nail"). They are not
  // materials. Keep genuine fastener MATERIALS (item mentions nail/screw/bolt…).
  const itemIsFastenerMaterial = /\b(nail|screw|bolt|staple|fastener|hardware|anchor|connector|hanger|strap|clip|hold[- ]?down)s?\b/.test(itemL);
  // Spec is essentially just a fastener callout: "10d (3\" x 0.128\")", "3-10d (…", "4-8d (…"
  const fastenerSpec = /(^|\s)\d{0,2}-?\d+d\s*\(\s*\d/.test(specL);
  if (fastenerSpec && !itemIsFastenerMaterial) return true;
  // Nailing instructions / connection verbs.
  if (/\b(toe[- ]?nail|face[- ]?nail|blind[- ]?nail|end[- ]?nail)\b/.test(text)) return true;
  // Classic nail/staple/screw schedule language.
  const fasteningSchedule =
    /\b(nail|staple|screw)s?\b/.test(text) &&
    /\b(common|deformed|galvanized|o\.?c\.?|schedule|roofing nail)\b/.test(text);
  if (fasteningSchedule && !itemIsFastenerMaterial && text.length > 35) return true;
  // Pure spec / code statements (no physical material to quantify).
  if (/\b(shall be|do not scale|compressive strength|min(imum)?\s+\d+\s*day|conform to|in accordance with)\b/.test(text)) return true;
  return false;
}

async function runAiEnhancement(
  orgContext: OrgContext,
  fileId: string,
  ctx: InterpretationContext,
  chunkText: string,
): Promise<{ candidates: InsightCandidate[]; takeoff: TakeoffCandidate[]; costUsd: number | null; model: string | null }> {
  const { runAi } = await import("@/lib/ai/service");

  // One focused chunk of sheet text per call (materials/assemblies/schedules
  // live here → the source of the takeoff). Small input = reliable extraction.
  const aiContent = chunkText.trim() || "(none)";

  const result = await runAi(orgContext, {
    promptType: "drawing_interpretation",
    templateVars: {
      drawingNumber: ctx.drawingNumber ?? ctx.fileName,
      drawingTitle: ctx.fileName,
      discipline: ctx.discipline ?? "Unknown",
      revision: ctx.currentRevision ?? "—",
      notes: aiContent,
      revisions: ctx.revisions.map((r) => `${r.revision} ${r.revision_date ?? ""} ${r.description ?? ""}`).join("\n") || "(none)",
      tasks: ctx.tasks.slice(0, 50).map((t) => `- ${t.title} (${t.status})`).join("\n") || "(none)",
    },
  });

  if (result.status !== "completed" || !result.parsedJson) {
    return { candidates: [], takeoff: [], costUsd: result.costUsd, model: result.model };
  }
  const rawInsights = (result.parsedJson as { insights?: unknown[] }).insights ?? [];
  const rawExtractions = (result.parsedJson as { extractions?: unknown[] }).extractions ?? [];

  // Verbatim evidence corpus for validation — this chunk's text plus the
  // shared notes/revisions so cited excerpts validate.
  const corpus = [
    chunkText,
    ...ctx.notes.map((n) => n.text),
    ...ctx.revisions.map((r) => `${r.revision} ${r.revision_date ?? ""} ${r.description ?? ""}`),
  ].join("\n").toLowerCase();
  // Whitespace-tolerant evidence match: PDF text extraction produces erratic
  // spacing, so the model's verbatim quote rarely matches byte-for-byte. We
  // collapse whitespace on BOTH sides before the substring check — still an
  // anti-hallucination gate (the words must appear, in order, in the source),
  // just resilient to spacing noise.
  const matchCorpus = corpus.replace(/\s+/g, " ");
  const inCorpus = (excerpt: string): boolean =>
    matchCorpus.includes(excerpt.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 100));

  const taskByTitle = new Map(ctx.tasks.map((t) => [t.title.toLowerCase(), t]));
  const valid: InsightCandidate[] = [];

  for (const raw of rawInsights) {
    const insight = raw as Record<string, unknown>;
    const type = String(insight.type ?? "");
    const severity = String(insight.severity ?? "medium");
    const confidence = Number(insight.confidence_score ?? 0);
    const evidence = Array.isArray(insight.evidence) ? insight.evidence : [];

    if (!VALID_TYPES.has(type) || !VALID_SEVERITIES.has(severity)) continue;
    if (!Number.isFinite(confidence) || confidence <= 0 || confidence > 1) continue;

    // EVIDENCE-FIRST GATE: every excerpt must be traceable (verbatim,
    // case-insensitive) to the extracted content — otherwise drop.
    const evidenceRefs = evidence
      .map((e) => {
        const ev = e as Record<string, unknown>;
        return {
          page_number: Number(ev.page_number ?? 0) || 1,
          text_excerpt: String(ev.text_excerpt ?? ""),
        };
      })
      .filter((ev) => ev.text_excerpt.length >= 8);
    if (evidenceRefs.length === 0) continue;
    if (!evidenceRefs.every((ev) => inCorpus(ev.text_excerpt))) continue;

    const linkedTask = insight.linked_task_title
      ? taskByTitle.get(String(insight.linked_task_title).toLowerCase()) ?? null
      : null;

    const needsReview =
      confidence < INSIGHT_REVIEW_THRESHOLD ||
      severity === "high" ||
      severity === "critical" ||
      HIGH_IMPACT_TYPES.has(type);

    valid.push({
      insight_type: type as DrawingInsightType,
      title: String(insight.title ?? "").slice(0, 300) || `${type} (AI)`,
      description: String(insight.description ?? ""),
      severity: severity as DrawingInsightSeverity,
      confidence_score: Math.round(confidence * 100) / 100,
      evidence: evidenceRefs,
      recommended_action: String(insight.recommended_action ?? "request_human_review"),
      payload: { source: "ai", model_run: fileId },
      linked_task_id: linkedTask?.id ?? null,
      linked_milestone_id: linkedTask?.milestone_id ?? null,
      needs_review: needsReview,
    });
  }

  // ── Takeoff rows: same evidence-first gate as insights ────────────────────
  const takeoff: TakeoffCandidate[] = [];
  const seenTakeoff = new Set<string>();
  for (const raw of rawExtractions) {
    const row = raw as Record<string, unknown>;
    const extractionType = String(row.extraction_type ?? "material_takeoff");
    const category = String(row.category ?? "").trim();
    const item = String(row.item ?? "").trim();
    const specification = String(row.specification ?? "").trim();
    const confidence = Number(row.confidence_score ?? 0);
    const evidence = Array.isArray(row.evidence) ? row.evidence : [];

    if (!VALID_TAKEOFF_TYPES.has(extractionType)) continue;
    if (!category || !item || !specification) continue;
    if (!Number.isFinite(confidence) || confidence <= 0 || confidence > 1) continue;
    // Safety net: drop non-material noise the model may still leak (fastening
    // schedule rows, pure spec/code statements) so the takeoff stays clean.
    if (isNonMaterial(item, specification)) continue;

    const evidenceRefs = evidence
      .map((e) => {
        const ev = e as Record<string, unknown>;
        return {
          page_number: Number(ev.page_number ?? 0) || 1,
          text_excerpt: String(ev.text_excerpt ?? ""),
        };
      })
      .filter((ev) => ev.text_excerpt.length >= 8);
    if (evidenceRefs.length === 0) continue;
    if (!evidenceRefs.every((ev) => inCorpus(ev.text_excerpt))) continue;

    const dedupeKey = `${category}|${item}|${specification}`.toLowerCase();
    if (seenTakeoff.has(dedupeKey)) continue;
    seenTakeoff.add(dedupeKey);

    const quantity = Number(row.quantity);
    const status = String(row.status ?? "").toLowerCase();

    takeoff.push({
      extraction_type: extractionType as TakeoffCandidate["extraction_type"],
      category: category.slice(0, 120),
      item: item.slice(0, 200),
      specification: specification.slice(0, 600),
      unit: row.unit ? String(row.unit).slice(0, 20) : null,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : null,
      location: row.location ? String(row.location).slice(0, 200) : null,
      sheet_ref: row.sheet_ref ? String(row.sheet_ref).slice(0, 40) : null,
      code_reference: row.code_reference ? String(row.code_reference).slice(0, 120) : null,
      status: VALID_TAKEOFF_STATUS.has(status) ? status : null,
      confidence_score: Math.round(confidence * 100) / 100,
      evidence: evidenceRefs,
    });
  }

  return { candidates: valid, takeoff, costUsd: result.costUsd, model: result.model };
}

function mergeCandidates(base: InsightCandidate[], extra: InsightCandidate[]): InsightCandidate[] {
  const seen = new Set(base.map((c) => `${c.insight_type}|${c.evidence[0]?.text_excerpt ?? c.title}`));
  const merged = [...base];
  for (const candidate of extra) {
    const key = `${candidate.insight_type}|${candidate.evidence[0]?.text_excerpt ?? candidate.title}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(candidate);
    }
  }
  return merged;
}

// ── Living Graph connection ───────────────────────────────────────────────────

async function connectLivingGraph(
  supabase: Supabase,
  input: {
    organizationId: string;
    projectId: string;
    file: { id: string; drawing_number: string | null; file_name: string; revision: string | null };
    insightIds: { id: string; candidate: InsightCandidate }[];
  },
): Promise<void> {
  const { organizationId, projectId, file, insightIds } = input;
  const drawingLabel = file.drawing_number ?? file.file_name;

  // Drawing node (unique per source entity — emit is idempotent via the
  // unique index; a duplicate insert just fails silently in emitProcessNode)
  let drawingNodeId = await findNode(supabase, projectId, "drawing_files", file.id);
  if (!drawingNodeId) {
    drawingNodeId = await emitProcessNode({
      organizationId,
      projectId,
      nodeType: "drawing_event",
      sourceEntityType: "drawing_files",
      sourceEntityId: file.id,
      title: `Drawing ${drawingLabel}${file.revision ? ` rev ${file.revision}` : ""}`,
      metadata: { drawing_number: file.drawing_number, kind: "drawing" },
    });
  }
  if (!drawingNodeId) return;

  for (const { id: insightId, candidate } of insightIds) {
    const insightNodeId = await emitProcessNode({
      organizationId,
      projectId,
      nodeType: "drawing_insight",
      sourceEntityType: "drawing_insights",
      sourceEntityId: insightId,
      title: candidate.title.slice(0, 120),
      metadata: {
        insight_type: candidate.insight_type,
        severity: candidate.severity,
        confidence_score: candidate.confidence_score,
        risk_level: candidate.severity === "low" ? "low" : candidate.severity === "medium" ? "medium" : "high",
      },
    });
    if (!insightNodeId) continue;

    // drawing → insight
    await emitProcessEdge({
      organizationId,
      projectId,
      fromNodeId: drawingNodeId,
      toNodeId: insightNodeId,
      edgeType: "generated_insight",
      metadata: { relationship: "note_generates_insight" },
    });

    // insight → task (when linked and the task has a graph node)
    if (candidate.linked_task_id) {
      const taskNodeId = await findNode(supabase, projectId, "roadmap_tasks", candidate.linked_task_id);
      if (taskNodeId) {
        await emitProcessEdge({
          organizationId,
          projectId,
          fromNodeId: insightNodeId,
          toNodeId: taskNodeId,
          edgeType: "affects",
          metadata: { relationship: "insight_affects_task", insight_type: candidate.insight_type },
        });
      }
    }
  }
}

async function findNode(
  supabase: Supabase,
  projectId: string,
  sourceEntityType: string,
  sourceEntityId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("process_nodes")
    .select("id")
    .eq("project_id", projectId)
    .eq("source_entity_type", sourceEntityType)
    .eq("source_entity_id", sourceEntityId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

// ── Job helper ────────────────────────────────────────────────────────────────

async function setJob(
  supabase: Supabase,
  fileId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from("drawing_processing_jobs")
    .update(patch)
    .eq("drawing_file_id", fileId)
    .eq("job_type", "ai_interpretation")
    .is("deleted_at", null);
}
