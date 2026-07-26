"use client";

// ============================================================================
// PMO Intelligence Center — critical path drawer (CAP-048 Phase 2, M5)
// ============================================================================
// The bottom drawer: "critical path and selected process".
//
// The path itself comes from `getCommandCenterSummary().criticalPath`, which is
// the existing CPM monitor. CAP-048 §6 is unambiguous — "never write a second
// CPM" — so this component receives steps and renders them. It does not order
// them, score them, or decide what is critical.
//
// What it DOES do is be contextual: with a project or task selected it shows
// that selection's steps, and clicking a step selects and centres the node. A
// drawer that always shows the same eight rows regardless of what the user is
// looking at is a static list wearing a drawer's clothes.
//
// A step that could not be matched to a graph node stays in the list, rendered
// unclickable. Dropping it would silently shorten the critical path.
// ============================================================================

import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, Route } from "lucide-react";
import type { CriticalPathStep } from "@/lib/pmo-intelligence/dashboard-model";

export interface PmoCriticalPathDrawerProps {
  steps: readonly CriticalPathStep[];
  /** True when the list has been narrowed by the current selection. */
  contextual: boolean;
  /** Label describing what the drawer is currently scoped to. */
  contextLabel: string | null;
  open: boolean;
  onToggle: () => void;
  selectedNodeIds: readonly string[];
  onSelectStep: (nodeId: string) => void;
}

const RISK_CLASS: Record<CriticalPathStep["risk"], string> = {
  red: "bg-rose-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
};

export function PmoCriticalPathDrawer({
  steps,
  contextual,
  contextLabel,
  open,
  onToggle,
  selectedNodeIds,
  onSelectStep,
}: PmoCriticalPathDrawerProps) {
  const t = useTranslations("pmoIntelligence");
  const selected = new Set(selectedNodeIds);

  return (
    <section className="border-t border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-1.5 text-left hover:bg-slate-50"
      >
        <Route className="h-3.5 w-3.5 text-slate-400" aria-hidden />
        <span className="text-xs font-extrabold uppercase tracking-wide text-slate-600">
          {t("criticalPathTitle")}
        </span>
        <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600">
          {steps.length}
        </span>
        {/* Whether the drawer is showing the whole path or a slice of it is
            never left implicit — the same list means different things. */}
        <span className="truncate text-[10px] font-semibold text-slate-500">
          {contextual && contextLabel
            ? t("criticalPathContextual", { context: contextLabel })
            : t("criticalPathWhole")}
        </span>
        <span className="ml-auto text-slate-400">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </span>
      </button>

      {open ? (
        steps.length === 0 ? (
          <p className="px-4 pb-2 text-xs text-slate-500">{t("criticalPathEmpty")}</p>
        ) : (
          <ol className="flex max-h-40 gap-2 overflow-x-auto px-4 pb-2">
            {steps.map((step) => {
              const clickable = step.nodeId != null;
              const isSelected = step.nodeId != null && selected.has(step.nodeId);
              const body = (
                <>
                  <span className="flex items-center gap-1">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${RISK_CLASS[step.risk]}`}
                      aria-hidden
                    />
                    <span className="text-[10px] font-bold text-slate-400">#{step.order}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] font-bold text-slate-900">
                    {step.task}
                  </span>
                  <span className="block truncate text-[10px] text-slate-500">{step.project}</span>
                  <span className="block text-[10px] font-semibold text-slate-600">
                    {step.status}
                    {step.float != null ? ` · ${t("criticalPathFloat", { days: step.float })}` : ""}
                  </span>
                  {step.blocker ? (
                    <span className="mt-0.5 block truncate text-[10px] text-rose-700">
                      {step.blocker}
                    </span>
                  ) : null}
                </>
              );

              return (
                <li key={`${step.order}-${step.task}`} className="w-44 shrink-0">
                  {clickable ? (
                    <button
                      type="button"
                      onClick={() => onSelectStep(step.nodeId as string)}
                      aria-pressed={isSelected}
                      className={`h-full w-full rounded-md border px-2 py-1.5 text-left transition-colors ${
                        isSelected
                          ? "border-emerald-400 bg-emerald-50"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {body}
                    </button>
                  ) : (
                    // Present but not clickable, with the reason stated. The
                    // step is real; only its link to the canvas is missing.
                    <div
                      title={t("criticalPathNoNode")}
                      className="h-full w-full rounded-md border border-dashed border-slate-200 bg-slate-50 px-2 py-1.5"
                    >
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )
      ) : null}
    </section>
  );
}
