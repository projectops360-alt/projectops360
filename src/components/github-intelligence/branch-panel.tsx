"use client";

// Side panel for the GitHub Living Graph. Two modes:
//  • "day"      — everything that happened on a clicked day, filterable by type
//                 (Feature/Fix/Release/Other) and status (Merged/Open), each row
//                 showing the branch, PR # and its commit count.
//  • "inactive" — the full searchable list of anchorless branches.
// Read-only.

import { useMemo, useState } from "react";
import { X, GitMerge, GitBranch, Search } from "lucide-react";
import type { InactiveBranch, BranchType } from "@/lib/github-intelligence/types";

const TYPE_DOT: Record<BranchType, string> = {
  main: "bg-muted-foreground", feature: "bg-brand-500", hotfix: "bg-orange-500", release: "bg-purple-500", other: "bg-sky-500",
};

export interface DayBranchItem {
  name: string;
  type: BranchType;
  status: "merged" | "open";
  commitCount: number;
  prNumber?: number;
  time: string;
}

export type PanelState =
  | { kind: "day"; dayStart: string; items: DayBranchItem[] }
  | { kind: "inactive"; branches: InactiveBranch[] }
  | null;

// Type filter chips (only the types that make sense for side branches).
const TYPE_CHIPS: Array<{ t: BranchType; en: string; es: string }> = [
  { t: "feature", en: "Feature", es: "Feature" },
  { t: "hotfix", en: "Fix", es: "Fix" },
  { t: "release", en: "Release", es: "Release" },
  { t: "other", en: "Other", es: "Otras" },
];

export function BranchPanel({ panel, onClose, isEs }: { panel: PanelState; onClose: () => void; isEs: boolean }) {
  const [q, setQ] = useState("");
  const [types, setTypes] = useState<Set<BranchType>>(() => new Set());
  const [statuses, setStatuses] = useState<Set<"merged" | "open">>(() => new Set());

  const ql = q.trim().toLowerCase();
  const toggle = <T,>(set: Set<T>, v: T, apply: (s: Set<T>) => void) => {
    const n = new Set(set); if (n.has(v)) n.delete(v); else n.add(v); apply(n);
  };

  const dayItems = useMemo(() => {
    if (panel?.kind !== "day") return [];
    return panel.items.filter((it) =>
      (types.size === 0 || types.has(it.type)) &&
      (statuses.size === 0 || statuses.has(it.status)) &&
      (!ql || `${it.name} #${it.prNumber ?? ""}`.toLowerCase().includes(ql)),
    );
  }, [panel, types, statuses, ql]);

  if (!panel) return null;

  const isDay = panel.kind === "day";
  const title = isDay
    ? (isEs ? `Día ${fmtDay(panel.dayStart)}` : `${fmtDay(panel.dayStart)}`)
    : (isEs ? `Ramas inactivas (${panel.branches.length})` : `Inactive branches (${panel.branches.length})`);
  const mergedCount = isDay ? panel.items.filter((i) => i.status === "merged").length : 0;
  const openCount = isDay ? panel.items.filter((i) => i.status === "open").length : 0;

  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-96 max-w-[92%] flex-col rounded-r-2xl border-l border-border bg-card shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            {isDay ? <GitMerge className="h-4 w-4 text-muted-foreground" /> : <GitBranch className="h-4 w-4 text-muted-foreground" />}
            {title}
          </h3>
          {isDay && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {isEs ? `${mergedCount} mergeadas · ${openCount} abiertas` : `${mergedCount} merged · ${openCount} open`}
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="close">
          <X className="h-4 w-4" />
        </button>
      </div>

      {isDay && (
        <div className="space-y-2 border-b border-border px-3 py-2.5">
          <div className="flex flex-wrap gap-1">
            {TYPE_CHIPS.map((c) => {
              const on = types.has(c.t);
              return (
                <button key={c.t} type="button" onClick={() => toggle(types, c.t, setTypes)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${on ? "border-transparent bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  <span className={`h-2 w-2 rounded-full ${TYPE_DOT[c.t]}`} />{isEs ? c.es : c.en}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1">
            {(["merged", "open"] as const).map((s) => {
              const on = statuses.has(s);
              const label = s === "merged" ? (isEs ? "Mergeadas" : "Merged") : (isEs ? "Abiertas" : "Open");
              return (
                <button key={s} type="button" onClick={() => toggle(statuses, s, setStatuses)}
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${on ? "border-transparent bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={isEs ? "filtrar…" : "filter…"}
            className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground" />
        </div>
      </div>

      <ul className="flex-1 overflow-y-auto p-2 text-sm">
        {isDay
          ? dayItems.length === 0
            ? <li className="px-2 py-6 text-center text-xs text-muted-foreground">{isEs ? "Nada con estos filtros." : "Nothing matches these filters."}</li>
            : dayItems.map((it, i) => (
                <li key={`${it.name}-${i}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TYPE_DOT[it.type]}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-foreground">{it.name}</span>
                    <span className="text-[10px] text-muted-foreground">{it.prNumber ? `#${it.prNumber} · ` : ""}{it.commitCount} commit{it.commitCount === 1 ? "" : "s"}{it.status === "open" ? (isEs ? " · abierta" : " · open") : ""}</span>
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{fmtHm(it.time)}</span>
                </li>
              ))
          : panel.branches
              .filter((b) => !ql || `${b.name} ${b.status}`.toLowerCase().includes(ql))
              .map((b) => (
                <li key={b.name} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[b.type]}`} />
                  <span className="min-w-0 flex-1 truncate text-xs text-foreground">{b.name}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {b.status === "merged" ? (isEs ? "mergeada" : "merged") : b.prNumber ? `PR #${b.prNumber}` : b.status}
                  </span>
                </li>
              ))}
      </ul>
    </div>
  );
}

function fmtDay(iso: string): string {
  try { return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(new Date(iso)); } catch { return iso; }
}
function fmtHm(iso: string): string {
  try { return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}
