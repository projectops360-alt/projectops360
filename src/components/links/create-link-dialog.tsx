"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { X, Loader2 } from "lucide-react";
import { createLinkAction } from "@/app/[locale]/(app)/projects/[projectId]/links/actions";
import type { TraceableEntityType, LinkType, Locale } from "@/types/database";

type CreateState =
  | { error: string; success?: undefined; linkId?: undefined }
  | { error?: undefined; success: true; linkId: string }
  | null;

const TARGET_TYPES: TraceableEntityType[] = ["decision", "meeting", "communication", "document"];
const LINK_TYPES: LinkType[] = ["related_to", "caused_by", "depends_on", "supersedes", "derived_from", "contradicts"];

interface EntityOption {
  id: string;
  title: string;
}

interface CreateLinkDialogProps {
  projectId: string;
  sourceEntityType: TraceableEntityType;
  sourceEntityId: string;
  availableDecisions: EntityOption[];
  availableMeetings: EntityOption[];
  availableCommunications: EntityOption[];
  availableDocuments: EntityOption[];
  locale: Locale;
  translations: {
    title: string;
    targetType: string;
    targetRecord: string;
    linkType: string;
    contextNotes: string;
    contextNotesPlaceholder: string;
    submit: string;
    cancel: string;
    entityTypeLabels: Record<TraceableEntityType, string>;
    linkTypeLabels: Record<LinkType, string>;
    errors: {
      targetRequired: string;
      linkTypeRequired: string;
      contextTooLong: string;
      duplicate: string;
      unexpected: string;
    };
  };
  onClose: () => void;
  onCreated: () => void;
}

export function CreateLinkDialog({
  projectId,
  sourceEntityType,
  sourceEntityId,
  availableDecisions,
  availableMeetings,
  availableCommunications,
  availableDocuments,
  locale,
  translations: t,
  onClose,
  onCreated,
}: CreateLinkDialogProps) {
  const [targetType, setTargetType] = useState<TraceableEntityType | "">("");
  const [targetId, setTargetId] = useState("");
  const [selectedLinkType, setSelectedLinkType] = useState<LinkType | "">("");

  const catalogs: Record<string, EntityOption[]> = {
    decision: availableDecisions,
    meeting: availableMeetings,
    communication: availableCommunications,
    document: availableDocuments,
  };

  async function handleCreate(
    _prevState: CreateState,
    formData: FormData,
  ): Promise<CreateState> {
    const currentTargetType = formData.get("targetType") as string;
    const currentTargetId = formData.get("targetId") as string;
    const currentLinkType = formData.get("linkType") as string;
    const context = (formData.get("context") as string)?.trim();

    if (!currentTargetId) {
      return { error: t.errors.targetRequired };
    }
    if (!currentLinkType) {
      return { error: t.errors.linkTypeRequired };
    }

    const result = await createLinkAction({
      sourceType: sourceEntityType,
      sourceId: sourceEntityId,
      targetType: currentTargetType,
      targetId: currentTargetId,
      linkType: currentLinkType,
      context,
      locale,
    });

    if (result.error) {
      const errorMap: Record<string, string> = {
        contextTooLong: t.errors.contextTooLong,
        duplicate: t.errors.duplicate,
        unexpected: t.errors.unexpected,
      };
      return { error: errorMap[result.error] || t.errors.unexpected };
    }

    onCreated();
    onClose();
    return { success: true as const, linkId: result.linkId ?? "" };
  }

  const [state, formAction, isPending] = useActionState(handleCreate, null);

  const currentOptions = targetType ? (catalogs[targetType] ?? []) : [];

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div className="m-auto w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {state?.error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            {state.error}
          </div>
        )}

        <form action={formAction} className="mt-4 space-y-4">
          {/* Target Type */}
          <div className="space-y-2">
            <label htmlFor="link-target-type" className="block text-sm font-medium text-foreground">
              {t.targetType}
            </label>
            <select
              id="link-target-type"
              name="targetType"
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value as TraceableEntityType);
                setTargetId("");
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              disabled={isPending}
            >
              <option value="">—</option>
              {TARGET_TYPES.map((tt) => (
                <option key={tt} value={tt}>
                  {t.entityTypeLabels[tt]}
                </option>
              ))}
            </select>
          </div>

          {/* Target Record */}
          {targetType && (
            <div className="space-y-2">
              <label htmlFor="link-target-record" className="block text-sm font-medium text-foreground">
                {t.targetRecord}
              </label>
              <select
                id="link-target-record"
                name="targetId"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                disabled={isPending || currentOptions.length === 0}
              >
                <option value="">—</option>
                {currentOptions
                  .filter((opt) => !(opt.id === sourceEntityId && targetType === sourceEntityType))
                  .map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.title}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Link Type */}
          <div className="space-y-2">
            <label htmlFor="link-type" className="block text-sm font-medium text-foreground">
              {t.linkType}
            </label>
            <select
              id="link-type"
              name="linkType"
              value={selectedLinkType}
              onChange={(e) => setSelectedLinkType(e.target.value as LinkType)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              disabled={isPending}
            >
              <option value="">—</option>
              {LINK_TYPES.map((lt) => (
                <option key={lt} value={lt}>
                  {t.linkTypeLabels[lt]}
                </option>
              ))}
            </select>
          </div>

          {/* Context Notes */}
          <div className="space-y-2">
            <label htmlFor="link-context" className="block text-sm font-medium text-foreground">
              {t.contextNotes}
            </label>
            <textarea
              id="link-context"
              name="context"
              rows={2}
              maxLength={2000}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
              placeholder={t.contextNotesPlaceholder}
              disabled={isPending}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isPending || !targetType || !targetId || !selectedLinkType}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? "…" : t.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}