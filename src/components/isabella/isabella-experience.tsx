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
// • 3D-READY — the presence area hosts the validated hologram figure
//   (hologram/hologram-figure.tsx, port of the approved prototype) today and
//   the Ready Player Me + Mixamo 3D figure (React Three Fiber) next, behind
//   the same PresenceState contract. The old SVG portrait is retired here.
//
// Knowledge stays in Knowledge OS — same action, confidence and sources.
// ============================================================================

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Send, X, ThumbsUp, ThumbsDown, BookOpen, ChevronDown, ChevronUp, ChevronRight,
  ScanSearch, ListChecks, MessageCircleQuestion, Sparkles, TriangleAlert, Info,
  Volume2, VolumeX, Square, Palette, Play, PanelLeft, PanelRight, Minus,
  Maximize2, Minimize2, GripHorizontal, Compass, Presentation, MessageSquare,
  BadgeCheck,
} from "lucide-react";
import type { Locale } from "@/types/database";
import type { GuideAnswer, GuideContext, GuideIntent } from "@/lib/knowledge-os/types";
import { QUICK_ACTIONS } from "@/lib/knowledge-os/config";
import { resolveExpert } from "@/lib/knowledge-os/experts";
import { detectLanguage } from "@/lib/knowledge-os/language";
import { resolveScreen, enrichContextWithScreen } from "@/lib/knowledge-os/screens";
import { buildActionLinks, type ResolvedLink } from "@/lib/knowledge-os/action-links";
import {
  resolveIsabellaLayoutState,
  isCompactHeaderRequired,
  type IsabellaLayoutSignals,
} from "@/lib/product-ux-contracts/contracts";
import { askLivingGuideAction, submitGuideFeedbackAction } from "@/components/living-guide/actions";
import type { IsabellaAskDetail } from "@/lib/isabella/ask-isabella";
import { ConfidenceBadge, AnswerText } from "@/components/living-guide";
import { IsabellaPresence, type PresenceState } from "./avatar";
import { ProjectBriefing } from "./project-briefing";
import { PortfolioBriefing } from "./portfolio-briefing";
import { HologramFigure } from "./hologram/hologram-figure";
import { useWindowFrame, type WindowMode } from "./hologram/use-window-frame";
import { useSpeech } from "./use-speech";
import styles from "./isabella-experience.module.css";

const ICONS: Record<string, typeof ScanSearch> = {
  ScanSearch, ListChecks, MessageCircleQuestion, Sparkles, TriangleAlert,
};

