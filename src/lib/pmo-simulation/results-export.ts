// ============================================================================
// PMO Simulation — exporting a result (CAP-049 §6)
// ============================================================================
// A scenario that only exists inside a 320px rail cannot be taken into a
// steering committee. This module turns a `SimResult` into rows.
//
// Two rules carry over from the on-screen table, because an export is where
// they are easiest to lose:
//
//   1. A metric with no value exports as the words "Data unavailable", never as
//      an empty cell and never as 0. An empty cell in a spreadsheet is read as
//      zero by the next person to sum the column.
//
//   2. Provenance travels with the number. A figure the user assumed and a
//      figure measured from canonical rows must not become indistinguishable
//      the moment they leave the screen — that is precisely when someone pastes
//      them into a board pack.
//
// Pure: builds arrays of strings. The file writing lives in the component.
// ============================================================================

import type { SimResult } from "./contracts";
import { formatValue, metricLabelKey, provenanceLabelKey, engineLabelKey } from "./presentation";

export interface ExportSheet {
  /** Sheet name for XLSX; section heading for anything flatter. */
  name: string;
  rows: string[][];
}

export interface ExportLabels {
  /** Resolved translations, passed in so this module stays free of next-intl. */
  metric: (key: string) => string;
  provenance: (key: string) => string;
  engine: (key: string) => string;
  headers: {
    metric: string;
    baseline: string;
    simulated: string;
    delta: string;
    unit: string;
    engine: string;
    provenance: string;
    reason: string;
  };
  sheets: {
    metrics: string;
    interventions: string;
    assumptions: string;
    coverage: string;
  };
  unavailable: string;
  scenario: string;
  ranAt: string;
  baselineAt: string;
  neverModifies: string;
}

/**
 * The metrics table, one row per metric.
 *
 * `formatValue` is reused rather than reimplemented so an exported number is
 * formatted exactly as the one the user read on screen — a currency that
 * rounded differently in the export would be a small, corrosive discrepancy.
 */
export function buildMetricsSheet(
  result: SimResult,
  locale: string,
  labels: ExportLabels,
): ExportSheet {
  const header = [
    labels.headers.metric,
    labels.headers.baseline,
    labels.headers.simulated,
    labels.headers.delta,
    labels.headers.unit,
    labels.headers.engine,
    labels.headers.provenance,
    labels.headers.reason,
  ];

  const rows = result.metrics.map((metric) => {
    const missing = metric.baseline == null && metric.simulated == null;
    // `formatValue` returns null for a null or non-finite input. Both collapse
    // to the same words here: an empty spreadsheet cell is read as zero by the
    // next person who sums the column, which is the whole failure this avoids.
    const cell = (value: number | null) =>
      formatValue(value, metric.unit, locale) ?? labels.unavailable;
    return [
      labels.metric(metricLabelKey(metric.key)),
      cell(metric.baseline),
      cell(metric.simulated),
      cell(metric.delta),
      metric.unit,
      labels.engine(engineLabelKey(metric.engine)),
      labels.provenance(provenanceLabelKey(metric.provenance)),
      // The reason a value is missing is the most useful cell in the row when
      // it applies, and blank everywhere else.
      missing ? metric.unavailableReason ?? "" : "",
    ];
  });

  return { name: labels.sheets.metrics, rows: [header, ...rows] };
}

/** One row per intervention, including the ones that could not be computed. */
export function buildInterventionsSheet(result: SimResult, labels: ExportLabels): ExportSheet {
  const header = ["id", "kind", "computable", labels.headers.reason, "affected_nodes"];
  const rows = result.outcomes.map((outcome) => [
    outcome.interventionId,
    outcome.kind,
    outcome.computable ? "yes" : "no",
    outcome.notComputableReason ?? "",
    String(outcome.affectedNodeIds.length),
  ]);
  return { name: labels.sheets.interventions, rows: [header, ...rows] };
}

/** Assumptions and issues — the caveats that make the numbers defensible. */
export function buildAssumptionsSheet(result: SimResult, labels: ExportLabels): ExportSheet {
  const rows: string[][] = [["type", "code", "detail"]];
  for (const assumption of result.assumptions) rows.push(["assumption", assumption, ""]);
  for (const issue of result.issues) {
    rows.push([issue.severity, issue.code, issue.detail ?? ""]);
  }
  return { name: labels.sheets.assumptions, rows };
}

/** Which tables answered and which did not. Absent data is stated, not implied. */
export function buildCoverageSheet(result: SimResult, labels: ExportLabels): ExportSheet {
  const rows: string[][] = [["source", "status"]];
  for (const table of result.coverage.availableSources) rows.push([table, "available"]);
  for (const table of result.coverage.unavailableSources) rows.push([table, "unavailable"]);
  for (const target of result.coverage.unresolvedTargets) {
    rows.push([`${target.kind}:${target.id}`, "unresolved_target"]);
  }
  return { name: labels.sheets.coverage, rows };
}

export function buildExportSheets(
  result: SimResult,
  locale: string,
  labels: ExportLabels,
  scenarioName: string,
): ExportSheet[] {
  const cover: ExportSheet = {
    name: labels.sheets.metrics,
    rows: [
      [labels.scenario, scenarioName],
      [labels.baselineAt, result.baselineAt],
      [labels.ranAt, result.ranAt],
      // Stated in the file itself: someone will open this without the app.
      [labels.neverModifies, ""],
      [],
    ],
  };

  const metrics = buildMetricsSheet(result, locale, labels);
  return [
    { name: metrics.name, rows: [...cover.rows, ...metrics.rows] },
    buildInterventionsSheet(result, labels),
    buildAssumptionsSheet(result, labels),
    buildCoverageSheet(result, labels),
  ];
}

/** RFC-4180 CSV for one sheet. Excel opens it; so does everything else. */
export function sheetToCsv(sheet: ExportSheet): string {
  return sheet.rows
    .map((row) =>
      row
        .map((cell) => (/[",\n;]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
        .join(","),
    )
    .join("\r\n");
}

/** A filesystem-safe file stem. Never empty, never a path. */
export function exportFileName(scenarioName: string, ranAt: string, extension: string): string {
  const stem =
    scenarioName
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "simulation";
  const stamp = ranAt.slice(0, 10);
  return `${stem}-${stamp}.${extension}`;
}
