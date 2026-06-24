"use client";

// ============================================================================
// ProjectOps Scribe — capture modal (inside Project Memory)
// Capture (type / paste / optional desktop dictation) → Analyze with AI →
// review extracted items with source excerpts → approve/edit/reject → save to
// Project Memory (and optionally create approved tasks/decisions/risks).
// ============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Mic, MicOff, X, Loader2, Sparkles, Check, Pencil, Ban, ClipboardCheck,
  Quote, AlertTriangle, ListChecks, Scale, ShieldAlert, Bug, GitBranch,
  TrendingUp, HelpCircle, ArrowRight, Save,
} from "lucide-react";
import { useDictation } from "./use-dictation";
import { analyzeScribeAction, saveScribeEntryAction, type ScribeItemInput } from "@/app/[locale]/(app)/projects/[projectId]/memory/scribe-actions";

const inp = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

const CREATABLE = new Set(["action_item", "decision", "risk"]);

const TYPE_META: Record<string, { es: string; en: string; icon: typeof ListChecks; tone: string }> = {
  action_item: { es: "Acción", en: "Action item", icon: ListChecks, tone: "text-brand-500" },
  decision: { es: "Decisión", en: "Decision", icon: Scale, tone: "text-amber-500" },
  risk: { es: "Riesgo", en: "Risk", icon: ShieldAlert, tone: "text-red-500" },
  issue: { es: "Issue", en: "Issue", icon: Bug, tone: "text-orange-500" },
  blocker: { es: "Bloqueador", en: "Blocker", icon: Ban, tone: "text-red-500" },
  dependency: { es: "Dependencia", en: "Dependency", icon: GitBranch, tone: "text-brand-500" },
  project_impact: { es: "Impacto", en: "Impact", icon: TrendingUp, tone: "text-purple-500" },
  open_question: { es: "Pregunta abierta", en: "Open question", icon: HelpCircle, tone: "text-blue-500" },
  follow_up: { es: "Seguimiento", en: "Follow-up", icon: ArrowRight, tone: "text-muted-foreground" },
};

interface UiItem extends ScribeItemInput { id: number }