// The realistic 3D figure only renders when the official Ready Player Me avatar
// URL is configured; otherwise the elegant holographic presence stands in.
const HAS_3D_AVATAR = !!process.env.NEXT_PUBLIC_ISABELLA_AVATAR_URL;

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
  initialAsk,
  onClose,
}: {
  locale: Locale;
  baseContext: GuideContext;
  /** UX-014 — open with a seeded question + entity context (e.g. "Ask Isabella about this task"). */
  initialAsk?: IsabellaAskDetail | null;
  onClose: () => void;
}) {
  const isEs = locale === "es";
  const tt = (en: string, es: string) => (isEs ? es : en);
  const pathname = usePathname();
  const wf = useWindowFrame();
  const voice = useSpeech();

  const expert = resolveExpert({ module: baseContext.module });
  const screen = useMemo(() => resolveScreen(pathname || "", locale), [pathname, locale]);
  const context = useMemo(() => {
    const enriched = enrichContextWithScreen(baseContext, screen, pathname || "");
    // UX-014 — when opened about a specific entity, carry it so the server can
    // attach the right (record-backed) context/provenance to the answer.
    return initialAsk?.entity ? { ...enriched, currentEntity: initialAsk.entity } : enriched;
  }, [baseContext, screen, pathname, initialAsk]);
  const expertTitle = expert.title[isEs ? "es" : "en"];
  const expertInfo = { key: expert.key, displayName: expert.displayName, title: expertTitle };
  const actionLinks = useMemo(() => buildActionLinks(locale, context), [locale, context]);

  // REG-013 — Project Health Briefing. When Isabella opens inside a project she
  // proactively shows a deterministic briefing; dismissal is session-scoped.
  const projectId = context.projectId ?? null;
  const [briefingHidden, setBriefingHidden] = useState(false);
  useEffect(() => {
    if (!projectId) return;
    try {
      setBriefingHidden(window.sessionStorage.getItem(`isabella.briefing.dismissed:${projectId}`) === "1");
    } catch {
      setBriefingHidden(false);
    }
  }, [projectId]);

  // PMO portfolio briefing — shown outside a project for owner/admin (PMO).
  const isPmo = context.role === "owner" || context.role === "admin";
  const showPortfolio = !projectId && isPmo;
  const [portfolioHidden, setPortfolioHidden] = useState(false);
  useEffect(() => {
    if (!showPortfolio) return;
    try {
      setPortfolioHidden(window.sessionStorage.getItem("isabella.portfolioBriefing.dismissed") === "1");
    } catch {
      setPortfolioHidden(false);
    }
  }, [showPortfolio]);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [greeting, setGreeting] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [guideNote, setGuideNote] = useState<string | null>(null);
  // True when voice is enabled but no female voice could play (text-only, never male).
  const [voiceUnavailable, setVoiceUnavailable] = useState(false);
  const [tone, setTone] = useState<StageTone>(() => {
    try {
      const s = typeof window !== "undefined" ? (window.localStorage.getItem(TONE_STORAGE) as StageTone | null) : null;
      return s && TONE_ORDER.includes(s) ? s : "app";
    } catch { return "app"; }
  });
  const [pending, startTransition] = useTransition();
  // UX-004 — Compact Isabella Response Layout: the large hologram is the idle
  // presentation; once a conversation starts the answer wins. The user may
  // manually expand the avatar back without it hiding the current response.
  const [avatarExpanded, setAvatarExpanded] = useState(false);

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
        if (voice.enabled) setVoiceUnavailable(!voice.speak(answer.answer, answer.language));
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

  // UX-014 — when opened via "Ask Isabella about this task" (or similar), seed
  // the conversation once with the provided question. The created turn becomes
  // active content, so the Welcome Hero collapses per UX-001/REG-014.
  const askedInitialRef = useRef(false);
  useEffect(() => {
    if (askedInitialRef.current) return;
    const q = initialAsk?.query?.trim();
    if (q) {
      askedInitialRef.current = true;
      ask("question", q);
    }
    // ask is stable for this purpose; we intentionally run only for the seeded query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAsk]);

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
  // ── REG-014 / UX-001 — Isabella Welcome Hero lifecycle (PROTECTED) ────────
  // The full Welcome Hero belongs to the EMPTY_WELCOME state ONLY. ANY active
  // content is ACTIVE_CONTENT and MUST collapse the hero into the compact header
  // so the content wins — the large avatar is a welcome affordance, not chrome.
  //
  // ACTIVE_CONTENT is true when ANY of these hold:
  //   • a Project or Portfolio Briefing is showing (counts as assistant content),
  //   • the conversation has at least one turn (user or assistant),
  //   • a request is in flight (pending),
  //   • the user has typed the first character.
  // Returning to EMPTY_WELCOME happens only when all of the above are empty
  // (briefing dismissed AND no turns AND not pending AND input empty) — i.e. a
  // genuine reset/new-conversation/empty-history state.
  //
  // Do NOT reintroduce a `turns.length > 0`-only check here: a Project Briefing
  // with no turns would then wrongly show the large hero stacked on top of the
  // briefing. That stacked layout is exactly REG-014. See UX-001 and the test
  // src/lib/product-ux-contracts/__tests__/isabella-welcome-hero.test.ts.
  const briefingActive =
    (!!projectId && !briefingHidden) || (showPortfolio && !portfolioHidden);
  // The layout rule lives in the Product UX Contract (UX-001) so it is the single
  // source of truth and a future refactor cannot drift from the approved behavior.
  const layoutSignals: IsabellaLayoutSignals = {
    turnCount: turns.length,
    briefingActive,
    pending,
    inputLength: input.trim().length,
    avatarManuallyExpanded: avatarExpanded,
  };
  const isEmptyWelcome = resolveIsabellaLayoutState(layoutSignals) === "EMPTY_WELCOME";
  const hasActiveContent = !isEmptyWelcome;
  // State A (EMPTY_WELCOME): large hologram. State B (ACTIVE_CONTENT): compact
  // header. State C: the user manually re-expanded the avatar (UX-004) — an
  // explicit, user-initiated action, never an automatic regression.
  const compactPresence = isCompactHeaderRequired(layoutSignals);

  // ── Minimized pill ─────────────────────────────────────────────────────────
  if (wf.frame.minimized) {
    return (
      <div style={{ ...wf.style, width: "auto", height: "auto" }} className={`${themeClass}`}>
        <div
          onPointerDown={wf.onDragStart}
          className={`flex cursor-grab items-center gap-2 rounded-full border ${panelTone} py-1.5 pl-1.5 pr-3 text-foreground shadow-xl active:cursor-grabbing`}
        >
          <HologramFigure state={presence} size={34} label={expert.displayName} />
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

        {/* ── Presence — Welcome Hero lifecycle (REG-014 / UX-001) ───────────
            Two mutually-exclusive presentations share one animated region:
            • Compact header (State B): shown whenever there is active content.
            • Full Welcome Hero (State A / manual State C): always mounted but
              CSS-collapsed (max-height/opacity → 0, ~300ms) while content is
              active, so the briefing/conversation is readable immediately and
              the large avatar never stacks on top of content. On first load
              WITH a briefing it mounts already-collapsed (no flash of hero). */}
        {compactPresence && (
          <div
            data-testid="isabella-compact-header"
            className={`${styles.compactHeader} flex items-center justify-between gap-2 border-b border-border px-3 py-1.5`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <HologramFigure state={presence} size={28} label={expert.displayName} />
              <span className="truncate text-xs font-semibold text-foreground">{expert.displayName}</span>
              <span
                className="hidden shrink-0 items-center gap-0.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-1.5 text-[9px] font-medium text-brand-600 dark:text-brand-400 sm:inline-flex"
                title={tt(
                  "Isabella answers from the Product Brain, project data, and Project Memory.",
                  "Isabella responde desde el Product Brain, los datos del proyecto y la Memoria del Proyecto.",
                )}
              >
                <BadgeCheck className="h-2.5 w-2.5" aria-hidden />
                {tt("Grounded in Product Intelligence", "Fundamentada en Inteligencia de Producto")}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-brand-600 dark:text-brand-400">
                <span className={styles.statusDot} />
                {statusLabel[presence]}
              </span>
            </div>
            <button
              onClick={() => setAvatarExpanded(true)}
              className={`${iconBtn} shrink-0`}
              title={tt("Show Isabella", "Mostrar a Isabella")}
              aria-label={tt("Expand Isabella avatar", "Expandir el avatar de Isabella")}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Full Welcome Hero — always mounted, collapses when active content. */}
        <div
          data-testid="isabella-welcome-hero"
          data-collapsed={compactPresence ? "true" : "false"}
          aria-hidden={compactPresence}
          className={`${styles.heroWrap} ${compactPresence ? styles.heroWrapCollapsed : ""}`}
        >
          <div className={`${styles.presence} relative border-b border-border`}>
            {hasActiveContent && (
              <button
                onClick={() => setAvatarExpanded(false)}
                tabIndex={compactPresence ? -1 : 0}
                className={`absolute right-1.5 top-1.5 z-10 ${iconBtn}`}
                title={tt("Collapse", "Contraer")}
                aria-label={tt("Collapse Isabella avatar", "Contraer el avatar de Isabella")}
              >
                <ChevronUp className="h-4 w-4" />
              </button>
            )}
            <div className={`${styles.materialize} relative`} style={{ width: presenceSize, height: presenceSize }}>
              {/* Holograma validado del prototipo (también el fallback elegante
                  si la figura 3D no carga). The real-time 3D character renders on top. */}
              <div className="absolute inset-0">
                <HologramFigure state={presence} size={presenceSize} stage label={expert.displayName} />
              </div>
              {HAS_3D_AVATAR && (
                <div className="absolute inset-0">
                  <IsabellaPresence renderer="three" state={presence} size={presenceSize} accent={expert.presentation.accent} name={expert.displayName} />
                </div>
              )}
            </div>
            <div className={styles.nameplate}>
              <p className="text-sm font-semibold text-foreground">{expert.displayName}</p>
              <p className="text-[11px] text-muted-foreground">{expertTitle}</p>
              <span
                className="mt-1 inline-flex items-center gap-1 rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 text-[10px] font-medium text-brand-600 dark:text-brand-400"
                title={tt(
                  "Isabella answers from the Product Brain, project data, and Project Memory.",
                  "Isabella responde desde el Product Brain, los datos del proyecto y la Memoria del Proyecto.",
                )}
              >
                <BadgeCheck className="h-3 w-3" aria-hidden />
                {tt("Grounded in Product Intelligence", "Fundamentada en Inteligencia de Producto")}
              </span>
              <p className={`${styles.status} mt-1 text-brand-600 dark:text-brand-400`}>
                <span className={styles.statusDot} />
                {statusLabel[presence]}
              </p>
              {voice.enabled && voice.supported && (voiceUnavailable || !voice.hasFemaleVoice(locale)) && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {tt("Female voice unavailable on this device.", "Voz femenina no disponible en este dispositivo.")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Conversation ──────────────────────────────────────────────── */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {/* REG-013 — proactive Project Health Briefing (project context only) */}
          {projectId && !briefingHidden && (
            <ProjectBriefing
              key={projectId}
              locale={locale}
              projectId={projectId}
              onDismissed={() => setBriefingHidden(true)}
            />
          )}
          {/* PMO Portfolio Briefing (outside a project, owner/admin only) */}
          {showPortfolio && !portfolioHidden && (
            <PortfolioBriefing locale={locale} onDismissed={() => setPortfolioHidden(true)} />
          )}
          {/* Empty-welcome greeting — only in EMPTY_WELCOME. With an active
              briefing or conversation it is hidden so content wins (REG-014). */}
          {isEmptyWelcome && (
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
                  onSpeak={(text, lang) => setVoiceUnavailable(!voice.speak(text, lang))}
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
