# CAP-050 — Acronym Intelligence

**Status:** In production (2026-07-26, PR #213, `a4a9173`)
**Corpus:** 49 terms, 7 categories, `src/lib/acronyms/registry.ts` (`ACRONYM_REGISTRY_VERSION`)
**Surfaces:** simulation results table · toolbar glossary (`/[locale]/(app)/pmo-living-graph`)

A single, versioned source of truth for the acronyms and metric definitions the
PMO surfaces use. Three levels of depth, one registry, no per-component
definitions.

---

## 1. The problem it actually solves

The reported defect was **not** "EAC is undefined". It was *"I can't find the
acronyms anywhere, and I don't know what they mean."*

That distinction drove the design. An annotated term inside a results table only
ever reaches a user who **already has the right number on screen** — which
required building a scenario, running it, and hovering the correct cell. The
corpus existed and was unreachable.

So the capability has two entry points, and the second is the one that answers
the original question:

| Entry point | Reaches |
|---|---|
| `<AcronymTerm>` inline | Someone looking at a specific number |
| **Toolbar glossary** | Anyone, at any time, with no data and nothing selected |

---

## 2. Three levels

1. **Visible acronym** — dotted underline, `[cursor:help]`. Quiet enough to
   survive a table with a dozen of them.
2. **Hover / focus tooltip** — code, full name, short definition, unit.
3. **Full panel** — formula, variables, interpretation, **caveats**, worked
   example, source, related terms, and "Ask Isabella".

Ordering in the panel is deliberate: definition → formula → interpretation →
**caveats** → example → source. The caveats are what prevent the misreading
("SV is money, not days"), so they are not filed at the bottom as a footnote
where a reader who got their answer in the first paragraph will never scroll.

---

## 3. Explicit annotation, never a DOM scanner

Every use declares its own `code`. There is deliberately **no** global scanner
walking the DOM replacing capitalised runs. Such a regex cannot tell "AC"
(Actual Cost) from "AC" in a project name, would annotate user-generated content,
and would turn a dashboard into a field of dotted underlines.

An unannotated acronym is a small gap. A wrongly annotated one is misinformation.

An unknown code renders as plain text with no affordance: the dashboard must not
break because the corpus has a gap, and a control that opens an empty panel is
worse than no control.

---

## 4. Accessibility is structural, not decorative

The trigger is a `<button>`, not an `<abbr title>`. A native title tooltip is
invisible to touch, unstyleable and slow; `abbr` alone is not focusable, so
keyboard users would never reach the definition.

| Input | Behaviour |
|---|---|
| Pointer | Hover → tooltip; click → panel |
| Keyboard | Tab focuses, focus shows the tooltip, Enter/Space opens the panel, Escape closes |
| Touch | **First tap** shows the tooltip with an explicit "full definition" action |

Nothing is reachable by hover alone.

---

## 5. Relationship to `src/lib/i18n/glossary.ts`

They are **not** the same thing and were deliberately not merged.

`glossary.ts` is named "glossary" but is a **language-parity linter** for UX-012:
`{en, es}` pairs asserting that "Workboard" renders as "Tablero de Trabajo". It
has no formula, unit, direction or version, and its consumer is a parity test.
Adding `EAC = AC + (BAC − EV) / CPI` to it would turn a linter into a knowledge
base.

**Known seam:** PMO, KPI, WBS, CPM and RACI now appear in both files for
different purposes. This is recorded, not resolved.

---

## 6. Scenario context

When a caller has live values, the panel adds an "In this scenario" section:
baseline, simulated, delta, provenance, engine, data coverage and the timestamp.

Raw numbers are passed, not formatted strings — the panel formats in the reader's
locale, and a `null` must survive as a `null` so it renders "Data unavailable"
rather than being parsed back out of an em dash.

`formulaId` lets the panel state **which** variant produced a number. EAC accepts
four formulas; without it the panel could only show a default and admit it did not
know, which understates what the engine plainly reported.

---

## 7. Search

The glossary searches **code, full name and short definition** — accent- and
case-insensitive. Searching the code alone would fail the user who knows the
concept but not the abbreviation, which is the more common direction of that
question and the reason someone opens a glossary at all.

An exact code match sorts first: typing "CPI" must not bury CPI under every entry
whose definition mentions it. A search with no match returns nothing rather than
falling back to the full list, which would look like the search silently failed.

---

## 8. Executable guards

| Guard | Protects |
|---|---|
| `ACRONYM-GLOSSARY-REACHABLE` | The reference opens with no data; search covers name and definition; grouping loses no entry; every category has both locales |
| `PMO-SIM-FORMULA-REPORTED` | The id contract across engine → metric → panel |

Corpus integrity (both locales present, related terms resolve, formula ids
unique) is pinned by `src/lib/acronyms/__tests__/registry.test.ts`.

---

## 9. Known gaps

- Only the simulation results table uses `<AcronymTerm>`. Metric cards and the
  node panel show the same terms as plain text.
- Component tests are logic-only: no jsdom render test for Escape or touch.
- Examples use invented round numbers by contract — never project data.
