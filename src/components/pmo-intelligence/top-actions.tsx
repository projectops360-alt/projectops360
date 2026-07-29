"use client";

// ============================================================================
// PMO Intelligence Center — top actions (CAP-048 Phase 2, M5 §5)
// ============================================================================
// Three actions, all three delegating to a flow that already exists:
//
//   Import      → a link to `/import`, the real wizard. Not a modal that
//                 reimplements a step of it.
//   Ask AI      → `askIsabella`, with the dashboard's context and a MINIMAL
//                 subgraph (CAP-048 §6). Never the whole graph.
//   Report      → `runPmoScopeReportAction`, which forwards to `runReport`.
//                 CAP-048 §6 names `runReport` as the reuse point precisely so
//                 a second generator never appears.
//
// The report result is rendered inline rather than downloaded: the PMO is in
// the middle of an investigation, and a CSV in the downloads folder is a
// different task.
// ============================================================================

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Download, FileText, MessageSquare, Upload, X } from "lucide-react";
import { runPmoScopeReportAction, type PmoReportResult } from "@/lib/pmo-intelligence/commands.server";

/** Reports offered here. Ids come from the existing prebuilt library. */
const SCOPE_REPORTS = ["project_health_report", "at_risk_projects", "critical_path_report"] as const;

export interface PmoTopActionsProps {
  /** Locale-prefixed base ("" or "/es"), so links stay in the user's language. */
  base: string;
  projectIds: readonly string[];
  onAskIsabella: () => void;
}

export function PmoTopActions({ base, projectIds, onAskIsabella }: PmoTopActionsProps) {
  const t = useTranslations("pmoIntelligence");
  const [report, setReport] = useState<PmoReportResult["report"] | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  async function run(reportId: string) {
    setRunning(reportId);
    setReportError(null);
    const result = await runPmoScopeReportAction({
      reportId,
      projectIds: [...projectIds],
    });
    setRunning(null);
    if (result.error) {
      setReport(null);
      setReportError(result.error);
      return;
    }
    setReport(result.report ?? null);
  }

  return (
    // The three actions share the row evenly on a phone instead of the third
    // one hanging off the edge; from `sm` up they size to their content again.
    <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
      <Link
        href={`${base}/import`}
        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:min-h-0 sm:flex-none sm:justify-start"
      >
        <Upload className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        {t("actionImport")}
      </Link>

      <button
        type="button"
        onClick={onAskIsabella}
        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs font-semibold text-purple-800 hover:bg-purple-100 sm:min-h-0 sm:flex-none sm:justify-start"
      >
        <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {t("actionAskAi")}
      </button>

      <details className="relative flex-1 sm:flex-none">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:min-h-0 sm:justify-start">
          <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          {t("actionReport")}
        </summary>
        <div className="absolute right-0 z-30 mt-1 w-[calc(100vw-2rem)] max-w-[16rem] rounded-lg border border-slate-200 bg-white p-2 shadow-lg sm:w-64">
          {/* A multi-project scope cannot be expressed as one project id, so
              the report runs org-wide and says so. Silently reporting on the
              first selected project would be a confidently wrong answer. */}
          <p className="px-1 pb-1 text-[10px] text-slate-500">
            {projectIds.length === 1 ? t("reportScopedProject") : t("reportScopedOrg")}
          </p>
          <ul className="space-y-1">
            {SCOPE_REPORTS.map((reportId) => (
              <li key={reportId}>
                <button
                  type="button"
                  onClick={() => void run(reportId)}
                  disabled={running != null}
                  className="w-full rounded px-1.5 py-1 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {t(`report_${reportId}`)}
                  {running === reportId ? ` · ${t("reportRunning")}` : ""}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </details>

      {reportError ? (
        <span role="alert" className="text-[11px] font-semibold text-rose-700">
          {t("reportFailed", { reason: reportError })}
        </span>
      ) : null}

      {report ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 sm:p-6">
          <div className="flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-2">
              <Download className="h-4 w-4 text-slate-400" aria-hidden />
              <h2 className="text-sm font-extrabold text-slate-900">{report.name}</h2>
              <span className="text-[11px] text-slate-500">
                {t("reportRows", { count: report.totalRows })}
                {report.truncated ? ` · ${t("reportTruncated")}` : ""}
              </span>
              <button
                type="button"
                onClick={() => setReport(null)}
                aria-label={t("reportClose")}
                className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    {report.columns.map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        className="border-b border-slate-200 px-2 py-1 text-left font-bold text-slate-600"
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row, index) => (
                    <tr key={index} className="odd:bg-white even:bg-slate-50/50">
                      {report.columns.map((column) => (
                        <td key={column.key} className="border-b border-slate-100 px-2 py-1 text-slate-700">
                          {formatCell(row[column.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.rows.length === 0 ? (
                <p className="p-4 text-xs text-slate-500">{t("reportEmpty")}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "✓" : "—";
  return String(value);
}
