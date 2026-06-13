"use client";

import { useState, useCallback, FormEvent } from "react";
import { localizedHref } from "@/i18n/href";
import Link from "next/link";
import {
  Search,
  MessageSquare,
  CalendarDays,
  Scale,
  FileText,
  ListTodo,
  ArrowLeft,
  Loader2,
  Sparkles,
} from "lucide-react";
import { searchProjectAction } from "./search-action";
import type {
  SearchResult,
  SearchEntityType,
  SearchTranslations,
} from "./search-action";

// ── Types ───────────────────────────────────────────────────────────────────────

export interface SearchPageTranslations {
  title: string;
  placeholder: string;
  button: string;
  noResults: string;
  noResultsDescription: string;
  typeToSearch: string;
  resultCount: string;
  viewDetail: string;
  filters: {
    all: string;
    communication: string;
    meeting: string;
    decision: string;
    document: string;
    task: string;
  };
  semanticMatch: string;
  entityLabels: SearchTranslations;
}

interface SearchClientProps {
  projectId: string;
  locale: string;
  projectTitle: string;
  backLabel: string;
  translations: SearchPageTranslations;
}

// ── Entity type config ──────────────────────────────────────────────────────────

const ENTITY_CONFIG: Record<
  SearchEntityType,
  { icon: typeof MessageSquare; color: string }
> = {
  communication: {
    icon: MessageSquare,
    color:
      "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800",
  },
  meeting: {
    icon: CalendarDays,
    color:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
  },
  decision: {
    icon: Scale,
    color:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
  },
  document: {
    icon: FileText,
    color:
      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800",
  },
  task: {
    icon: ListTodo,
    color:
      "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800",
  },
};

type FilterValue = SearchEntityType | "all";
const FILTER_OPTIONS: FilterValue[] = [
  "all",
  "communication",
  "meeting",
  "decision",
  "document",
  "task",
];

// ── Highlight keyword in snippet ─────────────────────────────────────────────────

function HighlightedSnippet({
  snippet,
  keyword,
}: {
  snippet: string;
  keyword: string;
}) {
  if (!keyword) return <>{snippet}</>;
  const idx = snippet.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return <>{snippet}</>;

  const before = snippet.slice(0, idx);
  const match = snippet.slice(idx, idx + keyword.length);
  const after = snippet.slice(idx + keyword.length);

  return (
    <>
      {before}
      <mark className="bg-yellow-200 text-yellow-900 dark:bg-yellow-800 dark:text-yellow-100 rounded-sm px-0.5">
        {match}
      </mark>
      {after}
    </>
  );
}

// ── Component ───────────────────────────────────────────────────────────────────

export function SearchClient({
  projectId,
  locale,
  projectTitle,
  backLabel,
  translations: t,
}: SearchClientProps) {
  const [keyword, setKeyword] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterValue>("all");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchedKeyword, setSearchedKeyword] = useState("");

  const handleSearch = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmed = keyword.trim();
      if (!trimmed) return;

      setIsSearching(true);
      setResults(null);
      setSearchedKeyword(trimmed);

      const typeFilter: SearchEntityType | undefined =
        activeFilter === "all" ? undefined : activeFilter;

      const res = await searchProjectAction({
        projectId,
        locale,
        keyword: trimmed,
        typeFilter,
      });

      setIsSearching(false);
      setResults(res);
    },
    [keyword, activeFilter, projectId, locale],
  );

  // Re-run search when filter changes (if we have a keyword)
  const handleFilterChange = useCallback(
    async (filter: FilterValue) => {
      setActiveFilter(filter);
      if (!searchedKeyword) return;

      setIsSearching(true);
      setResults(null);

      const typeFilter: SearchEntityType | undefined =
        filter === "all" ? undefined : filter;

      const res = await searchProjectAction({
        projectId,
        locale,
        keyword: searchedKeyword,
        typeFilter,
      });

      setIsSearching(false);
      setResults(res);
    },
    [searchedKeyword, projectId, locale],
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href={localizedHref(locale, `/projects/${projectId}`)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {projectTitle} — {backLabel}
      </Link>

      <h1 className="text-2xl font-bold text-foreground">{t.title}</h1>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t.placeholder}
            className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <button
          type="submit"
          disabled={isSearching || !keyword.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {isSearching ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              {t.button}
            </>
          )}
        </button>
      </form>

      {/* Type filters */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((filter) => {
          const isActive = activeFilter === filter;
          const label =
            filter === "all"
              ? t.filters.all
              : t.entityLabels[filter as SearchEntityType];
          return (
            <button
              key={filter}
              type="button"
              onClick={() => handleFilterChange(filter)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300"
                  : "border-border bg-card text-muted-foreground hover:border-brand-500/40 hover:text-foreground"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Initial state */}
      {results === null && !isSearching && (
        <div className="py-12 text-center">
          <Search className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-sm text-muted-foreground">{t.typeToSearch}</p>
        </div>
      )}

      {/* Loading */}
      {isSearching && (
        <div className="flex items-center justify-center gap-2 py-12">
          <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
          <p className="text-sm text-muted-foreground">…</p>
        </div>
      )}

      {/* Results */}
      {results !== null && !isSearching && (
        <>
          {results.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t.resultCount.replace("[count]", String(results.length))}
            </p>
          )}

          {results.length === 0 && (
            <div className="py-12 text-center">
              <Search className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-sm font-medium text-foreground">
                {t.noResults}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.noResultsDescription}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {results.map((result) => {
              const config = ENTITY_CONFIG[result.type];
              const Icon = config.icon;
              const typeLabel = t.entityLabels[result.type];
              const dateStr = result.date
                ? new Date(result.date).toLocaleDateString(locale, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : null;

              return (
                <Link
                  key={`${result.type}-${result.id}`}
                  href={result.href}
                  className="group block rounded-xl border border-border bg-card p-4 transition-all hover:border-brand-500/40 hover:shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    {/* Type icon */}
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${config.color}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Title row */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${config.color}`}
                        >
                          {typeLabel}
                        </span>
                        {result.matchType === "semantic" && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300">
                            <Sparkles className="h-3 w-3" />
                            {t.semanticMatch}
                          </span>
                        )}
                        {dateStr && (
                          <span className="text-[10px] text-muted-foreground">
                            {dateStr}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="mt-1 text-sm font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400 truncate">
                        {result.title}
                      </h3>

                      {/* Snippet */}
                      {result.snippet && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          <HighlightedSnippet
                            snippet={result.snippet}
                            keyword={searchedKeyword}
                          />
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}