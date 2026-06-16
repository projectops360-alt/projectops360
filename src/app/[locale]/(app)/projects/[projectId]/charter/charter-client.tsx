"use client";

// ============================================================================
// Project Charter & Governance Center — living project foundation.
// Editable PMO sections, status lifecycle, completion %, version history.
// ============================================================================

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  FileText, ShieldCheck, Sparkles, Save, Loader2, AlertTriangle, CheckCircle2,
  Send, Stamp, XCircle, History, ScrollText, Target, ClipboardCheck, Landmark, Info,
  Users, GitBranch, Gavel, PenLine, BrainCircuit, ArrowRight,
} from "lucide-react";
import {
  CHARTER_SECTIONS, CHARTER_STATUS_META, CHARTER_LOCKED_STATUSES,
  computeCharterCompletion, type CharterFieldKey, type CharterStatus,
} from "@/lib/charter/fields";
import {
  updateCharterAction, submitCharterAction, approveCharterAction, rejectCharterAction,
  generateCharterDraftAction,
} from "./actions";
import {
  RolesTab, GovernanceRulesTab, ApprovalMatrixTab, SignoffTab, GovernanceAiTab,
  CharterQnA, StakeholderSummaryButton,
} from "./charter-extra";

interface CharterVersion { id: string; version: number; change_reason: string | null; created_at: string; }

interface Props {
  locale: string;
  projectId: string;
  projectName: string;
  charter: Record<string, unknown>;
  versions: CharterVersion[];
  roles: Record<string, unknown>[];
  rules: Record<string, unknown>[];
  approvals: Record<string, unknown>[];
  signoffs: Record<string, unknown>[];
  onboarding: boolean;
}

const SECTION_ICON: Record<string, typeof FileText> = {
  summary: FileText, scope: Target, deliverables: ClipboardCheck, governance: Landmark,
};

interface ExtraTab { key: string; es: string; en: string; icon: typeof FileText; }
const EXTRA_TABS: ExtraTab[] = [
  { key: "roles", es: "Roles", en: "Roles", icon: Users },
  { key: "approvals", es: "Matriz de Aprobación", en: "Approval Matrix", icon: Gavel },
  { key: "governance_rules", es: "Reglas de Gobernanza", en: "Governance Rules", icon: GitBranch },
  { key: "signoff", es: "Firmas", en: "Sign-Off", icon: PenLine },
  { key: "ai", es: "IA y Control", en: "AI & Control", icon: BrainCircuit },
];

const TONE_BADGE: Record<string, string> = {
  gray: "bg-muted text-muted-foreground",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  green: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

export function CharterClient({ locale, projectId, projectName, charter, versions, roles, rules, approvals, signoffs, onboarding }: Props) {
  const isEs = locale === "es";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [activeKey, setActiveKey] = useState(CHARTER_SECTIONS[0].key);
  const [showHistory, setShowHistory] = useState(false);
  const isTextSection = CHARTER_SECTIONS.some((s) => s.key === activeKey);

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
  // First section that still has a missing required field — the link target.
  const firstIncompleteSection = useMemo(
    () => CHARTER_SECTIONS.find((s) => s.fields.some((f) => f.required && !values[f.key]?.trim())) ?? null,
    [values],
  );

  function goTo(sectionKey: string) {
    setActiveKey(sectionKey);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
  const doGenerate = () => start(async () => { await generateCharterDraftAction({ projectId, locale }); router.refresh(); });
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
            {!locked && (
              <button onClick={doGenerate} disabled={pending}
                title={isEs ? "Rellena los campos vacíos con IA" : "Fill empty fields with AI"}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-50 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-300">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{isEs ? "Generar con IA" : "Generate with AI"}
              </button>
            )}
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
            <Link href={`/projects/${projectId}/charter/summary`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
              <Users className="h-4 w-4" />{isEs ? "Vista stakeholders" : "Stakeholder view"}
            </Link>
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
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {isEs ? `Faltan ${completion.missing.length} campo(s) requerido(s) para poder aprobar el charter.` : `${completion.missing.length} required field(s) missing before the charter can be approved.`}
              {firstIncompleteSection && (
                <button onClick={() => goTo(firstIncompleteSection.key)} className="inline-flex items-center gap-0.5 font-semibold underline underline-offset-2 hover:opacity-80">
                  {isEs ? `Ir a «${firstIncompleteSection.es}»` : `Go to "${firstIncompleteSection.en}"`}<ArrowRight className="h-3 w-3" />
                </button>
              )}
            </p>
          )}
        </div>

        {/* Locked-charter execution note — with a direct CTA to the next step */}
        {!locked && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
            <span className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0" />
              {isEs ? "El proyecto debería tener el charter aprobado antes de iniciar la ejecución real." : "The project should have an approved charter before real execution begins."}
            </span>
            {firstIncompleteSection ? (
              <button onClick={() => goTo(firstIncompleteSection.key)}
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 font-semibold text-white transition-colors hover:bg-amber-700">
                {isEs ? `Completar «${firstIncompleteSection.es}»` : `Complete "${firstIncompleteSection.en}"`}<ArrowRight className="h-3 w-3" />
              </button>
            ) : canSubmit ? (
              <button onClick={doSubmit} disabled={pending}
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50">
                {isEs ? "Enviar a aprobación" : "Submit for approval"}<ArrowRight className="h-3 w-3" />
              </button>
            ) : canReview ? (
              <button onClick={doApprove} disabled={pending}
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50">
                {isEs ? "Aprobar charter" : "Approve charter"}<ArrowRight className="h-3 w-3" />
              </button>
            ) : null}
          </div>
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
          <div className="my-1 hidden border-t border-border/60 lg:block" />
          {EXTRA_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.key === activeKey;
            return (
              <button key={tab.key} onClick={() => setActiveKey(tab.key)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${active ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "text-muted-foreground hover:bg-muted"}`}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{isEs ? tab.es : tab.en}</span>
              </button>
            );
          })}
        </nav>

        {/* Editor / sub-modules */}
        {isTextSection ? (
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
        ) : activeKey === "ai" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5"><GovernanceAiTab projectId={projectId} locale={locale} /></div>
            <StakeholderSummaryButton projectId={projectId} locale={locale} />
            <CharterQnA projectId={projectId} locale={locale} />
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-5">
            {activeKey === "roles" && <RolesTab projectId={projectId} locale={locale} roles={roles} />}
            {activeKey === "approvals" && <ApprovalMatrixTab projectId={projectId} locale={locale} approvals={approvals} />}
            {activeKey === "governance_rules" && <GovernanceRulesTab projectId={projectId} locale={locale} rules={rules} />}
            {activeKey === "signoff" && <SignoffTab projectId={projectId} locale={locale} signoffs={signoffs} />}
          </div>
        )}
      </div>
    </div>
  );
}
