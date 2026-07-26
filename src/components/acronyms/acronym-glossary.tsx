"use client";

// ============================================================================
// <AcronymGlossary /> — the reference you can open without a simulation
// ============================================================================
// `<AcronymTerm>` answers "what does this word on screen mean?". It cannot
// answer "where are the acronyms and what do they mean?", because reaching one
// required already having the right number in front of you. This is that second
// answer: every term in the corpus, searchable, one click from its full panel.
//
// Search runs over code AND name AND definition, because the user who needs a
// glossary usually knows the concept and not the abbreviation — that is the
// whole reason they opened it.
// ============================================================================

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { ModalDialog } from "@/components/pmo-simulation/modal-dialog";
import { categoryLabelKey, groupAcronymsByCategory, searchAcronyms } from "@/lib/acronyms/browse";
import { localize } from "@/lib/acronyms/registry";
import { AcronymPanel } from "./acronym-panel";

export function AcronymGlossary({ open, onClose }: { open: boolean; onClose: () => void }) {
  const locale = useLocale();
  const t = useTranslations("acronyms");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const groups = useMemo(
    () => groupAcronymsByCategory(searchAcronyms(query, locale)),
    [query, locale],
  );
  const total = useMemo(() => groups.reduce((sum, [, list]) => sum + list.length, 0), [groups]);

  return (
    <>
      <ModalDialog
        open={open}
        onClose={onClose}
        title={t("glossaryTitle")}
        description={t("glossarySubtitle", { count: total })}
        closeLabel={t("close")}
        widthClassName="max-w-3xl"
      >
        <div className="flex flex-col gap-3">
          <label className="relative block">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("glossarySearchPlaceholder")}
              aria-label={t("glossarySearchPlaceholder")}
              className="w-full rounded-md border border-slate-200 py-2 pl-8 pr-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
            />
          </label>

          {groups.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
              {t("glossaryNoResults")}
            </p>
          ) : (
            groups.map(([category, entries]) => (
              <section key={category}>
                <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                  {t(categoryLabelKey(category))}
                </h3>
                <ul className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                  {entries.map((entry) => (
                    <li key={entry.code}>
                      <button
                        type="button"
                        onClick={() => setSelected(entry.code)}
                        className="w-full rounded-lg border border-slate-200 bg-white p-2 text-left hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
                      >
                        <span className="block text-xs font-extrabold text-slate-900">
                          {entry.code}
                        </span>
                        <span className="block text-[11px] font-semibold text-slate-600">
                          {localize(entry.fullName, locale)}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                          {localize(entry.shortDefinition, locale)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </ModalDialog>

      {/* The same panel the inline term opens — one definition, one renderer.
          No scenario context here: the reference is read outside any result. */}
      {selected ? (
        <AcronymPanel
          code={selected}
          open={selected != null}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}
