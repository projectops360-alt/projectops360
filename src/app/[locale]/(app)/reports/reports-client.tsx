"use client";

// ============================================================================
// Reports & Intelligence — Project Intelligence Studio (client)
// ============================================================================
// Tabbed studio: Overview · Report Library · Report Builder · Saved Reports ·
// Data Explorer · KPI Dictionary. The builder works only against curated
// datasets (semantic layer) and runs through server actions — never raw SQL.
// ============================================================================

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3, LayoutGrid, Wrench, Bookmark, Compass, BookOpen, Play, Save, Download,
  Plus, X, Loader2, Table as TableIcon, Copy, Trash2, Database, AlertTriangle, Calculator, Sparkles,
} from "lucide-react";
import type { Locale } from "@/types/database";
import { localizedHref } from "@/i18n/href";
import { listDatasets, getDataset } from "@/lib/reports/registry";
import { listPrebuiltReports } from "@/lib/reports/report-library";
import { listKpis } from "@/lib/reports/kpi-dictionary";
import type {
  ReportConfig, ReportFilter, ReportResult, DatasetColumn, FilterOperator, VisualizationType,
} from "@/lib/reports/types";
import {
  runReportAction, exportReportCsvAction, saveReportAction, deleteSavedReportAction,
  duplicateSavedReportAction, suggestCalculatedFieldAction, type SavedReportRow,
} from "./actions";

type Tab = "overview" | "library" | "builder" | "saved" | "explorer" | "kpi";

