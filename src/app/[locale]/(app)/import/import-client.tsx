"use client";

// ============================================================================
// Project Import Intelligence — Wizard Client
// ============================================================================
// Upload → Analyze → Review (tabs with enable/disable per row) → Import →
// Done. Nothing is imported without preview and explicit approval.
// ============================================================================

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle,
  XCircle, Sparkles, ArrowRight, RotateCcw, Ban, Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createImportJobAction,
  analyzeImportJobAction,
  getImportJobAction,
  toggleImportEntityAction,
  executeImportAction,
  listProjectsForImportAction,
} from "./actions";
import type { Locale } from "@/types/database";
import type {
  ProjectImportJob,
  ProjectImportEntity,
  ProjectImportValidationResult,
  ImportEntityType,
} from "@/types/import-intelligence";

// ── Bilingual labels ────────────────────────────────────────────────────────

const LABELS = {
  en: {
    title: "Project Import Intelligence",
    subtitle: "Upload an existing project file and ProjectOps360° will analyze it, extract tasks, milestones, resources, materials, budget, risks, and dependencies, and prepare it for review before importing.",
    dropHint: "Drop a file here or click to browse",
    formats: "Supported: Excel (.xlsx), CSV, JSON, Word (.docx), PDF, TXT, Markdown — up to 25 MB",
    mode: "Import mode",
    modeCreate: "Create new project",
    modeMerge: "Merge into existing project",
    targetProject: "Target project",
    projectType: "Project type",
    analyze: "Analyze file",
    analyzing: "Analyzing… extracting tasks, milestones, materials, budget and risks",
    uploading: "Uploading…",
    reviewTitle: "Review before importing",
    found: (c: Record<string, number>) =>
      `ProjectOps360° found ${c.tasks ?? 0} tasks, ${c.milestones ?? 0} milestones, ${c.dependencies ?? 0} dependencies, ${c.resources ?? 0} resources, ${c.materials ?? 0} materials, ${c.budget_items ?? 0} budget lines, and ${c.risks ?? 0} risks. Review the extracted data before importing.`,
    tabs: { summary: "Summary", task: "Tasks", milestone: "Milestones", dependency: "Dependencies", resource: "Resources", material: "Materials", budget_item: "Budget", risk: "Risks", warnings: "Warnings", raw: "Raw data" },
    colInclude: "Import",
    colName: "Name",
    colDetails: "Details",
    colConfidence: "Confidence",
    colStatus: "Status",
    colSource: "Source",
    statusLabels: { valid: "Valid", needs_review: "Needs review", invalid: "Invalid", duplicate: "Duplicate", missing_required_data: "Missing data" } as Record<string, string>,
    approve: "Approve & import",
    importing: "Importing…",
    cancel: "Start over",
    doneTitle: "Import completed",
    openProject: "Open project",
    skipped: (n: number) => `${n} duplicate record(s) were skipped.`,
    cpYes: "Critical path was calculated automatically.",
    cpNo: "Critical path could not be fully calculated because some tasks are missing durations or dependencies.",
    recommendations: "AI recommendations",
    detected: "Detected project type",
    errors: {
      unsupported_file_type: "Unsupported file type.",
      file_too_large: "The file exceeds the 25 MB limit.",
      empty_file: "The file is empty.",
      invalid_json: "The JSON file is not valid.",
      corrupted_file: "The file could not be read. It may be corrupted or password-protected.",
      no_extractable_content: "No project data could be extracted from this file.",
      upload_failed: "Upload failed. Try again.",
      project_required: "Select a target project for merge mode.",
      blocker_unresolved: "Resolve the blocking issues (e.g. disable circular dependencies) before importing.",
      import_failed: "Import failed and was rolled back. No partial data was left behind.",
      unexpected: "Something unexpected happened. Try again.",
    } as Record<string, string>,
  },
  es: {
    title: "Importación Inteligente de Proyectos",
    subtitle: "Sube un archivo de proyecto existente y ProjectOps360° lo analizará, extraerá tareas, hitos, recursos, materiales, presupuesto, riesgos y dependencias, y lo preparará para revisión antes de importar.",
    dropHint: "Arrastra un archivo aquí o haz clic para buscar",
    formats: "Soportados: Excel (.xlsx), CSV, JSON, Word (.docx), PDF, TXT, Markdown — hasta 25 MB",
    mode: "Modo de importación",
    modeCreate: "Crear proyecto nuevo",
    modeMerge: "Fusionar con proyecto existente",
    targetProject: "Proyecto destino",
    projectType: "Tipo de proyecto",
    analyze: "Analizar archivo",
    analyzing: "Analizando… extrayendo tareas, hitos, materiales, presupuesto y riesgos",
    uploading: "Subiendo…",
    reviewTitle: "Revisa antes de importar",
    found: (c: Record<string, number>) =>
      `ProjectOps360° encontró ${c.tasks ?? 0} tareas, ${c.milestones ?? 0} hitos, ${c.dependencies ?? 0} dependencias, ${c.resources ?? 0} recursos, ${c.materials ?? 0} materiales, ${c.budget_items ?? 0} partidas de presupuesto y ${c.risks ?? 0} riesgos. Revisa los datos extraídos antes de importar.`,
    tabs: { summary: "Resumen", task: "Tareas", milestone: "Hitos", dependency: "Dependencias", resource: "Recursos", material: "Materiales", budget_item: "Presupuesto", risk: "Riesgos", warnings: "Advertencias", raw: "Datos crudos" },
    colInclude: "Importar",
    colName: "Nombre",
    colDetails: "Detalles",
    colConfidence: "Confianza",
    colStatus: "Estado",
    colSource: "Origen",
    statusLabels: { valid: "Válido", needs_review: "Por revisar", invalid: "Inválido", duplicate: "Duplicado", missing_required_data: "Faltan datos" } as Record<string, string>,
    approve: "Aprobar e importar",
    importing: "Importando…",
    cancel: "Empezar de nuevo",
    doneTitle: "Importación completada",
    openProject: "Abrir proyecto",
    skipped: (n: number) => `Se omitieron ${n} registro(s) duplicado(s).`,
    cpYes: "La ruta crítica se calculó automáticamente.",
    cpNo: "La ruta crítica no pudo calcularse por completo porque algunas tareas no tienen duración o dependencias.",
    recommendations: "Recomendaciones de IA",
    detected: "Tipo de proyecto detectado",
    errors: {
      unsupported_file_type: "Tipo de archivo no soportado.",
      file_too_large: "El archivo supera el límite de 25 MB.",
      empty_file: "El archivo está vacío.",
      invalid_json: "El archivo JSON no es válido.",
      corrupted_file: "No se pudo leer el archivo. Puede estar dañado o protegido con contraseña.",
      no_extractable_content: "No se pudieron extraer datos de proyecto de este archivo.",
      upload_failed: "Falló la subida. Intenta de nuevo.",
      project_required: "Selecciona un proyecto destino para el modo fusión.",
      blocker_unresolved: "Resuelve los bloqueos (p. ej. desactiva dependencias circulares) antes de importar.",
      import_failed: "La importación falló y se revirtió. No quedaron datos parciales.",
      unexpected: "Ocurrió algo inesperado. Intenta de nuevo.",
    } as Record<string, string>,
  },
};

