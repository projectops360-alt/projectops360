"use client";

import {
  StickyNote, Mail, MessageCircle, CalendarDays, Scale, CheckSquare,
  AlertTriangle, Paperclip, BadgeCheck, GitPullRequestArrow, Cog, FileText,
  Gavel, ShieldAlert, Coins, CalendarClock, Expand, Users,
} from "lucide-react";
import type {
  MemorySourceType, MemoryImportance, MemoryClassification, MemoryPipelineStatus,
} from "@/types/database";
import type { LinkableEntityType } from "./types";

// ── Source type ───────────────────────────────────────────────────────────────

export const SOURCE_META: Record<MemorySourceType, {
  icon: typeof StickyNote; en: string; es: string; color: string;
}> = {
  manual_note:    { icon: StickyNote, en: "Note", es: "Nota", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  email:          { icon: Mail, en: "Email", es: "Email", color: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  chat_message:   { icon: MessageCircle, en: "Chat", es: "Chat", color: "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300" },
  meeting_note:   { icon: CalendarDays, en: "Meeting note", es: "Nota de reunión", color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300" },
  decision:       { icon: Scale, en: "Decision", es: "Decisión", color: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  action_item:    { icon: CheckSquare, en: "Action item", es: "Acción", color: "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300" },
  risk_signal:    { icon: AlertTriangle, en: "Risk signal", es: "Señal de riesgo", color: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300" },
  evidence:       { icon: Paperclip, en: "Evidence", es: "Evidencia", color: "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300" },
  approval:       { icon: BadgeCheck, en: "Approval", es: "Aprobación", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  change_request: { icon: GitPullRequestArrow, en: "Change request", es: "Cambio", color: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300" },
  system_event:   { icon: Cog, en: "System event", es: "Evento del sistema", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  document:       { icon: FileText, en: "Document", es: "Documento", color: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300" },
};

export const SOURCE_TYPES: MemorySourceType[] = [
  "manual_note", "email", "chat_message", "meeting_note", "decision", "action_item",
  "risk_signal", "evidence", "approval", "change_request", "system_event", "document",
];

export function SourceTypeBadge({ type, isEs }: { type: MemorySourceType; isEs: boolean }) {
  const meta = SOURCE_META[type] ?? SOURCE_META.manual_note;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${meta.color}`}>
      <Icon className="h-2.5 w-2.5" />
      {isEs ? meta.es : meta.en}
    </span>
  );
}

// ── Importance ────────────────────────────────────────────────────────────────

const IMPORTANCE_META: Record<MemoryImportance, { en: string; es: string; color: string }> = {
  low:      { en: "Low", es: "Baja", color: "text-gray-500" },
  medium:   { en: "Medium", es: "Media", color: "text-blue-500" },
  high:     { en: "High", es: "Alta", color: "text-amber-500" },
  critical: { en: "Critical", es: "Crítica", color: "text-red-500" },
};

export function ImportanceDot({ level, isEs }: { level: MemoryImportance; isEs: boolean }) {
  const m = IMPORTANCE_META[level];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${m.color}`} title={isEs ? "Importancia" : "Importance"}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {isEs ? m.es : m.en}
    </span>
  );
}

// ── AI classification flags ─────────────────────────────────────────────────

const FLAG_META: Array<{
  key: keyof MemoryClassification; icon: typeof Gavel; en: string; es: string; color: string;
}> = [
  { key: "contains_decision", icon: Gavel, en: "Decision", es: "Decisión", color: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  { key: "contains_risk", icon: ShieldAlert, en: "Risk", es: "Riesgo", color: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300" },
  { key: "contains_action_item", icon: CheckSquare, en: "Action Item", es: "Acción", color: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" },
  { key: "contains_scope_change", icon: Expand, en: "Scope Change", es: "Cambio de alcance", color: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300" },
  { key: "contains_schedule_impact", icon: CalendarClock, en: "Schedule Impact", es: "Impacto en cronograma", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300" },
  { key: "contains_cost_impact", icon: Coins, en: "Cost Impact", es: "Impacto en costo", color: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300" },
  { key: "contains_stakeholder_concern", icon: Users, en: "Stakeholder Concern", es: "Preocupación de interesados", color: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300" },
];

export function ClassificationBadges({
  classification, isEs, max,
}: { classification: MemoryClassification; isEs: boolean; max?: number }) {
  const active = FLAG_META.filter((f) => classification[f.key] === true);
  if (active.length === 0) return null;
  const shown = max ? active.slice(0, max) : active;
  const hidden = active.length - shown.length;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {shown.map((f) => {
        const Icon = f.icon;
        return (
          <span key={String(f.key)} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${f.color}`}>
            <Icon className="h-2.5 w-2.5" />
            {isEs ? f.es : f.en}
          </span>
        );
      })}
      {hidden > 0 && (
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
          +{hidden}
        </span>
      )}
    </span>
  );
}

// ── AI / index pipeline status ─────────────────────────────────────────────

export function PipelineBadge({
  aiStatus, indexStatus, isEs,
}: { aiStatus: MemoryPipelineStatus; indexStatus: MemoryPipelineStatus; isEs: boolean }) {
  // Surface only the states the user should notice.
  const pending = aiStatus === "pending" || aiStatus === "processing" || indexStatus === "pending" || indexStatus === "processing";
  const failed = aiStatus === "failed" || indexStatus === "failed";

  if (failed) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300" title={isEs ? "Análisis o indexación falló" : "Analysis or indexing failed"}>
        <AlertTriangle className="h-2.5 w-2.5" />
        {isEs ? "Error IA" : "AI error"}
      </span>
    );
  }
  if (pending) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300" title={isEs ? "Procesando IA / indexación" : "Processing AI / indexing"}>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
        {isEs ? "Procesando" : "Processing"}
      </span>
    );
  }
  return null;
}

// ── Linkable entity type labels ─────────────────────────────────────────────

export const ENTITY_TYPE_META: Record<LinkableEntityType, { en: string; es: string; icon: typeof FileText }> = {
  task:          { en: "Task", es: "Tarea", icon: CheckSquare },
  milestone:     { en: "Milestone", es: "Hito", icon: BadgeCheck },
  decision:      { en: "Decision", es: "Decisión", icon: Scale },
  risk:          { en: "Risk", es: "Riesgo", icon: ShieldAlert },
  stakeholder:   { en: "Stakeholder", es: "Interesado", icon: Users },
  document:      { en: "Document", es: "Documento", icon: FileText },
  communication: { en: "Communication", es: "Comunicación", icon: Mail },
  meeting:       { en: "Meeting", es: "Reunión", icon: CalendarDays },
};

export const LINK_TYPE_META: Record<string, { en: string; es: string }> = {
  related_to:   { en: "Related to", es: "Relacionado con" },
  depends_on:   { en: "Depends on", es: "Depende de" },
  caused_by:    { en: "Caused by", es: "Causado por" },
  contradicts:  { en: "Contradicts", es: "Contradice" },
  supersedes:   { en: "Supersedes", es: "Reemplaza a" },
  derived_from: { en: "Derived from", es: "Derivado de" },
};
