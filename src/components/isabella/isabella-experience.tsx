"use client";

// ============================================================================
// Isabella Experience — immersive executive advisor (Phase 1.2)
// ============================================================================
// Turns the assistant from a chat window into a present advisor. On activation
// the workspace softly dims + blurs and Isabella materializes on a dedicated
// stage, staying visible and "alive" (breathing/blinking, with thinking,
// speaking and listening states) throughout the conversation.
//
// Decoupling contract:
//   • Presentation (avatar/stage/animation) lives here and in ./avatar.
//   • Knowledge stays in Knowledge OS — this calls the SAME server action and
//     renders the SAME confidence + sources as the classic panel. Nothing about
//     retrieval, confidence, provenance or Project Memory is touched.
//
// Conversation Intelligence: the reply language follows the user's latest
// message (detectLanguage), independent of the UI locale.
// Screen Intelligence: the current route is resolved to a screen description so
// "Explain this screen" is about the actual page, and follow-ups are contextual.
// ============================================================================

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Send, X, ThumbsUp, ThumbsDown, BookOpen, ChevronDown, ChevronRight,
  ScanSearch, ListChecks, MessageCircleQuestion, Sparkles, TriangleAlert, Info,
} from "lucide-react";
import type { Locale } from "@/types/database";
import type { GuideAnswer, GuideContext, GuideIntent } from "@/lib/knowledge-os/types";
import { QUICK_ACTIONS } from "@/lib/knowledge-os/config";
import { resolveExpert } from "@/lib/knowledge-os/experts";
import { detectLanguage } from "@/lib/knowledge-os/language";
import { resolveScreen, enrichContextWithScreen } from "@/lib/knowledge-os/screens";
import { askLivingGuideAction, submitGuideFeedbackAction } from "@/components/living-guide/actions";
import { ConfidenceBadge } from "@/components/living-guide";
import { IsabellaPresence, type PresenceState } from "./avatar";
import styles from "./isabella-experience.module.css";

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

