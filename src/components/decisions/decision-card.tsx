"use client";

import Link from "next/link";
import { localizedHref } from "@/i18n/href";
import type { Decision, ImpactArea, DecisionStatus } from "@/types/database";
import { getI18nValue, type Locale } from "@/types/database";
import { DecisionStatusBadge } from "./decision-status-badge";
import { ImpactBadge } from "./impact-badge";

interface DecisionCardProps {
  decision: Decision;
  locale: Locale;
  projectId: string;
  labels: {
    status: Record<DecisionStatus, string>;
    impactArea: Record<ImpactArea, string>;
    noImpactArea: string;
    noDate: string;
  };
}

export function DecisionCard({
  decision,
  locale,
  projectId,
  labels,
}: DecisionCardProps) {
  const title = getI18nValue(decision.title_i18n, locale, "Untitled");
  const description = getI18nValue(decision.description_i18n, locale);
  const date = decision.decision_date
    ? new Date(decision.decision_date).toLocaleDateString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : labels.noDate;

  return (
    <Link
      href={localizedHref(locale, `/projects/${projectId}/decisions/${decision.id}`)}
      className="block rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <DecisionStatusBadge
          status={decision.status}
          label={labels.status[decision.status]}
        />
      </div>

      {description && (
        <p className="mt-1 line-clamp-2 text-xs text-gray-600">{description}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span>{date}</span>

        {decision.impact_area && (
          <ImpactBadge
            impactArea={decision.impact_area}
            label={labels.impactArea[decision.impact_area]}
          />
        )}

        {decision.decision_maker && (
          <span className="truncate text-gray-400">
            · {decision.decision_maker}
          </span>
        )}
      </div>
    </Link>
  );
}