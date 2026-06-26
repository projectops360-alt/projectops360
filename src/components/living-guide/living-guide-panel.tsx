"use client";

// ============================================================================
// Living Guide™ — Coach panel (task-oriented, not a help center)
// ============================================================================
// Leads with "What are you trying to accomplish?". Every answer shows its
// confidence tier + sources. Presentation (avatar) is decoupled so an immersive
// / hologram layer can replace it later without touching this logic.
// ============================================================================

import { useRef, useState, useTransition } from "react";
import {
  Send, X, ThumbsUp, ThumbsDown, BookOpen, ChevronDown, ChevronRight,
  ScanSearch, ListChecks, MessageCircleQuestion, Sparkles, TriangleAlert, Info,
} from "lucide-react";
import type { Locale } from "@/types/database";
import type { GuideAnswer, GuideContext, GuideIntent } from "@/lib/knowledge-os/types";
import { QUICK_ACTIONS } from "@/lib/knowledge-os/config";
import { resolveExpert } from "@/lib/knowledge-os/experts";
import { askLivingGuideAction, submitGuideFeedbackAction } from "./actions";
import { LivingGuideAvatar, type AvatarState } from "./living-guide-avatar";
import { ConfidenceBadge } from "./confidence-badge";

const ICONS: Record<string, typeof ScanSearch> = {
  ScanSearch, ListChecks, MessageCircleQuestion, Sparkles, TriangleAlert,
};

interface Turn {
  id: string;
  question: string;
  intent: GuideIntent;
  answer?: GuideAnswer;
  feedback?: "up" | "down";
}

