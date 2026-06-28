"use client";

// ============================================================================
// ProjectOps360° — Living Graph saved-layout controls (UX-007 / PD-008)
// ============================================================================
// A compact floating toolbar over the canvas: Save Layout (+ unsaved indicator)
// and a small menu for Reset to saved / Reset to auto / Clear saved. It works in
// the normal, fullscreen, and Focus Mode views because it floats on the canvas
// rather than competing for toolbar space. Layout/interaction only — it never
// touches graph data; it just asks the parent to persist node coordinates.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import {
  Save,
  Check,
  ChevronDown,
  RotateCcw,
  Wand2,
  Trash2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import type { Locale } from "@/types/database";

export interface LivingGraphLayoutControlsProps {
  locale: Locale;
  /** The user has moved nodes since the last save (drives the active state). */
  hasUnsaved: boolean;
  /** A saved layout exists for the current project + context. */
  hasSaved: boolean;
  /** A save is in flight. */
  saving: boolean;
  onSave: () => void;
  onResetSaved: () => void;
  onResetAuto: () => void;
  onClear: () => void;
}

const COPY = {
  en: {
    save: "Save Layout",
    saving: "Saving…",
    unsaved: "Unsaved layout",
    saved: "Layout saved",
    options: "Layout options",
    resetSaved: "Reset to saved layout",
    resetAuto: "Reset to auto layout",
    clear: "Clear saved layout",
    savedApplied: "Saved layout applied",
    noSaved: "No saved layout yet",
  },
  es: {
    save: "Guardar diseño",
    saving: "Guardando…",
    unsaved: "Diseño sin guardar",
    saved: "Diseño guardado",
    options: "Opciones de diseño",
    resetSaved: "Restaurar diseño guardado",
    resetAuto: "Restaurar diseño automático",
    clear: "Borrar diseño guardado",
    savedApplied: "Diseño guardado aplicado",
    noSaved: "Aún no hay diseño guardado",
  },
} as const;

export function LivingGraphLayoutControls({
  locale,
  hasUnsaved,
  hasSaved,
  saving,
  onSave,
  onResetSaved,
  onResetAuto,
  onClear,
}: LivingGraphLayoutControlsProps) {
  const t = COPY[locale === "es" ? "es" : "en"];
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the options menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div
      ref={rootRef}
      className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-stretch overflow-visible rounded-lg border border-border bg-card/95 shadow-md backdrop-blur"
    >
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        aria-label={t.save}
        title={hasUnsaved ? t.unsaved : hasSaved ? t.savedApplied : t.save}
        className={
          "inline-flex items-center gap-1.5 rounded-l-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 " +
          (hasUnsaved
            ? "bg-brand-600 text-white hover:bg-brand-700"
            : "text-foreground hover:bg-muted")
        }
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : hasUnsaved ? (
          <span className="relative flex h-3.5 w-3.5 items-center justify-center">
            <Save className="h-3.5 w-3.5" aria-hidden />
            <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-amber-400 ring-2 ring-brand-600" />
          </span>
        ) : hasSaved ? (
          <Check className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" aria-hidden />
        ) : (
          <Save className="h-3.5 w-3.5" aria-hidden />
        )}
        <span>{saving ? t.saving : t.save}</span>
      </button>

      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={t.options}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title={t.options}
        className="inline-flex items-center rounded-r-lg border-l border-border px-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute left-1/2 top-[calc(100%+6px)] z-30 w-60 -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        >
          <MenuItem
            icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden />}
            label={t.resetSaved}
            disabled={!hasSaved}
            onClick={() => {
              onResetSaved();
              setMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<Wand2 className="h-3.5 w-3.5" aria-hidden />}
            label={t.resetAuto}
            onClick={() => {
              onResetAuto();
              setMenuOpen(false);
            }}
          />
          <div className="my-1 h-px bg-border" />
          <MenuItem
            icon={<Trash2 className="h-3.5 w-3.5" aria-hidden />}
            label={t.clear}
            disabled={!hasSaved}
            destructive
            onClick={() => {
              onClear();
              setMenuOpen(false);
            }}
          />
          {!hasSaved && (
            <p className="flex items-center gap-1.5 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
              {t.noSaved}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={
        "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
        (destructive
          ? "text-red-600 hover:bg-red-500/10 dark:text-red-400"
          : "text-foreground hover:bg-muted")
      }
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      {label}
    </button>
  );
}
