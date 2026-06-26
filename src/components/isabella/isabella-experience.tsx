"use client";

// ============================================================================
// Isabella Experience — floating holographic advisor window
// ============================================================================
// Isabella is a window the USER OWNS: a floating, draggable, dockable, resizable
// presence that never blocks the workflow (no full-screen scrim). She remembers
// her position/size, can minimize / expand / go fullscreen, and runs in three
// modes (Assistant · Guide · Executive).
//
// • THEME-AWARE — follows the app theme; optional dark/minimal panel tone.
// • VOICE — optional female TTS (off by default), conversation language.
// • GUIDED LINKS — answers render "Open <X>" actions that navigate AND keep
//   Isabella present (she's mounted app-wide), so she takes you there.
// • 3D-READY — the presence area hosts the holographic placeholder today and the
//   Ready Player Me + Mixamo 3D figure (React Three Fiber) next, behind the same
//   PresenceState contract. The old SVG portrait is retired here.
//
// Knowledge stays in Knowledge OS — same action, confidence and sources.
// ============================================================================

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Send, X, ThumbsUp, ThumbsDown, BookOpen, ChevronDown, ChevronRight,
  ScanSearch, ListChecks, MessageCircleQuestion, Sparkles, TriangleAlert, Info,
  Volume2, VolumeX, Square, Palette, Play, PanelLeft, PanelRight, Minus,
  Maximize2, Minimize2, GripHorizontal, Compass, Presentation, MessageSquare,
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
import { HologramPlaceholder } from "./hologram/hologram-placeholder";
import { useWindowFrame, type WindowMode } from "./hologram/use-window-frame";
import { useSpeech } from "./use-speech";
import styles from "./isabella-experience.module.css";

const ICONS: Record<string, typeof ScanSearch> = {
  ScanSearch, ListChecks, MessageCircleQuestion, Sparkles, TriangleAlert,
};

const MODE_ICON: Record<WindowMode, typeof Compass> = {
  assistant: MessageSquare,
  guide: Compass,
  executive: Presentation,
};

