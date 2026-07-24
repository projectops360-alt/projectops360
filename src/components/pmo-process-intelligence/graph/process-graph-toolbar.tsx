"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Crosshair,
  Maximize2,
  Minimize2,
  RotateCcw,
  Search,
} from "lucide-react";
import type {
  ProcessGraphEntity,
  ProcessGraphSemanticZoom,
} from "@/lib/pmo-process-intelligence/process-graph.types";

export function ProcessGraphToolbar({
  locale,
  entities,
  semanticZoom,
  layer,
  canGoBack,
  fullscreen,
  onFocusNode,
  onFitView,
  onReset,
  onBack,
  onToggleFullscreen,
}: {
  locale: "en" | "es";
  entities: readonly ProcessGraphEntity[];
  semanticZoom: ProcessGraphSemanticZoom;
  layer: string;
  canGoBack: boolean;
  fullscreen: boolean;
  onFocusNode: (nodeId: string) => void;
  onFitView: () => void;
  onReset: () => void;
  onBack: () => void;
  onToggleFullscreen: () => void;
}) {
  const es = locale === "es";
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale);
    if (!normalized) return [];
    return entities
      .filter((entity) =>
        entity.label.toLocaleLowerCase(locale).includes(normalized),
      )
      .slice(0, 8);
  }, [entities, locale, query]);
  return (
    <div className="relative z-30 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">
      {canGoBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {es ? "Atrás" : "Back"}
        </button>
      ) : null}
      <label className="relative min-w-[180px] flex-1 sm:min-w-[220px] sm:max-w-sm">
        <span className="sr-only">
          {es ? "Buscar y enfocar un nodo" : "Search and focus a node"}
        </span>
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={es ? "Buscar y enfocar…" : "Search and focus…"}
          className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
        {results.length > 0 ? (
          <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            {results.map((entity) => (
              <button
                key={entity.id}
                type="button"
                onClick={() => {
                  onFocusNode(entity.id);
                  setQuery("");
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-emerald-50"
              >
                <span className="truncate font-semibold text-slate-900">
                  {entity.label}
                </span>
                <span className="shrink-0 text-[10px] uppercase text-slate-500">
                  {entity.kind}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </label>
      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
        {layer} · {semanticZoom}
      </span>
      <button
        type="button"
        onClick={onFitView}
        aria-label={es ? "Ajustar vista" : "Fit view"}
        title={es ? "Ajustar vista" : "Fit view"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
      >
        <Crosshair className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onReset}
        aria-label={es ? "Restablecer layout" : "Reset layout"}
        title={es ? "Restablecer layout" : "Reset layout"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onToggleFullscreen}
        aria-label={fullscreen ? (es ? "Salir de pantalla completa" : "Exit fullscreen") : es ? "Pantalla completa" : "Fullscreen"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
      >
        {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
    </div>
  );
}
