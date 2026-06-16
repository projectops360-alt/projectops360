"use client";

// ============================================================================
// Charter sub-modules: Roles · Governance Rules · Approval Matrix · Sign-Off,
// plus AI tools (Gap Analysis, Scope Creep, Q&A, Stakeholder Summary).
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Sparkles, Stamp, CheckCircle2, XCircle, Search, MessageSquareText, AlertTriangle, Send } from "lucide-react";
import {
  saveCharterRoleAction, saveGovernanceRuleAction, saveApprovalRuleAction, saveSignoffAction,
  deleteCharterChildAction, gapAnalysisAction, scopeCreepAction, stakeholderSummaryAction, askCharterAction,
} from "./actions";

export const ROLE_OPTIONS = ["Project Sponsor", "Project Manager", "Steering Committee", "PMO", "Team Lead", "Work Team", "Vendor / Consultant", "Stakeholder"];
export const RULE_TYPES = ["Issue Management", "Change Management", "Risk Management", "Quality Management", "Communication Management", "Status Reporting", "Stakeholder Review", "Budget Control", "Schedule Control"];
export const APPROVAL_AREAS = ["Scope change", "Budget change", "Schedule change", "Risk acceptance", "Major issue escalation", "Vendor change", "Milestone acceptance", "Project closure"];

const inputCls = "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";
const cell = (v: unknown) => (v ? String(v) : "—");

function AddBtn({ onClick, pending, label }: { onClick: () => void; pending: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{label}
    </button>
  );
}

// ── Roles ───────────────────────────────────────────────────────────────────

export function RolesTab({ projectId, locale, roles }: { projectId: string; locale: string; roles: Record<string, unknown>[] }) {
  const isEs = locale === "es";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ role_name: ROLE_OPTIONS[0], person_name: "", responsibility: "", authority_level: "", decision_rights: "" });
  const add = () => { if (!f.role_name.trim()) return; start(async () => { await saveCharterRoleAction({ projectId, ...f }); setF({ role_name: ROLE_OPTIONS[0], person_name: "", responsibility: "", authority_level: "", decision_rights: "" }); router.refresh(); }); };
  const del = (id: string) => start(async () => { await deleteCharterChildAction({ projectId, table: "project_charter_roles", id }); router.refresh(); });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{isEs ? "Define quién patrocina, dirige, decide y escala en el proyecto." : "Define who sponsors, leads, decides and escalates in the project."}</p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-3 py-2 text-left">{isEs ? "Rol" : "Role"}</th><th className="px-3 py-2 text-left">{isEs ? "Persona" : "Person"}</th><th className="px-3 py-2 text-left">{isEs ? "Responsabilidad" : "Responsibility"}</th><th className="px-3 py-2 text-left">{isEs ? "Autoridad" : "Authority"}</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={String(r.id)} className="border-t border-border/50">
                <td className="px-3 py-2 font-medium text-foreground">{cell(r.role_name)}</td>
                <td className="px-3 py-2 text-muted-foreground">{cell(r.person_name || r.external_contact_name)}</td>
                <td className="px-3 py-2 text-muted-foreground">{cell(r.responsibility)}</td>
                <td className="px-3 py-2 text-muted-foreground">{cell(r.authority_level)}</td>
                <td className="px-3 py-2 text-right"><button onClick={() => del(String(r.id))} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
            {roles.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-xs text-muted-foreground">{isEs ? "Sin roles definidos." : "No roles defined."}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <select className={inputCls} value={f.role_name} onChange={(e) => setF({ ...f, role_name: e.target.value })}>{ROLE_OPTIONS.map((o) => <option key={o}>{o}</option>)}</select>
        <input className={inputCls} placeholder={isEs ? "Persona" : "Person"} value={f.person_name} onChange={(e) => setF({ ...f, person_name: e.target.value })} />
        <input className={inputCls} placeholder={isEs ? "Responsabilidad" : "Responsibility"} value={f.responsibility} onChange={(e) => setF({ ...f, responsibility: e.target.value })} />
        <input className={inputCls} placeholder={isEs ? "Autoridad" : "Authority"} value={f.authority_level} onChange={(e) => setF({ ...f, authority_level: e.target.value })} />
        <AddBtn onClick={add} pending={pending} label={isEs ? "Agregar" : "Add"} />
      </div>
    </div>
  );
}