type StageTone = "app" | "dark" | "minimal";
const TONE_ORDER: StageTone[] = ["app", "dark", "minimal"];
const TONE_STORAGE = "isabella.stageTone";

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
  const wf = useWindowFrame();
  const voice = useSpeech();

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
  const [guideNote, setGuideNote] = useState<string | null>(null);
  const [tone, setTone] = useState<StageTone>(() => {
    try {
      const s = typeof window !== "undefined" ? (window.localStorage.getItem(TONE_STORAGE) as StageTone | null) : null;
      return s && TONE_ORDER.includes(s) ? s : "app";
    } catch { return "app"; }
  });
  const [pending, startTransition] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setGreeting(false), 2000);
    return () => clearTimeout(t);
  }, []);

  function cycleTone() {
    setTone((m) => {
      const next = TONE_ORDER[(TONE_ORDER.indexOf(m) + 1) % TONE_ORDER.length];
      try { window.localStorage.setItem(TONE_STORAGE, next); } catch { /* ignore */ }
      return next;
    });
  }

  function requestClose() {
    voice.stop();
    onClose();
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

    setGuideNote(null);
    setTurns((t) => [...t, { id, question: label, intent }]);
    setInput("");
    setSpeaking(false);

    startTransition(async () => {
      try {
        const answer = await askLivingGuideAction({ query: q, intent, context, locale, answerLanguage });
        setTurns((t) => t.map((x) => (x.id === id ? { ...x, answer } : x)));
        setSpeaking(true);
        setTimeout(() => setSpeaking(false), 3200);
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

  // Guided action: she navigates AND stays present (mounted app-wide), then
  // offers to continue on the new screen.
  function onNavigate(_href: string, label: string) {
    setGuideNote(tt(`I took you to ${label}. Want me to explain this screen?`, `Te llevé a ${label}. ¿Quieres que te explique esta pantalla?`));
  }

  function feedback(turnId: string, answerId: string | null, helpful: boolean) {
    setTurns((t) => t.map((x) => (x.id === turnId ? { ...x, feedback: helpful ? "up" : "down" } : x)));
    if (answerId) void submitGuideFeedbackAction(answerId, helpful);
  }

  const suggestions = screen?.followups ?? [];
  const themeClass = tone === "dark" ? "dark" : "";
  const panelTone =
    tone === "minimal"
      ? "bg-card/85 supports-[backdrop-filter]:bg-card/70 backdrop-blur-xl border-border/60"
      : "bg-card border-border";
  const toneLabel: Record<StageTone, string> = {
    app: tt("Follows theme", "Sigue el tema"),
    dark: tt("Dark", "Oscuro"),
    minimal: tt("Minimal", "Mínimo"),
  };
  const modeLabel: Record<WindowMode, string> = {
    assistant: tt("Assistant", "Asistente"),
    guide: tt("Guide", "Guía"),
    executive: tt("Executive", "Ejecutivo"),
  };
  const iconBtn = "rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground";
  const presenceSize = wf.frame.mode === "executive" ? 200 : 150;

  // ── Minimized pill ─────────────────────────────────────────────────────────
  if (wf.frame.minimized) {
    return (
      <div style={{ ...wf.style, width: "auto", height: "auto" }} className={`${themeClass}`}>
        <div
          onPointerDown={wf.onDragStart}
          className={`flex cursor-grab items-center gap-2 rounded-full border ${panelTone} py-1.5 pl-1.5 pr-3 text-foreground shadow-xl active:cursor-grabbing`}
        >
          <HologramPlaceholder state={presence} size={34} accent={expert.presentation.accent} />
          <span className="text-sm font-semibold">{expert.displayName}</span>
          <button onClick={wf.toggleMinimize} className={iconBtn} title={tt("Expand", "Expandir")} aria-label={tt("Expand", "Expandir")}>
            <Maximize2 className="h-4 w-4" />
          </button>
          <button onClick={requestClose} className={iconBtn} title={tt("Close", "Cerrar")} aria-label={tt("Close", "Cerrar")}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={wf.style} className={themeClass} role="dialog" aria-label={expert.displayName}>
      {wf.frame.fullscreen && <div className="fixed inset-0 -z-10 bg-black/40 backdrop-blur-sm" aria-hidden />}
      <div className={`flex h-full w-full flex-col overflow-hidden rounded-2xl border ${panelTone} text-foreground shadow-2xl`}>
        {/* ── Title bar (drag handle) ───────────────────────────────────── */}
        <div
          onPointerDown={wf.onDragStart}
          className={`flex cursor-grab items-center justify-between gap-1 border-b border-border px-2 py-1.5 active:cursor-grabbing ${wf.dragging ? "select-none" : ""}`}
        >
          <div className="flex items-center gap-1.5 pl-1">
            <GripHorizontal className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold">{expert.displayName}</span>
            <span className="text-[10px] text-muted-foreground">· {modeLabel[wf.frame.mode]}</span>
          </div>
          <div className="flex items-center gap-0.5" onPointerDown={(e) => e.stopPropagation()}>
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
            {voice.speaking && (
              <button onClick={voice.stop} className={iconBtn} title={tt("Stop", "Detener")} aria-label={tt("Stop voice", "Detener voz")}>
                <Square className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => wf.dockTo("left")} className={iconBtn} title={tt("Dock left", "Acoplar izquierda")} aria-label={tt("Dock left", "Acoplar izquierda")}>
              <PanelLeft className="h-4 w-4" />
            </button>
            <button onClick={() => wf.dockTo("right")} className={iconBtn} title={tt("Dock right", "Acoplar derecha")} aria-label={tt("Dock right", "Acoplar derecha")}>
              <PanelRight className="h-4 w-4" />
            </button>
            <button onClick={cycleTone} className={iconBtn} title={`${tt("Display", "Vista")}: ${toneLabel[tone]}`} aria-label={tt("Change display tone", "Cambiar tono")}>
              <Palette className="h-4 w-4" />
            </button>
            <button onClick={wf.toggleFullscreen} className={iconBtn} title={wf.frame.fullscreen ? tt("Exit fullscreen", "Salir de pantalla completa") : tt("Fullscreen", "Pantalla completa")} aria-label={tt("Toggle fullscreen", "Alternar pantalla completa")}>
              {wf.frame.fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button onClick={wf.toggleMinimize} className={iconBtn} title={tt("Minimize", "Minimizar")} aria-label={tt("Minimize", "Minimizar")}>
              <Minus className="h-4 w-4" />
            </button>
            <button onClick={requestClose} className={iconBtn} title={tt("Close", "Cerrar")} aria-label={tt("Close", "Cerrar")}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Mode switch ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
          {(Object.keys(modeLabel) as WindowMode[]).map((m) => {
            const Icon = MODE_ICON[m];
            const active = wf.frame.mode === m;
            return (
              <button
                key={m}
                onClick={() => wf.setMode(m)}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
                  active ? "bg-brand-500/15 text-brand-700 dark:text-brand-300" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-3 w-3" />
                {modeLabel[m]}
              </button>
            );
          })}
        </div>

        {/* ── Presence ──────────────────────────────────────────────────── */}
        <div className={`${styles.presence} border-b border-border`}>
          <div className={`${styles.materialize} relative`} style={{ width: presenceSize, height: presenceSize }}>
            {/* Holographic base (also the graceful fallback if the 3D figure
                can't load). The real-time 3D character renders on top. */}
            <div className="absolute inset-0">
              <HologramPlaceholder state={presence} size={presenceSize} accent={expert.presentation.accent} label={expert.displayName} />
            </div>
            <div className="absolute inset-0">
              <IsabellaPresence renderer="three" state={presence} size={presenceSize} accent={expert.presentation.accent} name={expert.displayName} />
            </div>
          </div>
          <div className={styles.nameplate}>
            <p className="text-sm font-semibold text-foreground">{expert.displayName}</p>
            <p className="text-[11px] text-muted-foreground">{expertTitle}</p>
            <p className={`${styles.status} mt-1 text-brand-600 dark:text-brand-400`}>
              <span className={styles.statusDot} />
              {statusLabel[presence]}
            </p>
            {voice.enabled && voice.supported && !voice.hasFemaleVoice(locale) && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                {tt("No female voice installed — using the closest available.", "No hay voz femenina instalada — uso la más cercana.")}
              </p>
            )}
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
                  onNavigate={onNavigate}
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

          {guideNote && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-xs text-foreground">
              <span>{guideNote}</span>
              <button
                onClick={() => { setGuideNote(null); ask("explain_screen", ""); }}
                className="shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-brand-700"
              >
                {tt("Yes", "Sí")}
              </button>
            </div>
          )}
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
          onSubmit={(e) => { e.preventDefault(); ask("question", input); }}
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

        {/* ── Resize handle (bottom-left) ───────────────────────────────── */}
        {!wf.frame.fullscreen && (
          <div
            onPointerDown={wf.onResizeStart}
            className="absolute bottom-0 left-0 h-4 w-4 cursor-nesw-resize"
            title={tt("Resize", "Redimensionar")}
            aria-hidden
          >
            <span className="absolute bottom-1 left-1 h-2 w-2 border-b-2 border-l-2 border-muted-foreground/50" />
          </div>
        )}
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
  onNavigate,
  onFeedback,
  onFollowup,
}: {
  turn: Turn;
  locale: Locale;
  links: ResolvedLink[];
  canSpeak: boolean;
  onSpeak: (text: string, lang: Locale) => void;
  onNavigate: (href: string, label: string) => void;
  onFeedback: (helpful: boolean) => void;
  onFollowup: (q: string) => void;
}) {
  const isEs = locale === "es";
  const tt = (en: string, es: string) => (isEs ? es : en);
  const a = turn.answer!;
  const k: "en" | "es" = isEs ? "es" : "en";
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
        <AnswerText text={a.answer} links={links} locale={k} onNavigate={onNavigate} />
      </div>

      {a.steps.length > 0 && (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-foreground">
          {a.steps.map((s, i) => (
            <li key={i}>
              <AnswerText text={s} links={links} locale={k} onNavigate={onNavigate} />
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
