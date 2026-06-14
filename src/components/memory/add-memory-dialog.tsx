"use client";

import { useActionState } from "react";
import { X, Loader2, Sparkles } from "lucide-react";
import {
  createMemoryItemAction,
  updateMemoryItemAction,
} from "@/app/[locale]/(app)/projects/[projectId]/memory/actions";
import { SOURCE_TYPES, SOURCE_META } from "./memory-badges";
import type { MemoryItemView } from "./types";
import type { Locale } from "@/types/database";

type DialogState = { error?: string } | null;

interface AddMemoryDialogProps {
  locale: Locale;
  projectId: string;
  /** When set, the dialog edits this item instead of creating a new one. */
  item?: MemoryItemView | null;
  onClose: () => void;
  onSaved: () => void;
}

const IMPORTANCE: { value: string; en: string; es: string }[] = [
  { value: "low", en: "Low", es: "Baja" },
  { value: "medium", en: "Medium", es: "Media" },
  { value: "high", en: "High", es: "Alta" },
  { value: "critical", en: "Critical", es: "Crítica" },
];

const VISIBILITY: { value: string; en: string; es: string }[] = [
  { value: "project", en: "Project (all members)", es: "Proyecto (todos)" },
  { value: "organization", en: "Organization", es: "Organización" },
  { value: "private", en: "Private (only me)", es: "Privada (solo yo)" },
];

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

