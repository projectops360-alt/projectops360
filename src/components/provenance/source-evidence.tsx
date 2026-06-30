"use client";

// ============================================================================
// Evidence Provenance — "Source / Evidence" section (PD-012, TASK 5)
// ============================================================================
// Self-contained, bilingual evidence panel for a task / decision / risk detail.
// Fetches record-backed provenance on mount. When no source is linked it shows
// the gap honestly ("No source evidence linked yet.") — it never hides a missing
// source. Source excerpts are redacted server-side for external viewers.
// ============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileSearch, Mic, FileText, Users2, ExternalLink, BookOpen, Sparkles, AlertTriangle } from "lucide-react";
import type { EntityProvenance } from "@/lib/provenance/types";
import type { Locale } from "@/types/database";
import { askIsabella } from "@/lib/isabella/ask-isabella";
import { getEntityProvenanceAction } from "./actions";

interface Props {
  entityType: "task" | "work_item" | "decision" | "risk";
  entityId: string;
  projectId: string;
  locale: Locale;
  /** Optional title used by the "Ask Isabella" deep link. */
  entityTitle?: string;
}

const copy = (locale: Locale) => {
  const es = locale === "es";
  return {
    heading: es ? "Fuente / Evidencia" : "Source / Evidence",
    loading: es ? "Cargando procedencia…" : "Loading provenance…",
    noSource: es ? "Aún no hay evidencia de fuente vinculada." : "No source evidence linked yet.",
    noSourceHint: es
      ? "Esta es una brecha de trazabilidad: el origen de este ítem no está registrado."
      : "This is a traceability gap: this item's origin is not recorded.",
    createdFrom: es ? "Creado desde" : "Created from",
    sourceExcerpt: es ? "Extracto de la fuente" : "Source excerpt",
    approvedBy: es ? "Aprobado por" : "Approved by",
    sourceRecord: es ? "Registro fuente" : "Source record",
    openSource: es ? "Abrir la nota fuente" : "Open source note",
    openMeeting: es ? "Abrir la reunión" : "Open meeting",
    viewInMemory: es ? "Ver en Project Memory" : "View in Project Memory",
    askIsabella: es ? "Preguntar a Isabella por esta fuente" : "Ask Isabella about this source",
    incomplete: es
      ? "Procedencia incompleta: parte del registro de fuente no pudo resolverse."
      : "Provenance incomplete: part of the source record could not be resolved.",
    labels: {
      scribe_voice_note: es ? "Nota de voz de ProjectOps Scribe" : "ProjectOps Scribe voice note",
      scribe_note: es ? "Nota de ProjectOps Scribe" : "ProjectOps Scribe note",
      meeting: es ? "Reunión (Rythm)" : "Meeting (Rythm)",
      manual: es ? "Creado manualmente" : "Created manually",
      import: es ? "Importado" : "Imported",
      unknown: es ? "Origen desconocido" : "Unknown source",
    } as Record<string, string>,
  };
};

function sourceIcon(sourceType: string) {
  if (sourceType === "scribe_voice_note") return <Mic className="h-4 w-4" />;
  if (sourceType === "scribe_note") return <FileText className="h-4 w-4" />;
  if (sourceType === "meeting") return <Users2 className="h-4 w-4" />;
  return <FileSearch className="h-4 w-4" />;
}

export function SourceEvidence({ entityType, entityId, projectId, locale, entityTitle }: Props) {
  const t = copy(locale);
  const [state, setState] = useState<{ loading: boolean; prov: EntityProvenance | null }>({
    loading: true,
    prov: null,
  });

  useEffect(() => {
    let active = true;
    setState({ loading: true, prov: null });
    getEntityProvenanceAction({ entityType, entityId, projectId, locale })
      .then((res) => {
        if (!active) return;
        setState({ loading: false, prov: res.ok ? res.provenance : null });
      })
      .catch(() => active && setState({ loading: false, prov: null }));
    return () => {
      active = false;
    };
  }, [entityType, entityId, projectId, locale]);

  const isUnknown = !state.prov || !state.prov.found || state.prov.sourceType === "unknown";

  // "Ask Isabella" — opens the assistant (single event mechanism, UX-014) seeded
  // with the provenance question and this entity's context. Never a dead link.
  const askQuery =
    locale === "es"
      ? `¿De dónde vino este ${entityType === "decision" ? "decisión" : entityType === "risk" ? "riesgo" : "tarea"}${entityTitle ? `: "${entityTitle}"` : ""}?`
      : `Where did this ${entityType === "decision" ? "decision" : entityType === "risk" ? "risk" : "task"}${entityTitle ? ` "${entityTitle}"` : ""} come from?`;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <FileSearch className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">{t.heading}</h3>
      </div>

      {state.loading ? (
        <p className="mt-3 text-sm text-muted-foreground/70">{t.loading}</p>
      ) : isUnknown ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{t.noSource}</p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300/80">{t.noSourceHint}</p>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t.createdFrom}</p>
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
              {sourceIcon(state.prov!.sourceType)}
              {t.labels[state.prov!.sourceType] ?? state.prov!.sourceType}
            </p>
          </div>

          {state.prov!.sourceExcerpt && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t.sourceExcerpt}</p>
              <blockquote className="mt-1 border-l-2 border-brand-300 pl-3 text-sm italic text-muted-foreground">
                “{state.prov!.sourceExcerpt}”
              </blockquote>
            </div>
          )}

          {state.prov!.approval.approvedByName && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t.approvedBy}</p>
              <p className="mt-0.5 text-sm text-foreground">
                {state.prov!.approval.approvedByName}
                {state.prov!.approval.approvedAt ? ` · ${state.prov!.approval.approvedAt.slice(0, 10)}` : ""}
              </p>
            </div>
          )}

          {state.prov!.sourceRecord.title && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t.sourceRecord}</p>
              <p className="mt-0.5 text-sm text-foreground">{state.prov!.sourceRecord.title}</p>
            </div>
          )}

          {state.prov!.provenanceIncomplete && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{t.incomplete}</p>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            {state.prov!.sourceRecord.href && (
              <Link
                href={state.prov!.sourceRecord.href}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
              >
                {state.prov!.sourceRecord.kind === "meeting" ? (
                  <>
                    <ExternalLink className="h-3.5 w-3.5" /> {t.openMeeting}
                  </>
                ) : (
                  <>
                    <BookOpen className="h-3.5 w-3.5" /> {t.viewInMemory}
                  </>
                )}
              </Link>
            )}
            <button
              type="button"
              onClick={() =>
                askIsabella({ query: askQuery, entity: { type: entityType, id: entityId, title: entityTitle } })
              }
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              <Sparkles className="h-3.5 w-3.5" /> {t.askIsabella}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
