"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Search, BookOpen, X, Loader2, Filter, ArrowRight,
} from "lucide-react";
import { AddMemoryDialog } from "./add-memory-dialog";
import { MemoryDetailPanel } from "./memory-detail-panel";
import {
  SourceTypeBadge, ImportanceDot, ClassificationBadges, PipelineBadge,
  SOURCE_TYPES, SOURCE_META,
} from "./memory-badges";
import { searchMemoryAction, type MemorySearchResult } from "@/app/[locale]/(app)/projects/[projectId]/memory/search-action";
import type { MemoryItemView, LinkableEntities } from "./types";
import type { Locale, MemoryClassification } from "@/types/database";

interface MemoryTimelineProps {
  locale: Locale;
  projectId: string;
  items: MemoryItemView[];
  entities: LinkableEntities;
  initialItemId?: string;
}

const CLASSIFICATION_FILTERS: Array<{ key: keyof MemoryClassification; en: string; es: string }> = [
  { key: "contains_decision", en: "Decision", es: "Decisión" },
  { key: "contains_risk", en: "Risk", es: "Riesgo" },
  { key: "contains_action_item", en: "Action Item", es: "Acción" },
  { key: "contains_scope_change", en: "Scope Change", es: "Cambio de alcance" },
  { key: "contains_schedule_impact", en: "Schedule Impact", es: "Impacto en cronograma" },
  { key: "contains_cost_impact", en: "Cost Impact", es: "Impacto en costo" },
  { key: "contains_stakeholder_concern", en: "Stakeholder Concern", es: "Preocupación de interesados" },
];

function fmt(date: string | null, locale: string): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}

