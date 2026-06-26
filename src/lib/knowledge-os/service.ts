// ============================================================================
// ProjectOps360° — Knowledge OS generation service (server-only)
// ============================================================================
// The Knowledge OS "brain". Orchestrates one answer for whichever AI Workforce
// expert (persona) is active — Isabella by default:
//   resolve expert → retrieve (hybrid) → generate (base prompt + persona
//   overlay, grounded ONLY in retrieved KPs) → score confidence →
//   persist provenance (knowledge_answers + ai_runs) → log telemetry.
//
// Experts share ONE corpus; only persona/tone/specialty/presentation differ.
//
// Honesty guarantees:
//   • No retrieved knowledge  → honest "no verified answer", tier ai_suggestion,
//     NO model call invented as Verified.
//   • Model says not grounded → tier ai_suggestion.
//   • AI unavailable but KPs found → degraded answer straight from the corpus
//     (still tier-accurate), never fabricated.
// ============================================================================

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAi } from "@/lib/ai/service";
import type { OrgContext } from "@/lib/auth";
import type { Locale } from "@/types/database";
import type {
  AskGuideInput,
  GuideAnswer,
  AnswerSource,
  RetrievedChunk,
} from "./types";
import { retrieveKnowledge } from "./retrieval";
import { computeConfidence } from "./confidence";
import { KNOWLEDGE_OS_BASE_PROMPT_VERSION } from "./config";
import {
  resolveExpert,
  buildPersonaOverlay,
  type ExpertProfile,
} from "./experts";

const INTENT_HINT: Record<string, string> = {
  explain_screen: "The user wants this screen explained.",
  step_by_step: "The user wants step-by-step guidance.",
  question: "The user asked a direct question.",
  best_practices: "The user wants best practices.",
  common_mistakes: "The user wants to know common mistakes to avoid.",
};

// Bilingual topic seeds per intent — used to ground RETRIEVAL (not the answer).
// They steer quick actions and short/generic queries (e.g. "explain this
// screen" / "explícame esta pantalla") toward the relevant Knowledge Packages
// regardless of language, instead of a generic English meta-hint.
const INTENT_TOPIC: Record<string, string> = {
  explain_screen: "overview what is this screen resumen qué es esta pantalla",
  step_by_step: "how to step by step cómo paso a paso",
  best_practices: "best practices buenas prácticas recommendations recomendaciones",
  common_mistakes: "common mistakes errors to avoid errores comunes a evitar",
  question: "",
};

/**
 * Build the RETRIEVAL query (distinct from what the model sees). Context-aware:
 * always grounds retrieval in the current module/screen so the coach answers
 * about WHERE the user is — and bilingual intent topics make quick actions and
 * short queries reliable in both English and Spanish. The user's typed query
 * still dominates ranking; the context terms only add recall.
 */
function buildRetrievalQuery(input: AskGuideInput): string {
  const c = input.context;
  const moduleTopic = c.module ? c.module.replace(/_/g, " ") : "";
  const screenTopic = c.screen ? c.screen.replace(/_/g, " ") : "";
  const titleTopic = c.pageTitle ?? "";
  const intentTopic = INTENT_TOPIC[input.intent] ?? "";
  const parts = [input.query.trim(), intentTopic, titleTopic, moduleTopic, screenTopic].filter(Boolean);
  return parts.join(" ").trim() || INTENT_HINT[input.intent] || "";
}

function serializeContext(input: AskGuideInput): string {
  const c = input.context;
  // Screen Intelligence (Phase 1.2): describe WHERE the user is and WHAT is on
  // the screen so explanations are about the actual page, not generic docs.
  const parts = [
    c.pageTitle && `Screen the user is viewing: ${c.pageTitle}`,
    c.module && `Module: ${c.module}`,
    c.screen && `Screen id: ${c.screen}`,
    c.tab && `Active tab/section: ${c.tab}`,
    c.workflow && `Primary workflow here: ${c.workflow}`,
    c.components?.length && `Visible UI components on this screen: ${c.components.join(", ")}`,
    c.role && `Current user role: ${c.role}`,
    c.action && `Current action: ${c.action}`,
    c.permissions?.length && `Capabilities: ${c.permissions.join(", ")}`,
  ].filter(Boolean);
  return parts.join("\n") || "No additional context provided.";
}

function buildPassages(chunks: RetrievedChunk[]): { text: string; refMap: Map<string, RetrievedChunk> } {
  const refMap = new Map<string, RetrievedChunk>();
  const blocks = chunks.map((c, i) => {
    const ref = String(i + 1);
    refMap.set(ref, c);
    return `[ref:${ref}] (tier: ${c.confidenceTier}) ${c.title}\n${c.body}`;
  });
  return { text: blocks.join("\n\n"), refMap };
}

