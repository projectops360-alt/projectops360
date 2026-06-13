"use client";

import { useState, useCallback } from "react";
import { localizedHref } from "@/i18n/href";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import type { TraceableEntityType, LinkType, I18nField, Locale } from "@/types/database";
import { getI18nValue } from "@/types/database";
import { EntityTypeIcon } from "./entity-type-icon";
import { LinkTypeBadge } from "./link-type-badge";
import { CreateLinkDialog } from "./create-link-dialog";
import { deleteLinkAction } from "@/app/[locale]/(app)/projects/[projectId]/links/actions";

export interface ResolvedLink {
  id: string;
  linkType: LinkType;
  contextI18n: I18nField;
  createdAt: string;
  otherType: TraceableEntityType;
  otherId: string;
  otherTitle: string;
  direction: "outgoing" | "incoming";
}

interface EntityOption {
  id: string;
  title: string;
}

const entityRouteSegment: Record<TraceableEntityType, string> = {
  decision: "decisions",
  meeting: "meetings",
  communication: "communications",
  document: "documents",
  action_item: "action-items",
  stakeholder: "stakeholders",
  project: "projects",
};

interface LinkedRecordsProps {
  projectId: string;
  sourceEntityType: TraceableEntityType;
  sourceEntityId: string;
  links: ResolvedLink[];
  availableDecisions: EntityOption[];
  availableMeetings: EntityOption[];
  availableCommunications: EntityOption[];
  availableDocuments: EntityOption[];
  locale: Locale;
  translations: {
    title: string;
    empty: string;
    emptyDescription: string;
    addLink: string;
    removeLink: string;
    removeConfirm: string;
    context: string;
    createdAt: string;
    entityTypeLabels: Record<TraceableEntityType, string>;
    linkTypeLabels: Record<LinkType, string>;
    dialogTranslations: {
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
  };
}

export function LinkedRecords({
  projectId,
  sourceEntityType,
  sourceEntityId,
  links,
  availableDecisions,
  availableMeetings,
  availableCommunications,
  availableDocuments,
  locale,
  translations: t,
}: LinkedRecordsProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);

  const handleDelete = useCallback(
    async (linkId: string) => {
      if (!confirm(t.removeConfirm)) return;
      const result = await deleteLinkAction(linkId);
      if (!result.error) {
        router.refresh();
      }
    },
    [t.removeConfirm, router],
  );

  const handleCreated = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          {t.addLink}
        </button>
      </div>

      {links.length === 0 ? (
        <div className="mt-3 text-center py-6">
          <p className="text-sm text-muted-foreground">{t.empty}</p>
          <p className="mt-1 text-xs text-muted-foreground/60">{t.emptyDescription}</p>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {links.map((link) => {
            const routeBase = entityRouteSegment[link.otherType];
            const href = localizedHref(locale, `/projects/${projectId}/${routeBase}/${link.otherId}`);
            const contextText = getI18nValue(link.contextI18n, locale);
            const formattedDate = new Date(link.createdAt).toLocaleDateString(locale, {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <div
                key={link.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-background p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
                  <EntityTypeIcon entityType={link.otherType} className="h-4 w-4 text-brand-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={href}
                      className="text-sm font-medium text-foreground hover:text-brand-600 hover:underline truncate"
                    >
                      {link.otherTitle}
                    </Link>
                    <LinkTypeBadge
                      linkType={link.linkType}
                      label={t.linkTypeLabels[link.linkType]}
                    />
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <EntityTypeIcon entityType={link.otherType} className="h-3 w-3" />
                      {t.entityTypeLabels[link.otherType]}
                    </span>
                    <span>· {t.createdAt} {formattedDate}</span>
                  </div>
                  {contextText && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{contextText}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(link.id)}
                  className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                  title={t.removeLink}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateLinkDialog
          projectId={projectId}
          sourceEntityType={sourceEntityType}
          sourceEntityId={sourceEntityId}
          availableDecisions={availableDecisions}
          availableMeetings={availableMeetings}
          availableCommunications={availableCommunications}
          availableDocuments={availableDocuments}
          locale={locale}
          translations={t.dialogTranslations}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}