"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  X, Save, Sparkles, CheckCircle2, Loader2, Plus, Trash2, Scale, ListChecks,
  Users, BrainCircuit, Calendar, Target, Flag, Video, FileBarChart, AudioLines,
} from "lucide-react";
import {
  updateMeetingAction, addMeetingDecisionAction, addMeetingActionItemAction,
  addAttendeeAction, updateAttendeeAction, removeAttendeeAction,
  generateSummaryAction, completeMeetingAction,
} from "./actions";
import { TypeBadge, StatusBadge } from "./rhythm-badges";
import { RythmAudioPanel } from "@/components/rythm";
import type { EventView, StakeholderOption } from "./types";
import type { AgendaSection } from "@/types/database";

const inputCls = "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";
const ATT_STATUS = ["invited","accepted","declined","tentative","attended","absent"];

export function MeetingDrawer({
  locale, projectId, event, stakeholders, onClose,
}: { locale: string; projectId: string; event: EventView; stakeholders: StakeholderOption[]; onClose: () => void }) {
  const isEs = locale === "es";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const m = event.meeting!;

  const [agenda, setAgenda] = useState<AgendaSection[]>(m.agenda ?? []);
  const [notes, setNotes] = useState(m.notes);
  const [link, setLink] = useState(m.meetingLink ?? "");
  const [saving, setSaving] = useState<string | null>(null);
  const [newDecision, setNewDecision] = useState("");
  const [newAction, setNewAction] = useState({ title: "", dueDate: "", priority: "medium" });
  const [newAttendee, setNewAttendee] = useState({ name: "", stakeholderId: "", role: "required" });

  const refresh = () => startTransition(() => router.refresh());
  const fmt = (d: string | null) => d ? new Date(d).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "—";

  async function saveAgendaNotes() {
    setSaving("agenda");
    await updateMeetingAction({ meetingId: m.id, projectId, locale, agenda, notes });
    setSaving(null); refresh();
  }
  async function saveLink() {
    setSaving("link");
    await updateMeetingAction({ meetingId: m.id, projectId, locale, meetingLink: link });
    setSaving(null); refresh();
  }
  async function addDecision() {
    if (!newDecision.trim()) return;
    setSaving("decision");
    await addMeetingDecisionAction({ meetingId: m.id, projectId, decision: newDecision.trim(), locale });
    setNewDecision(""); setSaving(null); refresh();
  }
  async function addAction() {
    if (!newAction.title.trim()) return;
    setSaving("action");
    await addMeetingActionItemAction({ meetingId: m.id, projectId, title: newAction.title.trim(), dueDate: newAction.dueDate || undefined, priority: newAction.priority, locale });
    setNewAction({ title: "", dueDate: "", priority: "medium" }); setSaving(null); refresh();
  }
  async function addAtt() {
    const name = newAttendee.stakeholderId ? stakeholders.find((s) => s.id === newAttendee.stakeholderId)?.name : newAttendee.name.trim();
    if (!name) return;
    setSaving("attendee");
    await addAttendeeAction({ meetingId: m.id, projectId, name: newAttendee.stakeholderId ? undefined : newAttendee.name.trim(), stakeholderId: newAttendee.stakeholderId || undefined, role: newAttendee.role, locale });
    setNewAttendee({ name: "", stakeholderId: "", role: "required" }); setSaving(null); refresh();
  }
  async function genSummary() {
    setSaving("summary");
    await generateSummaryAction({ meetingId: m.id, projectId, locale });
    setSaving(null); refresh();
  }
  async function complete() {
    if (!confirm(isEs ? "¿Completar la reunión? Se generará el resumen IA y se guardará en Project Memory." : "Complete the meeting? AI summary will be generated and saved to Project Memory.")) return;
    setSaving("complete");
    await completeMeetingAction({ meetingId: m.id, projectId, locale });
    setSaving(null); refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-card/95 px-6 py-4 backdrop-blur">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <TypeBadge type={event.eventType} isEs={isEs} />
              <StatusBadge status={m.meetingStatus} isEs={isEs} />
              {m.memorySynced && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300" title={isEs ? "Sincronizado a Project Memory" : "Synced to Project Memory"}>
                  <BrainCircuit className="h-3 w-3" />{isEs ? "En memoria" : "In memory"}
                </span>
              )}
              {m.meetingLink && (
                <a href={m.meetingLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-medium text-white transition-colors hover:bg-brand-700">
                  <Video className="h-3 w-3" />{isEs ? "Unirse" : "Join"}
                </a>
              )}
            </div>
            <h2 className="text-base font-semibold text-foreground">{event.title}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"><Calendar className="h-3 w-3" />{fmt(event.startDatetime)}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {/* Meeting link */}
          <section>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Video className="h-3.5 w-3.5" />{isEs ? "Link de la reunión" : "Meeting link"}</h3>
            <div className="flex gap-2">
              <input type="url" className={inputCls} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://zoom.us/j/…  ·  meet.google.com/…  ·  teams.microsoft.com/…" />
              <button onClick={saveLink} disabled={isPending} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50">
                {saving === "link" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}{isEs ? "Guardar" : "Save"}
              </button>
            </div>
          </section>

          {/* Objective / outcome */}
          {(m.objective || m.expectedOutcome) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {m.objective && <InfoCard icon={Target} label={isEs ? "Objetivo" : "Objective"} text={m.objective} />}
              {m.expectedOutcome && <InfoCard icon={Flag} label={isEs ? "Resultado esperado" : "Expected outcome"} text={m.expectedOutcome} />}
            </div>
          )}

          {/* AI summary */}
          {m.summary && (
            <section className="rounded-lg border border-brand-200 bg-brand-50/50 p-3 dark:border-brand-900 dark:bg-brand-950/20">
              <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400"><Sparkles className="h-3.5 w-3.5" />{isEs ? "Resumen IA" : "AI Summary"}</h3>
              <p className="text-sm text-foreground">{m.summary}</p>
            </section>
          )}

          {/* Audio & recording (Rythm) */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><AudioLines className="h-3.5 w-3.5" />{isEs ? "Audio y grabación" : "Audio & recording"}</h3>
            <RythmAudioPanel projectId={projectId} meetingId={m.id} locale={locale} />
          </section>

          {/* Agenda builder */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><ListChecks className="h-3.5 w-3.5" />{isEs ? "Agenda" : "Agenda"}</h3>
              <button onClick={saveAgendaNotes} disabled={isPending} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline disabled:opacity-50">
                {saving === "agenda" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}{isEs ? "Guardar agenda y notas" : "Save agenda & notes"}
              </button>
            </div>
            <div className="space-y-2">
              {agenda.length === 0 && <p className="text-xs text-muted-foreground">{isEs ? "Sin agenda." : "No agenda."}</p>}
              {agenda.map((s, i) => (
                <div key={s.key + i} className="rounded-lg border border-border p-2.5">
                  <p className="mb-1 text-xs font-semibold text-foreground">{s.title}</p>
                  <textarea
                    rows={2} className={`${inputCls} resize-y`} value={s.content}
                    placeholder={isEs ? "Notas de esta sección…" : "Notes for this section…"}
                    onChange={(e) => setAgenda((prev) => prev.map((x, j) => j === i ? { ...x, content: e.target.value } : x))}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* General notes */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{isEs ? "Notas generales" : "General notes"}</h3>
            <textarea rows={4} className={`${inputCls} resize-y`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={isEs ? "Notas de la reunión…" : "Meeting notes…"} />
          </section>

          {/* Decisions */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Scale className="h-3.5 w-3.5" />{isEs ? "Decisiones" : "Decisions"} ({m.decisions.length})</h3>
            <ul className="mb-2 space-y-1.5">
              {m.decisions.map((d) => (
                <li key={d.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground">
                  <Scale className="h-3.5 w-3.5 shrink-0 text-amber-500" /><span className="min-w-0 flex-1">{d.title}</span>
                  {d.impactArea && <span className="text-[10px] text-muted-foreground">{d.impactArea}</span>}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input className={inputCls} value={newDecision} onChange={(e) => setNewDecision(e.target.value)} placeholder={isEs ? "Nueva decisión…" : "New decision…"} onKeyDown={(e) => e.key === "Enter" && addDecision()} />
              <button onClick={addDecision} disabled={isPending || !newDecision.trim()} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"><Plus className="h-3.5 w-3.5" /></button>
            </div>
          </section>

          {/* Action items */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><ListChecks className="h-3.5 w-3.5" />{isEs ? "Acciones" : "Action items"} ({m.actionItems.length})</h3>
            <ul className="mb-2 space-y-1.5">
              {m.actionItems.map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm">
                  <ListChecks className="h-3.5 w-3.5 shrink-0 text-green-500" />
                  <span className="min-w-0 flex-1 text-foreground">{a.title}</span>
                  <span className="text-[10px] capitalize text-muted-foreground">{a.priority}</span>
                  {a.dueDate && <span className="text-[10px] text-muted-foreground">{a.dueDate}</span>}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <input className={`${inputCls} flex-1`} value={newAction.title} onChange={(e) => setNewAction((p) => ({ ...p, title: e.target.value }))} placeholder={isEs ? "Nueva acción…" : "New action…"} />
              <input type="date" className={`${inputCls} w-36`} value={newAction.dueDate} onChange={(e) => setNewAction((p) => ({ ...p, dueDate: e.target.value }))} />
              <select className={`${inputCls} w-28`} value={newAction.priority} onChange={(e) => setNewAction((p) => ({ ...p, priority: e.target.value }))}>
                <option value="low">{isEs ? "Baja" : "Low"}</option><option value="medium">{isEs ? "Media" : "Medium"}</option><option value="high">{isEs ? "Alta" : "High"}</option><option value="critical">{isEs ? "Crítica" : "Critical"}</option>
              </select>
              <button onClick={addAction} disabled={isPending || !newAction.title.trim()} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"><Plus className="h-3.5 w-3.5" /></button>
            </div>
          </section>

          {/* Attendees */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Users className="h-3.5 w-3.5" />{isEs ? "Asistentes" : "Attendees"} ({m.attendees.length})</h3>
            <ul className="mb-2 space-y-1.5">
              {m.attendees.map((a) => (
                <li key={a.id} className="group flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm">
                  <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 text-foreground">{a.name ?? stakeholders.find((s) => s.id === a.stakeholderId)?.name ?? "—"}</span>
                  <span className="text-[10px] capitalize text-muted-foreground">{a.role}</span>
                  <select className="rounded border border-border bg-background px-1 py-0.5 text-[10px]" value={a.attendanceStatus} onChange={(e) => { updateAttendeeAction({ attendeeId: a.id, projectId, attendanceStatus: e.target.value, locale }).then(refresh); }}>
                    {ATT_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => removeAttendeeAction({ attendeeId: a.id, projectId, locale }).then(refresh)} className="text-muted-foreground opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {stakeholders.length > 0 && (
                <select className={`${inputCls} w-44`} value={newAttendee.stakeholderId} onChange={(e) => setNewAttendee((p) => ({ ...p, stakeholderId: e.target.value, name: "" }))}>
                  <option value="">{isEs ? "Interesado…" : "Stakeholder…"}</option>
                  {stakeholders.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              <input className={`${inputCls} flex-1`} value={newAttendee.name} onChange={(e) => setNewAttendee((p) => ({ ...p, name: e.target.value, stakeholderId: "" }))} placeholder={isEs ? "o nombre libre…" : "or free name…"} />
              <select className={`${inputCls} w-28`} value={newAttendee.role} onChange={(e) => setNewAttendee((p) => ({ ...p, role: e.target.value }))}>
                <option value="required">{isEs ? "Requerido" : "Required"}</option><option value="optional">{isEs ? "Opcional" : "Optional"}</option><option value="presenter">{isEs ? "Presentador" : "Presenter"}</option>
              </select>
              <button onClick={addAtt} disabled={isPending} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"><Plus className="h-3.5 w-3.5" /></button>
            </div>
          </section>

          {/* Closeout report link (closing meetings) */}
          {m.meetingType === "closing" && (
            <a href={`/${locale}/projects/${projectId}/closeout`} className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50/50 px-3 py-2.5 text-sm transition-colors hover:bg-brand-100/50 dark:border-brand-900 dark:bg-brand-950/20">
              <span className="flex items-center gap-2 font-medium text-brand-700 dark:text-brand-300"><FileBarChart className="h-4 w-4" />{isEs ? "Reporte de Cierre del Proyecto" : "Project Closeout Report"}</span>
              <span className="text-xs text-muted-foreground">{isEs ? "Ver / PDF →" : "View / PDF →"}</span>
            </a>
          )}

          {/* Complete / summary actions */}
          <section className="flex flex-wrap gap-2 border-t border-border pt-4">
            <button onClick={genSummary} disabled={isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50">
              {saving === "summary" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-brand-500" />}{isEs ? "Generar resumen IA" : "Generate AI summary"}
            </button>
            <button onClick={complete} disabled={isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50">
              {saving === "complete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{isEs ? "Completar y guardar en memoria" : "Complete & save to memory"}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, text }: { icon: typeof Target; label: string; text: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-2.5">
      <p className="mb-0.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"><Icon className="h-3 w-3" />{label}</p>
      <p className="text-xs text-foreground">{text}</p>
    </div>
  );
}
