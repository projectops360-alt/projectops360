"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  X, Pencil, Trash2, Sparkles, Link2, Plus, Loader2, AlertTriangle, Lightbulb,
} from "lucide-react";
import {
  archiveMemoryItemAction,
  reclassifyMemoryItemAction,
  linkMemoryItemAction,
  unlinkMemoryItemAction,
} from "@/app/[locale]/(app)/projects/[projectId]/memory/actions";
import {
  SourceTypeBadge, ImportanceDot, ClassificationBadges, ENTITY_TYPE_META, LINK_TYPE_META,
} from "./memory-badges";
import type { MemoryItemView, LinkableEntities, LinkableEntityType } from "./types";
import { MemoryDerivedItems } from "@/components/provenance/memory-derived-items";
import type { Locale } from "@/types/database";

interface MemoryDetailPanelProps {
  locale: Locale;
  projectId: string;
  item: MemoryItemView;
  entities: LinkableEntities;
  onClose: () => void;
  onEdit: () => void;
}

const ENTITY_ORDER: LinkableEntityType[] = [
  "task", "milestone", "decision", "risk", "stakeholder", "document", "communication", "meeting",
];

function fmt(date: string | null, locale: string): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

export function MemoryDetailPanel({ locale, projectId, item, entities, onClose, onEdit }: MemoryDetailPanelProps) {
  const isEs = locale === "es";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showLinker, setShowLinker] = useState(false);
  const [linkType, setLinkType] = useState<LinkableEntityType>("task");
  const [linkTargetId, setLinkTargetId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ai = item.aiClassification ?? {};
  const hasFlags =
    !!ai.contains_decision || !!ai.contains_risk || !!ai.contains_action_item ||
    !!ai.contains_scope_change || !!ai.contains_schedule_impact || !!ai.contains_cost_impact ||
    !!ai.contains_stakeholder_concern;

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleArchive() {
    if (!confirm(isEs ? "¿Archivar este recuerdo? Se quitará de la búsqueda." : "Archive this memory item? It will be removed from search.")) return;
    const res = await archiveMemoryItemAction({ memoryItemId: item.id, projectId, locale });
    if (res.error) { setError(isEs ? "No se pudo archivar." : "Could not archive."); return; }
    onClose();
    refresh();
  }

  async function handleReclassify() {
    const res = await reclassifyMemoryItemAction({ memoryItemId: item.id, projectId, locale });
    if (res.error) { setError(isEs ? "No se pudo reanalizar." : "Could not re-analyze."); return; }
    refresh();
  }

  async function handleAddLink() {
    setError(null);
    if (!linkTargetId) return;
    const res = await linkMemoryItemAction({
      memoryItemId: item.id, targetType: linkType, targetId: linkTargetId, projectId, locale,
    });
    if (res.error) {
      setError(res.error === "duplicate" ? (isEs ? "Ese vínculo ya existe." : "That link already exists.") : (isEs ? "No se pudo vincular." : "Could not link."));
      return;
    }
    setShowLinker(false);
    setLinkTargetId("");
    refresh();
  }

  async function handleRemoveLink(linkId: string) {
    const res = await unlinkMemoryItemAction({ linkId, projectId, locale });
    if (res.error) { setError(isEs ? "No se pudo quitar el vínculo." : "Could not remove link."); return; }
    refresh();
  }

  const targetOptions = entities[linkType] ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-card/95 px-6 py-4 backdrop-blur">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <SourceTypeBadge type={item.sourceType} isEs={isEs} />
              <ImportanceDot level={item.importanceLevel} isEs={isEs} />
              {item.indexStatus === "failed" && (
                <span className="inline-flex items-center gap-1 text-[11px] text-red-500" title={isEs ? "No indexado" : "Not indexed"}>
                  <AlertTriangle className="h-3 w-3" />{isEs ? "Indexación falló" : "Indexing failed"}
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-foreground">{item.title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {item.authorName && <>{item.authorName} · </>}
              {fmt(item.occurredAt ?? item.createdAt, locale)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">{error}</div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button onClick={onEdit} disabled={isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50">
              <Pencil className="h-3.5 w-3.5" />{isEs ? "Editar" : "Edit"}
            </button>
            <button onClick={handleReclassify} disabled={isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50">
              <Sparkles className="h-3.5 w-3.5 text-brand-500" />{isEs ? "Reanalizar con IA" : "Re-analyze with AI"}
            </button>
            <button onClick={handleArchive} disabled={isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40 disabled:opacity-50">
              <Trash2 className="h-3.5 w-3.5" />{isEs ? "Archivar" : "Archive"}
            </button>
          </div>

          {/* AI Summary */}
          {item.summary && (
            <section>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{isEs ? "Resumen" : "Summary"}</h3>
              <p className="text-sm text-foreground">{item.summary}</p>
            </section>
          )}

          {/* AI classification */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-brand-500" />{isEs ? "Clasificación IA" : "AI Classification"}
            </h3>
            {item.aiStatus === "pending" || item.aiStatus === "processing" ? (
              <p className="text-xs text-amber-600">{isEs ? "Análisis en curso…" : "Analysis in progress…"}</p>
            ) : item.aiStatus === "failed" ? (
              <p className="text-xs text-red-500">{isEs ? "El análisis IA falló. Usa “Reanalizar”." : "AI analysis failed. Use “Re-analyze”."}</p>
            ) : item.aiStatus === "skipped" ? (
              <p className="text-xs text-muted-foreground">{isEs ? "No se ejecutó análisis IA." : "AI analysis was not run."}</p>
            ) : hasFlags ? (
              <div className="space-y-2">
                <ClassificationBadges classification={ai} isEs={isEs} />
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {ai.sentiment && <span>{isEs ? "Sentimiento" : "Sentiment"}: <strong className="text-foreground">{ai.sentiment}</strong></span>}
                  {ai.urgency && <span>{isEs ? "Urgencia" : "Urgency"}: <strong className="text-foreground">{ai.urgency}</strong></span>}
                  {typeof ai.confidence === "number" && <span>{isEs ? "Confianza" : "Confidence"}: <strong className="text-foreground">{Math.round(ai.confidence * 100)}%</strong></span>}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{isEs ? "No se detectaron señales destacadas." : "No notable signals detected."}</p>
            )}

            {/* AI suggestions (not auto-applied) */}
            {(ai.suggested_tags?.length || ai.suggested_links?.length) ? (
              <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/20 p-3">
                <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <Lightbulb className="h-3 w-3" />{isEs ? "Sugerencias IA (no aplicadas)" : "AI suggestions (not applied)"}
                </p>
                {ai.suggested_tags?.length ? (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {ai.suggested_tags.map((t) => (
                      <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">#{t}</span>
                    ))}
                  </div>
                ) : null}
                {ai.suggested_links?.length ? (
                  <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                    {ai.suggested_links.map((l, i) => (
                      <li key={i}>→ <strong className="text-foreground">{l.entity_type}</strong>: {l.hint}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </section>

          {/* Full content */}
          {item.content && (
            <section>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{isEs ? "Contenido" : "Content"}</h3>
              <div className="whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-sm text-foreground">{item.content}</div>
            </section>
          )}

          {/* Linked entities */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Link2 className="h-3.5 w-3.5" />{isEs ? "Entidades vinculadas" : "Linked entities"}
              </h3>
              <button onClick={() => setShowLinker((s) => !s)} disabled={isPending}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400 disabled:opacity-50">
                <Plus className="h-3 w-3" />{isEs ? "Vincular" : "Link"}
              </button>
            </div>

            {showLinker && (
              <div className="mb-3 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <select value={linkType} onChange={(e) => { setLinkType(e.target.value as LinkableEntityType); setLinkTargetId(""); }}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs" disabled={isPending}>
                    {ENTITY_ORDER.filter((t) => (entities[t] ?? []).length > 0).map((t) => (
                      <option key={t} value={t}>{isEs ? ENTITY_TYPE_META[t].es : ENTITY_TYPE_META[t].en}</option>
                    ))}
                  </select>
                  <select value={linkTargetId} onChange={(e) => setLinkTargetId(e.target.value)}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs" disabled={isPending}>
                    <option value="">{isEs ? "Selecciona…" : "Select…"}</option>
                    {targetOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowLinker(false)} className="rounded-lg px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted">{isEs ? "Cancelar" : "Cancel"}</button>
                  <button onClick={handleAddLink} disabled={isPending || !linkTargetId}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                    {isPending && <Loader2 className="h-3 w-3 animate-spin" />}{isEs ? "Vincular" : "Link"}
                  </button>
                </div>
              </div>
            )}

            {item.links.length === 0 ? (
              <p className="text-xs text-muted-foreground">{isEs ? "Sin vínculos. Conecta este recuerdo a tareas, hitos, riesgos…" : "No links yet. Connect this item to tasks, milestones, risks…"}</p>
            ) : (
              <ul className="space-y-1.5">
                {item.links.map((l) => {
                  const meta = ENTITY_TYPE_META[l.targetType as LinkableEntityType];
                  const Icon = meta?.icon;
                  return (
                    <li key={l.linkId} className="group flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm">
                      {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      <span className="text-[10px] font-medium uppercase text-muted-foreground">{meta ? (isEs ? meta.es : meta.en) : l.targetType}</span>
                      <span className="min-w-0 flex-1 truncate text-foreground">{l.label}</span>
                      <span className="text-[10px] text-muted-foreground">{LINK_TYPE_META[l.linkType] ? (isEs ? LINK_TYPE_META[l.linkType].es : LINK_TYPE_META[l.linkType].en) : l.linkType}</span>
                      <button onClick={() => handleRemoveLink(l.linkId)} disabled={isPending}
                        className="text-muted-foreground opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* What this note produced (PD-012 provenance — derived items) */}
          <MemoryDerivedItems memoryItemId={item.id} projectId={projectId} locale={locale} />

          {/* Metadata / source info */}
          <section className="rounded-lg border border-border bg-muted/20 p-3 text-xs">
            <h3 className="mb-2 font-semibold uppercase tracking-wide text-muted-foreground">{isEs ? "Detalles" : "Details"}</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <dt className="text-muted-foreground">{isEs ? "Tipo de fuente" : "Source type"}</dt>
              <dd className="text-foreground">{item.sourceType}</dd>
              {item.sourceSystem && (<><dt className="text-muted-foreground">{isEs ? "Sistema" : "System"}</dt><dd className="text-foreground">{item.sourceSystem}</dd></>)}
              {item.authorEmail && (<><dt className="text-muted-foreground">Email</dt><dd className="truncate text-foreground">{item.authorEmail}</dd></>)}
              {item.participants.length > 0 && (<><dt className="text-muted-foreground">{isEs ? "Participantes" : "Participants"}</dt><dd className="text-foreground">{item.participants.join(", ")}</dd></>)}
              <dt className="text-muted-foreground">{isEs ? "Visibilidad" : "Visibility"}</dt>
              <dd className="text-foreground">{item.visibility}</dd>
              <dt className="text-muted-foreground">{isEs ? "Creado" : "Created"}</dt>
              <dd className="text-foreground">{fmt(item.createdAt, locale)}</dd>
            </dl>
            {item.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {item.tags.map((t) => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">#{t}</span>)}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
