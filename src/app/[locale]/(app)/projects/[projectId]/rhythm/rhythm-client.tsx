"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Plus, Filter, X, Loader2, ArrowRight, CalendarDays, List, CalendarRange, Video } from "lucide-react";
import { RhythmCalendar } from "./rhythm-calendar";
import { createMeetingFromTemplateAction } from "./actions";
import { MeetingDrawer } from "./meeting-drawer";
import { TypeBadge, StatusBadge, PriorityDot, EVENT_STATUSES, EVENT_TYPES_ALL, EVENT_TYPE_META, STATUS_META } from "./rhythm-badges";
import { MEETING_TEMPLATES, MEETING_TYPES } from "@/lib/rhythm/templates";
import type { EventView, StakeholderOption } from "./types";
import type { RhythmMeetingType } from "@/types/database";

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

export function RhythmClient({
  locale, projectId, events, stakeholders,
}: { locale: string; projectId: string; events: EventView[]; stakeholders: StakeholderOption[] }) {
  const isEs = locale === "es";
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [now] = useState(() => Date.now());
  const [view, setView] = useState<"list" | "calendar">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [fType, setFType] = useState<string>("");
  const [fStatus, setFStatus] = useState<string>("");
  const [fFrom, setFFrom] = useState<string>("");
  const [fTo, setFTo] = useState<string>("");

  const selected = events.find((e) => e.id === selectedId) ?? null;
  const fmt = (d: string) => new Date(d).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });

  const filtered = useMemo(() => events.filter((e) => {
    if (fType && e.eventType !== fType) return false;
    if (fStatus && e.status !== fStatus) return false;
    if (fFrom && new Date(e.startDatetime) < new Date(fFrom)) return false;
    if (fTo && new Date(e.startDatetime) > new Date(fTo + "T23:59:59")) return false;
    return true;
  }), [events, fType, fStatus, fFrom, fTo]);

  const upcoming = useMemo(() =>
    events.filter((e) => new Date(e.startDatetime).getTime() >= now && !["completed","closed","canceled"].includes(e.status))
      .sort((a, b) => new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime()).slice(0, 5),
  [events, now]);

  const hasFilters = !!(fType || fStatus || fFrom || fTo);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (events.length === 0 && !createOpen) {
    return (
      <>
        <Header isEs={isEs} count={0} onCreate={() => setCreateOpen(true)} />
        <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 px-6 py-16 text-center">
          <CalendarClock className="mb-4 h-12 w-12 text-muted-foreground/30" />
          <h3 className="text-base font-semibold text-foreground">{isEs ? "Aún no hay reuniones ni eventos" : "No meetings or events yet"}</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {isEs ? "Crea tu primera reunión desde una plantilla (Arranque, Actualización de Estado, Revisión…) y el sistema genera la agenda automáticamente." : "Create your first meeting from a template (Kickoff, Status Update, Review…) and the system generates the agenda automatically."}
          </p>
          <button onClick={() => setCreateOpen(true)} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
            <Plus className="h-4 w-4" />{isEs ? "Nueva reunión" : "New meeting"}
          </button>
        </div>
        {createOpen && <CreateMeetingDialog locale={locale} projectId={projectId} stakeholders={stakeholders} onClose={() => setCreateOpen(false)} onCreated={(id) => { setCreateOpen(false); setSelectedId(id); startTransition(() => router.refresh()); }} />}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <Header isEs={isEs} count={events.length} onCreate={() => setCreateOpen(true)} />

      {/* View toggle + filters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-border p-0.5">
          <button onClick={() => setView("list")} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === "list" ? "bg-brand-500/10 text-brand-600 dark:text-brand-400" : "text-muted-foreground hover:text-foreground"}`}><List className="h-4 w-4" />{isEs ? "Lista" : "List"}</button>
          <button onClick={() => setView("calendar")} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === "calendar" ? "bg-brand-500/10 text-brand-600 dark:text-brand-400" : "text-muted-foreground hover:text-foreground"}`}><CalendarRange className="h-4 w-4" />{isEs ? "Calendario" : "Calendar"}</button>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{filtered.length} {isEs ? "eventos" : "events"}</p>
          <button onClick={() => setShowFilters((s) => !s)} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${hasFilters ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-border text-muted-foreground hover:text-foreground"}`}>
            <Filter className="h-4 w-4" />{isEs ? "Filtros" : "Filters"}{hasFilters && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-brand-500" />}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-4">
          <select className={inputCls} value={fType} onChange={(e) => setFType(e.target.value)}>
            <option value="">{isEs ? "Todo tipo" : "All types"}</option>
            {EVENT_TYPES_ALL.map((t) => <option key={t} value={t}>{isEs ? EVENT_TYPE_META[t].es : EVENT_TYPE_META[t].en}</option>)}
          </select>
          <select className={inputCls} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">{isEs ? "Todo estado" : "All statuses"}</option>
            {EVENT_STATUSES.map((s) => <option key={s} value={s}>{isEs ? STATUS_META[s].es : STATUS_META[s].en}</option>)}
          </select>
          <input type="date" className={inputCls} value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
          <input type="date" className={inputCls} value={fTo} onChange={(e) => setFTo(e.target.value)} />
          {hasFilters && <button onClick={() => { setFType(""); setFStatus(""); setFFrom(""); setFTo(""); }} className="text-left text-xs font-medium text-brand-600 hover:underline sm:col-span-4">{isEs ? "Limpiar filtros" : "Clear filters"}</button>}
        </div>
      )}

      {view === "calendar" ? (
        <RhythmCalendar locale={locale} events={filtered} onSelect={(e) => e.meeting && setSelectedId(e.id)} />
      ) : (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main list */}
        <div className="space-y-1.5 lg:col-span-2">
          {/* Event list */}
          <div className="space-y-1.5">
            {filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">{isEs ? "Ningún evento coincide." : "No events match."}</div>
            ) : filtered.map((e) => (
              <div key={e.id} onClick={() => e.meeting && setSelectedId(e.id)}
                className={`group flex w-full items-start gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors ${e.meeting ? "cursor-pointer hover:border-brand-300 hover:bg-muted/30" : "opacity-90"}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <TypeBadge type={e.eventType} isEs={isEs} />
                    <StatusBadge status={e.status} isEs={isEs} />
                    <PriorityDot priority={e.priority} isEs={isEs} />
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-400">{e.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{fmt(e.startDatetime)}</span>
                    {e.meeting && <span>· {e.meeting.decisions.length} {isEs ? "decisiones" : "decisions"} · {e.meeting.actionItems.length} {isEs ? "acciones" : "actions"}</span>}
                    {e.meeting?.memorySynced && <span className="text-green-600 dark:text-green-400">· {isEs ? "en memoria" : "in memory"}</span>}
                  </div>
                </div>
                {e.meeting?.meetingLink && (
                  <a href={e.meeting.meetingLink} target="_blank" rel="noopener noreferrer" onClick={(ev) => ev.stopPropagation()}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700">
                    <Video className="h-3.5 w-3.5" />{isEs ? "Unirse" : "Join"}
                  </a>
                )}
                {e.meeting && <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming panel */}
        <aside className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><CalendarDays className="h-4 w-4 text-brand-500" />{isEs ? "Próximos eventos" : "Upcoming events"}</h3>
          {upcoming.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">{isEs ? "Nada próximo." : "Nothing upcoming."}</p>
          ) : upcoming.map((e) => (
            <button key={e.id} onClick={() => e.meeting && setSelectedId(e.id)} className="block w-full rounded-lg border border-border bg-card p-2.5 text-left transition-colors hover:border-brand-300 hover:bg-muted/30">
              <div className="flex items-center gap-1.5"><TypeBadge type={e.eventType} isEs={isEs} /></div>
              <p className="mt-1 truncate text-sm font-medium text-foreground">{e.title}</p>
              <p className="text-[11px] text-muted-foreground">{fmt(e.startDatetime)}</p>
            </button>
          ))}
        </aside>
      </div>
      )}

      {selected?.meeting && <MeetingDrawer locale={locale} projectId={projectId} event={selected} stakeholders={stakeholders} onClose={() => setSelectedId(null)} />}
      {createOpen && <CreateMeetingDialog locale={locale} projectId={projectId} stakeholders={stakeholders} onClose={() => setCreateOpen(false)} onCreated={(id) => { setCreateOpen(false); setSelectedId(id); startTransition(() => router.refresh()); }} />}
    </div>
  );
}

function Header({ isEs, count, onCreate }: { isEs: boolean; count: number; onCreate: () => void }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold text-foreground"><CalendarClock className="h-5 w-5 text-brand-500" />{isEs ? "Centro de Ritmo del Proyecto" : "Project Rhythm Center"}</h1>
        <p className="text-sm text-muted-foreground">{isEs ? "Calendario y reuniones conectadas con tareas, riesgos, decisiones y memoria." : "Calendar and meetings connected to tasks, risks, decisions and memory."}{count > 0 && ` · ${count}`}</p>
      </div>
      <button onClick={onCreate} className="inline-flex items-center gap-2 self-start rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"><Plus className="h-4 w-4" />{isEs ? "Nueva reunión" : "New meeting"}</button>
    </div>
  );
}

// ── Create meeting dialog (template flow) ─────────────────────────────────────

function CreateMeetingDialog({
  locale, projectId, stakeholders, onClose, onCreated,
}: { locale: string; projectId: string; stakeholders: StakeholderOption[]; onClose: () => void; onCreated: (eventId: string) => void }) {
  const isEs = locale === "es";
  const [meetingType, setMeetingType] = useState<RhythmMeetingType>("status_update");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [priority, setPriority] = useState("medium");
  const [link, setLink] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const tpl = MEETING_TEMPLATES[meetingType];

  async function submit() {
    setError(null);
    if (!start) { setError(isEs ? "Elige fecha y hora." : "Pick a date & time."); return; }
    startTransition(async () => {
      const res = await createMeetingFromTemplateAction({
        projectId, meetingType, title: title.trim() || undefined,
        startDatetime: new Date(start).toISOString(),
        endDatetime: end ? new Date(end).toISOString() : undefined,
        priority, meetingLink: link.trim() || undefined,
        attendees: [...picked].map((id) => ({ stakeholderId: id, role: "required" })),
        locale,
      });
      if (res.error || !res.eventId) { setError(isEs ? "No se pudo crear." : "Could not create."); return; }
      onCreated(res.eventId);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div className="m-auto w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{isEs ? "Nueva reunión" : "New meeting"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">{error}</div>}

        <div className="mt-4 space-y-4">
          {/* Meeting type */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">{isEs ? "Tipo de reunión" : "Meeting type"}</label>
            <div className="grid grid-cols-2 gap-2">
              {MEETING_TYPES.map((mt) => (
                <button key={mt} onClick={() => setMeetingType(mt)} className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${meetingType === mt ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300" : "border-border hover:bg-muted"}`}>
                  {isEs ? MEETING_TEMPLATES[mt].label.es : MEETING_TEMPLATES[mt].label.en}
                </button>
              ))}
            </div>
          </div>

          {/* Objective preview + agenda count */}
          <div className="rounded-lg border border-border bg-muted/20 p-2.5 text-xs text-muted-foreground">
            <p>{isEs ? tpl.objective.es : tpl.objective.en}</p>
            <p className="mt-1 font-medium text-foreground">{isEs ? "Agenda automática" : "Auto agenda"}: {tpl.agenda.length} {isEs ? "secciones" : "sections"}</p>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">{isEs ? "Título (opcional)" : "Title (optional)"}</label>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isEs ? MEETING_TEMPLATES[meetingType].label.es : MEETING_TEMPLATES[meetingType].label.en} />
          </div>

          {/* Date/time */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2"><label className="block text-sm font-medium text-foreground">{isEs ? "Inicio" : "Start"} *</label><input type="datetime-local" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="space-y-1.5"><label className="block text-sm font-medium text-foreground">{isEs ? "Prioridad" : "Priority"}</label>
              <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value)}><option value="low">{isEs?"Baja":"Low"}</option><option value="medium">{isEs?"Media":"Medium"}</option><option value="high">{isEs?"Alta":"High"}</option><option value="critical">{isEs?"Crítica":"Critical"}</option></select>
            </div>
          </div>
          <div className="space-y-1.5"><label className="block text-sm font-medium text-foreground">{isEs ? "Fin (opcional)" : "End (optional)"}</label><input type="datetime-local" className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          <div className="space-y-1.5"><label className="block text-sm font-medium text-foreground">{isEs ? "Link de la reunión (opcional)" : "Meeting link (optional)"}</label><input type="url" className={inputCls} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://zoom.us/j/…  ·  meet.google.com/…  ·  teams.microsoft.com/…" /></div>

          {/* Attendees */}
          {stakeholders.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">{isEs ? "Asistentes (interesados)" : "Attendees (stakeholders)"}</label>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border bg-background p-2">
                {stakeholders.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm text-foreground hover:bg-muted/50">
                    <input type="checkbox" className="h-4 w-4 rounded border-border text-brand-600" checked={picked.has(s.id)} onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(s.id); else n.delete(s.id); return n; })} />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button onClick={onClose} disabled={isPending} className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">{isEs ? "Cancelar" : "Cancel"}</button>
            <button onClick={submit} disabled={isPending} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{isPending && <Loader2 className="h-4 w-4 animate-spin" />}{isEs ? "Crear reunión" : "Create meeting"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
