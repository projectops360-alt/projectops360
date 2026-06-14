"use client";

import type { EventType, EventStatus, EventPriority } from "@/types/database";

export const EVENT_TYPE_META: Record<EventType, { en: string; es: string; color: string }> = {
  kickoff_meeting:     { en: "Kickoff", es: "Arranque", color: "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300" },
  status_update:       { en: "Status Update", es: "Actualización", color: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  stakeholder_review:  { en: "Stakeholder Review", es: "Rev. Interesados", color: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300" },
  project_review:      { en: "Project Review", es: "Rev. Proyecto", color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" },
  project_closing:     { en: "Closing", es: "Cierre", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  milestone:          { en: "Milestone", es: "Hito", color: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  deliverable_deadline:{ en: "Deadline", es: "Entrega", color: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
  risk_review:        { en: "Risk Review", es: "Rev. Riesgos", color: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
  budget_review:      { en: "Budget Review", es: "Rev. Presupuesto", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  change_review:      { en: "Change Review", es: "Rev. Cambios", color: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300" },
  vendor_followup:    { en: "Vendor Follow-up", es: "Seguim. Proveedor", color: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300" },
  resource_planning:  { en: "Resource Planning", es: "Plan. Recursos", color: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300" },
  action_followup:    { en: "Action Follow-up", es: "Seguim. Acción", color: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300" },
  other:              { en: "Event", es: "Evento", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
};

export const STATUS_META: Record<EventStatus, { en: string; es: string; color: string }> = {
  draft:             { en: "Draft", es: "Borrador", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
  scheduled:         { en: "Scheduled", es: "Agendado", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  agenda_ready:      { en: "Agenda Ready", es: "Agenda Lista", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300" },
  in_progress:       { en: "In Progress", es: "En Curso", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  completed:         { en: "Completed", es: "Completado", color: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300" },
  follow_up_pending: { en: "Follow-up Pending", es: "Seguimiento Pend.", color: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300" },
  closed:            { en: "Closed", es: "Cerrado", color: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  canceled:          { en: "Canceled", es: "Cancelado", color: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300" },
};

export const PRIORITY_META: Record<EventPriority, { en: string; es: string; color: string }> = {
  low:      { en: "Low", es: "Baja", color: "text-gray-500" },
  medium:   { en: "Medium", es: "Media", color: "text-blue-500" },
  high:     { en: "High", es: "Alta", color: "text-amber-500" },
  critical: { en: "Critical", es: "Crítica", color: "text-red-500" },
};

export const EVENT_STATUSES: EventStatus[] = ["draft","scheduled","agenda_ready","in_progress","completed","follow_up_pending","closed","canceled"];
export const EVENT_TYPES_ALL: EventType[] = ["kickoff_meeting","status_update","stakeholder_review","project_review","project_closing","milestone","deliverable_deadline","risk_review","budget_review","change_review","vendor_followup","resource_planning","action_followup","other"];
export const PRIORITIES_ALL: EventPriority[] = ["low","medium","high","critical"];

export function TypeBadge({ type, isEs }: { type: EventType; isEs: boolean }) {
  const m = EVENT_TYPE_META[type] ?? EVENT_TYPE_META.other;
  return <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${m.color}`}>{isEs ? m.es : m.en}</span>;
}

export function StatusBadge({ status, isEs }: { status: EventStatus; isEs: boolean }) {
  const m = STATUS_META[status] ?? STATUS_META.draft;
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${m.color}`}>{isEs ? m.es : m.en}</span>;
}

export function PriorityDot({ priority, isEs }: { priority: EventPriority; isEs: boolean }) {
  const m = PRIORITY_META[priority] ?? PRIORITY_META.medium;
  return <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${m.color}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{isEs ? m.es : m.en}</span>;
}
