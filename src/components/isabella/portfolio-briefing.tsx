"use client";

// ============================================================================
// Isabella — Portfolio Health Briefing (PMO)
// ============================================================================
// The PMO counterpart of the per-project briefing. When Isabella opens OUTSIDE
// a project for a PMO (owner/admin) she proactively summarizes the whole
// portfolio: overall status, what looks good, what needs attention, the projects
// that need attention most (with drill-in links), the top recommended actions,
// and where to verify. Deterministic (no AI on open); refresh + session dismiss.
// ============================================================================

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshCw, X, CheckCircle2, TriangleAlert, ArrowRight, ExternalLink,
  LayoutDashboard, Info, Loader2, FolderKanban,
} from "lucide-react";
import type { Locale } from "@/types/database";
import { localizedPath } from "@/lib/knowledge-os/action-links";
import { getPortfolioBriefingAction } from "@/components/living-guide/actions";
import type { PortfolioBriefing } from "@/lib/portfolio-briefing/types";
import {
  portfolioTitle, portfolioSubtitle, portfolioOverallLine, portfolioGoodLabel,
  portfolioAttentionLabel, portfolioRecommendedLabel, portfolioVerifyLabel,
  portfolioVerifyRoute, portfolioDataGapLabel, portfolioStableLine,
} from "@/lib/portfolio-briefing/portfolio-copy";

const DISMISS_KEY = "isabella.portfolioBriefing.dismissed";