const PROJECT_TYPES = [
  "general", "software_development", "data_center_construction",
  "residential_construction", "commercial_construction", "infrastructure", "industrial",
];

const TYPE_LABELS: Record<string, { en: string; es: string }> = {
  general: { en: "General", es: "General" },
  software_development: { en: "Software Development", es: "Desarrollo de Software" },
  data_center_construction: { en: "Data Center Construction", es: "Centro de Datos" },
  residential_construction: { en: "Residential Construction", es: "Construcción Residencial" },
  commercial_construction: { en: "Commercial Construction", es: "Construcción Comercial" },
  infrastructure: { en: "Infrastructure", es: "Infraestructura" },
  industrial: { en: "Industrial", es: "Industrial" },
};

type Step = "upload" | "analyzing" | "review" | "importing" | "done";

const ENTITY_TABS: ImportEntityType[] = ["task", "milestone", "dependency", "resource", "material", "budget_item", "risk"];

// ── Component ───────────────────────────────────────────────────────────────

export function ImportClient({
  locale,
  organizationId,
  preselectedProjectId,
}: {
  locale: Locale;
  organizationId: string;
  preselectedProjectId: string | null;
}) {
  const t = LABELS[locale] ?? LABELS.en;
  const router = useRouter();

  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"create_new" | "merge_existing">(preselectedProjectId ? "merge_existing" : "create_new");
  const [targetProjectId, setTargetProjectId] = useState<string>(preselectedProjectId ?? "");
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<ProjectImportJob | null>(null);
  const [entities, setEntities] = useState<ProjectImportEntity[]>([]);
  const [validations, setValidations] = useState<ProjectImportValidationResult[]>([]);
  const [activeTab, setActiveTab] = useState<string>("summary");
  const [selectedType, setSelectedType] = useState<string>("general");
  const [result, setResult] = useState<{ projectId: string; created: Record<string, number>; skippedDuplicates: number; criticalPathCalculated: boolean } | null>(null);

  useEffect(() => {
    listProjectsForImportAction().then((res) => setProjects(res.projects ?? []));
  }, []);

  const refreshJob = useCallback(async (jobId: string) => {
    const res = await getImportJobAction({ jobId });
    if (res.job) {
      setJob(res.job);
      setEntities(res.entities ?? []);
      setValidations(res.validations ?? []);
      setSelectedType(res.job.selected_project_type ?? res.job.detected_project_type ?? "general");
    }
  }, []);

  // ── Upload + analyze ──────────────────────────────────────────────────────
  async function handleAnalyze() {
    if (!file) return;
    if (mode === "merge_existing" && !targetProjectId) {
      setError(t.errors.project_required);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^\w.\- ()]/g, "_");
      const storagePath = `project-imports/${organizationId}/${crypto.randomUUID()}/${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("project-imports")
        .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) {
        setError(t.errors.upload_failed);
        setBusy(false);
        return;
      }

      const createRes = await createImportJobAction({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        storagePath,
        importMode: mode,
        projectId: mode === "merge_existing" ? targetProjectId : null,
      });
      if (createRes.error || !createRes.jobId) {
        setError(t.errors[createRes.error ?? "unexpected"] ?? t.errors.unexpected);
        setBusy(false);
        return;
      }

      setStep("analyzing");
      const analyzeRes = await analyzeImportJobAction({ jobId: createRes.jobId });
      if (analyzeRes.error) {
        setError(t.errors[analyzeRes.error] ?? analyzeRes.error);
        setStep("upload");
        setBusy(false);
        return;
      }
      await refreshJob(createRes.jobId);
      setStep("review");
    } finally {
      setBusy(false);
    }
  }

  // ── Toggle row ────────────────────────────────────────────────────────────
  async function handleToggle(entity: ProjectImportEntity) {
    const next = !entity.will_import;
    setEntities((prev) => prev.map((e) => (e.id === entity.id ? { ...e, will_import: next } : e)));
    await toggleImportEntityAction({ entityId: entity.id, willImport: next });
  }

  // ── Execute ───────────────────────────────────────────────────────────────
  async function handleImport() {
    if (!job) return;
    setError(null);
    setStep("importing");
    const res = await executeImportAction({ jobId: job.id, selectedProjectType: selectedType });
    if (res.error || !res.projectId) {
      setError(t.errors[res.error ?? "unexpected"] ?? t.errors.unexpected);
      setStep("review");
      return;
    }
    setResult({
      projectId: res.projectId,
      created: res.created ?? {},
      skippedDuplicates: res.skippedDuplicates ?? 0,
      criticalPathCalculated: res.criticalPathCalculated ?? false,
    });
    setStep("done");
  }

  const counts = (job?.summary_json as { counts?: Record<string, number> })?.counts ?? {};
  const recommendations = validations.filter((v) => v.validation_type.startsWith("recommendation:"));
  const warnings = validations.filter((v) => !v.validation_type.startsWith("recommendation:"));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Sparkles className="h-6 w-6 text-brand-500" />
          {t.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Step: Upload ── */}
      {step === "upload" && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border px-6 py-12 text-center transition-colors hover:border-brand-400 hover:bg-muted/30">
            <input
              type="file"
              className="hidden"
              accept=".xlsx,.xlsm,.csv,.json,.docx,.pdf,.txt,.md"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={busy}
            />
            {file ? (
              <>
                <FileSpreadsheet className="h-10 w-10 text-brand-500" />
                <span className="text-sm font-medium text-foreground">{file.name}</span>
                <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
              </>
            ) : (
              <>
                <UploadCloud className="h-10 w-10 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{t.dropHint}</span>
                <span className="text-xs text-muted-foreground">{t.formats}</span>
              </>
            )}
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">{t.mode}</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none"
                disabled={busy}
              >
                <option value="create_new">{t.modeCreate}</option>
                <option value="merge_existing">{t.modeMerge}</option>
              </select>
            </div>
            {mode === "merge_existing" && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">{t.targetProject}</label>
                <select
                  value={targetProjectId}
                  onChange={(e) => setTargetProjectId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none"
                  disabled={busy}
                >
                  <option value="">—</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!file || busy}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {busy ? t.uploading : t.analyze}
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Analyzing ── */}
      {step === "analyzing" && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          <p className="text-sm text-muted-foreground">{t.analyzing}</p>
        </div>
      )}

      {/* ── Step: Review ── */}
      {(step === "review" || step === "importing") && job && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm text-foreground">{t.found(counts)}</p>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-muted-foreground">
                  {t.detected}: <span className="font-semibold">{TYPE_LABELS[job.detected_project_type ?? "general"]?.[locale]}</span>
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-brand-500 focus:outline-none"
                  disabled={step === "importing"}
                >
                  {PROJECT_TYPES.map((pt) => (
                    <option key={pt} value={pt}>{TYPE_LABELS[pt][locale]}</option>
                  ))}
                </select>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setStep("upload"); setFile(null); setJob(null); setError(null); }}
                  disabled={step === "importing"}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <RotateCcw className="h-4 w-4" />
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={step === "importing"}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {step === "importing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {step === "importing" ? t.importing : t.approve}
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1 border-b border-border">
            {["summary", ...ENTITY_TABS, "warnings", "raw"].map((tab) => {
              const count =
                tab === "warnings"
                  ? warnings.length
                  : ENTITY_TABS.includes(tab as ImportEntityType)
                    ? entities.filter((e) => e.entity_type === tab).length
                    : null;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.tabs[tab as keyof typeof t.tabs] ?? tab}
                  {count != null && count > 0 && <span className="ml-1 text-xs text-muted-foreground">({count})</span>}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          {activeTab === "summary" && (
            <div className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Object.entries(counts).map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-border p-3 text-center">
                    <div className="text-xl font-bold text-foreground">{v}</div>
                    <div className="text-xs text-muted-foreground">{t.tabs[k.replace(/s$/, "") as keyof typeof t.tabs] ?? k.replace(/_/g, " ")}</div>
                  </div>
                ))}
              </div>
              {warnings.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{warnings[0].message}{warnings.length > 1 ? ` (+${warnings.length - 1})` : ""}</span>
                </div>
              )}
            </div>
          )}

          {ENTITY_TABS.includes(activeTab as ImportEntityType) && (
            <EntityTable
              entities={entities.filter((e) => e.entity_type === activeTab)}
              onToggle={handleToggle}
              t={t}
              disabled={step === "importing"}
            />
          )}

          {activeTab === "warnings" && (
            <div className="space-y-2">
              {warnings.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">—</p>}
              {warnings.map((w) => (
                <div
                  key={w.id}
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                    w.severity === "blocker" || w.severity === "error"
                      ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                      : w.severity === "warning"
                        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                        : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {w.severity === "blocker" ? <Ban className="mt-0.5 h-4 w-4 shrink-0" /> : w.severity === "info" ? <Info className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                  <div>
                    <p>{w.message}</p>
                    {w.recommended_action && <p className="mt-0.5 text-xs opacity-80">{w.recommended_action}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "raw" && (
            <pre className="max-h-96 overflow-auto rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
              {JSON.stringify(job.summary_json, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* ── Step: Done ── */}
      {step === "done" && result && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            {t.doneTitle}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(result.created).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border p-3 text-center">
                <div className="text-xl font-bold text-foreground">{v}</div>
                <div className="text-xs text-muted-foreground">{k.replace(/_/g, " ")}</div>
              </div>
            ))}
          </div>
          {result.skippedDuplicates > 0 && (
            <p className="text-sm text-muted-foreground">{t.skipped(result.skippedDuplicates)}</p>
          )}
          <p className={`text-sm ${result.criticalPathCalculated ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
            {result.criticalPathCalculated ? t.cpYes : t.cpNo}
          </p>
          {recommendations.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">{t.recommendations}</p>
              {recommendations.map((r) => (
                <div key={r.id} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                  {r.message}
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => router.push(`/${locale}/projects/${result.projectId}/execution-map`)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              {t.openProject}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Entity review table ─────────────────────────────────────────────────────

function EntityTable({
  entities,
  onToggle,
  t,
  disabled,
}: {
  entities: ProjectImportEntity[];
  onToggle: (e: ProjectImportEntity) => void;
  t: (typeof LABELS)["en"];
  disabled: boolean;
}) {
  if (entities.length === 0) {
    return <p className="px-2 py-6 text-center text-sm text-muted-foreground">—</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2">{t.colInclude}</th>
            <th className="px-3 py-2">{t.colName}</th>
            <th className="px-3 py-2">{t.colDetails}</th>
            <th className="px-3 py-2">{t.colConfidence}</th>
            <th className="px-3 py-2">{t.colStatus}</th>
            <th className="px-3 py-2">{t.colSource}</th>
          </tr>
        </thead>
        <tbody>
          {entities.map((e) => {
            const n = e.normalized_json as Record<string, unknown>;
            const name = String(n.name ?? n.title ?? e.source_key ?? "—");
            const details = entityDetails(e);
            const conf = e.confidence_score != null ? Math.round(e.confidence_score * 100) : null;
            return (
              <tr key={e.id} className={`border-b border-border last:border-0 ${e.will_import ? "" : "opacity-45"}`}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={e.will_import}
                    onChange={() => onToggle(e)}
                    disabled={disabled || e.validation_status === "invalid"}
                    className="h-4 w-4 rounded border-border accent-brand-600"
                  />
                </td>
                <td className="max-w-[260px] truncate px-3 py-2 font-medium text-foreground" title={name}>{name}</td>
                <td className="max-w-[280px] truncate px-3 py-2 text-muted-foreground" title={details}>{details}</td>
                <td className="px-3 py-2">
                  {conf != null && (
                    <span className={conf >= 70 ? "text-green-600 dark:text-green-400" : conf >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}>
                      {conf}%
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      e.validation_status === "valid"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : e.validation_status === "invalid"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}
                  >
                    {t.statusLabels[e.validation_status] ?? e.validation_status}
                  </span>
                </td>
                <td className="max-w-[180px] truncate px-3 py-2 text-xs text-muted-foreground" title={e.source_reference ?? ""}>
                  {e.source_reference}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function entityDetails(e: ProjectImportEntity): string {
  const n = e.normalized_json as Record<string, unknown>;
  switch (e.entity_type) {
    case "task": {
      const parts = [];
      if (n.assigned_to) parts.push(`→ ${n.assigned_to}`);
      if (n.planned_start || n.planned_finish) parts.push(`${n.planned_start ?? "?"} → ${n.planned_finish ?? "?"}`);
      if (n.duration_days != null) parts.push(`${n.duration_days}d`);
      return parts.join(" · ");
    }
    case "dependency":
      return `${n.predecessor_source_id} → ${n.successor_source_id}${n.inferred ? " (inferred)" : ""}`;
    case "material":
      return [n.quantity != null ? `${n.quantity} ${n.unit ?? ""}`.trim() : null, n.supplier].filter(Boolean).join(" · ");
    case "budget_item":
      return n.estimated_cost != null ? `$${Number(n.estimated_cost).toLocaleString()}` : "";
    case "risk":
      return `P:${n.probability} / I:${n.impact}`;
    case "resource":
      return String(n.resource_type ?? "");
    case "milestone":
      return String(n.target_date ?? "");
    default:
      return "";
  }
}