function sourcesFrom(chunks: RetrievedChunk[]): AnswerSource[] {
  const seen = new Set<string>();
  const out: AnswerSource[] = [];
  for (const c of chunks) {
    if (seen.has(c.packageId)) continue;
    seen.add(c.packageId);
    out.push({
      packageId: c.packageId,
      versionId: c.versionId,
      slug: c.slug,
      title: c.title,
      tier: c.confidenceTier,
    });
  }
  return out;
}

async function logEvent(
  org: OrgContext,
  eventType: string,
  fields: { answerId?: string | null; queryHash?: string; surface?: string; metadata?: Record<string, unknown> },
): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("guide_events").insert({
      organization_id: org.organizationId,
      user_id: org.userId,
      answer_id: fields.answerId ?? null,
      event_type: eventType,
      query_hash: fields.queryHash ?? null,
      surface: fields.surface ?? null,
      role: org.role,
      metadata: fields.metadata ?? {},
    });
  } catch (err) {
    console.error("guide_events insert failed:", err);
  }
}

async function persistAnswer(
  org: OrgContext,
  input: AskGuideInput,
  expert: ExpertProfile,
  data: {
    grounded: boolean;
    retrieved: RetrievedChunk[];
    used: RetrievedChunk[];
    tier: string;
    score: number;
    model: string | null;
    aiRunId: string | null;
  },
): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data: row, error } = await supabase
      .from("knowledge_answers")
      .insert({
        organization_id: org.organizationId,
        user_id: org.userId,
        project_id: input.context.projectId ?? null,
        query_text: input.query,
        answer_language: input.answerLanguage ?? input.locale,
        surface: input.context.screen ?? input.context.module ?? null,
        context_payload: input.context as unknown as Record<string, unknown>,
        intent: input.intent,
        retrieved_chunks: data.retrieved.map((c) => ({
          chunk_id: c.chunkId,
          package_id: c.packageId,
          version_id: c.versionId,
          similarity: c.similarity ?? null,
          lex_rank: c.lexRank ?? null,
          fused: c.fused,
          tier: c.confidenceTier,
        })),
        package_versions: sourcesFrom(data.used).map((s) => ({
          package_id: s.packageId,
          version_id: s.versionId,
          slug: s.slug,
          tier: s.tier,
        })),
        prompt_version: KNOWLEDGE_OS_BASE_PROMPT_VERSION,
        persona_version: expert.personaVersion,
        expert_key: expert.key,
        model: data.model,
        confidence_tier: data.tier,
        confidence_score: data.score,
        grounded: data.grounded,
        ai_run_id: data.aiRunId,
      })
      .select("id")
      .single();
    if (error) {
      console.error("knowledge_answers insert failed:", error.message);
      return null;
    }
    return row.id as string;
  } catch (err) {
    console.error("knowledge_answers insert threw:", err);
    return null;
  }
}

/** The honest "we do not have a verified answer yet" response. */
function emptyAnswer(locale: Locale): Pick<GuideAnswer, "answer" | "steps" | "followups"> {
  return locale === "es"
    ? {
        answer:
          "Todavía no tengo una respuesta verificada para esto. Puedo ayudarte con personas, roles y permisos: prueba a reformular tu pregunta o usa una de las acciones rápidas.",
        steps: [],
        followups: ["¿Qué puede ver un Gerente de proyecto?", "¿Por qué un usuario no puede ver un proyecto?"],
      }
    : {
        answer:
          "I do not have a verified answer for this yet. I can help with people, roles, and permissions — try rephrasing, or use one of the quick actions.",
        steps: [],
        followups: ["What can a Project Manager see?", "Why can a user not see a project?"],
      };
}

/**
 * Answer a Knowledge OS request for the active AI Workforce expert (Isabella by
 * default). Never throws.
 */
