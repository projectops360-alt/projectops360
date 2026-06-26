"use client";

// ============================================================================
// Isabella Experience — immersive executive advisor
// ============================================================================
// A present advisor: on activation the workspace softly blurs and Isabella
// materializes on a dedicated stage, alive (breathing/blinking + thinking,
// speaking, listening, greeting states).
//
// This revision:
//   • THEME-AWARE — the panel follows the app theme by default (no forced black
//     overlay). Optional immersive modes: app · dark · light · minimal.
//   • VOICE — optional browser text-to-speech (off by default), conversation
//     language, with mute/stop. No audio leaves the browser.
//   • LINKS — answers + steps render safe internal links (allow-listed).
//
// Decoupling intact: knowledge stays in Knowledge OS; this calls the SAME action
// and renders the SAME confidence + sources as the classic panel.
// ============================================================================

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Send, X, ThumbsUp, ThumbsDown, BookOpen, ChevronDown, ChevronRight,
  ScanSearch, ListChecks, MessageCircleQuestion, Sparkles, TriangleAlert, Info,
  Volume2, VolumeX, Square, Palette, Play,
} from "lucide-react";
import type { Locale } from "@/types/database";
import type { GuideAnswer, GuideContext, GuideIntent } from "@/lib/knowledge-os/types";
import { QUICK_ACTIONS } from "@/lib/knowledge-os/config";
import { resolveExpert } from "@/lib/knowledge-os/experts";
import { detectLanguage } from "@/lib/knowledge-os/language";
import { resolveScreen, enrichContextWithScreen } from "@/lib/knowledge-os/screens";
import { buildActionLinks, type ResolvedLink } from "@/lib/knowledge-os/action-links";
import { askLivingGuideAction, submitGuideFeedbackAction } from "@/components/living-guide/actions";
import { ConfidenceBadge, AnswerText } from "@/components/living-guide";
import { IsabellaPresence, type PresenceState } from "./avatar";
import { useSpeech } from "./use-speech";
import styles from "./isabella-experience.module.css";

const ICONS: Record<string, typeof ScanSearch> = {
  ScanSearch, ListChecks, MessageCircleQuestion, Sparkles, TriangleAlert,
};

