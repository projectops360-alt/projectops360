"use client";

// ============================================================================
// Right-click a milestone → measure it by this KPI
// ============================================================================
// Linking a KPI to a phase used to be impossible: the engine was project-wide,
// so a KPI belonged to a project or to nothing. Now that a KPI can be asked of
// one milestone, the act of linking needs somewhere to live — and the obvious
// place is the milestone itself, on the graph, where the user is already
// looking at the phase they want to measure.
//
// The menu lists built-ins and the project's own custom KPIs together: from
// here they are the same thing, a question you can ask of this phase.
// ============================================================================

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, BarChart3, Check, Loader2, Plus, Trash2, X } from "lucide-react";
import {
  MAX_PINS_PER_MILESTONE,
  type PinnableKpi,
  type ResolvedPinnedKpi,
} from "@/lib/kpi/milestone-pins";
import type { MilestoneKpiPinError } from "@/lib/kpi/milestone-pin-actions";
import type { Locale } from "@/types/database";

export interface MilestoneKpiContextMenuProps {
  locale: Locale;
  /** Where the user right-clicked, in viewport coordinates. */
  x: number;
  y: number;
  milestoneTitle: string;
  /** Everything pinnable: catalog + this project's custom KPIs. */
  available: PinnableKpi[];
  /** Everything pinned here, INCLUDING pins whose KPI was deleted. Passing the
   *  resolved list (not just slugs) is what makes an orphaned pin removable. */
  pinned: ResolvedPinnedKpi[];
  /** Returns an error message, or null on success. The menu shows it: a click
   *  that silently does nothing reads as a broken button. */
  onTogglePin: (slug: string, pinned: boolean) => Promise<MilestoneKpiPinError | null>;
  onClose: () => void;
}

const COPY = {
  en: {
    title: "Measure this milestone by",
    search: "Search KPIs…",
    none: "No KPI matches",
    builtIn: "Built-in",
    custom: "Yours",
    hint: "Hover the card to see the values.",
    errors: {
      unauthorized: "You do not have access to this project.",
      viewer_cannot_write: "Viewers cannot change KPIs.",
      invalid_input: "That KPI could not be read.",
      unknown_kpi: "That KPI no longer exists.",
      cap_reached: `This milestone already has ${MAX_PINS_PER_MILESTONE} KPIs. Remove one to add another.`,
      write_failed: "Could not save the change. Try again.",
    },
  },
  es: {
    title: "Medir este hito por",
    search: "Buscar KPIs…",
    none: "Ningún KPI coincide",
    builtIn: "Del sistema",
    custom: "Tuyos",
    hint: "Pasa el ratón por la tarjeta para ver los valores.",
    errors: {
      unauthorized: "No tienes acceso a este proyecto.",
      viewer_cannot_write: "Los observadores no pueden cambiar KPIs.",
      invalid_input: "No se pudo leer ese KPI.",
      unknown_kpi: "Ese KPI ya no existe.",
      cap_reached: `Este hito ya tiene ${MAX_PINS_PER_MILESTONE} KPIs. Quita uno para añadir otro.`,
      write_failed: "No se pudo guardar el cambio. Inténtalo de nuevo.",
    },
  },
} as const;

/** Keep the menu on screen when the click lands near an edge. */
function clamp(x: number, y: number, width = 288, height = 380) {
  if (typeof window === "undefined") return { left: x, top: y };
  return {
    left: Math.min(x, Math.max(8, window.innerWidth - width - 8)),
    top: Math.min(y, Math.max(8, window.innerHeight - height - 8)),
  };
}