// ── Governance rules ────────────────────────────────────────────────────────

export function GovernanceRulesTab({ projectId, locale, rules }: { projectId: string; locale: string; rules: Record<string, unknown>[] }) {
  const isEs = locale === "es";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ rule_type: RULE_TYPES[0], rule_name: "", description: "", required_approval_role: "", escalation_role: "" });
  const add = () => { if (!f.rule_name.trim()) return; start(async () => { await saveGovernanceRuleAction({ projectId, ...f }); setF({ rule_type: RULE_TYPES[0], rule_name: "", description: "", required_approval_role: "", escalation_role: "" }); router.refresh(); }); };
  const del = (id: string) => start(async () => { await deleteCharterChildAction({ projectId, table: "project_governance_rules", id }); router.refresh(); });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{isEs ? "Reglas que gobiernan la ejecución (escalamiento, aprobaciones, cadencias)." : "Rules that govern execution (escalation, approvals, cadences)."}</p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-3 py-2 text-left">{isEs ? "Tipo" : "Type"}</th><th className="px-3 py-2 text-left">{isEs ? "Regla" : "Rule"}</th><th className="px-3 py-2 text-left">{isEs ? "Aprobación" : "Approval"}</th><th className="px-3 py-2 text-left">{isEs ? "Escalamiento" : "Escalation"}</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={String(r.id)} className="border-t border-border/50">
                <td className="px-3 py-2"><span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{cell(r.rule_type)}</span></td>
                <td className="px-3 py-2 font-medium text-foreground">{cell(r.rule_name)}<div className="text-[11px] text-muted-foreground">{cell(r.description)}</div></td>
                <td className="px-3 py-2 text-muted-foreground">{cell(r.required_approval_role)}</td>
                <td className="px-3 py-2 text-muted-foreground">{cell(r.escalation_role)}</td>
                <td className="px-3 py-2 text-right"><button onClick={() => del(String(r.id))} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
            {rules.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-xs text-muted-foreground">{isEs ? "Sin reglas definidas." : "No rules defined."}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <select className={inputCls} value={f.rule_type} onChange={(e) => setF({ ...f, rule_type: e.target.value })}>{RULE_TYPES.map((o) => <option key={o}>{o}</option>)}</select>
        <input className={inputCls} placeholder={isEs ? "Nombre de la regla" : "Rule name"} value={f.rule_name} onChange={(e) => setF({ ...f, rule_name: e.target.value })} />
        <input className={inputCls} placeholder={isEs ? "Rol que aprueba" : "Approval role"} value={f.required_approval_role} onChange={(e) => setF({ ...f, required_approval_role: e.target.value })} />
        <input className={inputCls} placeholder={isEs ? "Rol de escalamiento" : "Escalation role"} value={f.escalation_role} onChange={(e) => setF({ ...f, escalation_role: e.target.value })} />
        <AddBtn onClick={add} pending={pending} label={isEs ? "Agregar" : "Add"} />
      </div>
    </div>
  );
}

// ── Approval matrix ─────────────────────────────────────────────────────────

