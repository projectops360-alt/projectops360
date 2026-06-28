"use client";

// ============================================================================
// CAP — Project Export & Blueprint Generator — Export modal (client)
// ============================================================================
// Two modes: Full Project Archive (as executed) and Starter Blueprint (clean
// reusable template). Shows what's included/excluded + a sensitivity warning,
// then downloads a .zip from the server route (which re-enforces RBAC).
// ============================================================================

import { useState } from "react";
import {
  Download, Archive, Sparkles, ShieldAlert, X, CheckCircle2, Lock,
} from "lucide-react";
import { canExportFullArchive, canExportBlueprint, type OrgRole } from "@/lib/project-export/rbac";

type Mode = "full_archive" | "starter_blueprint";

export function ExportProjectButton({ locale, projectId, role }: { locale: string; projectId: string; role: OrgRole }) {
  const [open, setOpen] = useState(false);
  const isEs = locale === "es";
  if (!canExportBlueprint(role)) return null; // viewers cannot export anything

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Download className="h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
          <div className="min-w-0 text-left">
            <p className="text-sm font-semibold text-foreground">{isEs ? "Exportar Proyecto" : "Export Project"}</p>
            <p className="text-[11px] text-muted-foreground">{isEs ? "Archivo completo o plantilla reutilizable" : "Full archive or reusable template"}</p>
          </div>
        </div>
      </button>
      {open && <ExportModal locale={locale} projectId={projectId} role={role} onClose={() => setOpen(false)} />}
    </>
  );
}

