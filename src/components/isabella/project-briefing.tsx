"use client";

// ============================================================================
// Isabella — Project Health Briefing (REG-013)
// ============================================================================
// When Isabella opens inside a project she does NOT wait passively. She fetches
// a deterministic project health briefing (no AI on open) and shows it above the
// generic prompt: overall status, what looks good, what needs attention, the top
// recommended actions, and where to verify each finding in the app.
//
// • Deterministic: every number/list comes from getProjectBriefingAction, which
//   reuses the canonical REG-010 rollup + roadmap engines. Nothing is invented.
// • Refresh: re-runs the deterministic load on demand.
// • Dismiss: hides the briefing for the current session only (sessionStorage).
// ============================================================================

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshCw, X, CheckCircle2, TriangleAlert, ArrowRight, ExternalLink,
  ShieldCheck, Info, Loader2,
} from "lucide-react";
import type { Locale } from "@/types/database";
import { localizedPath } from "@/lib/knowledge-os/action-links";
import { getProjectBriefingAction } from "@/components/living-guide/actions";
import type { ProjectBriefing } from "@/lib/project-briefing/types";
import {
  briefingTitle, briefingSubtitle, healthBandLabel, overallStatusLine,
  goodSignalLabel, attentionLabel, recommendedLabel, verifyLabel, verifyRoute,
  dataGapLabel, allStableLine,
} from "@/lib/project-briefing/briefing-copy";

const DISMISS_PREFIX = "isabella.briefing.dismissed:";

function sessionDismissed(projectId: string): boolean {
  try {
    return typeof window !== "undefined" && window.sessionStorage.getItem(DISMISS_PREFIX + projectId) === "1";
  } catch {
    return false;
  }
}

