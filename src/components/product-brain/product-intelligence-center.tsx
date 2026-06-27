"use client";

// ============================================================================
// ProjectOps360° — Product Intelligence Center (client shell)
// ============================================================================
// Internal documentation experience over the Product Intelligence™ corpus.
// Left: searchable navigation tree (grouped by section). Main: rendered
// markdown. Internal doc links navigate inside the Center. All content was
// gated server-side (owner/admin only) before reaching this component.
// ============================================================================

import { useCallback, useMemo, useState } from "react";
import {
  Brain,
  Search,
  ExternalLink,
  FileText,
  ShieldAlert,
  Lock,
  ChevronRight,
} from "lucide-react";
import type { Locale } from "@/types/database";
import type { ProductBrainDoc } from "@/lib/product-brain/loader";
import { MarkdownViewer } from "./markdown-viewer";

interface Props {
  locale: Locale;
  docs: ProductBrainDoc[];
  initialId: string | null;
  isAdmin: boolean;
}

export function ProductIntelligenceCenter({ locale, docs, initialId, isAdmin }: Props) {
  const es = locale === "es";
  const [activeId, setActiveId] = useState<string | null>(initialId);
  const [query, setQuery] = useState("");

  const byId = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs]);
  const activeDoc = activeId ? byId.get(activeId) ?? null : null;

  const navigate = useCallback((id: string) => {
    setActiveId(id);
    setQuery("");
    if (typeof window !== "undefined") {
      const url = `${window.location.pathname}?doc=${encodeURIComponent(id)}`;
      window.history.replaceState(null, "", url);
      // Scroll the reading pane back to top on navigation.
      document.getElementById("pi-main")?.scrollTo({ top: 0 });
    }
  }, []);

  // Grouped navigation (docs already arrive sorted by section then order).
  const groups = useMemo(() => {
    const map = new Map<string, ProductBrainDoc[]>();
    for (const d of docs) {
      const list = map.get(d.section) ?? [];
      list.push(d);
      map.set(d.section, list);
    }
    return [...map.entries()];
  }, [docs]);

  // Client-side search over title, id/path and content.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return docs
      .map((d) => {
        const hay = `${d.title}\n${d.id}\n${d.content}`.toLowerCase();
        const idx = hay.indexOf(q);
        if (idx === -1) return null;
        const titleHit = `${d.title} ${d.id}`.toLowerCase().includes(q);
        return { doc: d, titleHit };
      })
      .filter((x): x is { doc: ProductBrainDoc; titleHit: boolean } => x !== null)
      .sort((a, b) => Number(b.titleHit) - Number(a.titleHit))
      .slice(0, 40);
  }, [query, docs]);

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      {/* ── Top bar ── */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Brain className="h-6 w-6 text-brand-500" />
            Product Intelligence Center
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <Lock className="h-3 w-3" /> {es ? "Interno" : "Internal"}
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {es
              ? "El cerebro de producto interno de ProjectOps360°."
              : "The internal product brain of ProjectOps360°."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
            Product Intelligence™ v0.1
          </span>
          {isAdmin && activeDoc && (
            <a
              href={activeDoc.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <ExternalLink className="h-4 w-4" /> {es ? "Abrir en GitHub" : "Open in GitHub"}
            </a>
          )}
        </div>
      </div>

      {/* ── Body: nav + reader ── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 pt-4 lg:grid-cols-[280px_1fr]">
        {/* Left: search + navigation */}
        <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={es ? "Buscar en Product Intelligence…" : "Search Product Intelligence…"}
                className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                aria-label={es ? "Buscar documentos" : "Search documents"}
              />
            </div>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto p-2">
            {results ? (
              <SearchResults
                results={results}
                activeId={activeId}
                onNavigate={navigate}
                emptyLabel={es ? "Sin resultados." : "No results."}
                countLabel={
                  es
                    ? `${results.length} resultado(s)`
                    : `${results.length} result(s)`
                }
              />
            ) : (
              groups.map(([section, items]) => (
                <div key={section} className="mb-3">
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {section}
                  </p>
                  <ul className="space-y-0.5">
                    {items.map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => navigate(d.id)}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                            d.id === activeId
                              ? "bg-brand-100 font-medium text-brand-800 dark:bg-brand-900/40 dark:text-brand-200"
                              : "text-foreground/80 hover:bg-muted"
                          }`}
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{d.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </nav>
        </aside>

        {/* Main: reader */}
        <main
          id="pi-main"
          className="min-h-0 overflow-y-auto rounded-xl border border-border bg-card px-5 py-4 sm:px-8 sm:py-6"
        >
          {docs.length === 0 ? (
            <EmptyState
              icon={<ShieldAlert className="h-10 w-10 text-muted-foreground" />}
              title={es ? "No hay documentos" : "No documents found"}
              body={
                es
                  ? "No se encontró documentación de Product Intelligence en este despliegue."
                  : "No Product Intelligence documentation was found in this deployment."
              }
            />
          ) : !activeDoc ? (
            <EmptyState
              icon={<FileText className="h-10 w-10 text-muted-foreground" />}
              title={es ? "Documento no encontrado" : "Document not found"}
              body={
                es
                  ? "El documento solicitado no existe. Elige uno del panel izquierdo."
                  : "The requested document does not exist. Pick one from the left panel."
              }
            />
          ) : (
            <article>
              <div className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Product Intelligence</span>
                <ChevronRight className="h-3 w-3" />
                <span className="font-mono">{activeDoc.relPath}</span>
              </div>
              <MarkdownViewer
                content={activeDoc.content}
                currentId={activeDoc.id}
                onNavigate={navigate}
              />
            </article>
          )}
        </main>
      </div>
    </div>
  );
}

function SearchResults({
  results,
  activeId,
  onNavigate,
  emptyLabel,
  countLabel,
}: {
  results: { doc: ProductBrainDoc; titleHit: boolean }[];
  activeId: string | null;
  onNavigate: (id: string) => void;
  emptyLabel: string;
  countLabel: string;
}) {
  if (results.length === 0) {
    return <p className="px-2 py-3 text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div>
      <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {countLabel}
      </p>
      <ul className="space-y-0.5">
        {results.map(({ doc }) => (
          <li key={doc.id}>
            <button
              type="button"
              onClick={() => onNavigate(doc.id)}
              className={`flex w-full flex-col rounded-md px-2 py-1.5 text-left transition-colors ${
                doc.id === activeId ? "bg-brand-100 dark:bg-brand-900/40" : "hover:bg-muted"
              }`}
            >
              <span className="truncate text-sm font-medium text-foreground">{doc.title}</span>
              <span className="truncate font-mono text-[11px] text-muted-foreground">{doc.relPath}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center py-20 text-center">
      {icon}
      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