function ExportModal({ locale, projectId, role, onClose }: { locale: string; projectId: string; role: OrgRole; onClose: () => void }) {
  const isEs = locale === "es";
  const [mode, setMode] = useState<Mode>(canExportFullArchive(role) ? "full_archive" : "starter_blueprint");
  const [busy, setBusy] = useState(false);

  // Option state (defaults mirror the server defaults).
  const [full, setFull] = useState({ memory: true, transcripts: false, documents: true, audit: false, closeout: true, traceability: true });
  const [bp, setBp] = useState({ milestones: true, tasks: true, dependencies: true, roles: true, risks: true, docchecklist: true, lessons: false });

  const fullAllowed = canExportFullArchive(role);

  function doExport() {
    setBusy(true);
    const p = new URLSearchParams({ mode });
    if (mode === "full_archive") {
      p.set("memory", b(full.memory)); p.set("transcripts", b(full.transcripts)); p.set("documents", b(full.documents));
      p.set("audit", b(full.audit)); p.set("closeout", b(full.closeout)); p.set("traceability", b(full.traceability));
    } else {
      p.set("milestones", b(bp.milestones)); p.set("tasks", b(bp.tasks)); p.set("dependencies", b(bp.dependencies));
      p.set("roles", b(bp.roles)); p.set("risks", b(bp.risks)); p.set("docchecklist", b(bp.docchecklist)); p.set("lessons", b(bp.lessons));
    }
    const a = document.createElement("a");
    a.href = `/${locale}/projects/${projectId}/export?${p.toString()}`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // The browser handles the download; close shortly after.
    setTimeout(() => { setBusy(false); onClose(); }, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">{isEs ? "Exportar Proyecto" : "Export Project"}</h2>
            <p className="text-xs text-muted-foreground">{isEs ? "Elige cómo quieres exportar este proyecto." : "Choose how you want to export this project."}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ModeCard
            active={mode === "full_archive"} disabled={!fullAllowed}
            onClick={() => fullAllowed && setMode("full_archive")}
            icon={Archive} title={isEs ? "Archivo Completo" : "Full Project Archive"}
            desc={isEs ? "El proyecto ejecutado con documentación, memoria, trazabilidad, reportes, decisiones, riesgos y evidencia." : "The completed project with documentation, memory, traceability, reports, decisions, risks and evidence."}
            forList={isEs ? ["auditorías", "cierre", "documentación", "revisión de liderazgo"] : ["audits", "closeout", "documentation", "leadership review"]}
            lockedNote={!fullAllowed ? (isEs ? "Solo PMO/Admin/Owner" : "PMO/Admin/Owner only") : undefined}
          />
          <ModeCard
            active={mode === "starter_blueprint"} disabled={false}
            onClick={() => setMode("starter_blueprint")}
            icon={Sparkles} title={isEs ? "Plantilla (Blueprint)" : "Starter Blueprint"}
            desc={isEs ? "Una plantilla limpia y reutilizable a partir de la estructura del proyecto, sin datos históricos de ejecución." : "A clean reusable project template from this project's structure, without historical execution data."}
            forList={isEs ? ["proyectos similares", "simulaciones", "plantillas", "onboarding"] : ["similar projects", "simulations", "templates", "onboarding"]}
          />
        </div>

        {/* Options */}
        <div className="mt-4 rounded-xl border border-border p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{isEs ? "Opciones" : "Options"}</p>
          {mode === "full_archive" ? (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <Opt label={isEs ? "Incluir Project Memory" : "Include Project Memory"} checked={full.memory} onChange={(v) => setFull({ ...full, memory: v })} sensitive />
              <Opt label={isEs ? "Incluir transcripciones" : "Include transcripts"} checked={full.transcripts} onChange={(v) => setFull({ ...full, transcripts: v })} sensitive />
              <Opt label={isEs ? "Incluir documentos" : "Include documents"} checked={full.documents} onChange={(v) => setFull({ ...full, documents: v })} />
              <Opt label={isEs ? "Incluir trazabilidad" : "Include traceability"} checked={full.traceability} onChange={(v) => setFull({ ...full, traceability: v })} />
              <Opt label={isEs ? "Incluir Reporte de Cierre" : "Include Closeout Report"} checked={full.closeout} onChange={(v) => setFull({ ...full, closeout: v })} />
              <Opt label={isEs ? "Incluir registro de auditoría" : "Include audit trail"} checked={full.audit} onChange={(v) => setFull({ ...full, audit: v })} sensitive />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <Opt label={isEs ? "Mantener hitos/fases" : "Keep milestone structure"} checked={bp.milestones} onChange={(v) => setBp({ ...bp, milestones: v })} />
              <Opt label={isEs ? "Mantener tareas" : "Keep task structure"} checked={bp.tasks} onChange={(v) => setBp({ ...bp, tasks: v })} />
              <Opt label={isEs ? "Mantener dependencias" : "Keep dependency structure"} checked={bp.dependencies} onChange={(v) => setBp({ ...bp, dependencies: v })} />
              <Opt label={isEs ? "Mantener roles" : "Keep role structure"} checked={bp.roles} onChange={(v) => setBp({ ...bp, roles: v })} />
              <Opt label={isEs ? "Mantener plantillas de riesgo" : "Keep risk templates"} checked={bp.risks} onChange={(v) => setBp({ ...bp, risks: v })} />
              <Opt label={isEs ? "Mantener checklist de documentos" : "Keep document checklist"} checked={bp.docchecklist} onChange={(v) => setBp({ ...bp, docchecklist: v })} />
              <Opt label={isEs ? "Incluir lecciones aprendidas" : "Include lessons learned"} checked={bp.lessons} onChange={(v) => setBp({ ...bp, lessons: v })} sensitive />
            </div>
          )}
        </div>

        {/* Sensitivity / privacy note */}
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {mode === "full_archive"
            ? (isEs ? "El archivo completo contiene evidencia y datos sensibles. La exportación es de solo lectura y queda registrada en auditoría." : "The full archive contains sensitive evidence. Export is read-only and is recorded in the audit log.")
            : (isEs ? "La plantilla reinicia estados a planificado, borra fechas, convierte responsables en roles y elimina memoria/transcripciones por defecto." : "The blueprint resets statuses to planned, blanks dates, converts owners to roles, and removes raw memory/transcripts by default.")}
        </p>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">{isEs ? "Cancelar" : "Cancel"}</button>
          <button type="button" onClick={doExport} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            <Download className="h-4 w-4" />
            {busy ? (isEs ? "Generando…" : "Generating…") : (isEs ? "Exportar" : "Export")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeCard({ active, disabled, onClick, icon: Icon, title, desc, forList, lockedNote }: {
  active: boolean; disabled: boolean; onClick: () => void; icon: typeof Archive; title: string; desc: string; forList: string[]; lockedNote?: string;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className={`flex flex-col rounded-xl border p-3 text-left transition-colors ${
        active ? "border-brand-400 bg-brand-50/60 dark:bg-brand-500/10" : "border-border hover:border-brand-300"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {active && <CheckCircle2 className="ml-auto h-4 w-4 text-brand-600 dark:text-brand-400" />}
        {lockedNote && <Lock className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{desc}</p>
      <p className="mt-1.5 text-[10px] text-muted-foreground"><span className="font-medium">{forList.join(" · ")}</span></p>
      {lockedNote && <p className="mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">{lockedNote}</p>}
    </button>
  );
}

function Opt({ label, checked, onChange, sensitive }: { label: string; checked: boolean; onChange: (v: boolean) => void; sensitive?: boolean }) {
  return (
    <label className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs text-foreground hover:bg-muted/40">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 rounded border-border accent-brand-600" />
      <span>{label}</span>
      {sensitive && <span className="ml-auto rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-semibold uppercase text-amber-700 dark:text-amber-400">sensitive</span>}
    </label>
  );
}

const b = (v: boolean) => (v ? "1" : "0");