export function ScribeModal({ projectId, locale, onClose }: { projectId: string; locale: string; onClose: () => void }) {
  const isEs = locale === "es";
  const router = useRouter();
  const [pending, start] = useTransition();

  const [text, setText] = useState("");
  const [summary, setSummary] = useState("");
  const [detectedLang, setDetectedLang] = useState("");
  const [items, setItems] = useState<UiItem[] | null>(null); // null = not analyzed yet
  const [editing, setEditing] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [dictLang, setDictLang] = useState(locale === "es" ? "es" : "en");
  const dictation = useDictation(dictLang, (t) => setText((prev) => (prev ? `${prev} ${t}` : t)));

  const analyze = () => {
    if (!text.trim()) return;
    setErr(null);
    start(async () => {
      const r = await analyzeScribeAction({ projectId, text, locale });
      if (r.error || !r.analysis) { setErr(r.error === "ai_failed" ? (isEs ? "La IA no pudo analizar. Igual puedes guardar la nota." : "AI couldn't analyze. You can still save the note.") : (isEs ? "Algo falló." : "Something failed.")); return; }
      setSummary(r.analysis.summary);
      setDetectedLang(r.analysis.detected_language);
      setItems(r.analysis.items.map((it, i) => ({ ...it, id: i, status: "suggested" })));
    });
  };

  const setItem = (id: number, patch: Partial<UiItem>) => setItems((arr) => arr?.map((it) => (it.id === id ? { ...it, ...patch } : it)) ?? null);
  const approveAll = () => setItems((arr) => arr?.map((it) => (it.status === "rejected" ? it : { ...it, status: "approved" })) ?? null);

  const save = (createApproved: boolean) => {
    if (dictation.listening) dictation.stop();
    start(async () => {
      const r = await saveScribeEntryAction({
        projectId, sourceType: "manual_note",
        title: "", content: text, summary, detectedLanguage: detectedLang,
        captureMethod: "manual_note",
        items: (items ?? []).map((it): ScribeItemInput => ({
          item_type: it.item_type, description: it.description,
          suggested_owner: it.suggested_owner, suggested_due_date: it.suggested_due_date,
          confidence: it.confidence, source_excerpt: it.source_excerpt,
          proposed_action: it.proposed_action, status: it.status,
          needs_review: it.needs_review, extra: it.extra,
        })),
        createApproved, locale,
      });
      if (r.error) { setErr(isEs ? "No se pudo guardar." : "Could not save."); return; }
      onClose();
      router.refresh();
    });
  };

  const reviewing = items !== null;
  const approvedCount = (items ?? []).filter((it) => it.status === "approved" || it.status === "edited").length;
  const creatableApproved = (items ?? []).filter((it) => (it.status === "approved" || it.status === "edited") && CREATABLE.has(it.item_type)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 backdrop-blur-sm sm:items-start sm:overflow-y-auto sm:p-4">
      <div className="flex max-h-full w-full flex-col bg-card shadow-2xl sm:my-8 sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-border">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300"><Mic className="h-5 w-5" /></span>
            <div>
              <h2 className="text-base font-bold text-foreground">ProjectOps Scribe</h2>
              <p className="text-xs text-muted-foreground">{isEs ? "Captura actualizaciones, decisiones, riesgos y acciones en la Memoria del Proyecto." : "Capture project updates, decisions, risks and action items into Project Memory."}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {err && <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{err}</div>}

          {!reviewing ? (
            // ── Capture step ──────────────────────────────────────────────
            <div className="space-y-3">
              {dictation.supported && (
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <select
                    value={dictLang}
                    onChange={(e) => setDictLang(e.target.value)}
                    disabled={dictation.listening}
                    title={isEs ? "Idioma del dictado por voz" : "Voice dictation language"}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-brand-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="es">🎤 ES</option>
                    <option value="en">🎤 EN</option>
                  </select>
                  <button onClick={() => (dictation.listening ? dictation.stop() : dictation.start())} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${dictation.listening ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300" : "border-border text-foreground hover:bg-muted"}`}>
                    {dictation.listening ? <><MicOff className="h-3.5 w-3.5" />{isEs ? "Detener" : "Stop"}</> : <><Mic className="h-3.5 w-3.5" />{isEs ? "Dictar" : "Dictate"}</>}
                  </button>
                </div>
              )}
              <textarea
                autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={10}
                placeholder={isEs ? "Escribe o pega la actualización… (en el móvil, toca el micrófono de tu teclado para dictar)" : "Type or paste the update… (on mobile, tap your keyboard's mic to dictate)"}
                className={inp}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">{text.trim().length} {isEs ? "caracteres" : "characters"}{dictation.listening ? ` · ${isEs ? "escuchando…" : "listening…"}` : ""}</span>
                <div className="flex gap-2">
                  <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted">{isEs ? "Cancelar" : "Cancel"}</button>
                  <button onClick={analyze} disabled={pending || !text.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{isEs ? "Analizar con IA" : "Analyze with AI"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // ── Review step ───────────────────────────────────────────────
            <div className="space-y-4">
              {summary && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Sparkles className="h-3.5 w-3.5 text-brand-500" />{isEs ? "Resumen IA" : "AI summary"}{detectedLang ? <span className="font-normal lowercase">· {detectedLang}</span> : null}</p>
                  <p className="text-sm text-foreground">{summary}</p>
                </div>
              )}

              {text.trim() && (
                <details className="rounded-lg border border-border">
                  <summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {isEs ? "Ver transcripción completa" : "View full transcript"}
                  </summary>
                  <p className="whitespace-pre-wrap border-t border-border px-3 py-2 text-sm text-foreground">{text}</p>
                </details>
              )}

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{(items ?? []).length} {isEs ? "elementos extraídos" : "extracted items"} · {approvedCount} {isEs ? "aprobados" : "approved"}</p>
                {(items ?? []).length > 0 && <button onClick={approveAll} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"><ClipboardCheck className="h-3.5 w-3.5" />{isEs ? "Aprobar todo" : "Approve all"}</button>}
              </div>

              {(items ?? []).length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{isEs ? "La IA no extrajo elementos accionables. Puedes guardar la nota igualmente." : "No actionable items extracted. You can still save the note."}</p>
              ) : (
                <div className="space-y-2">
                  {(items ?? []).map((it) => {
                    const meta = TYPE_META[it.item_type] ?? TYPE_META.follow_up;
                    const Icon = meta.icon;
                    const rejected = it.status === "rejected";
                    const approved = it.status === "approved" || it.status === "edited";
                    const isEditing = editing === it.id;
                    return (
                      <div key={it.id} className={`rounded-lg border p-3 ${rejected ? "border-border bg-muted/30 opacity-60" : approved ? "border-green-300 dark:border-green-900" : "border-border"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><Icon className={`h-3.5 w-3.5 ${meta.tone}`} />{isEs ? meta.es : meta.en}
                            {!CREATABLE.has(it.item_type) && <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-normal text-muted-foreground">{isEs ? "solo memoria" : "memory only"}</span>}
                            {it.needs_review && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{isEs ? "Requiere revisión" : "Needs review"}</span>}
                          </span>
                          {it.confidence != null && <span className="shrink-0 text-[10px] text-muted-foreground">{Math.round(it.confidence * 100)}%</span>}
                        </div>

                        {isEditing ? (
                          <div className="mt-2 space-y-1.5">
                            <textarea value={it.description} onChange={(e) => setItem(it.id, { description: e.target.value })} rows={2} className={inp} />
                            <div className="grid grid-cols-2 gap-1.5">
                              <input value={it.suggested_owner ?? ""} onChange={(e) => setItem(it.id, { suggested_owner: e.target.value || null })} placeholder={isEs ? "Responsable" : "Owner"} className={inp} />
                              <input value={it.suggested_due_date ?? ""} onChange={(e) => setItem(it.id, { suggested_due_date: e.target.value || null })} placeholder="YYYY-MM-DD" className={inp} />
                            </div>
                            <button onClick={() => { setItem(it.id, { status: "edited" }); setEditing(null); }} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700"><Check className="h-3.5 w-3.5" />{isEs ? "Listo" : "Done"}</button>
                          </div>
                        ) : (
                          <>
                            <p className="mt-1 text-sm text-foreground">{it.description}</p>
                            {(it.suggested_owner || it.suggested_due_date) && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground">{it.suggested_owner ? `${isEs ? "Responsable" : "Owner"}: ${it.suggested_owner}` : ""}{it.suggested_owner && it.suggested_due_date ? " · " : ""}{it.suggested_due_date ? `${isEs ? "Fecha" : "Due"}: ${it.suggested_due_date}` : ""}</p>
                            )}
                            {it.source_excerpt && (
                              <p className="mt-1.5 flex items-start gap-1.5 rounded bg-muted/40 px-2 py-1 text-[11px] italic text-muted-foreground"><Quote className="mt-0.5 h-3 w-3 shrink-0" />{it.source_excerpt}</p>
                            )}
                          </>
                        )}

                        {!isEditing && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <button onClick={() => setItem(it.id, { status: "approved" })} className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${approved ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300" : "border border-border text-foreground hover:bg-muted"}`}><Check className="h-3 w-3" />{isEs ? "Aprobar" : "Approve"}</button>
                            <button onClick={() => setEditing(it.id)} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"><Pencil className="h-3 w-3" />{isEs ? "Editar" : "Edit"}</button>
                            <button onClick={() => setItem(it.id, { status: "rejected" })} className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${rejected ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "border border-border text-foreground hover:bg-muted"}`}><Ban className="h-3 w-3" />{isEs ? "Rechazar" : "Reject"}</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer (review) */}
        {reviewing && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border p-4">
            <button onClick={() => { setItems(null); setSummary(""); }} className="mr-auto rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted">{isEs ? "← Volver" : "← Back"}</button>
            <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted">{isEs ? "Descartar" : "Discard"}</button>
            <button onClick={() => save(false)} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{isEs ? "Guardar en Memoria" : "Save to Memory"}
            </button>
            <button onClick={() => save(true)} disabled={pending || creatableApproved === 0} title={creatableApproved === 0 ? (isEs ? "Aprueba acciones, decisiones o riesgos para crearlos" : "Approve action items, decisions or risks to create them") : undefined} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{isEs ? `Guardar y crear (${creatableApproved})` : `Save & create (${creatableApproved})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