export function MemoryTimeline({ locale, projectId, items, entities, initialItemId }: MemoryTimelineProps) {
  const isEs = locale === "es";
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MemoryItemView | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialItemId ?? null);

  // Filters
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [classFilter, setClassFilter] = useState<keyof MemoryClassification | "">("");
  const [importanceFilter, setImportanceFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // Semantic search
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<MemorySearchResult[] | null>(null);

  const selected = items.find((i) => i.id === selectedId) ?? null;

  const allTags = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => i.tags.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [items]);

  const lastUpdate = useMemo(() => {
    const dates = items.map((i) => i.occurredAt ?? i.createdAt).filter(Boolean) as string[];
    if (dates.length === 0) return null;
    return dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (sourceFilter && i.sourceType !== sourceFilter) return false;
      if (classFilter && i.aiClassification[classFilter] !== true) return false;
      if (importanceFilter && i.importanceLevel !== importanceFilter) return false;
      if (tagFilter && !i.tags.includes(tagFilter)) return false;
      return true;
    });
  }, [items, sourceFilter, classFilter, importanceFilter, tagFilter]);

  const hasActiveFilters = !!(sourceFilter || classFilter || importanceFilter || tagFilter);

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const results = await searchMemoryAction({ projectId, query: q });
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setQuery("");
    setSearchResults(null);
  }

  function handleSaved() {
    startTransition(() => router.refresh());
  }

  // ── Empty state (no memory at all) ────────────────────────────────────────
  if (items.length === 0 && !dialogOpen) {
    return (
      <>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 px-6 py-16 text-center">
          <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/30" />
          <h3 className="text-base font-semibold text-foreground">
            {isEs ? "Construye la memoria de este proyecto" : "Start building this project's memory"}
          </h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {isEs
              ? "Añade emails, notas de reuniones, decisiones, riesgos y comunicaciones importantes. La IA los clasificará y los hará buscables."
              : "Add emails, meeting notes, decisions, risks, and important communication. AI will classify them and make them searchable."}
          </p>
          <button onClick={() => setDialogOpen(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
            <Plus className="h-4 w-4" />{isEs ? "Añadir primer recuerdo" : "Add first memory item"}
          </button>
        </div>
        {dialogOpen && (
          <AddMemoryDialog locale={locale} projectId={projectId} onClose={() => setDialogOpen(false)} onSaved={handleSaved} />
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{items.length}</strong> {isEs ? "recuerdos" : "memory items"}
            {lastUpdate && <> · {isEs ? "última actualización" : "last update"} {fmt(lastUpdate, locale)}</>}
          </p>
        </div>
        <button onClick={() => { setEditing(null); setDialogOpen(true); }}
          className="inline-flex items-center gap-2 self-start rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
          <Plus className="h-4 w-4" />{isEs ? "Añadir recuerdo" : "Add memory item"}
        </button>
      </div>

      {/* Search + filter toggle */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <form onSubmit={runSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={isEs ? "Buscar: \"¿qué se decidió sobre el cronograma?\"" : "Search: \"what was decided about the timeline?\""}
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-20 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
          {query && (
            <button type="button" onClick={clearSearch} className="absolute right-12 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
          <button type="submit" disabled={searching}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (isEs ? "Buscar" : "Search")}
          </button>
        </form>
        <button onClick={() => setShowFilters((s) => !s)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${hasActiveFilters ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-border text-muted-foreground hover:text-foreground"}`}>
          <Filter className="h-4 w-4" />{isEs ? "Filtros" : "Filters"}
          {hasActiveFilters && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-brand-500" />}
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-4">
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
            <option value="">{isEs ? "Todos los tipos" : "All source types"}</option>
            {SOURCE_TYPES.map((st) => <option key={st} value={st}>{isEs ? SOURCE_META[st].es : SOURCE_META[st].en}</option>)}
          </select>
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value as keyof MemoryClassification | "")} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
            <option value="">{isEs ? "Toda clasificación" : "All classifications"}</option>
            {CLASSIFICATION_FILTERS.map((c) => <option key={String(c.key)} value={String(c.key)}>{isEs ? c.es : c.en}</option>)}
          </select>
          <select value={importanceFilter} onChange={(e) => setImportanceFilter(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
            <option value="">{isEs ? "Toda importancia" : "All importance"}</option>
            <option value="low">{isEs ? "Baja" : "Low"}</option>
            <option value="medium">{isEs ? "Media" : "Medium"}</option>
            <option value="high">{isEs ? "Alta" : "High"}</option>
            <option value="critical">{isEs ? "Crítica" : "Critical"}</option>
          </select>
          <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs" disabled={allTags.length === 0}>
            <option value="">{isEs ? "Todas las etiquetas" : "All tags"}</option>
            {allTags.map((t) => <option key={t} value={t}>#{t}</option>)}
          </select>
          {hasActiveFilters && (
            <button onClick={() => { setSourceFilter(""); setClassFilter(""); setImportanceFilter(""); setTagFilter(""); }}
              className="text-left text-xs font-medium text-brand-600 hover:underline sm:col-span-4">
              {isEs ? "Limpiar filtros" : "Clear filters"}
            </button>
          )}
        </div>
      )}

      {/* ── Search results ──────────────────────────────────────────────────── */}
      {searchResults !== null ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {searchResults.length} {isEs ? "resultados para" : "results for"} “{query}”
            </p>
            <button onClick={clearSearch} className="text-xs font-medium text-brand-600 hover:underline">{isEs ? "Volver a la cronología" : "Back to timeline"}</button>
          </div>
          {searchResults.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              {isEs ? "Sin resultados. Prueba otra pregunta." : "No results. Try a different question."}
            </div>
          ) : (
            <div className="space-y-1.5">
              {searchResults.map((r) => (
                <button key={r.id} onClick={() => setSelectedId(r.id)} className="group flex w-full items-start gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-brand-300 hover:bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {r.sourceType && <SourceTypeBadge type={r.sourceType as never} isEs={isEs} />}
                      <p className="truncate text-sm font-medium text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400">{r.title}</p>
                    </div>
                    {r.snippet && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.snippet}</p>}
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      {r.matchType === "semantic" && r.similarity != null && (
                        <span className="rounded bg-brand-50 px-1.5 py-0.5 font-medium text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
                          {Math.round(r.similarity * 100)}% {isEs ? "relevancia" : "match"}
                        </span>
                      )}
                      {r.occurredAt && <span>{fmt(r.occurredAt, locale)}</span>}
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── Timeline list ─────────────────────────────────────────────────── */
        <div className="space-y-1.5">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              {isEs ? "Ningún recuerdo coincide con los filtros." : "No memory items match the filters."}
            </div>
          ) : (
            filtered.map((item) => (
              <button key={item.id} onClick={() => setSelectedId(item.id)}
                className="group flex w-full items-start gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-brand-300 hover:bg-muted/30">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SourceTypeBadge type={item.sourceType} isEs={isEs} />
                    <ImportanceDot level={item.importanceLevel} isEs={isEs} />
                    <PipelineBadge aiStatus={item.aiStatus} indexStatus={item.indexStatus} isEs={isEs} />
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400">{item.title}</p>
                  {item.summary && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.summary}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <ClassificationBadges classification={item.aiClassification} isEs={isEs} max={4} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {item.authorName && <span>{item.authorName}</span>}
                    {(item.occurredAt ?? item.createdAt) && <span>· {fmt(item.occurredAt ?? item.createdAt, locale)}</span>}
                    {item.links.length > 0 && <span>· {item.links.length} {isEs ? "vínculos" : "links"}</span>}
                    {item.tags.slice(0, 3).map((t) => <span key={t} className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">#{t}</span>)}
                  </div>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))
          )}
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <MemoryDetailPanel
          locale={locale} projectId={projectId} item={selected} entities={entities}
          onClose={() => setSelectedId(null)}
          onEdit={() => { setEditing(selected); setSelectedId(null); setDialogOpen(true); }}
        />
      )}

      {/* Add / edit dialog */}
      {dialogOpen && (
        <AddMemoryDialog locale={locale} projectId={projectId} item={editing}
          onClose={() => { setDialogOpen(false); setEditing(null); }}
          onSaved={handleSaved} />
      )}
    </div>
  );
}
