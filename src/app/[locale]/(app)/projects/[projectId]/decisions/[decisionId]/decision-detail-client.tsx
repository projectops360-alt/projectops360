"use client";

import { useState, useCallback } from "react";
import { localizedHref } from "@/i18n/href";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, User, Link2, ExternalLink, Pencil, Trash2 } from "lucide-react";
import type { Decision, DecisionStatus, DecisionSourceType, ImpactArea, TraceableEntityType, LinkType, Locale } from "@/types/database";
import { getI18nValue } from "@/types/database";
import { DecisionStatusBadge } from "@/components/decisions/decision-status-badge";
import { ImpactBadge } from "@/components/decisions/impact-badge";
import { EditDecisionDialog } from "@/components/decisions/edit-decision-dialog";
import { LinkedRecords, type ResolvedLink } from "@/components/links/linked-records";
import { SourceEvidence } from "@/components/provenance/source-evidence";
import { archiveDecisionAction } from "../actions";

interface StakeholderOption {
  id: string;
  name: string;
}

interface EntityOption {
  id: string;
  title: string;
}

interface LinksTranslations {
  title: string;
  empty: string;
  emptyDescription: string;
  addLink: string;
  removeLink: string;
  removeConfirm: string;
  context: string;
  createdAt: string;
  entityTypeLabels: Partial<Record<TraceableEntityType, string>>;
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
    entityTypeLabels: Partial<Record<TraceableEntityType, string>>;
    linkTypeLabels: Record<LinkType, string>;
    errors: {
      targetRequired: string;
      linkTypeRequired: string;
      contextTooLong: string;
      duplicate: string;
      unexpected: string;
    };
  };
}

interface Translations {
  back: string;
  date: string;
  decisionMaker: string;
  source: string;
  noSource: string;
  evidence: string;
  description: string;
  noDescription: string;
  rationale: string;
  noRationale: string;
  linkedStakeholders: string;
  noStakeholders: string;
  linkedRecords: string;
  edit: string;
  archive: string;
  archiveConfirm: string;
  statusLabels: Record<DecisionStatus, string>;
  impactAreaLabels: Record<ImpactArea, string>;
  sourceTypeLabels: Record<DecisionSourceType, string>;
  linksTranslations: LinksTranslations;
}

interface DecisionDetailClientProps {
  projectId: string;
  projectTitle: string;
  decision: Decision;
  stakeholders: StakeholderOption[];
  locale: Locale;
  links: ResolvedLink[];
  availableDecisions: EntityOption[];
  availableMeetings: EntityOption[];
  availableCommunications: EntityOption[];
  availableDocuments: EntityOption[];
  translations: Translations;
}

export function DecisionDetailClient({
  projectId,
  projectTitle,
  decision,
  stakeholders,
  locale,
  links,
  availableDecisions,
  availableMeetings,
  availableCommunications,
  availableDocuments,
  translations: t,
}: DecisionDetailClientProps) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);

  const title = getI18nValue(decision.title_i18n, locale) || "Untitled";
  const description = getI18nValue(decision.description_i18n, locale);
  const rationale = getI18nValue(decision.rationale_i18n, locale);

  const formattedDate = decision.decision_date
    ? new Date(decision.decision_date).toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const handleArchive = useCallback(async () => {
    if (!confirm(t.archiveConfirm)) return;
    const result = await archiveDecisionAction(decision.id);
    if (!result.error) {
      router.push(localizedHref(locale, `/projects/${projectId}/decisions`));
    }
  }, [decision.id, t.archiveConfirm, router, locale, projectId]);

  const handleSaved = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href={localizedHref(locale, `/projects/${projectId}/decisions`)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.back}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <DecisionStatusBadge
              status={decision.status}
              label={t.statusLabels[decision.status]}
            />
            {decision.impact_area && (
              <ImpactBadge
                impactArea={decision.impact_area}
                label={t.impactAreaLabels[decision.impact_area]}
              />
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{projectTitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEdit(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
            {t.edit}
          </button>
          <button
            type="button"
            onClick={handleArchive}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            <Trash2 className="h-4 w-4" />
            {t.archive}
          </button>
        </div>
      </div>

      {/* Metadata grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {formattedDate && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {t.date}
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">{formattedDate}</p>
          </div>
        )}
        {decision.decision_maker && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              {t.decisionMaker}
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">{decision.decision_maker}</p>
          </div>
        )}
        {decision.source_type && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" />
              {t.source}
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {t.sourceTypeLabels[decision.source_type] || decision.source_type}
            </p>
          </div>
        )}
        {decision.evidence_url && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <ExternalLink className="h-3.5 w-3.5" />
              {t.evidence}
            </div>
            <a
              href={decision.evidence_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-sm font-semibold text-brand-600 hover:text-brand-700 hover:underline"
            >
              {decision.evidence_url.length > 40
                ? decision.evidence_url.substring(0, 40) + "…"
                : decision.evidence_url}
            </a>
          </div>
        )}
      </div>

      {/* Source / Evidence (PD-012 provenance) */}
      <SourceEvidence
        entityType="decision"
        entityId={decision.id}
        projectId={projectId}
        locale={locale}
        entityTitle={title}
      />

      {/* Description */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground">{t.description}</h3>
        {description ? (
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{description}</p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground/60">{t.noDescription}</p>
        )}
      </div>

      {/* Rationale */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground">{t.rationale}</h3>
        {rationale ? (
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{rationale}</p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground/60">{t.noRationale}</p>
        )}
      </div>

      {/* Linked Records (Traceability) */}
      <LinkedRecords
        projectId={projectId}
        sourceEntityType="decision"
        sourceEntityId={decision.id}
        links={links}
        availableDecisions={availableDecisions}
        availableMeetings={availableMeetings}
        availableCommunications={availableCommunications}
        availableDocuments={availableDocuments}
        locale={locale}
        translations={t.linksTranslations}
      />

      {/* Edit dialog */}
      {showEdit && (
        <EditDecisionDialog
          decision={decision}
          locale={locale}
          projectId={projectId}
          stakeholders={stakeholders}
          linkedStakeholderIds={[]}
          onClose={() => setShowEdit(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}