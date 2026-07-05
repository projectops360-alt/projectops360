"use client";

// Side panel for the GitHub Living Graph: shows either the PRs merged on a given
// day, or the full filterable list of inactive branches. Opened from the spine
// merge badges / the "N inactive branches" chip. Read-only.

import { useState } from "react";
import { X, GitMerge, GitBranch, Search } from "lucide-react";
import type { DailyMerge, InactiveBranch, BranchType } from "@/lib/github-intelligence/types";

const TYPE_DOT: Record<BranchType, string> = {
  main: "bg-muted-foreground", feature: "bg-brand-500", hotfix: "bg-orange-500", release: "bg-purple-500", other: "bg-sky-500",
};

export type PanelState =
  | { kind: "merges"; day: DailyMerge }
  | { kind: "inactive"; branches: InactiveBranch[] }
  | null;

export function BranchPanel({ panel, onClose, isEs }: { panel: PanelState; onClose: () => void; isEs: boolean }) {
  const [q, setQ] = useState("");
  if (!panel) return null;

  const title =
    panel.kind === "merges"
      ? isEs
        ? `Merges del ${fmtDay(panel.day.start)} (${panel.day.count})`
        : `Merges on ${fmtDay(panel.day.start)} (${panel.day.count})`
      : isEs
        ? `Ramas inactivas (${panel.branches.length})`
        : `Inactive branches (${panel.branches.length})`;

  const ql = q.trim().toLowerCase();

  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-80 max-w-[85%] flex-col rounded-r-2xl border-l border-border bg-card shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          {panel.kind === "merges" ? <GitMerge className="h-4 w-4 text-muted-foreground" /> : <GitBranch className="h-4 w-4 text-muted-foreground" />}
          {title}
        </h3>
        <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={isEs ? "filtrar…" : "filter…"}
            className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <ul className="flex-1 overflow-y-auto p-2 text-sm">
        {panel.kind === "merges"
          ? panel.day.prs
              .filter((p) => !ql || `#${p.number} ${p.title} ${p.branch}`.toLowerCase().includes(ql))
              .map((p) => (
                <li key={p.number} className="rounded-lg px-2 py-1.5 hover:bg-muted/50">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <span className="text-muted-foreground">#{p.number}</span>
                    <span className="truncate">{p.title || p.branch}</span>
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{p.branch} · {fmtTime(p.mergedAt)}</p>
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
  try { return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(iso)); } catch { return iso; }
}
function fmtTime(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