export function ApprovalMatrixTab({ projectId, locale, approvals }: { projectId: string; locale: string; approvals: Record<string, unknown>[] }) {
  const isEs = locale === "es";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ approval_area: APPROVAL_AREAS[0], approval_required_from: "", threshold_type: "", threshold_value: "", required_response_time: "" });
  const add = () => start(async () => { await saveApprovalRuleAction({ projectId, ...f }); setF({ approval_area: APPROVAL_AREAS[0], approval_required_from: "", threshold_type: "", threshold_value: "", required_response_time: "" }); router.refresh(); });
  const del = (id: string) => start(async () => { await deleteCharterChildAction({ projectId, table: "project_approval_matrix", id }); router.refresh(); });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{isEs ? "Quién aprueba qué, umbrales y tiempos de respuesta." : "Who approves what, thresholds and response times."}</p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-3 py-2 text-left">{isEs ? "Área" : "Area"}</th><th className="px-3 py-2 text-left">{isEs ? "Aprueba" : "Approved by"}</th><th className="px-3 py-2 text-left">{isEs ? "Umbral" : "Threshold"}</th><th className="px-3 py-2 text-left">{isEs ? "Respuesta" : "Response"}</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {approvals.map((r) => (
              <tr key={String(r.id)} className="border-t border-border/50">
                <td className="px-3 py-2 font-medium text-foreground">{cell(r.approval_area)}</td>
                <td className="px-3 py-2 text-muted-foreground">{cell(r.approval_required_from)}</td>
                <td className="px-3 py-2 text-muted-foreground">{[cell(r.threshold_type), r.threshold_value ? String(r.threshold_value) : ""].filter((x) => x && x !== "—").join(": ") || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{cell(r.required_response_time)}</td>
                <td className="px-3 py-2 text-right"><button onClick={() => del(String(r.id))} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
            {approvals.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-xs text-muted-foreground">{isEs ? "Sin reglas de aprobación." : "No approval rules."}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <select className={inputCls} value={f.approval_area} onChange={(e) => setF({ ...f, approval_area: e.target.value })}>{APPROVAL_AREAS.map((o) => <option key={o}>{o}</option>)}</select>
        <input className={inputCls} placeholder={isEs ? "Aprobado por" : "Approved by"} value={f.approval_required_from} onChange={(e) => setF({ ...f, approval_required_from: e.target.value })} />
        <input className={inputCls} placeholder={isEs ? "Umbral (ej. >10%)" : "Threshold (e.g. >10%)"} value={f.threshold_value} onChange={(e) => setF({ ...f, threshold_value: e.target.value })} />
        <input className={inputCls} placeholder={isEs ? "Tiempo de respuesta" : "Response time"} value={f.required_response_time} onChange={(e) => setF({ ...f, required_response_time: e.target.value })} />
        <AddBtn onClick={add} pending={pending} label={isEs ? "Agregar" : "Add"} />
      </div>
    </div>
  );
}

// ── Sign-off ────────────────────────────────────────────────────────────────

