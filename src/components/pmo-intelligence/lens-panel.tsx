"use client";

// ============================================================================
// PMO Intelligence Center — lens findings panel (CAP-048 Phase 2, M4)
// ============================================================================
// What the active lens has to say about the canvas, in words.
//
// The graph carries the emphasis; this carries the reason. A highlighted node
// with no stated cause is decoration, and every number here names the engine or
// projection that produced it — CAP-048 §5 for capacity in particular, where
// two engines report in different units and an unlabelled figure is worse than
// no figure.
//
// Gaps are rendered as first-class content, not as an empty state. "No benefits
// data model exists" is a real answer and must not look like a loading failure.
// ============================================================================

import { useTranslations } from "next-intl";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import type {
  LensAnnotation,
  LensAnnotationTone,
  LensNotice,
  LensProjection,
} from "@/lib/pmo-intelligence/lens-projection";

const TONE_CLASS: Record<LensAnnotationTone, string> = {
  critical: "border-rose-200 bg-rose-50 text-rose-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
};

export interface PmoLensPanelProps {
  projection: LensProjection;
  /** Node id → label, so a finding names the thing rather than its id. */
  labelsById: ReadonlyMap<string, string>;
  onSelectNode: (nodeId: string) => void;
}

export function PmoLensPanel({ projection, labelsById, onSelectNode }: PmoLensPanelProps) {
  const t = useTranslations("pmoIntelligence");

  const hasContent =
    projection.annotations.length > 0 || projection.notices.length > 0;

  return (
    <aside className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-3 py-2">
        <h2 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
          {t(`lens_${projection.lens}`)}
        </h2>
        {!projection.hasData ? (
          <p className="mt-1 text-[11px] font-semibold text-slate-500">{t("lensNoData")}</p>
        ) : null}
      </header>

      {projection.notices.length > 0 ? (
        <ul className="space-y-1.5 border-b border-slate-100 p-3">
          {projection.notices.map((notice, index) => (
            <NoticeRow key={`${notice.key}-${index}`} notice={notice} />
          ))}
        </ul>
      ) : null}

      {projection.annotations.length > 0 ? (
        <ul className="space-y-1.5 p-3">
          {projection.annotations.map((annotation, index) => (
            <AnnotationRow
              key={`${annotation.nodeId}-${annotation.labelKey}-${index}`}
              annotation={annotation}
              label={labelsById.get(annotation.nodeId) ?? annotation.nodeId}
              onSelect={() => onSelectNode(annotation.nodeId)}
            />
          ))}
        </ul>
      ) : null}

      {!hasContent ? (
        <p className="p-3 text-xs text-slate-500">{t("lensNoFindings")}</p>
      ) : null}
    </aside>
  );
}

function NoticeRow({ notice }: { notice: LensNotice }) {
  const t = useTranslations("pmoIntelligence");
  const Icon = notice.tone === "critical" ? CircleAlert : notice.tone === "warning" ? TriangleAlert : Info;

  // Values that are themselves message keys (the capacity engine name) are
  // translated before interpolation, so the sentence reads correctly in both
  // languages rather than embedding an English identifier in Spanish prose.
  const values = notice.values
    ? Object.fromEntries(
        Object.entries(notice.values).map(([key, value]) =>
          key === "engine" && typeof value === "string" ? [key, t(value)] : [key, value],
        ),
      )
    : undefined;

  return (
    <li
      className={`flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-[11px] ${TONE_CLASS[notice.tone]}`}
    >
      <Icon className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        {t(notice.key, values)}
        {notice.isGap ? (
          <span className="ml-1 rounded bg-white/70 px-1 text-[9px] font-bold uppercase tracking-wide">
            {t("gapBadge")}
          </span>
        ) : null}
      </span>
    </li>
  );
}

function AnnotationRow({
  annotation,
  label,
  onSelect,
}: {
  annotation: LensAnnotation;
  label: string;
  onSelect: () => void;
}) {
  const t = useTranslations("pmoIntelligence");

  const values = annotation.values
    ? Object.fromEntries(
        Object.entries(annotation.values).map(([key, value]) =>
          key === "engine" && typeof value === "string" ? [key, t(value)] : [key, value],
        ),
      )
    : undefined;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`w-full rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors hover:brightness-95 ${TONE_CLASS[annotation.tone]}`}
      >
        <span className="block font-bold">{label}</span>
        <span className="block">{t(annotation.labelKey, values)}</span>
        {/* The producing engine/projection, always. A number without its source
            cannot be checked, and CAP-048 §5 makes the unit ambiguous without it. */}
        <span className="mt-0.5 block text-[10px] font-medium opacity-70">
          {t("sourceLabel", { source: annotation.source })}
        </span>
      </button>
    </li>
  );
}
