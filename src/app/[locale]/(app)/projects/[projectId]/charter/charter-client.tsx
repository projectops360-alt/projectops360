"use client";

// ============================================================================
// Project Charter & Governance Center — living project foundation.
// Editable PMO sections, status lifecycle, completion %, version history.
// ============================================================================

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, ShieldCheck, Sparkles, Save, Loader2, AlertTriangle, CheckCircle2,
  Send, Stamp, XCircle, History, ScrollText, Target, ClipboardCheck, Landmark, Info,
} from "lucide-react";
import {
  CHARTER_SECTIONS, CHARTER_STATUS_META, CHARTER_LOCKED_STATUSES,
  computeCharterCompletion, type CharterFieldKey, type CharterStatus,
} from "@/lib/charter/fields";
import {
  updateCharterAction, submitCharterAction, approveCharterAction, rejectCharterAction,
} from "./actions";

interface CharterVersion { id: string; version: number; change_reason: string | null; created_at: string; }

interface Props {
  locale: string;
  projectId: string;
  projectName: string;
  charter: Record<string, unknown>;
  versions: CharterVersion[];
  onboarding: boolean;
}

const SECTION_ICON: Record<string, typeof FileText> = {
  summary: FileText, scope: Target, deliverables: ClipboardCheck, governance: Landmark,
};