export async function askKnowledgeOs(org: OrgContext, input: AskGuideInput): Promise<GuideAnswer> {
  // Conversation language (Phase 1.2) drives the ANSWER; it follows the user's
  // latest message and may differ from the UI locale. Retrieval already searches
  // the whole corpus regardless of language, so a Spanish question still reaches
  // English-authored knowledge — only the reply is rendered in this language.
  const locale = input.answerLanguage ?? input.locale;
  const queryHash = createHash("sha256").update(`${input.intent}:${input.query}`).digest("hex").slice(0, 32);
  const surface = input.context.screen ?? input.context.module;

  // ── 0. Resolve the active expert (explicit → module/domain → Isabella) ───
  const expert = resolveExpert({ expertKey: input.expertKey, module: input.context.module });
  const expertInfo = { key: expert.key, displayName: expert.displayName, title: expert.title[locale === "es" ? "es" : "en"] };

  // ── 1. Retrieve (hybrid, multilingual, context-aware) ────────────────────
  const retrieved = await retrieveKnowledge(buildRetrievalQuery(input), {
    organizationId: org.organizationId,
    language: locale,
  });

  // ── 2. No knowledge → honest fallback, NO fabricated answer ──────────────
  if (retrieved.length === 0) {
    const empty = emptyAnswer(locale);
    const answerId = await persistAnswer(org, input, expert, {
      grounded: false,
      retrieved: [],
      used: [],
      tier: "ai_suggestion",
      score: 0.2,
      model: null,
      aiRunId: null,
    });
    await logEvent(org, "no_answer", { answerId, queryHash, surface, metadata: { expert_key: expert.key } });
    return {
      answerId,
      grounded: false,
      ...empty,
      tier: "ai_suggestion",
      confidenceScore: 0.2,
      language: locale,
      sources: [],
      expert: expertInfo,
    };
  }

  const { text: passages, refMap } = buildPassages(retrieved);
  const hadVector = retrieved.some((c) => c.similarity != null);

  // ── 3. Generate: base prompt + persona overlay, grounded in passages ─────
  const ai = await runAi(org, {
    promptType: "guide_coaching",
    model: expert.model,
    templateVars: {
      persona: buildPersonaOverlay(expert, locale),
      context: serializeContext(input),
      intent: INTENT_HINT[input.intent] ?? input.intent,
      question: input.query || INTENT_HINT[input.intent] || "",
      passages,
      language: locale === "es" ? "Spanish" : "English",
    },
    temperature: expert.temperature,
  });

  // ── 3b. AI unavailable/failed → degraded answer straight from the corpus ─
  if (ai.status !== "completed" || !ai.parsedJson) {
    const top = retrieved.slice(0, 2);
    const { tier, score } = computeConfidence({ grounded: true, usedChunks: top, hadVectorConfirmation: hadVector });
    const answerId = await persistAnswer(org, input, expert, {
      grounded: true,
      retrieved,
      used: top,
      tier,
      score,
      model: ai.model,
      aiRunId: ai.runId || null,
    });
    await logEvent(org, "answered", { answerId, queryHash, surface, metadata: { degraded: true, expert_key: expert.key } });
    return {
      answerId,
      grounded: true,
      answer: top[0].body,
      steps: [],
      followups: [],
      tier,
      confidenceScore: score,
      language: locale,
      sources: sourcesFrom(top),
      expert: expertInfo,
      degraded: true,
    };
  }

  // ── 4. Parse model output + resolve cited passages ───────────────────────
  const parsed = ai.parsedJson as {
    grounded?: boolean;
    answer?: string;
    steps?: unknown;
    used_refs?: unknown;
    followups?: unknown;
  };
  const grounded = parsed.grounded === true;
  const usedRefs = Array.isArray(parsed.used_refs) ? parsed.used_refs.map(String) : [];
  const used = grounded
    ? (usedRefs.map((r) => refMap.get(r)).filter(Boolean) as RetrievedChunk[])
    : [];
  // If the model claims grounded but cited nothing parseable, fall back to top.
  const effectiveUsed = grounded && used.length === 0 ? retrieved.slice(0, 1) : used;

  const { tier, score } = computeConfidence({
    grounded,
    usedChunks: effectiveUsed,
    hadVectorConfirmation: hadVector,
  });

  const steps = Array.isArray(parsed.steps) ? parsed.steps.map(String).filter(Boolean).slice(0, 8) : [];
  const followups = Array.isArray(parsed.followups)
    ? parsed.followups.map(String).filter(Boolean).slice(0, 3)
    : [];
  const answerText = typeof parsed.answer === "string" && parsed.answer.trim()
    ? parsed.answer.trim()
    : emptyAnswer(locale).answer;

  const answerId = await persistAnswer(org, input, expert, {
    grounded,
    retrieved,
    used: effectiveUsed,
    tier,
    score,
    model: ai.model,
    aiRunId: ai.runId || null,
  });

  await logEvent(org, grounded ? "answered" : "no_answer", { answerId, queryHash, surface, metadata: { expert_key: expert.key } });

  return {
    answerId,
    grounded,
    answer: answerText,
    steps,
    followups,
    tier,
    confidenceScore: score,
    language: locale,
    sources: sourcesFrom(effectiveUsed),
    expert: expertInfo,
  };
}

/**
 * @deprecated Back-compat alias. The system is now Knowledge OS; use
 * {@link askKnowledgeOs}. Kept so any external caller keeps working.
 */
export const askLivingGuide = askKnowledgeOs;

/** Record explicit user feedback against a prior answer. Never throws. */
export async function recordGuideFeedback(
  org: OrgContext,
  answerId: string,
  helpful: boolean,
): Promise<void> {
  await logEvent(org, helpful ? "feedback_helpful" : "feedback_unhelpful", {
    answerId,
    metadata: { helpful },
  });
}
