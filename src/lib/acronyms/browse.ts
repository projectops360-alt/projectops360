// ============================================================================
// Acronym Intelligence — browsing the corpus (CAP-050)
// ============================================================================
// The annotated term is a good answer to "what does EAC mean?" when EAC is
// already on screen. It is no answer at all to "where are the acronyms and what
// do they mean?" — which was the original question, and which the product could
// not answer without first running a simulation and hovering the right cell.
//
// This module backs a reference the user can open at any time. Pure: search and
// grouping only, no React, so the ordering rules below are testable.
// ============================================================================

import type { AcronymCategory, AcronymEntry } from "./contracts";
import { ACRONYM_CATEGORIES } from "./contracts";
import { ACRONYM_ENTRIES, localize } from "./registry";

/** Strip accents and case so "cronograma" finds "Cronograma" and vice versa. */
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/**
 * Search the corpus.
 *
 * Matches the code, the full name and the short definition — searching the code
 * alone would fail the user who knows the concept but not the abbreviation,
 * which is the more common direction of that question.
 *
 * An exact code match sorts first. Typing "CPI" must not bury CPI under every
 * entry whose definition happens to mention it.
 */
export function searchAcronyms(
  query: string,
  locale: string,
  entries: readonly AcronymEntry[] = ACRONYM_ENTRIES,
): AcronymEntry[] {
  const needle = fold(query);
  if (!needle) return [...entries];

  const matches = entries.filter((entry) => {
    if (fold(entry.code).includes(needle)) return true;
    if (fold(localize(entry.fullName, locale)).includes(needle)) return true;
    return fold(localize(entry.shortDefinition, locale)).includes(needle);
  });

  return matches.sort((a, b) => {
    const aExact = fold(a.code) === needle ? 0 : 1;
    const bExact = fold(b.code) === needle ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    const aStarts = fold(a.code).startsWith(needle) ? 0 : 1;
    const bStarts = fold(b.code).startsWith(needle) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return a.code.localeCompare(b.code);
  });
}

/**
 * Group entries by category, in the declared category order.
 *
 * Declared order, not alphabetical: `ACRONYM_CATEGORIES` runs from the
 * financial core outward, and re-sorting it here would put "budget" before
 * "evm" for no reason a reader would recognise. Empty categories are dropped so
 * a filtered search does not render a column of headings with nothing under them.
 */
export function groupAcronymsByCategory(
  entries: readonly AcronymEntry[],
): [AcronymCategory, AcronymEntry[]][] {
  const groups = new Map<AcronymCategory, AcronymEntry[]>();
  for (const entry of entries) {
    const bucket = groups.get(entry.category);
    if (bucket) bucket.push(entry);
    else groups.set(entry.category, [entry]);
  }
  for (const bucket of groups.values()) bucket.sort((a, b) => a.code.localeCompare(b.code));

  return ACRONYM_CATEGORIES.filter((category) => groups.has(category)).map((category) => [
    category,
    groups.get(category) ?? [],
  ]);
}

/** i18n key for a category heading. Mirrors the existing `category_*` keys. */
export function categoryLabelKey(category: AcronymCategory): string {
  return `category_${category}`;
}

/** How many terms the reference holds. Shown so the corpus is not a mystery. */
export function acronymCount(): number {
  return ACRONYM_ENTRIES.length;
}