export function MilestoneKpiContextMenu({
  locale,
  x,
  y,
  milestoneTitle,
  available,
  pinned,
  onTogglePin,
  onClose,
}: MilestoneKpiContextMenuProps) {
  const isEs = locale === "es";
  const t = COPY[isEs ? "es" : "en"];
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [error, setError] = useState<MilestoneKpiPinError | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const needle = query.trim().toLowerCase();
  const matches = available.filter((k) => {
    if (!needle) return true;
    return (
      (isEs ? k.nameEs : k.nameEn).toLowerCase().includes(needle) ||
      k.slug.includes(needle) ||
      k.expression.toLowerCase().includes(needle)
    );
  });

  const pinnedSlugs = pinned.map((k) => k.slug);
  // Pins whose KPI was deleted. They still occupy one of the milestone's slots,
  // and until now there was NO way to remove one: the menu only listed KPIs
  // that exist, so an orphan stayed visible on the card forever.
  const orphans = pinned.filter((k) => k.status === "missing");
  const atCap = pinned.length >= MAX_PINS_PER_MILESTONE;

  const { left, top } = clamp(x, y);

  async function toggle(slug: string, isPinned: boolean) {
    setBusySlug(slug);
    setError(null);
    try {
      setError(await onTogglePin(slug, isPinned));
    } finally {
      setBusySlug(null);
    }
  }

  return (
    <div
      ref={rootRef}
      role="menu"
      aria-label={`${t.title}: ${milestoneTitle}`}
      style={{ left, top }}
      className="fixed z-[60] w-72 rounded-xl border border-border bg-card p-2 shadow-2xl"
    >
      <div className="flex items-baseline justify-between gap-2 px-1.5 pb-1.5">
        <p className="text-[11px] font-semibold text-foreground">
          {t.title}
          <span className="ml-1 font-normal text-muted-foreground">
            {milestoneTitle.length > 22 ? `${milestoneTitle.slice(0, 22)}…` : milestoneTitle}
          </span>
        </p>
        <span className="flex shrink-0 items-center gap-1.5">
          {/* The limit has to be legible BEFORE it bites: a click that does
              nothing because a hidden cap was reached reads as a broken menu. */}
          <span className={`font-mono text-[9px] tabular-nums ${atCap ? "font-bold text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
            {pinned.length}/{MAX_PINS_PER_MILESTONE}
          </span>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      </div>

      <input
        type="text"
        value={query}
        autoFocus
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.search}
        className="mb-1.5 w-full rounded-md border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-brand-500"
      />

      {orphans.length > 0 && (
        <div className="mb-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-1.5">
          <p className="mb-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
            {isEs ? "KPIs eliminados, aún fijados aquí" : "Deleted KPIs, still pinned here"}
          </p>
          {orphans.map((orphan) => (
            <button
              key={orphan.slug}
              type="button"
              onClick={() => startTransition(() => void toggle(orphan.slug, true))}
              disabled={busySlug === orphan.slug}
              className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-[11px] hover:bg-amber-500/15 disabled:opacity-60"
            >
              {busySlug === orphan.slug ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-3 w-3 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate font-mono italic text-muted-foreground">
                {orphan.slug}
              </span>
              <span className="shrink-0 text-[9px] font-medium text-amber-700 dark:text-amber-400">
                {isEs ? "Quitar" : "Remove"}
              </span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mb-1.5 flex items-start gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-[10px] leading-snug text-rose-700 dark:text-rose-400"
        >
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden />
          {t.errors[error]}
        </p>
      )}

      <ul className="max-h-64 space-y-0.5 overflow-y-auto pr-0.5">
        {matches.length === 0 && (
          <li className="px-1.5 py-2 text-[11px] text-muted-foreground">{t.none}</li>
        )}
        {matches.map((kpi) => {
          const isPinned = pinnedSlugs.includes(kpi.slug);
          const busy = busySlug === kpi.slug;
          const blocked = atCap && !isPinned;
          return (
            <li key={kpi.slug}>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={isPinned}
                disabled={busy || blocked}
                onClick={() => startTransition(() => void toggle(kpi.slug, isPinned))}
                title={
                  blocked
                    ? isEs
                      ? `Este hito ya tiene ${MAX_PINS_PER_MILESTONE} KPIs. Quita uno para añadir este.`
                      : `This milestone already has ${MAX_PINS_PER_MILESTONE} KPIs. Remove one to add this.`
                    : kpi.expression
                }
                className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[11px] transition-colors hover:bg-muted disabled:opacity-60 ${blocked ? "cursor-not-allowed" : ""}`}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {busy ? (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden />
                  ) : isPinned ? (
                    <Check className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" aria-hidden />
                  ) : (
                    <Plus className="h-3 w-3 text-muted-foreground" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={isPinned ? "font-medium text-foreground" : "text-foreground"}>
                    {isEs ? kpi.nameEs : kpi.nameEn}
                  </span>
                  <span className="block truncate font-mono text-[9px] text-muted-foreground">
                    {kpi.expression}
                  </span>
                </span>
                {kpi.source === "custom" && (
                  <span className="shrink-0 rounded bg-brand-500/15 px-1 text-[8px] font-semibold uppercase text-brand-700 dark:text-brand-300">
                    {t.custom}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="flex items-center gap-1 border-t border-border/60 px-1.5 pt-1.5 text-[9px] text-muted-foreground">
        <BarChart3 className="h-2.5 w-2.5" aria-hidden />
        {t.hint}
      </p>
    </div>
  );
}
