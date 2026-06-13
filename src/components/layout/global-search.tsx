"use client";

// ============================================================================
// PMO Global Search — header search box + command palette
// ============================================================================
// Searches across all projects and company data (org-scoped). Opens on click
// or ⌘K / Ctrl-K, debounced, grouped results, keyboard + click navigation.
// ============================================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  Search, X, Loader2, FolderKanban, ListChecks, Flag, ShieldAlert, Package, HelpCircle, Users, Scale, Wallet,
} from "lucide-react";
import { globalSearchAction, type SearchResult, type SearchEntityType } from "@/app/[locale]/(app)/search-actions";

const TYPE_ICON: Record<SearchEntityType, typeof FolderKanban> = {
  project: FolderKanban, task: ListChecks, milestone: Flag, risk: ShieldAlert,
  material: Package, rfi: HelpCircle, resource: Users, decision: Scale, budget: Wallet,
};
const TYPE_LABEL: Record<SearchEntityType, { en: string; es: string }> = {
  project: { en: "Project", es: "Proyecto" }, task: { en: "Task", es: "Tarea" },
  milestone: { en: "Milestone", es: "Hito" }, risk: { en: "Risk", es: "Riesgo" },
  material: { en: "Material", es: "Material" }, rfi: { en: "RFI", es: "RFI" },
  resource: { en: "Person/Crew", es: "Persona/Cuadrilla" }, decision: { en: "Decision", es: "Decisión" },
  budget: { en: "Budget", es: "Presupuesto" },
};

export function GlobalSearch() {
  const router = useRouter();
  const locale = useLocale();
  const isEs = locale === "es";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl-K to open
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(true); }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  // Debounced search — all state updates happen inside the timer callback.
  useEffect(() => {
    const id = setTimeout(async () => {
      if (query.trim().length < 2) { setResults([]); setLoading(false); return; }
      setLoading(true);
      const res = await globalSearchAction({ query, locale });
      setResults(res.results ?? []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(id);
  }, [query, locale]);

  const go = useCallback((href: string) => { setOpen(false); setQuery(""); router.push(href); }, [router]);

  // Group results by type
  const grouped = new Map<SearchEntityType, SearchResult[]>();
  for (const r of results) { if (!grouped.has(r.type)) grouped.set(r.type, []); grouped.get(r.type)!.push(r); }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/70"
        aria-label={isEs ? "Buscar" : "Search"}
      >
        <Search className="h-4 w-4" />
        <span>{isEs ? "Buscar en todo…" : "Search everything…"}</span>
        <kbd className="ml-8 hidden rounded border border-border bg-background px-1.5 py-0.5 text-xs font-medium text-muted-foreground sm:inline">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isEs ? "Buscar proyectos, tareas, riesgos, materiales, RFIs, personas…" : "Search projects, tasks, risks, materials, RFIs, people…"}
                className="flex-1 bg-transparent py-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
              <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {query.trim().length < 2 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">{isEs ? "Escribe al menos 2 caracteres para buscar en toda la compañía." : "Type at least 2 characters to search across the company."}</p>
              ) : results.length === 0 && !loading ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">{isEs ? "Sin resultados." : "No results."}</p>
              ) : (
                [...grouped.entries()].map(([type, items]) => {
                  const Icon = TYPE_ICON[type];
                  return (
                    <div key={type} className="mb-2">
                      <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{isEs ? TYPE_LABEL[type].es : TYPE_LABEL[type].en}</p>
                      {items.map((r, i) => (
                        <button key={i} type="button" onClick={() => go(r.href)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted/60">
                          <Icon className="h-4 w-4 shrink-0 text-brand-500" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-foreground">{r.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