// "app" follows the application theme (default — never a forced black trap).
// "dark" forces the premium dark immersive look. "minimal" is app + translucent.
// A true forced "light" is intentionally not a separate mode: in "app" it already
// follows the app's light theme. (Forcing light inside a dark app can't be done
// cleanly given the class-based dark variant.)
type StageMode = "app" | "dark" | "minimal";
const MODE_ORDER: StageMode[] = ["app", "dark", "minimal"];
const MODE_STORAGE = "isabella.stageMode";

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

  const screen = useMemo(() => resolveScreen(pathname || "", locale), [pathname, locale]);
  const context = useMemo(
    () => enrichContextWithScreen(baseContext, screen, pathname || ""),
    [baseContext, screen, pathname],
  );
  const expertTitle = expert.title[isEs ? "es" : "en"];
  const expertInfo = { key: expert.key, displayName: expert.displayName, title: expertTitle };
  const actionLinks = useMemo(() => buildActionLinks(locale, context), [locale, context]);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [greeting, setGreeting] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [closing, setClosing] = useState(false);
  // Restore the immersive-mode preference up-front (mounts client-side on open,
  // so there's no SSR/hydration mismatch and no setState-in-effect needed).
  const [stageMode, setStageMode] = useState<StageMode>(() => {
    try {
      const s = typeof window !== "undefined" ? (window.localStorage.getItem(MODE_STORAGE) as StageMode | null) : null;
      return s && MODE_ORDER.includes(s) ? s : "app";
    } catch {
      return "app";
    }
  });
  const [pending, startTransition] = useTransition();

  const voice = useSpeech();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function cycleMode() {
    setStageMode((m) => {
      const next = MODE_ORDER[(MODE_ORDER.indexOf(m) + 1) % MODE_ORDER.length];
      try { window.localStorage.setItem(MODE_STORAGE, next); } catch { /* ignore */ }
      return next;
    });
  }

  useEffect(() => {
    const t = setTimeout(() => setGreeting(false), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function requestClose() {
    voice.stop();
    setClosing(true);
    setTimeout(onClose, 280);
  }

  const presence: PresenceState = pending
    ? "thinking"
    : speaking || voice.speaking
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
        // Autoplay ONLY when the user has explicitly enabled voice.
        if (voice.enabled) voice.speak(answer.answer, answer.language);
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

  // "dark" forces the dark theme on the stage subtree; "app"/"minimal" inherit.
  const themeClass = stageMode === "dark" ? "dark" : "";
  const panelTone =
    stageMode === "minimal"
      ? "bg-card/85 supports-[backdrop-filter]:bg-card/70 backdrop-blur-xl border-border/60"
      : "bg-card border-border";
  const modeLabel: Record<StageMode, string> = {
    app: tt("Follows theme", "Sigue el tema"),
    dark: tt("Dark", "Oscuro"),
    minimal: tt("Minimal", "Mínimo"),
  };

  const iconBtn =
    "rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground";

  return (
    <div className={`${styles.overlay} ${themeClass}`} role="dialog" aria-modal="true" aria-label={expert.displayName}>
      <div
        className={`${styles.scrim} ${stageMode === "minimal" ? styles.scrimMinimal : ""} ${closing ? styles.scrimOut : ""}`}
        onClick={requestClose}
        aria-hidden
      />

      <div className={`${styles.stage} ${panelTone} border-l text-foreground ${closing ? styles.stageOut : ""}`}>
        {/* ── Presence area ─────────────────────────────────────────────── */}
        <div className={`${styles.presence} border-b border-border`}>
          <div className="absolute right-2 top-2 flex items-center gap-0.5">
            {/* Voice toggle */}
            <button
              onClick={voice.toggleEnabled}
              disabled={!voice.supported}
              className={`${iconBtn} ${voice.enabled ? "text-brand-600 dark:text-brand-400" : ""}`}
              title={
                !voice.supported
                  ? tt("Voice coming soon (not supported here)", "Voz próximamente (no disponible aquí)")
                  : voice.enabled
                  ? tt("Voice on — click to mute", "Voz activada — clic para silenciar")
                  : tt("Voice off — click to enable", "Voz desactivada — clic para activar")
              }
              aria-label={tt("Toggle voice", "Alternar voz")}
            >
              {voice.enabled && voice.supported ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            {/* Stop speaking */}
            {voice.speaking && (
              <button onClick={voice.stop} className={iconBtn} title={tt("Stop", "Detener")} aria-label={tt("Stop voice", "Detener voz")}>
                <Square className="h-4 w-4" />
              </button>
            )}
            {/* Immersive mode */}
            <button onClick={cycleMode} className={iconBtn} title={`${tt("Display", "Vista")}: ${modeLabel[stageMode]}`} aria-label={tt("Change display mode", "Cambiar modo de vista")}>
              <Palette className="h-4 w-4" />
            </button>
            {/* Close */}
            <button onClick={requestClose} className={iconBtn} title={tt("Close", "Cerrar")} aria-label={tt("Close", "Cerrar")}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className={`${styles.materialize} relative`}>
            <div className={styles.platform} aria-hidden />
            <IsabellaPresence state={presence} size={150} accent={expert.presentation.accent} name={expert.displayName} />
          </div>

          <div className={styles.nameplate}>
            <p className="text-base font-semibold text-foreground">{expert.displayName}</p>
            <p className="text-[11px] text-muted-foreground">{expertTitle}</p>
            <p className={`${styles.status} mt-1 text-brand-600 dark:text-brand-400`}>
              <span className={styles.statusDot} />
              {statusLabel[presence]}
            </p>
          </div>
        </div>

        {/* ── Conversation ──────────────────────────────────────────────── */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {turns.length === 0 && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-base font-semibold text-foreground">{expert.greeting[isEs ? "es" : "en"]}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
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
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] text-foreground transition hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400"
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
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-500/15 px-3 py-2 text-sm text-foreground">
                  {turn.question}
                </div>
              </div>
              {turn.answer ? (
                <AnswerCard
                  turn={turn}
                  locale={locale}
                  links={actionLinks}
                  canSpeak={voice.supported}
                  onSpeak={(text, lang) => voice.speak(text, lang)}
                  onFeedback={(helpful) => feedback(turn.id, turn.answer!.answerId, helpful)}
                  onFollowup={(q) => ask("question", q)}
                />
              ) : (
                <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                  <span className={styles.statusDot} />
                  {tt("Thinking…", "Pensando…")}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Quick actions ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1.5 border-t border-border px-3 pt-3">
          {QUICK_ACTIONS.map((a) => {
            const Icon = ICONS[a.icon] ?? Info;
            return (
              <button
                key={a.intent}
                disabled={pending}
                onClick={() => ask(a.intent, "")}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:border-brand-500 hover:text-brand-600 disabled:opacity-50 dark:hover:text-brand-400"
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
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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

// ── Answer card ──────────────────────────────────────────────────────────────

function AnswerCard({
  turn,
  locale,
  links,
  canSpeak,
  onSpeak,
  onFeedback,
  onFollowup,
}: {
  turn: Turn;
  locale: Locale;
  links: ResolvedLink[];
  canSpeak: boolean;
  onSpeak: (text: string, lang: Locale) => void;
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
        <div className="flex items-center gap-1">
          {a.degraded && (
            <span className="text-[10px] text-muted-foreground">{tt("from knowledge base", "desde la base de conocimiento")}</span>
          )}
          {canSpeak && (
            <button
              onClick={() => onSpeak(a.answer, a.language)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title={tt("Read aloud", "Leer en voz alta")}
              aria-label={tt("Read aloud", "Leer en voz alta")}
            >
              <Play className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="text-sm text-foreground">
        <AnswerText text={a.answer} links={links} />
      </div>

      {a.steps.length > 0 && (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-foreground">
          {a.steps.map((s, i) => (
            <li key={i}>
              <AnswerText text={s} links={links} />
            </li>
          ))}
        </ol>
      )}

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

      {a.followups.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {a.followups.map((q, i) => (
            <button
              key={i}
              onClick={() => onFollowup(q)}
              className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-foreground transition hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400"
            >
              {q}
            </button>
          ))}
        </div>
      )}

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