function splitCsv(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

export function AddMemoryDialog({ locale, projectId, item, onClose, onSaved }: AddMemoryDialogProps) {
  const isEs = locale === "es";
  const isEdit = !!item;

  async function handleSubmit(_prev: DialogState, formData: FormData): Promise<DialogState> {
    const title = (formData.get("title") as string)?.trim();
    if (!title) return { error: isEs ? "El título es obligatorio." : "Title is required." };

    const payload = {
      title,
      content: (formData.get("content") as string)?.trim() || "",
      summary: (formData.get("summary") as string)?.trim() || "",
      sourceType: (formData.get("sourceType") as string) || "manual_note",
      sourceSystem: (formData.get("sourceSystem") as string)?.trim() || "",
      authorName: (formData.get("authorName") as string)?.trim() || "",
      authorEmail: (formData.get("authorEmail") as string)?.trim() || "",
      participants: splitCsv((formData.get("participants") as string) || ""),
      occurredAt: (formData.get("occurredAt") as string) || undefined,
      importanceLevel: (formData.get("importanceLevel") as string) || "medium",
      tags: splitCsv((formData.get("tags") as string) || ""),
      visibility: (formData.get("visibility") as string) || "project",
      runAi: formData.get("runAi") === "on",
      projectId,
      locale,
    };

    const result = isEdit
      ? await updateMemoryItemAction({ ...payload, memoryItemId: item!.id })
      : await createMemoryItemAction(payload);

    if (result.error) {
      const map: Record<string, string> = {
        titleRequired: isEs ? "El título es obligatorio." : "Title is required.",
        titleTooLong: isEs ? "El título es demasiado largo." : "Title is too long.",
        contentTooLong: isEs ? "El contenido es demasiado largo." : "Content is too long.",
        project_not_found: isEs ? "Proyecto no encontrado." : "Project not found.",
        not_authenticated: isEs ? "Sesión no válida." : "Not authenticated.",
      };
      return { error: map[result.error] || (isEs ? "Error inesperado al guardar." : "Unexpected error while saving.") };
    }

    onSaved();
    onClose();
    return null;
  }

  const [state, formAction, isPending] = useActionState(handleSubmit, null);

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div className="m-auto w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? (isEs ? "Editar recuerdo" : "Edit memory item") : (isEs ? "Añadir a la memoria del proyecto" : "Add to project memory")}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {state?.error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            {state.error}
          </div>
        )}

        <form action={formAction} className="mt-4 space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="mem-title" className="block text-sm font-medium text-foreground">
              {isEs ? "Título" : "Title"} <span className="text-red-500">*</span>
            </label>
            <input id="mem-title" name="title" type="text" required maxLength={300} autoFocus
              defaultValue={item?.title ?? ""} className={inputCls} disabled={isPending}
              placeholder={isEs ? "p. ej., Email del cliente sobre el cambio de fecha" : "e.g., Client email about the date change"} />
          </div>

          {/* Source type + Importance + Occurred date */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="mem-source" className="block text-sm font-medium text-foreground">{isEs ? "Tipo de fuente" : "Source type"}</label>
              <select id="mem-source" name="sourceType" defaultValue={item?.sourceType ?? "manual_note"} className={inputCls} disabled={isPending}>
                {SOURCE_TYPES.map((st) => (
                  <option key={st} value={st}>{isEs ? SOURCE_META[st].es : SOURCE_META[st].en}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="mem-importance" className="block text-sm font-medium text-foreground">{isEs ? "Importancia" : "Importance"}</label>
              <select id="mem-importance" name="importanceLevel" defaultValue={item?.importanceLevel ?? "medium"} className={inputCls} disabled={isPending}>
                {IMPORTANCE.map((o) => <option key={o.value} value={o.value}>{isEs ? o.es : o.en}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="mem-date" className="block text-sm font-medium text-foreground">{isEs ? "Fecha del evento" : "Occurred date"}</label>
              <input id="mem-date" name="occurredAt" type="date" className={inputCls} disabled={isPending}
                defaultValue={item?.occurredAt ? item.occurredAt.slice(0, 10) : ""} />
            </div>
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <label htmlFor="mem-content" className="block text-sm font-medium text-foreground">{isEs ? "Contenido" : "Content"}</label>
            <textarea id="mem-content" name="content" rows={6} maxLength={20000} className={`${inputCls} resize-y`} disabled={isPending}
              defaultValue={item?.content ?? ""}
              placeholder={isEs ? "Pega el email, la nota de reunión o escribe el contexto…" : "Paste the email, meeting note, or write the context…"} />
          </div>

          {/* Summary (optional; AI fills if blank) */}
          <div className="space-y-1.5">
            <label htmlFor="mem-summary" className="block text-sm font-medium text-foreground">
              {isEs ? "Resumen (opcional)" : "Summary (optional)"}
            </label>
            <textarea id="mem-summary" name="summary" rows={2} maxLength={2000} className={`${inputCls} resize-none`} disabled={isPending}
              defaultValue={item?.summary ?? ""}
              placeholder={isEs ? "Si lo dejas vacío, la IA lo generará." : "Leave blank and AI will generate it."} />
          </div>

          {/* Author + Participants */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="mem-author" className="block text-sm font-medium text-foreground">{isEs ? "Autor / fuente" : "Author / source"}</label>
              <input id="mem-author" name="authorName" type="text" maxLength={200} className={inputCls} disabled={isPending}
                defaultValue={item?.authorName ?? ""} placeholder={isEs ? "Quién lo dijo o envió" : "Who said or sent it"} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="mem-participants" className="block text-sm font-medium text-foreground">{isEs ? "Participantes (separados por comas)" : "Participants (comma-separated)"}</label>
              <input id="mem-participants" name="participants" type="text" className={inputCls} disabled={isPending}
                defaultValue={item?.participants?.join(", ") ?? ""} placeholder="Ana, Luis, Client PM" />
            </div>
          </div>

          {/* Author email + Source system */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="mem-email" className="block text-sm font-medium text-foreground">{isEs ? "Email del autor (opcional)" : "Author email (optional)"}</label>
              <input id="mem-email" name="authorEmail" type="text" maxLength={200} className={inputCls} disabled={isPending}
                defaultValue={item?.authorEmail ?? ""} placeholder="name@company.com" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="mem-system" className="block text-sm font-medium text-foreground">{isEs ? "Sistema de origen (opcional)" : "Source system (optional)"}</label>
              <input id="mem-system" name="sourceSystem" type="text" maxLength={100} className={inputCls} disabled={isPending}
                defaultValue={item?.sourceSystem ?? ""} placeholder={isEs ? "Gmail, Teams, en persona…" : "Gmail, Teams, in person…"} />
            </div>
          </div>

          {/* Tags + Visibility */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="mem-tags" className="block text-sm font-medium text-foreground">{isEs ? "Etiquetas (separadas por comas)" : "Tags (comma-separated)"}</label>
              <input id="mem-tags" name="tags" type="text" className={inputCls} disabled={isPending}
                defaultValue={item?.tags?.join(", ") ?? ""} placeholder={isEs ? "cronograma, presupuesto" : "schedule, budget"} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="mem-visibility" className="block text-sm font-medium text-foreground">{isEs ? "Visibilidad" : "Visibility"}</label>
              <select id="mem-visibility" name="visibility" defaultValue={item?.visibility ?? "project"} className={inputCls} disabled={isPending}>
                {VISIBILITY.map((o) => <option key={o.value} value={o.value}>{isEs ? o.es : o.en}</option>)}
              </select>
            </div>
          </div>

          {/* AI toggle */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <input name="runAi" type="checkbox" defaultChecked={!isEdit} disabled={isPending}
              className="mt-0.5 h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500/20" />
            <span className="text-sm">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-brand-500" />
                {isEs ? "Analizar con IA" : "Analyze with AI"}
              </span>
              <span className="text-xs text-muted-foreground">
                {isEs
                  ? "Detecta decisiones, riesgos, acciones, impactos y genera un resumen. El recuerdo se guarda aunque la IA falle."
                  : "Detects decisions, risks, actions, impacts and writes a summary. The item is saved even if AI fails."}
              </span>
            </span>
          </label>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={isPending}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50">
              {isEs ? "Cancelar" : "Cancel"}
            </button>
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? (isEs ? "Guardar cambios" : "Save changes") : (isEs ? "Añadir recuerdo" : "Add memory")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