export function IsabellaExperience({
  locale,
  baseContext,
  onClose,
}: {
  locale: Locale;
  baseContext: GuideContext;
  onClose: () => void;
}) {
  const isEs = locale === "es";
  const tt = (en: string, es: string) => (isEs ? es : en);
  const pathname = usePathname();

  const expert = resolveExpert({ module: baseContext.module });

  // Screen Intelligence: resolve where the user is and what is on the screen.
  const screen = useMemo(() => resolveScreen(pathname || "", locale), [pathname, locale]);
  const context = useMemo(
    () => enrichContextWithScreen(baseContext, screen, pathname || ""),
    [baseContext, screen, pathname],
  );
  const expertTitle = expert.title[isEs ? "es" : "en"];
  const expertInfo = { key: expert.key, displayName: expert.displayName, title: expertTitle };

  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [greeting, setGreeting] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pending, startTransition] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Greeting window on entrance.
  useEffect(() => {
    const t = setTimeout(() => setGreeting(false), 2000);
    return () => clearTimeout(t);
  }, []);

  // Esc to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function requestClose() {
    setClosing(true);
    setTimeout(onClose, 280);
  }

  // Avatar state machine (priority order). Pure presentation.
  const presence: PresenceState = pending
    ? "thinking"
    : speaking
    ? "speaking"
    : greeting
    ? "greeting"
    : focused && input.trim().length > 0
    ? "listening"
    : "idle";

  const statusLabel: Record<PresenceState, string> = {
    idle: tt("Present", "Presente"),
    greeting: tt("Greeting you", "Saludándote"),
    listening: tt("Listening…", "Escuchando…"),
    thinking: tt("Thinking…", "Pensando…"),
    speaking: tt("Advising", "Asesorando"),
  };

  function ask(intent: GuideIntent, query: string) {
    const q = query.trim();
    if (intent === "question" && !q) {
      inputRef.current?.focus();
      return;
    }
    const id = crypto.randomUUID();
    const label = q || QUICK_ACTIONS.find((a) => a.intent === intent)?.label[isEs ? "es" : "en"] || intent;

    // Conversation Intelligence: the reply language follows THIS message. Quick
    // actions (no free text) keep the current UI locale.
    const answerLanguage: Locale = (q ? detectLanguage(q) : null) ?? locale;

    setTurns((t) => [...t, { id, question: label, intent }]);
    setInput("");
    setSpeaking(false);

    startTransition(async () => {
      try {
        const answer = await askLivingGuideAction({ query: q, intent, context, locale, answerLanguage });
        setTurns((t) => t.map((x) => (x.id === id ? { ...x, answer } : x)));
        setSpeaking(true);
        setTimeout(() => setSpeaking(false), 3200);
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
                    language: answerLanguage, sources: [], expert: expertInfo, degraded: true,
                  },
                }
              : x,
          ),
        );
      } finally {
        requestAnimationFrame(() =>
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
        );
      }
    });
  }

  function feedback(turnId: string, answerId: string | null, helpful: boolean) {
    setTurns((t) => t.map((x) => (x.id === turnId ? { ...x, feedback: helpful ? "up" : "down" } : x)));
    if (answerId) void submitGuideFeedbackAction(answerId, helpful);
  }

  const suggestions = screen?.followups ?? [];

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={expert.displayName}>
      <div className={`${styles.scrim} ${closing ? styles.scrimOut : ""}`} onClick={requestClose} aria-hidden />

      <div className={`${styles.stage} ${closing ? styles.stageOut : ""}`}>
        {/* ── Presence area ─────────────────────────────────────────────── */}
        <div className={styles.presence}>
          <button
            onClick={requestClose}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
            aria-label={tt("Close", "Cerrar")}
          >
            <X className="h-4 w-4" />
          </button>

          <div className={`${styles.materialize} relative`}>
            <div className={styles.platform} aria-hidden />
            <IsabellaPresence
              state={presence}
              size={150}
              accent={expert.presentation.accent}
              name={expert.displayName}
            />
          </div>

          <div className={styles.nameplate}>
            <p className="text-base font-semibold text-white">{expert.displayName}</p>
            <p className="text-[11px] text-white/55">{expertTitle}</p>
            <p className={`${styles.status} mt-1 text-brand-300`}>
              <span className={styles.statusDot} />
              {statusLabel[presence]}
            </p>
          </div>
        </div>

        {/* ── Conversation ──────────────────────────────────────────────── */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {turns.length === 0 && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-base font-semibold text-white">{expert.greeting[isEs ? "es" : "en"]}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-white/65">
                  {screen
                    ? tt(
                        `You're on ${screen.pageTitle}. Tell me your goal, or ask me to explain this screen — I'll guide you and explain the why.`,
                        `Estás en ${screen.pageTitle}. Dime tu objetivo o pídeme que te explique esta pantalla — te guío y te explico el porqué.`,
                      )
                    : tt(
                        "Tell me what you're trying to accomplish and I'll guide you — and explain the why.",
                        "Dime qué intentas lograr y te guío — y te explico el porqué.",
                      )}
                </p>
              </div>

              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => ask("question", s)}
                      className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/80 transition hover:border-brand-400 hover:text-white"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {turns.map((turn) => (
            <div key={turn.id} className={`${styles.turnIn} space-y-2`}>
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-500/20 px-3 py-2 text-sm text-white">
                  {turn.question}
                </div>
              </div>
              {turn.answer ? (
                <AnswerCard
                  turn={turn}
                  locale={locale}
                  onFeedback={(helpful) => feedback(turn.id, turn.answer!.answerId, helpful)}
                  onFollowup={(q) => ask("question", q)}
                />
              ) : (
                <div className="flex items-center gap-2 px-1 text-xs text-white/55">
                  <span className={styles.statusDot} />
                  {tt("Thinking…", "Pensando…")}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Quick actions ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1.5 border-t border-white/10 px-3 pt-3">
          {QUICK_ACTIONS.map((a) => {
            const Icon = ICONS[a.icon] ?? Info;
            return (
              <button
                key={a.intent}
                disabled={pending}
                onClick={() => ask(a.intent, "")}
                className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/80 transition hover:border-brand-400 hover:text-white disabled:opacity-50"
              >
                <Icon className="h-3 w-3" />
                {a.label[isEs ? "es" : "en"]}
              </button>
            );
          })}
        </div>

        {/* ── Input ─────────────────────────────────────────────────────── */}
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
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={pending}
            placeholder={tt("Tell Isabella your goal…", "Dile a Isabella tu objetivo…")}
            className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-40"
            aria-label={tt("Send", "Enviar")}
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Answer card (dark stage variant) ────────────────────────────────────────

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
    <div className="rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.04] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <ConfidenceBadge tier={a.tier} score={a.confidenceScore} locale={locale} />
        {a.degraded && (
          <span className="text-[10px] text-white/45">{tt("from knowledge base", "desde la base de conocimiento")}</span>
        )}
      </div>

      <p className="whitespace-pre-line text-sm text-white/90">{a.answer}</p>

      {a.steps.length > 0 && (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-white/85">
          {a.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}

      {a.sources.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowSources((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-white/55 hover:text-white"
          >
            {showSources ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <BookOpen className="h-3 w-3" />
            {tt("View source", "Ver fuente")} ({a.sources.length})
          </button>
          {showSources && (
            <ul className="mt-1.5 space-y-1">
              {a.sources.map((s) => (
                <li key={s.versionId} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
                  <span className="text-xs text-white/80">{s.title}</span>
                  <ConfidenceBadge tier={s.tier} locale={locale} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {a.followups.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {a.followups.map((q, i) => (
            <button
              key={i}
              onClick={() => onFollowup(q)}
              className="rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/80 transition hover:border-brand-400 hover:text-white"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-2">
        <span className="text-[11px] text-white/45">{tt("Was this helpful?", "¿Te sirvió?")}</span>
        <button
          onClick={() => onFeedback(true)}
          className={`rounded-md p-1 hover:bg-white/10 ${turn.feedback === "up" ? "text-green-400" : "text-white/50"}`}
          aria-label={tt("Helpful", "Útil")}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onFeedback(false)}
          className={`rounded-md p-1 hover:bg-white/10 ${turn.feedback === "down" ? "text-red-400" : "text-white/50"}`}
          aria-label={tt("Not helpful", "No útil")}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