export function SignoffTab({ projectId, locale, signoffs }: { projectId: string; locale: string; signoffs: Record<string, unknown>[] }) {
  const isEs = locale === "es";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [role, setRole] = useState(ROLE_OPTIONS[0]);
  const request = () => start(async () => { await saveSignoffAction({ projectId, signer_role: role, status: "pending" }); router.refresh(); });
  const sign = (id: string, status: "approved" | "rejected") => {
    const comments = status === "rejected" ? (window.prompt(isEs ? "Comentario:" : "Comment:") ?? undefined) : undefined;
    start(async () => { await saveSignoffAction({ projectId, id, signer_role: "", status, comments }); router.refresh(); });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{isEs ? "Aprobación formal del Sponsor, Project Manager y Comité Directivo." : "Formal sign-off by Sponsor, Project Manager and Steering Committee."}</p>
      <div className="space-y-2">
        {signoffs.map((s) => {
          const status = String(s.status);
          return (
            <div key={String(s.id)} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{cell(s.signer_role)}</p>
                {s.comments ? <p className="text-xs text-muted-foreground">{String(s.comments)}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                {status === "pending" ? (
                  <>
                    <button onClick={() => sign(String(s.id), "rejected")} disabled={pending} className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300"><XCircle className="h-3.5 w-3.5" /></button>
                    <button onClick={() => sign(String(s.id), "approved")} disabled={pending} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"><Stamp className="h-3.5 w-3.5" />{isEs ? "Firmar" : "Sign"}</button>
                  </>
                ) : (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${status === "approved" ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"}`}>
                    {status === "approved" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {status === "approved" ? (isEs ? "Aprobado" : "Approved") : (isEs ? "Rechazado" : "Rejected")}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {signoffs.length === 0 && <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">{isEs ? "Sin firmas solicitadas." : "No sign-offs requested."}</p>}
      </div>
      <div className="flex gap-2">
        <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}>{ROLE_OPTIONS.map((o) => <option key={o}>{o}</option>)}</select>
        <AddBtn onClick={request} pending={pending} label={isEs ? "Solicitar firma" : "Request sign-off"} />
      </div>
    </div>
  );
}

// ── AI: Gap Analysis + Scope Creep ──────────────────────────────────────────

export function GovernanceAiTab({ projectId, locale }: { projectId: string; locale: string }) {
  const isEs = locale === "es";
  const [pending, start] = useTransition();
  const [gap, setGap] = useState<{ area: string; severity: string; recommendation: string }[] | null>(null);
  const [creep, setCreep] = useState<{ item: string; reason: string }[] | null>(null);

  const runGap = () => start(async () => { const r = await gapAnalysisAction({ projectId, locale }); setGap(r.items ?? []); });
  const runCreep = () => start(async () => { const r = await scopeCreepAction({ projectId, locale }); setCreep(r.flags ?? []); });

  const sevCls: Record<string, string> = { high: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300", medium: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", low: "bg-muted text-muted-foreground" };

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Search className="h-4 w-4 text-brand-500" />{isEs ? "Análisis de brechas (IA)" : "Gap analysis (AI)"}</h3>
          <button onClick={runGap} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{isEs ? "Analizar" : "Analyze"}</button>
        </div>
        {gap && (gap.length === 0
          ? <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400"><CheckCircle2 className="h-4 w-4" />{isEs ? "Sin brechas relevantes. El charter está sólido." : "No significant gaps. The charter looks solid."}</p>
          : <ul className="space-y-1.5">{gap.map((g, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${sevCls[g.severity] ?? sevCls.medium}`}>{g.severity}</span>
                <span><strong className="text-foreground">{g.area}.</strong> <span className="text-muted-foreground">{g.recommendation}</span></span>
              </li>))}</ul>)}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><AlertTriangle className="h-4 w-4 text-amber-500" />{isEs ? "Detección de scope creep (IA)" : "Scope creep detection (AI)"}</h3>
          <button onClick={runCreep} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{isEs ? "Revisar tareas" : "Check tasks"}</button>
        </div>
        <p className="mb-2 text-xs text-muted-foreground">{isEs ? "Compara las tareas del proyecto contra el alcance aprobado." : "Compares project tasks against the approved scope."}</p>
        {creep && (creep.length === 0
          ? <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400"><CheckCircle2 className="h-4 w-4" />{isEs ? "Las tareas se alinean con el alcance aprobado." : "Tasks align with the approved scope."}</p>
          : <ul className="space-y-1.5">{creep.map((c, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/20">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span><strong className="text-foreground">{c.item}.</strong> <span className="text-muted-foreground">{c.reason}</span></span>
              </li>))}</ul>)}
      </div>
    </div>
  );
}

// ── AI: Stakeholder summary + Q&A ───────────────────────────────────────────

export function CharterQnA({ projectId, locale }: { projectId: string; locale: string }) {
  const isEs = locale === "es";
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [a, setA] = useState<string | null>(null);
  const ask = () => { if (!q.trim()) return; start(async () => { const r = await askCharterAction({ projectId, question: q, locale }); setA(r.answer || (isEs ? "No encontrado en el charter." : "Not found in the charter.")); }); };
  const samples = isEs
    ? ["¿Quién aprueba los cambios de alcance?", "¿Qué está fuera del alcance?", "¿Cuáles son los criterios de éxito?"]
    : ["Who approves scope changes?", "What is out of scope?", "What are the success criteria?"];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground"><MessageSquareText className="h-4 w-4 text-brand-500" />{isEs ? "Pregúntale al Charter (IA)" : "Ask the Charter (AI)"}</h3>
      <div className="flex gap-2">
        <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} placeholder={isEs ? "Escribe tu pregunta…" : "Type your question…"} />
        <button onClick={ask} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {samples.map((s) => <button key={s} onClick={() => setQ(s)} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/70">{s}</button>)}
      </div>
      {a && <p className="mt-3 rounded-lg bg-muted/40 p-3 text-sm text-foreground">{a}</p>}
    </div>
  );
}

export function StakeholderSummaryButton({ projectId, locale }: { projectId: string; locale: string }) {
  const isEs = locale === "es";
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState<string | null>(null);
  const gen = () => start(async () => { const r = await stakeholderSummaryAction({ projectId, locale }); setSummary(r.summary || ""); });

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Sparkles className="h-4 w-4 text-brand-500" />{isEs ? "Resumen para stakeholders (IA)" : "Stakeholder summary (AI)"}</h3>
        <button onClick={gen} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{isEs ? "Generar" : "Generate"}</button>
      </div>
      {summary
        ? <p className="rounded-lg bg-muted/40 p-3 text-sm text-foreground">{summary}</p>
        : <p className="text-xs text-muted-foreground">{isEs ? "Genera una explicación clara y no técnica para compartir con stakeholders." : "Generate a clear, non-technical explanation to share with stakeholders."}</p>}
    </div>
  );
}
