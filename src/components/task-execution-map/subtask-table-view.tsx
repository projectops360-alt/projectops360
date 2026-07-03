"use client";

// ============================================================================
// ProjectOps360° — Task Execution Map · Table/List fallback view
// ============================================================================
// The fast-editing, sortable, accessible fallback (UX requirement: the table
// remains available alongside the map). Same records, same actions.
// ============================================================================

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Flame } from "lucide-react";
import type { Subtask } from "@/lib/subtasks/types";
import { isSubtaskOverdue, effectiveSubtaskProgress } from "@/lib/subtasks/types";
import { STATUS_ICONS, STATUS_BADGE_CLASS } from "./map-nodes";

type SortKey = "title" | "status" | "progress" | "due_date" | "owner";

export interface SubtaskTableViewProps {
  subtasks: Subtask[];
  ownerNames: Record<string, string>;
  onSelect: (subtaskId: string) => void;
  asOf: Date;
}

export function SubtaskTableView({ subtasks, ownerNames, onSelect, asOf }: SubtaskTableViewProps) {
  const t = useTranslations("taskExecutionMap");
  const [sortKey, setSortKey] = useState<SortKey>("due_date");
  const [asc, setAsc] = useState(true);

  const sorted = useMemo(() => {
    const arr = [...subtasks];
    arr.sort((a, b) => {
      const dir = asc ? 1 : -1;
      switch (sortKey) {
        case "title":
          return a.title.localeCompare(b.title) * dir;
        case "status":
          return a.status.localeCompare(b.status) * dir;
        case "progress":
          return (effectiveSubtaskProgress(a) - effectiveSubtaskProgress(b)) * dir;
        case "owner":
          return ((a.owner_id && ownerNames[a.owner_id]) ?? "").localeCompare(
            (b.owner_id && ownerNames[b.owner_id]) ?? "",
          ) * dir;
        default:
          return ((a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")) * dir;
      }
    });
    return arr;
  }, [subtasks, sortKey, asc, ownerNames]);

  const header = (key: SortKey, label: string) => (
    <th scope="col" className="px-2 py-1.5 text-left">
      <button
        type="button"
        className="font-medium text-muted-foreground hover:text-foreground"
        onClick={() => {
          if (sortKey === key) setAsc((v) => !v);
          else {
            setSortKey(key);
            setAsc(true);
          }
        }}
      >
        {label}
        {sortKey === key ? (asc ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <div data-testid="tem-table-view" className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] text-xs">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            {header("title", t("form.title"))}
            {header("status", t("table.status"))}
            {header("progress", t("table.progress"))}
            {header("owner", t("table.owner"))}
            {header("due_date", t("node.dueDate"))}
            <th scope="col" className="px-2 py-1.5 text-left font-medium text-muted-foreground">
              {t("table.hours")}
            </th>
            <th scope="col" className="px-2 py-1.5 text-left font-medium text-muted-foreground">
              {t("table.flags")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => {
            const Icon = STATUS_ICONS[s.status];
            const overdue = isSubtaskOverdue(s, asOf);
            return (
              <tr
                key={s.id}
                data-testid="tem-table-row"
                className={`cursor-pointer border-b border-border/50 hover:bg-muted/40 ${s.status === "cancelled" ? "opacity-50" : ""}`}
                onClick={() => onSelect(s.id)}
              >
                <td className="px-2 py-1.5 font-medium text-foreground">{s.title}</td>
                <td className="px-2 py-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] ${STATUS_BADGE_CLASS[s.status]}`}>
                    <Icon className="h-3 w-3" aria-hidden /> {t(`status.${s.status}`)}
                  </span>
                </td>
                <td className="px-2 py-1.5 tabular-nums">{effectiveSubtaskProgress(s)}%</td>
                <td className="px-2 py-1.5 text-muted-foreground">
                  {s.owner_id ? (ownerNames[s.owner_id] ?? t("unassigned")) : t("unassigned")}
                </td>
                <td className={`px-2 py-1.5 tabular-nums ${overdue ? "font-semibold text-amber-600" : "text-muted-foreground"}`}>
                  {s.due_date ?? "—"}
                </td>
                <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                  {s.actual_hours ?? 0}/{s.estimated_hours ?? "—"}h
                </td>
                <td className="px-2 py-1.5">
                  <span className="inline-flex gap-1">
                    {s.is_critical && <Flame className="h-3.5 w-3.5 text-amber-500" aria-label={t("node.critical")} />}
                    {overdue && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-label={t("node.overdue")} />}
                  </span>
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                {t("empty")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