const T = {
  en: {
    title: "Reports & Intelligence",
    subtitle: "Create executive dashboards, analyze project performance, and build custom reports from trusted ProjectOps360° datasets.",
    tabs: { overview: "Overview", library: "Report Library", builder: "Report Builder", saved: "Saved Reports", explorer: "Data Explorer", kpi: "KPI Dictionary" } as Record<Tab, string>,
    quick: { build: "Create Custom Report", library: "Browse Report Library", explore: "Explore Data" },
    categories: "Report categories",
    recent: "Recent saved reports", noRecent: "Create your first custom report using curated ProjectOps360° datasets.",
    run: "Run", open: "Open", dataset: "Dataset", columns: "Columns", filters: "Filters", grouping: "Group by",
    sort: "Sort", visualization: "Visualization", preview: "Preview", save: "Save", exportCsv: "Export CSV",
    addFilter: "Add filter", none: "None", rows: "rows", in: "in", ran: "ran in", truncated: "Showing the first 5,000 rows.",
    selectDataset: "Select a dataset to start building.", noColumns: "Pick at least one column, then Run.",
    runFirst: "Run the report to preview results.", noData: "No rows match this report.",
    saveTitle: "Save report", reportName: "Report name", description: "Description", visibility: "Visibility",
    vis: { private: "Private", project: "Project", organization: "Organization" } as Record<string, string>,
    cancel: "Cancel", saved: "Saved", deleteConfirm: "Delete this report?", duplicate: "Duplicate", delete: "Delete",
    by: "by", lastRun: "Last run", never: "never", group: "Group", count: "Count",
    explorerHint: "Curated, business-friendly datasets you can report from — no raw tables.",
    kpiHint: "What each metric means and how it's computed.",
    formula: "Formula", interpretation: "How to read it", caution: "Caution", source: "Source",
    calc: {
      title: "Calculated fields", add: "Add field", label: "Label", expression: "Formula",
      exprHint: "Use column keys, + - * / %, and round/abs/min/max/if(). e.g. forecast_cost - estimated_cost",
      aiTitle: "Describe it and let AI write the formula", aiPlaceholder: "e.g. budget overrun percent",
      aiBtn: "AI", generating: "Writing…", none: "No calculated fields yet.",
    },
    errors: { invalid_config: "The report configuration is invalid.", invalid_filters: "One or more filters are invalid.", invalid_formula: "A calculated field formula is invalid.", ai_not_configured: "AI isn't configured. Add an AI provider to use this.", ai_failed: "AI couldn't generate a formula. Try rephrasing.", ai_invalid_formula: "The AI formula referenced unknown columns.", not_authenticated: "Session expired.", unexpected: "Something went wrong.", project_not_found: "Project not found." } as Record<string, string>,
  },
  es: {
    title: "Reportes e Inteligencia",
    subtitle: "Crea dashboards ejecutivos, analiza el desempeño de proyectos y construye reportes a la medida desde datasets confiables de ProjectOps360°.",
    tabs: { overview: "Resumen", library: "Biblioteca de Reportes", builder: "Constructor de Reportes", saved: "Reportes Guardados", explorer: "Explorador de Datos", kpi: "Diccionario de KPIs" } as Record<Tab, string>,
    quick: { build: "Crear reporte a la medida", library: "Ver biblioteca de reportes", explore: "Explorar datos" },
    categories: "Categorías de reportes",
    recent: "Reportes guardados recientes", noRecent: "Crea tu primer reporte a la medida con los datasets de ProjectOps360°.",
    run: "Ejecutar", open: "Abrir", dataset: "Dataset", columns: "Columnas", filters: "Filtros", grouping: "Agrupar por",
    sort: "Ordenar", visualization: "Visualización", preview: "Vista previa", save: "Guardar", exportCsv: "Exportar CSV",
    addFilter: "Agregar filtro", none: "Ninguno", rows: "filas", in: "en", ran: "ejecutado en", truncated: "Mostrando las primeras 5.000 filas.",
    selectDataset: "Elige un dataset para empezar.", noColumns: "Elige al menos una columna y ejecuta.",
    runFirst: "Ejecuta el reporte para ver resultados.", noData: "Ninguna fila coincide con este reporte.",
    saveTitle: "Guardar reporte", reportName: "Nombre del reporte", description: "Descripción", visibility: "Visibilidad",
    vis: { private: "Privado", project: "Proyecto", organization: "Organización" } as Record<string, string>,
    cancel: "Cancelar", saved: "Guardado", deleteConfirm: "¿Eliminar este reporte?", duplicate: "Duplicar", delete: "Eliminar",
    by: "por", lastRun: "Última ejecución", never: "nunca", group: "Grupo", count: "Conteo",
    explorerHint: "Datasets curados y fáciles de entender para tus reportes — sin tablas técnicas.",
    kpiHint: "Qué significa cada métrica y cómo se calcula.",
    formula: "Fórmula", interpretation: "Cómo leerlo", caution: "Precaución", source: "Fuente",
    calc: {
      title: "Campos calculados", add: "Agregar campo", label: "Etiqueta", expression: "Fórmula",
      exprHint: "Usa claves de columnas, + - * / % y round/abs/min/max/if(). Ej: forecast_cost - estimated_cost",
      aiTitle: "Descríbelo y deja que la IA escriba la fórmula", aiPlaceholder: "ej. porcentaje de sobrecosto",
      aiBtn: "IA", generating: "Escribiendo…", none: "Aún no hay campos calculados.",
    },
    errors: { invalid_config: "La configuración del reporte no es válida.", invalid_filters: "Uno o más filtros no son válidos.", invalid_formula: "La fórmula de un campo calculado no es válida.", ai_not_configured: "La IA no está configurada. Agrega un proveedor de IA para usar esto.", ai_failed: "La IA no pudo generar una fórmula. Reformula la descripción.", ai_invalid_formula: "La fórmula de la IA usó columnas desconocidas.", not_authenticated: "La sesión expiró.", unexpected: "Algo salió mal.", project_not_found: "Proyecto no encontrado." } as Record<string, string>,
  },
};

const OPERATORS_BY_TYPE: Record<string, FilterOperator[]> = {
  text: ["equals", "not_equals", "contains", "starts_with", "in", "is_empty", "is_not_empty"],
  number: ["equals", "greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal", "between"],
  date: ["date_before", "date_after", "date_between", "is_empty", "is_not_empty"],
  boolean: ["equals"],
  enum: ["equals", "not_equals", "in", "not_in"],
};
const OP_LABELS: Record<FilterOperator, string> = {
  equals: "=", not_equals: "≠", contains: "contains", not_contains: "not contains", starts_with: "starts with",
  ends_with: "ends with", greater_than: ">", greater_than_or_equal: "≥", less_than: "<", less_than_or_equal: "≤",
  between: "between", in: "in", not_in: "not in", is_empty: "is empty", is_not_empty: "is not empty",
  date_before: "before", date_after: "after", date_between: "between",
};

const VIS_OPTIONS: { value: VisualizationType; label: string }[] = [
  { value: "table", label: "Table" }, { value: "kpi_cards", label: "KPI Cards" },
  { value: "bar", label: "Bar Chart" }, { value: "donut", label: "Donut" }, { value: "pivot", label: "Pivot" },
];