export function LivingGuidePanel({
  locale,
  context,
  onClose,
}: {
  locale: Locale;
  context: GuideContext;
  onClose: () => void;
}) {
  const isEs = locale === "es";
  const k = isEs ? "es" : "en";
  const tt = (en: string, es: string) => (isEs ? es : en);

  // Resolve the active AI Workforce expert (Isabella by default) for the
  // current module. Presentation only — the same expert is resolved server-side.
  const expert = resolveExpert({ module: context.module });
  const expertInfo = { key: expert.key, displayName: expert.displayName, title: expert.title[k] };

  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const avatarState: AvatarState = pending ? "thinking" : turns.length > 0 ? "speaking" : "idle";

  function ask(intent: GuideIntent, query: string) {
    const q = query.trim();
    // Free-text intents need text; action intents can run with an empty query.
    if (intent === "question" && !q) {
      inputRef.current?.focus();
      return;
    }
    const id = crypto.randomUUID();
    const label =
      q ||
      QUICK_ACTIONS.find((a) => a.intent === intent)?.label[isEs ? "es" : "en"] ||
      intent;
    setTurns((t) => [...t, { id, question: label, intent }]);
    setInput("");

    startTransition(async () => {
      try {
        const answer = await askLivingGuideAction({ query: q, intent, context, locale });
        setTurns((t) => t.map((x) => (x.id === id ? { ...x, answer } : x)));
      } catch {
        setTurns((t) =>
          t.map((x) =>
            x.id === id
              ? {
                  ...x,
                  answer: {
                    answerId: null, grounded: false,
                    answer: tt("Something went wrong. Please try again.", "Algo salió mal. Inténtalo de nuevo."),
                    steps: [], followups: [], tier: "ai_suggestion", confidenceScore: 0,
                    language: locale, sources: [], expert: expertInfo, degraded: true,
                  },
                }
              : x,
          ),
        );
      } finally {
        requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
      }
    });
  }

  function feedback(turnId: string, answerId: string | null, helpful: boolean) {
    setTurns((t) => t.map((x) => (x.id === turnId ? { ...x, feedback: helpful ? "up" : "down" } : x)));
    if (answerId) void submitGuideFeedbackAction(answerId, helpful);
  }

  return (
    <div className="flex h-full w-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <LivingGuideAvatar state={avatarState} size={34} initial={expert.presentation.initial} accent={expert.presentation.accent} />
          <div>
            <p className="text-sm font-semibold text-foreground">{expert.displayName}</p>
            <p className="text-[11px] text-muted-foreground">{expertInfo.title}</p>
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={tt("Close", "Cerrar")}>
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {turns.length === 0 && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-medium text-muted-foreground">
                {tt(`Hello, I am ${expert.displayName} — ${expertInfo.title}.`, `Hola, soy ${expert.displayName} — ${expertInfo.title}.`)}
              </p>
              <p className="mt-1 text-base font-semibold text-foreground">{expert.greeting[k]}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {tt(
                  "Tell me your goal in your own words, or pick a quick action. I will guide you and explain the why — my answers on People & Permissions are grounded in verified guidance.",
                  "Dime tu objetivo con tus palabras o elige una acción rápida. Te guío y te explico el porqué — mis respuestas sobre Personas y Permisos se basan en guía verificada.",
                )}
              </p>
            </div>
          </div>
        )}

        {turns.map((turn) => (
          <div key={turn.id} className="space-y-2">
            {/* User turn */}
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-500/10 px-3 py-2 text-sm text-foreground">
                {turn.question}
              </div>
            </div>
            {/* Assistant turn */}
            {turn.answer ? (
              <AnswerCard
                turn={turn}
                locale={locale}
                onFeedback={(helpful) => feedback(turn.id, turn.answer!.answerId, helpful)}
                onFollowup={(q) => ask("question", q)}
              />
            ) : (
              <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <LivingGuideAvatar state="thinking" size={20} />
                {tt("Thinking…", "Pensando…")}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-1.5 border-t border-border px-3 pt-3">
        {QUICK_ACTIONS.map((a) => {
          const Icon = ICONS[a.icon] ?? Info;
          return (
            <button
              key={a.intent}
              disabled={pending}
              onClick={() => ask(a.intent, "")}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-brand-500 hover:text-brand-600 disabled:opacity-50 dark:hover:text-brand-400"
            >
              <Icon className="h-3 w-3" />
              {a.label[isEs ? "es" : "en"]}
            </button>
          );
        })}
      </div>

      {/* Input */}
      <form
        className="flex items-center gap-2 px-3 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask("question", input);
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={pending}
          placeholder={tt("Ask the guide…", "Pregúntale a la guía…")}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
          aria-label={tt("Send", "Enviar")}
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

// ── Answer card ──────────────────────────────────────────────────────────────

function AnswerCard({
  turn,
  locale,
  onFeedback,
  onFollowup,
}: {
  turn: Turn;
  locale: Locale;
  onFeedback: (helpful: boolean) => void;
  onFollowup: (q: string) => void;
}) {
  const isEs = locale === "es";
  const tt = (en: string, es: string) => (isEs ? es : en);
  const a = turn.answer!;
  const [showSources, setShowSources] = useState(false);

  return (
    <div className="rounded-2xl rounded-bl-sm border border-border bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <ConfidenceBadge tier={a.tier} score={a.confidenceScore} locale={locale} />
        {a.degraded && (
          <span className="text-[10px] text-muted-foreground">{tt("from knowledge base", "desde la base de conocimiento")}</span>
        )}
      </div>

      <p className="whitespace-pre-line text-sm text-foreground">{a.answer}</p>

      {a.steps.length > 0 && (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-foreground">
          {a.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}

      {/* Sources / provenance */}
      {a.sources.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowSources((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            {showSources ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <BookOpen className="h-3 w-3" />
            {tt("View source", "Ver fuente")} ({a.sources.length})
          </button>
          {showSources && (
            <ul className="mt-1.5 space-y-1">
              {a.sources.map((s) => (
                <li key={s.versionId} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-2 py-1.5">
                  <span className="text-xs text-foreground">{s.title}</span>
                  <ConfidenceBadge tier={s.tier} locale={locale} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Follow-ups */}
      {a.followups.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {a.followups.map((q, i) => (
            <button
              key={i}
              onClick={() => onFollowup(q)}
              className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-foreground hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Feedback */}
      <div className="mt-3 flex items-center gap-2 border-t border-border pt-2">
        <span className="text-[11px] text-muted-foreground">{tt("Was this helpful?", "¿Te sirvió?")}</span>
        <button
          onClick={() => onFeedback(true)}
          className={`rounded-md p-1 hover:bg-muted ${turn.feedback === "up" ? "text-green-600" : "text-muted-foreground"}`}
          aria-label={tt("Helpful", "Útil")}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onFeedback(false)}
          className={`rounded-md p-1 hover:bg-muted ${turn.feedback === "down" ? "text-red-600" : "text-muted-foreground"}`}
          aria-label={tt("Not helpful", "No útil")}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