export function ProjectBriefing({
  locale,
  projectId,
  onDismissed,
}: {
  locale: Locale;
  projectId: string;
  /** Called once the user dismisses the briefing (so the host can hide it). */
  onDismissed: () => void;
}) {
  const isEs = locale === "es";
  const tt = (en: string, es: string) => (isEs ? es : en);

  const [briefing, setBriefing] = useState<ProjectBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | "not_authorized" | "no_project" | "unavailable">(null);
  // Guard against React Strict Mode double-invoke and duplicate concurrent loads.
  const loadKeyRef = useRef<string>("");

  const load = useCallback(
    async (force = false) => {
      const key = `${projectId}:${force ? Date.now() : "initial"}`;
      if (!force && loadKeyRef.current.startsWith(`${projectId}:`)) return; // already loaded/loading for this project
      loadKeyRef.current = key;
      setLoading(true);
      setError(null);
      try {
        const res = await getProjectBriefingAction(projectId, locale);
        // Ignore a stale response if a newer load started.
        if (loadKeyRef.current !== key) return;
        if (res.ok) {
          setBriefing(res.briefing);
        } else {
          setError(res.reason);
          setBriefing(null);
        }
      } catch {
        if (loadKeyRef.current !== key) return;
        setError("unavailable");
      } finally {
        if (loadKeyRef.current === key) setLoading(false);
      }
    },
    [projectId, locale],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  function dismiss() {
    try {
      window.sessionStorage.setItem(DISMISS_PREFIX + projectId, "1");
    } catch {
      /* ignore */
    }
    onDismissed();
  }

  const updatedLabel = tt("Updated just now", "Actualizado recién");

  return (
    <div className="rounded-2xl border border-brand-500/30 bg-brand-500/[0.04] p-4">
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{briefingTitle(locale)}</p>
            <p className="text-[11px] text-muted-foreground">{briefingSubtitle(locale)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
            title={tt("Refresh briefing", "Actualizar briefing")}
            aria-label={tt("Refresh briefing", "Actualizar briefing")}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={dismiss}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            title={tt("Dismiss for this session", "Ocultar en esta sesión")}
            aria-label={tt("Dismiss briefing", "Ocultar briefing")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && !briefing && (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {tt("Reviewing your project…", "Revisando tu proyecto…")}
        </div>
      )}

      {/* Error / safe states */}
      {!loading && error && (
        <p className="py-1 text-xs text-muted-foreground">
          {error === "not_authorized"
            ? tt("You don't have access to this project's briefing.", "No tienes acceso al briefing de este proyecto.")
            : error === "no_project"
            ? tt("I couldn't find this project.", "No pude encontrar este proyecto.")
            : tt("Project data is unavailable right now.", "Los datos del proyecto no están disponibles ahora mismo.")}
        </p>
      )}

      {briefing && (
        <BriefingBody locale={locale} briefing={briefing} updatedLabel={updatedLabel} />
      )}
    </div>
  );
}

function BriefingBody({
  locale,
  briefing: b,
  updatedLabel,
}: {
  locale: Locale;
  briefing: ProjectBriefing;
  updatedLabel: string;
}) {
  const isEs = locale === "es";
  const tt = (en: string, es: string) => (isEs ? es : en);
  const bandTone: Record<ProjectBriefing["healthBand"], string> = {
    healthy: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
    watch: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    at_risk: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
  };

  return (
    <div className="space-y-3 text-sm text-foreground">
      {/* Overall status */}
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${bandTone[b.healthBand]}`}>
          {healthBandLabel(b.healthBand, locale)}
        </span>
        <span className="text-[10px] text-muted-foreground">· {updatedLabel}</span>
      </div>
      <p className="leading-relaxed">{overallStatusLine(b, locale)}</p>

      {/* Quick numbers */}
      {b.overview.totalTasks > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>{tt("Complete", "Completado")}: <strong className="text-foreground">{b.overview.percentComplete}%</strong></span>
          <span>{tt("Active", "Activas")}: <strong className="text-foreground">{b.overview.activeTasks}</strong></span>
          <span>{tt("In progress", "En progreso")}: <strong className="text-foreground">{b.overview.inProgressTasks}</strong></span>
          <span>{tt("Done", "Hechas")}: <strong className="text-foreground">{b.overview.completedTasks}</strong></span>
          {b.overview.nextMilestone && (
            <span className="basis-full">
              {tt("Next milestone", "Próximo hito")}: <strong className="text-foreground">{b.overview.nextMilestone.title}</strong>
              {b.overview.nextMilestone.date ? ` · ${b.overview.nextMilestone.date}` : ""}
            </span>
          )}
        </div>
      )}

      {/* What looks good */}
      {b.good.length > 0 && (
        <Section icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />} title={tt("What looks good", "Lo que va bien")}>
          <ul className="space-y-0.5">
            {b.good.map((g) => (
              <li key={g} className="text-xs text-muted-foreground">• {goodSignalLabel(g, locale)}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* Needs attention */}
      {b.attention.length > 0 ? (
        <Section icon={<TriangleAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />} title={tt("Needs attention", "Requiere atención")}>
          <ul className="space-y-0.5">
            {b.attention.map((a) => (
              <li key={a.key} className="text-xs text-foreground">• {attentionLabel(a.key, a.count, locale)}</li>
            ))}
          </ul>
        </Section>
      ) : (
        b.overview.totalTasks > 0 && (
          <p className="rounded-lg border border-green-500/30 bg-green-500/5 px-2.5 py-1.5 text-xs text-foreground">
            {allStableLine(locale)}
          </p>
        )
      )}

      {/* Recommended next actions */}
      {b.recommended.length > 0 && (
        <Section icon={<ArrowRight className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />} title={tt("Recommended next actions", "Próximas acciones recomendadas")}>
          <ol className="list-decimal space-y-0.5 pl-5">
            {b.recommended.map((r) => (
              <li key={r} className="text-xs text-foreground">{recommendedLabel(r, locale)}</li>
            ))}
          </ol>
        </Section>
      )}

      {/* Data gaps (honesty) */}
      {b.dataGaps.length > 0 && (
        <Section icon={<Info className="h-3.5 w-3.5 text-muted-foreground" />} title={tt("Not enough data for", "Datos insuficientes para")}>
          <ul className="space-y-0.5">
            {b.dataGaps.map((d) => (
              <li key={d} className="text-xs text-muted-foreground">• {dataGapLabel(d, locale)}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* Verify in app */}
      {b.verify.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border pt-2.5">
          <span className="w-full text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {tt("Verify in app", "Verifica en la app")}
          </span>
          {b.verify.map((v) => (
            <Link
              key={v}
              href={localizedPath(verifyRoute(v, b.projectId), locale)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400"
            >
              <ExternalLink className="h-3 w-3" />
              {verifyLabel(v, locale)}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}
