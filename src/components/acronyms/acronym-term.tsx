"use client";

// ============================================================================
// <AcronymTerm /> — the annotated acronym (CAP-050)
// ============================================================================
// Every use declares its own `code`. There is deliberately NO global scanner
// that walks the DOM replacing capitalised runs: such a regex cannot tell "AC"
// (Actual Cost) from "AC" in a project name, would annotate user-generated
// content, and would turn a page of a PMO dashboard into a field of dotted
// underlines. Explicit beats clever here — an unannotated acronym is a small
// gap; a wrongly annotated one is misinformation.
//
// Interaction, in full:
//   • Desktop pointer  — hover shows the brief tooltip; click opens the panel.
//   • Keyboard         — Tab focuses (it is a real <button>), focus shows the
//                        tooltip, Enter/Space opens the panel. Escape closes.
//   • Touch            — hover does not exist, so the FIRST tap shows the brief
//                        popover with an explicit "full definition" action, and
//                        that action opens the panel. Nothing is reachable by
//                        hover alone.
//
// The trigger is a <button> rather than an <abbr> with a title. A native title
// tooltip is invisible to touch, unstyleable, and slow to appear; and `abbr`
// alone is not focusable, so keyboard users would never reach the definition.
// ============================================================================

import { useCallback, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AcronymContext } from "@/lib/acronyms/contracts";
import { buildTooltipModel } from "@/lib/acronyms/presentation";
import { AcronymPanel } from "./acronym-panel";

export interface AcronymTermProps {
  /** Explicit, always. Never inferred from the rendered text. */
  code: string;
  /**
   * Text to display. Defaults to the code — pass this when the label differs
   * from the code, e.g. showing "Estimate at Completion" annotated as EAC.
   */
  children?: React.ReactNode;
  /** Live values for this term, when the caller has them. */
  context?: AcronymContext | null;
  /** Optional inline value rendered after the term, already formatted. */
  value?: string | null;
  className?: string;
}

export function AcronymTerm({ code, children, context, value, className }: AcronymTermProps) {
  const locale = useLocale();
  const t = useTranslations("acronyms");
  const tooltipId = useId();

  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  // Distinguishes a touch tap (which must show the popover, not open the panel)
  // from a mouse click (which opens the panel directly). Set by the pointer
  // event and read by the click handler that fires immediately after.
  const lastPointerWasTouch = useRef(false);

  const model = buildTooltipModel(code, locale);

  const openPanel = useCallback(() => {
    setTooltipOpen(false);
    setPanelOpen(true);
  }, []);

  // An unknown code renders as plain text with no affordance. The dashboard
  // must not break because the corpus has a gap, and a control that opens an
  // empty panel would be worse than no control.
  if (!model) {
    return (
      <span className={className}>
        {children ?? code}
        {value ? <span className="ml-1 tabular-nums">{value}</span> : null}
      </span>
    );
  }

  return (
    <>
      <span className="relative inline-flex items-baseline">
        <button
          type="button"
          // `aria-describedby` only while the tooltip exists, so a screen
          // reader is not pointed at a node that is not in the tree.
          aria-describedby={tooltipOpen ? tooltipId : undefined}
          aria-haspopup="dialog"
          aria-expanded={panelOpen}
          onMouseEnter={() => setTooltipOpen(true)}
          onMouseLeave={() => setTooltipOpen(false)}
          onFocus={() => setTooltipOpen(true)}
          onBlur={() => setTooltipOpen(false)}
          onPointerDown={(event) => {
            lastPointerWasTouch.current = event.pointerType === "touch";
          }}
          onClick={() => {
            // Touch: first tap reveals the brief popover and stops there. The
            // user then chooses the explicit action to go deeper.
            if (lastPointerWasTouch.current) {
              setTooltipOpen((open) => !open);
              return;
            }
            openPanel();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openPanel();
            } else if (event.key === "Escape" && tooltipOpen) {
              setTooltipOpen(false);
            }
          }}
          // Dotted underline + help cursor: the long-standing convention for
          // "there is a definition here", and quiet enough to survive a table
          // with a dozen of them. min-h keeps the touch target usable without
          // changing the line box of the surrounding text.
          className={`inline-flex min-h-[24px] items-baseline gap-1 rounded-sm border-b border-dotted border-slate-400 bg-transparent p-0 text-inherit underline-offset-2 [cursor:help] hover:border-slate-700 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${className ?? ""}`}
        >
          {children ?? code}
          {value ? <span className="tabular-nums">{value}</span> : null}
        </button>

        {tooltipOpen ? (
          <span
            id={tooltipId}
            role="tooltip"
            // Non-interactive by design: everything in it is also in the panel,
            // so there is nothing here a keyboard user could fail to reach.
            className="absolute bottom-full left-0 z-40 mb-1.5 w-64 rounded-lg border border-slate-200 bg-white p-2.5 text-left shadow-lg motion-safe:animate-in motion-safe:fade-in-0 motion-reduce:animate-none"
          >
            <span className="block text-[11px] font-extrabold text-slate-900">{model.code}</span>
            <span className="mt-0.5 block text-[11px] font-semibold text-slate-600">
              {model.fullName}
            </span>
            <span className="mt-1 block text-[11px] leading-snug text-slate-600">
              {model.shortDefinition}
            </span>
            {model.unitKey ? (
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {t(model.unitKey)}
              </span>
            ) : null}
            <span className="mt-1.5 block border-t border-slate-100 pt-1.5 text-[10px] font-semibold text-blue-700">
              {t("clickForFullDefinition")}
            </span>
            {/* Touch has no hover, so the deep link must be a real control. */}
            <button
              type="button"
              onClick={openPanel}
              className="mt-1 inline-flex min-h-[32px] items-center rounded-md bg-blue-50 px-2 text-[11px] font-bold text-blue-700 hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 sm:hidden"
            >
              {t("viewFullDefinition")}
            </button>
          </span>
        ) : null}
      </span>

      {panelOpen ? (
        <AcronymPanel
          code={code}
          context={context}
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
        />
      ) : null}
    </>
  );
}
