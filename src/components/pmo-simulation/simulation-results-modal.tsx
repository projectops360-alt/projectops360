"use client";

// ============================================================================
// PMO Simulation — the expanded, exportable result (CAP-049 §6)
// ============================================================================
// The rail is where a result is CONSULTED next to the graph it explains. It is
// too narrow to be read carefully, and a scenario that never leaves a 320px
// column cannot go into a steering committee.
//
// Export choices, and why:
//
//   * XLSX is loaded with a dynamic import, inside the click handler. SheetJS
//     is close to a megabyte; making every visitor to the dashboard download it
//     so that a few of them can export would be a poor trade.
//   * PDF is `window.print()` against a print stylesheet rather than a client
//     PDF library. The browser already renders this table correctly and the
//     repo prints its Status and Closeout reports the same way — a second
//     mechanism would be a second thing to keep in sync.
//   * CSV is offered too, because it is the one format that opens everywhere
//     and needs no dependency at all.
// ============================================================================

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import type { SimResult } from "@/lib/pmo-simulation/contracts";
import {
  buildExportSheets,
  exportFileName,
  sheetToCsv,
  type ExportLabels,
} from "@/lib/pmo-simulation/results-export";
import { ModalDialog } from "./modal-dialog";
import { SimulationResults } from "./simulation-results";

export function SimulationResultsModal({
  open,
  onClose,
  result,
  locale,
  scenarioName,
}: {
  open: boolean;
  onClose: () => void;
  result: SimResult;
  locale: string;
  scenarioName: string;
}) {
  const t = useTranslations("pmoSimulation");
  const [busy, setBusy] = useState(false);

  const labels: ExportLabels = {
    metric: (key) => t(key),
    provenance: (key) => t(key),
    engine: (key) => t(key),
    headers: {
      metric: t("metric"),
      baseline: t("baseline"),
      simulated: t("simulated"),
      delta: t("delta"),
      unit: t("unit"),
      engine: t("engine"),
      provenance: t("status"),
      reason: t("reason"),
    },
    sheets: {
      metrics: t("exportSheetMetrics"),
      interventions: t("exportSheetInterventions"),
      assumptions: t("exportSheetAssumptions"),
      coverage: t("dataCoverage"),
    },
    unavailable: t("provenanceUnavailable"),
    scenario: t("scenarioName"),
    ranAt: t("exportRanAt"),
    baselineAt: t("exportBaselineAt"),
    neverModifies: t("neverModifies"),
  };

  const download = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    // Revoking immediately can cancel the download in some browsers; a tick is
    // enough and the object is small.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportCsv = () => {
    const sheets = buildExportSheets(result, locale, labels, scenarioName);
    // One file, sections separated — CSV has no notion of sheets and silently
    // dropping three of the four would lose the assumptions.
    const body = sheets
      .map((sheet) => `${sheet.name}\r\n${sheetToCsv(sheet)}`)
      .join("\r\n\r\n");
    download(
      new Blob([`﻿${body}`], { type: "text/csv;charset=utf-8" }),
      exportFileName(scenarioName, result.ranAt, "csv"),
    );
  };

  const exportXlsx = async () => {
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      for (const sheet of buildExportSheets(result, locale, labels, scenarioName)) {
        XLSX.utils.book_append_sheet(
          workbook,
          XLSX.utils.aoa_to_sheet(sheet.rows),
          // Excel rejects sheet names over 31 chars and a few punctuation marks.
          sheet.name.replace(/[\\/?*[\]:]/g, "").slice(0, 31),
        );
      }
      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
      download(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        exportFileName(scenarioName, result.ranAt, "xlsx"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={t("resultsTitle")}
      description={scenarioName}
      closeLabel={t("close")}
      widthClassName="max-w-5xl"
      footer={
        <>
          <p className="mr-auto text-[11px] text-slate-500">{t("neverModifies")}</p>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 print:hidden"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden />
            {t("exportPdf")}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 print:hidden"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            {t("exportCsv")}
          </button>
          <button
            type="button"
            onClick={exportXlsx}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-md bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-40 print:hidden"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            {busy ? t("exporting") : t("exportExcel")}
          </button>
        </>
      }
    >
      {/* The id is how the print stylesheet finds this subtree — the same
          mechanism the Status, Budget, Closeout and Charter reports already
          use (globals.css). A second mechanism would be a second thing to
          keep in sync. */}
      <div id="pmo-simulation-print">
        <h2 className="mb-2 hidden text-sm font-extrabold text-slate-900 print:block">
          {t("resultsTitle")} — {scenarioName}
        </h2>
        <SimulationResults result={result} locale={locale} />
      </div>
    </ModalDialog>
  );
}