export function PortfolioBriefing({
  locale,
  onDismissed,
}: {
  locale: Locale;
  onDismissed: () => void;
}) {
  const isEs = locale === "es";
  const tt = (en: string, es: string) => (isEs ? es : en);

  const [briefing, setBriefing] = useState<PortfolioBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | "not_authorized" | "unavailable">(null);
  const loadKeyRef = useRef<string>("");

  const load = useCallback(
    async (force = false) => {
      const key = force ? `f:${Date.now()}` : "initial";
      if (!force && loadKeyRef.current) return; // already loaded/loading
      loadKeyRef.current = key;
      setLoading(true);
      setError(null);
      try {
        const res = await getPortfolioBriefingAction(locale);
        if (loadKeyRef.current !== key) return;
        if (res.ok) setBriefing(res.briefing);
        else {
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
    [locale],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  function dismiss() {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    onDismissed();
  }

  // A PMO with no access / no data: stay quiet (host falls back to the prompt).
  if (!loading && error === "not_authorized") return null;

  return (
    <div className="rounded-2xl border border-brand-500/30 bg-brand-500/[0.04] p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <LayoutDashboard className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{portfolioTitle(locale)}</p>
            <p className="text-[11px] text-muted-foreground">{portfolioSubtitle(locale)}</p>
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

      {loading && !briefing && (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {tt("Reviewing your portfolio…", "Revisando tu portafolio…")}
        </div>
      )}

      {!loading && error === "unavailable" && (
        <p className="py-1 text-xs text-muted-foreground">
          {tt("Portfolio data is unavailable right now.", "Los datos del portafolio no están disponibles ahora mismo.")}
        </p>
      )}

      {briefing && <PortfolioBody locale={locale} briefing={briefing} />}
    </div>
  );
}

function PortfolioBody({ locale, briefing: b }: { locale: Locale; briefing: PortfolioBriefing }) {
  const isEs = locale === "es";
  const tt = (en: string, es: string) => (isEs ? es : en);
  const bandTone: Record<PortfolioBriefing["healthBand"], string> = {
    healthy: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
    watch: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    at_risk: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
  };
  const bandLabel: Record<PortfolioBriefing["healthBand"], { en: string; es: string }> = {
    healthy: { en: "Healthy", es: "Saludable" },
    watch: { en: "Watch", es: "En observación" },
    at_risk: { en: "Needs attention", es: "Requiere atención" },
  };

  return (
    <div className="space-y-3 text-sm text-foreground">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${bandTone[b.healthBand]}`}>
          {isEs ? bandLabel[b.healthBand].es : bandLabel[b.healthBand].en}
        </span>
        <span className="text-[10px] text-muted-foreground">· {tt("Updated just now", "Actualizado recién")}</span>
      </div>
      <p className="leading-relaxed">{portfolioOverallLine(b, locale)}</p>

      {b.overview.totalActiveTasks > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>{tt("Active projects", "Proyectos activos")}: <strong className="text-foreground">{b.overview.activeProjects}</strong></span>
          <span>{tt("Active tasks", "Tareas activas")}: <strong className="text-foreground">{b.overview.totalActiveTasks}</strong></span>
          <span>{tt("Blockers", "Bloqueos")}: <strong className="text-foreground">{b.overview.activeBlockers}</strong></span>
        </div>
      )}

      {b.good.length > 0 && (
        <Section icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />} title={tt("What looks good", "Lo que va bien")}>
          <ul className="space-y-0.5">
            {b.good.map((g) => (
              <li key={g} className="text-xs text-muted-foreground">• {portfolioGoodLabel(g, locale)}</li>
            ))}
          </ul>
        </Section>
      )}

      {b.attention.length > 0 ? (
        <Section icon={<TriangleAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />} title={tt("Needs attention", "Requiere atención")}>
          <ul className="space-y-0.5">
            {b.attention.map((a) => (
              <li key={a.key} className="text-xs text-foreground">• {portfolioAttentionLabel(a.key, a.count, locale)}</li>
            ))}
          </ul>
        </Section>
      ) : (
        b.overview.totalActiveTasks > 0 && (
          <p className="rounded-lg border border-green-500/30 bg-green-500/5 px-2.5 py-1.5 text-xs text-foreground">
            {portfolioStableLine(locale)}
          </p>
        )
      )}

      {/* Projects that need attention most — drill in */}
      {b.topProjects.length > 0 && (
        <Section icon={<FolderKanban className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />} title={tt("Projects needing attention", "Proyectos que requieren atención")}>
          <ul className="space-y-1">
            {b.topProjects.map((p) => {
              const parts: string[] = [];
              if (p.activeBlockers > 0) parts.push(tt(`${p.activeBlockers} blocked`, `${p.activeBlockers} bloqueadas`));
              if (p.atRiskMilestones > 0) parts.push(tt(`${p.atRiskMilestones} at-risk milestone${p.atRiskMilestones === 1 ? "" : "s"}`, `${p.atRiskMilestones} hito${p.atRiskMilestones === 1 ? "" : "s"} en riesgo`));
              if (p.overdue > 0) parts.push(tt(`${p.overdue} overdue`, `${p.overdue} vencidas`));
              if (p.highRisks > 0) parts.push(tt(`${p.highRisks} high risk${p.highRisks === 1 ? "" : "s"}`, `${p.highRisks} riesgo${p.highRisks === 1 ? "" : "s"} alto${p.highRisks === 1 ? "" : "s"}`));
              return (
                <li key={p.projectId}>
                  <Link
                    href={localizedPath(`/projects/${p.projectId}/status`, locale)}
                    className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 transition hover:border-brand-500"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-foreground">{p.name}</span>
                      {parts.length > 0 && <span className="block truncate text-[10px] text-muted-foreground">{parts.join(" · ")}</span>}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-brand-600 dark:group-hover:text-brand-400" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {b.recommended.length > 0 && (
        <Section icon={<ArrowRight className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />} title={tt("Recommended next actions", "Próximas acciones recomendadas")}>
          <ol className="list-decimal space-y-0.5 pl-5">
            {b.recommended.map((r) => (
              <li key={r} className="text-xs text-foreground">{portfolioRecommendedLabel(r, locale)}</li>
            ))}
          </ol>
        </Section>
      )}

      {b.dataGaps.length > 0 && (
        <Section icon={<Info className="h-3.5 w-3.5 text-muted-foreground" />} title={tt("Not enough data for", "Datos insuficientes para")}>
          <ul className="space-y-0.5">
            {b.dataGaps.map((d) => (
              <li key={d} className="text-xs text-muted-foreground">• {portfolioDataGapLabel(d, locale)}</li>
            ))}
          </ul>
        </Section>
      )}

      <div className="flex flex-wrap gap-1.5 border-t border-border pt-2.5">
        <span className="w-full text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {tt("Verify in app", "Verifica en la app")}
        </span>
        {b.verify.map((v) => (
          <Link
            key={v}
            href={localizedPath(portfolioVerifyRoute(v), locale)}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400"
          >
            <ExternalLink className="h-3 w-3" />
            {portfolioVerifyLabel(v, locale)}
          </Link>
        ))}
      </div>
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