function emptyConfig(datasetId: string): ReportConfig {
  const ds = getDataset(datasetId);
  return { datasetId, columns: ds?.defaultColumns ?? [], filters: [], grouping: null, sort: [], visualization: "table" };
}

export function ReportsClient({ locale, initialSavedReports, initialReportId }: { locale: Locale; initialSavedReports: SavedReportRow[]; initialReportId?: string | null }) {
  const t = T[locale] ?? T.en;
  const [tab, setTab] = useState<Tab>("overview");
  const [config, setConfig] = useState<ReportConfig | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedReportRow[]>(initialSavedReports);
  const [showSave, setShowSave] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const datasets = listDatasets();
  const dataset = config ? getDataset(config.datasetId) : null;

  const openBuilder = useCallback((cfg: ReportConfig) => {
    setConfig(cfg);
    setResult(null);
    setError(null);
    setTab("builder");
  }, []);

  const run = useCallback(async (cfg: ReportConfig) => {
    setRunning(true);
    setError(null);
    const res = await runReportAction({ config: cfg, page: 1, pageSize: 100 });
    setRunning(false);
    if (res.error || !res.result) {
      setError(t.errors[res.error ?? "unexpected"] ?? res.details?.join(" ") ?? t.errors.unexpected);
      setResult(null);
      return;
    }
    setResult(res.result);
  }, [t]);

  // Deep-link: /reports?report=<id> opens the prebuilt report in the builder and runs it.
  useEffect(() => {
    if (!initialReportId) return;
    const prebuilt = listPrebuiltReports().find((r) => r.id === initialReportId);
    if (!prebuilt) return;
    const cfg: ReportConfig = { datasetId: prebuilt.datasetId, ...prebuilt.config };
    // Defer past the mount commit so this isn't a synchronous in-effect setState.
    const id = setTimeout(() => { openBuilder(cfg); run(cfg); }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for the incoming deep link
  }, [initialReportId]);

  async function exportCsv() {
    if (!config) return;
    const res = await exportReportCsvAction({ config, reportName: dataset?.displayName });
    if (res.csv != null && res.fileName) {
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = res.fileName; a.click();
      URL.revokeObjectURL(url);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <BarChart3 className="h-6 w-6 text-brand-500" />
          {t.title}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {(Object.keys(t.tabs) as Tab[]).map((key) => {
          const Icon = { overview: LayoutGrid, library: BarChart3, builder: Wrench, saved: Bookmark, explorer: Compass, kpi: BookOpen }[key];
          return (
            <button key={key} type="button" onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${tab === key ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-4 w-4" />
              {t.tabs[key]}
            </button>
          );
        })}
      </div>

      {tab === "overview" && <Overview t={t} datasets={datasets} saved={saved} onBuild={() => openBuilder(emptyConfig(datasets[0].id))} onLibrary={() => setTab("library")} onExplore={() => setTab("explorer")} onOpenSaved={(r) => openBuilder(savedToConfig(r))} />}
      {tab === "library" && <Library t={t} onRun={(cfg) => { openBuilder(cfg); run(cfg); }} />}
      {tab === "builder" && (
        <Builder
          t={t} locale={locale} datasets={datasets} config={config} setConfig={setConfig} dataset={dataset}
          result={result} running={running} error={error}
          onRun={() => config && run(config)} onSave={() => setShowSave(true)} onExport={exportCsv}
        />
      )}
      {tab === "saved" && (
        <Saved t={t} saved={saved} onOpen={(r) => { openBuilder(savedToConfig(r)); }} onDelete={async (id) => { await deleteSavedReportAction({ reportId: id }); setSaved((s) => s.filter((x) => x.id !== id)); }} onDuplicate={async (id) => { const r = await duplicateSavedReportAction({ reportId: id }); if (r.reportId) { const src = saved.find((x) => x.id === id); if (src) setSaved((s) => [{ ...src, id: r.reportId!, report_name: `${src.report_name} (copy)` }, ...s]); } }} />
      )}
      {tab === "explorer" && <Explorer t={t} datasets={datasets} onBuild={(id) => openBuilder(emptyConfig(id))} />}
      {tab === "kpi" && <KpiDictionary t={t} />}

      {showSave && config && (
        <SaveDialog t={t} onClose={() => setShowSave(false)} onSave={async (meta) => {
          const res = await saveReportAction({ config, ...meta });
          setShowSave(false);
          if (!res.error) { setSavedToast(true); setTimeout(() => setSavedToast(false), 2500); }
        }} />
      )}
      {savedToast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-lg">{t.saved} ✓</div>
      )}
    </div>
  );
}

/** Where a report row drills into: the project page that owns the problem. */
function entityHref(locale: string, datasetId: string, projectId: string | null, recordId?: string | null): string | null {
  if (!projectId) return null;
  switch (datasetId) {
    case "task_execution": return localizedHref(locale, `/projects/${projectId}/workboard${recordId ? `?task=${recordId}` : ""}`);
    case "project_health": return localizedHref(locale, `/projects/${projectId}/status`);
    default: return localizedHref(locale, `/projects/${projectId}`); // budget, risks, materials, rfis
  }
}

function savedToConfig(r: SavedReportRow): ReportConfig {
  return {
    datasetId: r.dataset_id,
    columns: r.columns_json ?? [],
    filters: r.filters_json ?? [],
    grouping: r.grouping_json ?? null,
    sort: r.sorting_json ?? [],
    visualization: r.visualization_type,
    calculatedFields: r.calculated_fields_json ?? [],
  };
}

// ── Overview ──────────────────────────────────────────────────────────────────

type Labels = (typeof T)["en"];

function Overview({ t, datasets, saved, onBuild, onLibrary, onExplore, onOpenSaved }: {
  t: Labels; datasets: ReturnType<typeof listDatasets>; saved: SavedReportRow[];
  onBuild: () => void; onLibrary: () => void; onExplore: () => void; onOpenSaved: (r: SavedReportRow) => void;
}) {
  const cats = [...new Set(datasets.map((d) => d.category))];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onBuild} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"><Wrench className="h-4 w-4" />{t.quick.build}</button>
        <button type="button" onClick={onLibrary} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"><BarChart3 className="h-4 w-4" />{t.quick.library}</button>
        <button type="button" onClick={onExplore} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"><Compass className="h-4 w-4" />{t.quick.explore}</button>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t.categories}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {datasets.map((d) => (
            <button key={d.id} type="button" onClick={onLibrary} className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-brand-400">
              <div className="flex items-center gap-2"><Database className="h-4 w-4 text-brand-500" /><span className="text-sm font-semibold text-foreground">{d.displayName}</span></div>
              <p className="mt-1 text-xs text-muted-foreground">{d.description}</p>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{cats.length} {t.categories.toLowerCase()}</p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t.recent}</h2>
        {saved.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t.noRecent}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {saved.slice(0, 6).map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onOpenSaved(r)} className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-muted/40">
                  <span className="text-sm font-medium text-foreground">{r.report_name}</span>
                  <span className="text-xs text-muted-foreground">{getDataset(r.dataset_id)?.displayName ?? r.dataset_id}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Library ─────────────────────────────────────────────────────────────────

function Library({ t, onRun }: { t: Labels; onRun: (cfg: ReportConfig) => void }) {
  const reports = listPrebuiltReports();
  const cats = [...new Set(reports.map((r) => r.category))];
  return (
    <div className="space-y-6">
      {cats.map((cat) => (
        <div key={cat}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{cat}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reports.filter((r) => r.category === cat).map((r) => (
              <div key={r.id} className="flex flex-col rounded-xl border border-border bg-card p-4">
                <span className="text-sm font-semibold text-foreground">{r.name}</span>
                <p className="mt-1 flex-1 text-xs text-muted-foreground">{r.description}</p>
                <button type="button" onClick={() => onRun({ datasetId: r.datasetId, ...r.config })}
                  className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
                  <Play className="h-3.5 w-3.5" />{t.run}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Builder ─────────────────────────────────────────────────────────────────

function Builder({ t, locale, datasets, config, setConfig, dataset, result, running, error, onRun, onSave, onExport }: {
  t: Labels; locale: Locale; datasets: ReturnType<typeof listDatasets>; config: ReportConfig | null;
  setConfig: (c: ReportConfig) => void; dataset: ReturnType<typeof getDataset>;
  result: ReportResult | null; running: boolean; error: string | null;
  onRun: () => void; onSave: () => void; onExport: () => void;
}) {
  if (!config || !dataset) {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-foreground">{t.dataset}</label>
        <select className="w-full max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-sm" defaultValue=""
          onChange={(e) => e.target.value && setConfig(emptyConfig(e.target.value))}>
          <option value="">{t.selectDataset}</option>
          {datasets.map((d) => <option key={d.id} value={d.id}>{d.displayName}</option>)}
        </select>
      </div>
    );
  }

  // Calculated fields appear as selectable numeric columns in a "Calculated" group.
  const calcCols: DatasetColumn[] = (config.calculatedFields ?? []).map((f) => ({
    key: f.key, label: f.label, group: "Calculated", type: "number" as const,
    filterable: true, sortable: true, aggregatable: true, description: f.expression,
  }));
  const effectiveCols: DatasetColumn[] = [...dataset.columns, ...calcCols];

  const colByGroup = new Map<string, DatasetColumn[]>();
  for (const c of effectiveCols) {
    if (!colByGroup.has(c.group)) colByGroup.set(c.group, []);
    colByGroup.get(c.group)!.push(c);
  }
  const selectedSet = new Set(config.columns);
  const toggleColumn = (key: string) => {
    const next = selectedSet.has(key) ? config.columns.filter((c) => c !== key) : [...config.columns, key];
    setConfig({ ...config, columns: next });
  };
  const filterableCols = effectiveCols.filter((c) => c.filterable !== false);
  const groupableCols = effectiveCols.filter((c) => c.groupable);

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      {/* Left: dataset + columns */}
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.dataset}</label>
          <select value={config.datasetId} onChange={(e) => setConfig(emptyConfig(e.target.value))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {datasets.map((d) => <option key={d.id} value={d.id}>{d.displayName}</option>)}
          </select>
        </div>
        <div className="rounded-xl border border-border p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.columns}</p>
          <div className="max-h-[420px] space-y-3 overflow-y-auto">
            {[...colByGroup.entries()].map(([group, cols]) => (
              <div key={group}>
                <p className="mb-1 text-[11px] font-medium uppercase text-muted-foreground/70">{group}</p>
                {cols.map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm text-foreground hover:bg-muted/40">
                    <input type="checkbox" checked={selectedSet.has(c.key)} onChange={() => toggleColumn(c.key)} className="h-4 w-4 rounded border-border accent-brand-600" />
                    {c.label}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Calculated fields */}
        <CalcFieldsPanel t={t} config={config} setConfig={setConfig} />
      </div>

      {/* Right: controls + preview */}
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <select value={config.visualization} onChange={(e) => setConfig({ ...config, visualization: e.target.value as VisualizationType })}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
            {VIS_OPTIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
          <select value={config.grouping?.column ?? ""} onChange={(e) => setConfig({ ...config, grouping: e.target.value ? { column: e.target.value, metrics: [{ column: config.columns[0] ?? "", fn: "count", label: t.count }] } : null })}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
            <option value="">{t.grouping}: {t.none}</option>
            {groupableCols.map((c) => <option key={c.key} value={c.key}>{t.grouping}: {c.label}</option>)}
          </select>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onRun} disabled={running || config.columns.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{t.run}
            </button>
            <button type="button" onClick={onSave} disabled={config.columns.length === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"><Save className="h-4 w-4" />{t.save}</button>
            <button type="button" onClick={onExport} disabled={!result} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"><Download className="h-4 w-4" />{t.exportCsv}</button>
          </div>
        </div>

        {/* Filters */}
        <FilterBuilder t={t} columns={filterableCols} filters={config.filters} onChange={(filters) => setConfig({ ...config, filters })} />

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}
          </div>
        )}

        {/* Preview */}
        {config.columns.length === 0 ? (
          <Empty icon={<TableIcon className="h-8 w-8" />} text={t.noColumns} />
        ) : !result ? (
          <Empty icon={<Play className="h-8 w-8" />} text={t.runFirst} />
        ) : (
          <PreviewPane t={t} locale={locale} config={config} result={result} />
        )}
      </div>
    </div>
  );
}

function CalcFieldsPanel({ t, config, setConfig }: { t: Labels; config: ReportConfig; setConfig: (c: ReportConfig) => void }) {
  const fields = config.calculatedFields ?? [];
  const [label, setLabel] = useState("");
  const [expr, setExpr] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  function addField(lbl: string, expression: string, source: "manual" | "ai") {
    const trimmedLabel = lbl.trim() || "Calculated";
    const key = `calc_${Date.now().toString(36)}_${fields.length}`;
    setConfig({
      ...config,
      calculatedFields: [...fields, { key, label: trimmedLabel, expression: expression.trim(), source }],
      columns: [...config.columns, key], // auto-select the new field
    });
  }
  function removeField(key: string) {
    setConfig({ ...config, calculatedFields: fields.filter((f) => f.key !== key), columns: config.columns.filter((c) => c !== key) });
  }
  async function generateAi() {
    if (!aiPrompt.trim() || aiBusy) return;
    setAiBusy(true); setAiError(null);
    const res = await suggestCalculatedFieldAction({ datasetId: config.datasetId, prompt: aiPrompt });
    setAiBusy(false);
    if (res.error || !res.expression) { setAiError(t.errors[res.error ?? "ai_failed"] ?? t.errors.ai_failed); return; }
    addField(res.label ?? aiPrompt, res.expression, "ai");
    setAiPrompt("");
  }

  return (
    <div className="rounded-xl border border-border p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Calculator className="h-3.5 w-3.5" />{t.calc.title}
      </p>

      {fields.length > 0 && (
        <ul className="mb-2 space-y-1">
          {fields.map((f) => (
            <li key={f.key} className="flex items-center gap-2 rounded bg-muted/40 px-2 py-1 text-xs">
              <span className="shrink-0 font-medium text-foreground">{f.label}</span>
              {f.source === "ai" && <Sparkles className="h-3 w-3 shrink-0 text-purple-500" />}
              <code className="min-w-0 flex-1 truncate text-muted-foreground" title={f.expression}>{f.expression}</code>
              <button type="button" onClick={() => removeField(f.key)} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}

      {/* Manual add */}
      <div className="space-y-1.5">
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder={t.calc.label}
          className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs" />
        <div className="flex gap-1.5">
          <input value={expr} onChange={(e) => setExpr(e.target.value)} maxLength={500} placeholder={t.calc.expression}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 font-mono text-xs" />
          <button type="button" disabled={!expr.trim()} onClick={() => { addField(label, expr, "manual"); setLabel(""); setExpr(""); }}
            className="shrink-0 rounded-lg border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"><Plus className="h-3.5 w-3.5" /></button>
        </div>
        <p className="text-[10px] text-muted-foreground">{t.calc.exprHint}</p>
      </div>

      {/* AI add */}
      <div className="mt-2 border-t border-border pt-2">
        <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-purple-600 dark:text-purple-400"><Sparkles className="h-3 w-3" />{t.calc.aiTitle}</p>
        <div className="flex gap-1.5">
          <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} maxLength={300} placeholder={t.calc.aiPlaceholder}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); generateAi(); } }}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs" />
          <button type="button" disabled={!aiPrompt.trim() || aiBusy} onClick={generateAi}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-purple-600 px-2 py-1 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
            {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{aiBusy ? t.calc.generating : t.calc.aiBtn}
          </button>
        </div>
        {aiError && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{aiError}</p>}
      </div>
    </div>
  );
}

function FilterBuilder({ t, columns, filters, onChange }: { t: Labels; columns: DatasetColumn[]; filters: ReportFilter[]; onChange: (f: ReportFilter[]) => void }) {
  const colByKey = new Map(columns.map((c) => [c.key, c]));
  const addFilter = () => {
    const first = columns[0];
    if (!first) return;
    onChange([...filters, { column: first.key, operator: OPERATORS_BY_TYPE[first.type][0], value: "" }]);
  };
  const update = (i: number, patch: Partial<ReportFilter>) => onChange(filters.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const remove = (i: number) => onChange(filters.filter((_, idx) => idx !== i));

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.filters}</p>
        <button type="button" onClick={addFilter} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"><Plus className="h-3.5 w-3.5" />{t.addFilter}</button>
      </div>
      {filters.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t.none}</p>
      ) : (
        <div className="space-y-2">
          {filters.map((f, i) => {
            const col = colByKey.get(f.column);
            const type = col?.type ?? "text";
            const needsValue = !["is_empty", "is_not_empty"].includes(f.operator);
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select value={f.column} onChange={(e) => { const nc = colByKey.get(e.target.value); update(i, { column: e.target.value, operator: OPERATORS_BY_TYPE[nc?.type ?? "text"][0], value: "" }); }}
                  className="rounded-lg border border-border bg-background px-2 py-1 text-xs">
                  {columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
                <select value={f.operator} onChange={(e) => update(i, { operator: e.target.value as FilterOperator })} className="rounded-lg border border-border bg-background px-2 py-1 text-xs">
                  {OPERATORS_BY_TYPE[type].map((op) => <option key={op} value={op}>{OP_LABELS[op]}</option>)}
                </select>
                {needsValue && (
                  type === "boolean" ? (
                    <select value={String(f.value ?? "true")} onChange={(e) => update(i, { value: e.target.value === "true" })} className="rounded-lg border border-border bg-background px-2 py-1 text-xs">
                      <option value="true">true</option><option value="false">false</option>
                    </select>
                  ) : type === "enum" && col?.enumValues ? (
                    <select value={String(f.value ?? "")} onChange={(e) => update(i, { value: ["in", "not_in"].includes(f.operator) ? [e.target.value] : e.target.value })} className="rounded-lg border border-border bg-background px-2 py-1 text-xs">
                      <option value="">—</option>
                      {col.enumValues.map((ev) => <option key={ev.value} value={ev.value}>{ev.label}</option>)}
                    </select>
                  ) : (
                    <input type={type === "number" ? "number" : type === "date" ? "date" : "text"}
                      value={Array.isArray(f.value) ? f.value.join(",") : String(f.value ?? "")}
                      onChange={(e) => update(i, { value: ["in", "not_in"].includes(f.operator) ? e.target.value.split(",").map((s) => s.trim()) : e.target.value })}
                      className="w-40 rounded-lg border border-border bg-background px-2 py-1 text-xs" placeholder="…" />
                  )
                )}
                <button type="button" onClick={() => remove(i)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PreviewPane({ t, locale, config, result }: { t: Labels; locale: Locale; config: ReportConfig; result: ReportResult }) {
  const router = useRouter();
  const grouped = config.grouping && result.grouped ? result.grouped : null;

  // Grouped bar/donut/kpi
  if (grouped && config.grouping) {
    const metricKey = config.grouping.metrics[0]?.label ?? "group_count";
    const max = Math.max(1, ...grouped.map((g) => Number(g[metricKey]) || 0));
    return (
      <div className="space-y-3">
        <ResultMeta t={t} result={result} />
        {config.visualization === "kpi_cards" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {grouped.map((g, i) => (
              <div key={i} className="rounded-lg border border-border p-3 text-center">
                <div className="text-xl font-bold text-foreground">{String(g[metricKey])}</div>
                <div className="truncate text-xs text-muted-foreground">{String(g[config.grouping!.column])}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5 rounded-xl border border-border p-4">
            {grouped.map((g, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-40 shrink-0 truncate text-muted-foreground">{String(g[config.grouping!.column])}</span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
                  <div className="h-full rounded bg-brand-500" style={{ width: `${((Number(g[metricKey]) || 0) / max) * 100}%` }} />
                </div>
                <span className="w-12 shrink-0 text-right font-medium text-foreground">{String(g[metricKey])}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Table (default)
  return (
    <div className="space-y-3">
      <ResultMeta t={t} result={result} />
      {result.rows.length === 0 ? (
        <Empty icon={<TableIcon className="h-8 w-8" />} text={t.noData} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                {result.columns.map((c) => <th key={c.key} className="px-3 py-2 font-medium">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => {
                const href = entityHref(locale, config.datasetId, (row._projectId as string) ?? null, (row._recordId as string) ?? null);
                return (
                  <tr
                    key={i}
                    onClick={href ? () => router.push(href) : undefined}
                    title={href ? t.open : undefined}
                    className={`border-b border-border last:border-0 ${href ? "cursor-pointer hover:bg-brand-50/60 dark:hover:bg-brand-950/20" : ""}`}
                  >
                    {result.columns.map((c, ci) => (
                      <td key={c.key} className={`max-w-[260px] truncate px-3 py-1.5 ${ci === 0 && href ? "font-medium text-brand-600 dark:text-brand-400" : "text-foreground"}`}>
                        {formatCell(row[c.key], c)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatCell(v: string | number | boolean | null, c: DatasetColumn): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (c.type === "enum" && c.enumValues) return c.enumValues.find((e) => e.value === v)?.label ?? String(v);
  return String(v);
}

function ResultMeta({ t, result }: { t: Labels; result: ReportResult }) {
  return (
    <p className="text-xs text-muted-foreground">
      {result.totalRows} {t.rows} · {t.ran} {result.durationMs}ms{result.truncated ? ` · ${t.truncated}` : ""}
    </p>
  );
}

// ── Saved ─────────────────────────────────────────────────────────────────

function Saved({ t, saved, onOpen, onDelete, onDuplicate }: {
  t: Labels; saved: SavedReportRow[]; onOpen: (r: SavedReportRow) => void; onDelete: (id: string) => void; onDuplicate: (id: string) => void;
}) {
  if (saved.length === 0) return <Empty icon={<Bookmark className="h-8 w-8" />} text={t.noRecent} />;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2">{t.reportName}</th><th className="px-3 py-2">{t.dataset}</th>
            <th className="px-3 py-2">{t.visualization}</th><th className="px-3 py-2">{t.visibility}</th><th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {saved.map((r) => (
            <tr key={r.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2"><button type="button" onClick={() => onOpen(r)} className="font-medium text-brand-600 hover:underline dark:text-brand-400">{r.report_name}</button></td>
              <td className="px-3 py-2 text-muted-foreground">{getDataset(r.dataset_id)?.displayName ?? r.dataset_id}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.visualization_type}</td>
              <td className="px-3 py-2 text-muted-foreground">{t.vis[r.visibility]}</td>
              <td className="px-3 py-2">
                <div className="flex justify-end gap-1">
                  <button type="button" onClick={() => onDuplicate(r.id)} title={t.duplicate} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><Copy className="h-4 w-4" /></button>
                  <button type="button" onClick={() => { if (confirm(t.deleteConfirm)) onDelete(r.id); }} title={t.delete} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Data Explorer ─────────────────────────────────────────────────────────

function Explorer({ t, datasets, onBuild }: { t: Labels; datasets: ReturnType<typeof listDatasets>; onBuild: (id: string) => void }) {
  const [open, setOpen] = useState<string | null>(datasets[0]?.id ?? null);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.explorerHint}</p>
      {datasets.map((d) => (
        <div key={d.id} className="rounded-xl border border-border">
          <button type="button" onClick={() => setOpen(open === d.id ? null : d.id)} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <div>
              <span className="text-sm font-semibold text-foreground">{d.displayName}</span>
              <p className="text-xs text-muted-foreground">{d.description}</p>
            </div>
            <button type="button" onClick={(e) => { e.stopPropagation(); onBuild(d.id); }} className="shrink-0 rounded-lg border border-border px-3 py-1 text-xs font-medium hover:bg-muted">{t.quick.build}</button>
          </button>
          {open === d.id && (
            <div className="overflow-x-auto border-t border-border">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/30 text-left text-xs text-muted-foreground"><th className="px-3 py-2">Column</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Group</th><th className="px-3 py-2">Definition</th></tr></thead>
                <tbody>
                  {d.columns.map((c) => (
                    <tr key={c.key} className="border-b border-border last:border-0">
                      <td className="px-3 py-1.5 font-medium text-foreground">{c.label}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{c.type}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{c.group}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{c.description ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── KPI Dictionary ──────────────────────────────────────────────────────────

function KpiDictionary({ t }: { t: Labels }) {
  const kpis = listKpis();
  const cats = [...new Set(kpis.map((k) => k.category))];
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{t.kpiHint}</p>
      {cats.map((cat) => (
        <div key={cat}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{cat}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {kpis.filter((k) => k.category === cat).map((k) => (
              <div key={k.id} className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-semibold text-foreground">{k.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{k.description}</p>
                <dl className="mt-2 space-y-1 text-xs">
                  <div><dt className="inline font-medium text-foreground">{t.formula}: </dt><dd className="inline text-muted-foreground">{k.formula}</dd></div>
                  <div><dt className="inline font-medium text-foreground">{t.source}: </dt><dd className="inline text-muted-foreground">{k.sourceDataset}</dd></div>
                  <div><dt className="inline font-medium text-foreground">{t.interpretation}: </dt><dd className="inline text-muted-foreground">{k.interpretation}</dd></div>
                  {k.caution && <div><dt className="inline font-medium text-amber-600 dark:text-amber-400">{t.caution}: </dt><dd className="inline text-muted-foreground">{k.caution}</dd></div>}
                </dl>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-12 text-center text-muted-foreground">
      {icon}
      <p className="max-w-xs text-sm">{text}</p>
    </div>
  );
}

function SaveDialog({ t, onClose, onSave }: { t: Labels; onClose: () => void; onSave: (meta: { reportName: string; description: string; visibility: string }) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t.saveTitle}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">{t.reportName}</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={160} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">{t.description}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">{t.visibility}</label>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="private">{t.vis.private}</option><option value="project">{t.vis.project}</option><option value="organization">{t.vis.organization}</option>
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">{t.cancel}</button>
          <button type="button" disabled={!name.trim() || saving} onClick={async () => { setSaving(true); await onSave({ reportName: name, description, visibility }); }}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}{t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
