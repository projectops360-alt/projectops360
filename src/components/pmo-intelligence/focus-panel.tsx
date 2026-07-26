"use client";

// ============================================================================
// PMO Intelligence Center — today's PMO focus (CAP-048 Phase 2, M5)
// ============================================================================
// Dashboard 1's focus rules, verbatim: the same items in the same order, from
// `getCommandCenterSummary`. Nothing is re-ranked here — the ordering IS the
// rule (max 3 blockers, then the conditionals), and re-sorting it would produce
// a different answer from the same data.
//
// Dashboard 1 makes each item a link. Here it also aims the canvas: selecting a
// focus item selects the nodes it names when they can be resolved, so the graph
// answers the same question the item asks. When they cannot be resolved the
// item is still selectable and still links out — a focus item without a graph
// counterpart is a real situation ("4 materials need validation" names no node),
// not a broken row.
// ============================================================================

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowUpRight, Target } from "lucide-react";
import type { PmoFocusSlice } from "@/lib/pmo-intelligence/dashboard-model";

export interface PmoFocusPanelProps {
  focus: readonly PmoFocusSlice[];
  selectedFocusId: string | null;
  /**
   * `nodeIds` is empty when the item names nothing on the canvas. The shell
   * decides what to do with that; the panel does not pretend it resolved.
   */
  onSelectFocus: (item: PmoFocusSlice) => void;
  /** Node ids each focus item resolves to, keyed by focus id. */
  resolvedNodeIds: ReadonlyMap<string, string[]>;
}

const SEVERITY_CLASS: Record<string, string> = {
  critical: "border-rose-200 bg-rose-50 text-rose-900",
  high: "border-amber-200 bg-amber-50 text-amber-900",
  review: "border-sky-200 bg-sky-50 text-sky-900",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-900",
  info: "border-slate-200 bg-slate-50 text-slate-700",
};

export function PmoFocusPanel({
  focus,
  selectedFocusId,
  onSelectFocus,
  resolvedNodeIds,
}: PmoFocusPanelProps) {
  const t = useTranslations("pmoIntelligence");

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <h2 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-500">
        <Target className="h-3.5 w-3.5 text-slate-400" aria-hidden />
        {t("focusTitle")}
      </h2>

      {focus.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">{t("focusEmpty")}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {focus.map((item) => {
            const resolved = resolvedNodeIds.get(item.id) ?? [];
            const isSelected = selectedFocusId === item.id;
            return (
              <li
                key={item.id}
                className={`rounded-md border px-2 py-1.5 ${
                  SEVERITY_CLASS[item.severity] ?? SEVERITY_CLASS.info
                } ${isSelected ? "ring-1 ring-emerald-400" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => onSelectFocus(item)}
                  aria-pressed={isSelected}
                  className="w-full text-left"
                >
                  <span className="block text-[11px] font-bold">{item.title}</span>
                  <span className="mt-0.5 block text-[10px] opacity-80">{item.explanation}</span>
                  <span className="mt-0.5 block text-[10px] font-semibold">→ {item.action}</span>
                  {/* Whether the item reaches the canvas is stated, so a click
                      that does not move the graph is understood rather than
                      read as a dead control. */}
                  <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wide opacity-60">
                    {resolved.length > 0
                      ? t("focusSelectsNodes", { count: resolved.length })
                      : t("focusNoGraphMatch")}
                  </span>
                </button>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-bold underline underline-offset-2"
                  >
                    {t("focusOpen")}
                    <ArrowUpRight className="h-2.5 w-2.5" aria-hidden />
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