const TONE_BADGE: Record<string, string> = {
  gray: "bg-muted text-muted-foreground",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  green: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

export function CharterClient({ locale, projectId, projectName, charter, versions, onboarding }: Props) {
  const isEs = locale === "es";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [activeKey, setActiveKey] = useState(CHARTER_SECTIONS[0].key);
  const [showHistory, setShowHistory] = useState(false);

  const initial = useMemo(() => {
    const v: Record<string, string> = {};
    for (const s of CHARTER_SECTIONS) for (const f of s.fields) v[f.key] = (charter[f.key] as string) ?? "";
    return v;
  }, [charter]);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [savedFlash, setSavedFlash] = useState(false);

  const status = charter.status as CharterStatus;
  const version = charter.version as number;
  const meta = CHARTER_STATUS_META[status] ?? CHARTER_STATUS_META.draft;
  const locked = CHARTER_LOCKED_STATUSES.includes(status);

  const completion = useMemo(() => computeCharterCompletion(values as Partial<Record<CharterFieldKey, string>>), [values]);
  const dirty = useMemo(() => CHARTER_SECTIONS.some((s) => s.fields.some((f) => values[f.key] !== initial[f.key])), [values, initial]);

  const section = CHARTER_SECTIONS.find((s) => s.key === activeKey) ?? CHARTER_SECTIONS[0];

  function save() {
    const fields: Partial<Record<CharterFieldKey, string>> = {};
    for (const s of CHARTER_SECTIONS) for (const f of s.fields) {
      if (values[f.key] !== initial[f.key]) fields[f.key] = values[f.key];
    }
    if (Object.keys(fields).length === 0) return;
    start(async () => {
      const res = await updateCharterAction({ projectId, fields });
      if (!res.error) { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2000); router.refresh(); }
    });
  }
  const doSubmit = () => start(async () => { await submitCharterAction({ projectId }); router.refresh(); });
  const doApprove = () => start(async () => { await approveCharterAction({ projectId, locale }); router.refresh(); });
  const doReject = () => {
    const notes = window.prompt(isEs ? "Motivo del rechazo / revisión requerida:" : "Reason for rejection / revision required:") ?? undefined;
    start(async () => { await rejectCharterAction({ projectId, notes }); router.refresh(); });
  };

  const canSubmit = ["draft", "under_review", "revision_required"].includes(status);
  const canReview = ["pending_approval", "under_review"].includes(status);

  return (
    <div className="space-y-5">
      {/* Onboarding banner */}
      {onboarding && (
        <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/20 dark:bg-brand-500/5">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
          <p className="text-sm text-foreground">
            {isEs
              ? "Comienza definiendo la base del proyecto. Este charter vivo guiará la ejecución, la gobernanza, los reportes, la visibilidad para stakeholders y la memoria del proyecto."
              : "Start by defining the project foundation. This living charter will guide execution, governance, reporting, stakeholder visibility, and project memory."}
          </p>
        </div>
      )}

      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">
              <ShieldCheck className="h-4 w-4" />{isEs ? "Charter y Gobernanza" : "Charter & Governance"}
            </div>
            <h1 className="mt-1 truncate text-xl font-bold text-foreground">{projectName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold ${TONE_BADGE[meta.tone]}`}>
                {isEs ? meta.es : meta.en}
              </span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground">v{version}</span>
              <span className="text-muted-foreground">{completion.pct}% {isEs ? "completo" : "complete"}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {canSubmit && (
              <button onClick={doSubmit} disabled={pending || completion.pct < 100}
                title={completion.pct < 100 ? (isEs ? "Completa los campos requeridos primero" : "Complete required fields first") : ""}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50">
                <Send className="h-4 w-4" />{isEs ? "Enviar a aprobación" : "Submit for approval"}
              </button>
            )}
            {canReview && (
              <>
                <button onClick={doReject} disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30">
                  <XCircle className="h-4 w-4" />{isEs ? "Rechazar" : "Reject"}
                </button>
                <button onClick={doApprove} disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50">
                  <Stamp className="h-4 w-4" />{isEs ? "Aprobar charter" : "Approve charter"}
                </button>
              </>
            )}
            {locked && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 dark:bg-green-950/30 dark:text-green-300">
                <CheckCircle2 className="h-4 w-4" />{isEs ? "Aprobado" : "Approved"}
              </span>
            )}
            <button onClick={() => setShowHistory((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
              <History className="h-4 w-4" />{isEs ? "Versiones" : "Versions"}
            </button>
          </div>
        </div>

        {/* Completion bar */}
        <div className="mt-4">
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div className={`h-1.5 rounded-full transition-all ${completion.pct === 100 ? "bg-green-500" : "bg-brand-600"}`} style={{ width: `${completion.pct}%` }} />
          </div>
          {completion.missing.length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {isEs ? `Faltan ${completion.missing.length} campo(s) requerido(s) para poder aprobar el charter.` : `${completion.missing.length} required field(s) missing before the charter can be approved.`}
            </p>
          )}
        </div>

        {/* Locked-charter execution note */}
        {!locked && (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
            <Info className="h-3.5 w-3.5 shrink-0" />
            {isEs ? "El proyecto debería tener el charter aprobado antes de iniciar la ejecución real." : "The project should have an approved charter before real execution begins."}
          </p>
        )}
        {(charter.approval_notes as string) && (
          <p className="mt-2 text-xs text-muted-foreground"><strong>{isEs ? "Notas de revisión" : "Review notes"}:</strong> {charter.approval_notes as string}</p>
        )}
      </div>

      {/* Version history */}
      {showHistory && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground"><ScrollText className="h-4 w-4 text-brand-500" />{isEs ? "Historial de versiones" : "Version history"}</h3>
          {versions.length === 0 ? (
            <p className="text-xs text-muted-foreground">{isEs ? "Aún no hay versiones. Se crea una al aprobar el charter." : "No versions yet. One is created when the charter is approved."}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 border-b border-border/40 py-1.5 last:border-0">
                  <span className="font-medium text-foreground">v{v.version}</span>
                  <span className="flex-1 truncate text-muted-foreground">{v.change_reason ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleDateString(isEs ? "es-ES" : "en-US")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Body: section nav + editor */}
      <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
        {/* Section nav */}
        <nav className="flex flex-row gap-1 overflow-x-auto rounded-xl border border-border bg-card p-2 lg:flex-col">
          {CHARTER_SECTIONS.map((s) => {
            const Icon = SECTION_ICON[s.key] ?? FileText;
            const done = s.fields.filter((f) => f.required).every((f) => values[f.key]?.trim());
            const hasReq = s.fields.some((f) => f.required);
            const active = s.key === activeKey;
            return (
              <button key={s.key} onClick={() => setActiveKey(s.key)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${active ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "text-muted-foreground hover:bg-muted"}`}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{isEs ? s.es : s.en}</span>
                {hasReq && (done
                  ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                  : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />)}
              </button>
            );
          })}
        </nav>

        {/* Editor */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">{isEs ? section.es : section.en}</h2>
              <p className="text-xs text-muted-foreground">{isEs ? section.descEs : section.descEn}</p>
            </div>
            <button onClick={save} disabled={pending || !dirty}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : savedFlash ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {savedFlash ? (isEs ? "Guardado" : "Saved") : (isEs ? "Guardar" : "Save")}
            </button>
          </div>

          {locked && (
            <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0" />
              {isEs ? "El charter está aprobado. Editar abrirá una nueva revisión (versión nueva)." : "The charter is approved. Editing will open a new revision (new version)."}
            </p>
          )}

          <div className="space-y-4">
            {section.fields.map((f) => (
              <div key={f.key}>
                <label htmlFor={`f-${f.key}`} className="mb-1 block text-sm font-medium text-foreground">
                  {isEs ? f.es : f.en}
                  {f.required && <span className="ml-1 text-red-500">*</span>}
                </label>
                {(f.helpEs || f.helpEn) && (
                  <p className="mb-1 text-[11px] text-muted-foreground">{isEs ? f.helpEs : f.helpEn}</p>
                )}
                <textarea
                  id={`f-${f.key}`}
                  rows={f.key === "executive_summary" || f.key === "background" ? 4 : 3}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  placeholder={isEs ? "Escribe aquí…" : "Write here…"}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
