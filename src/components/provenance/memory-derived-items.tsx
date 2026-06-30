"use client";

// ============================================================================
// Evidence Provenance — "What this note produced" (PD-012, TASK 6)
// ============================================================================
// Surfaces the derived-items view that already exists as a server action
// (getMemoryArtifactsAction). From a Project Memory note it answers "what did
// this note produce?": the tasks/decisions/risks it generated, plus extractions
// that stayed memory-only. Record-backed; nothing inferred.
// ============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { GitBranch, CheckSquare, GitCommitHorizontal, AlertTriangle, FileText } from "lucide-react";
import {
  getMemoryArtifactsAction,
  type MemoryArtifact,
} from "@/app/[locale]/(app)/projects/[projectId]/memory/scribe-actions";
import type { Locale } from "@/types/database";

interface Props {
  memoryItemId: string;
  projectId: string;
  locale: Locale;
}

function artifactIcon(entityType: string | null, itemType: string) {
  if (entityType === "decision" || itemType === "decision") return <GitCommitHorizontal className="h-3.5 w-3.5" />;
  if (entityType === "risk" || itemType === "risk") return <AlertTriangle className="h-3.5 w-3.5" />;
  if (entityType === "work_item" || itemType === "action_item") return <CheckSquare className="h-3.5 w-3.5" />;
  return <FileText className="h-3.5 w-3.5" />;
}

export function MemoryDerivedItems({ memoryItemId, projectId, locale }: Props) {
  const isEs = locale === "es";
  const [state, setState] = useState<{ loading: boolean; artifacts: MemoryArtifact[] }>({
    loading: true,
    artifacts: [],
  });

  useEffect(() => {
    let active = true;
    getMemoryArtifactsAction({ memoryItemId, projectId, locale })
      .then((res) => active && setState({ loading: false, artifacts: res.artifacts }))
      .catch(() => active && setState({ loading: false, artifacts: [] }));
    return () => {
      active = false;
    };
  }, [memoryItemId, projectId, locale]);

  if (state.loading) {
    return (
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <GitBranch className="h-3.5 w-3.5" />
          {isEs ? "Qué produjo esta nota" : "What this note produced"}
        </h3>
        <p className="text-xs text-muted-foreground/70">{isEs ? "Cargando…" : "Loading…"}</p>
      </section>
    );
  }

  if (state.artifacts.length === 0) return null;

  const created = state.artifacts.filter((a) => a.entityId);
  const memoryOnly = state.artifacts.filter((a) => !a.entityId);
  const counts = {
    tasks: created.filter((a) => a.entityType === "work_item").length,
    decisions: created.filter((a) => a.entityType === "decision").length,
    risks: created.filter((a) => a.entityType === "risk").length,
  };

  const summaryParts: string[] = [];
  if (counts.tasks) summaryParts.push(isEs ? `${counts.tasks} tarea(s)` : `${counts.tasks} task(s)`);
  if (counts.decisions) summaryParts.push(isEs ? `${counts.decisions} decisión(es)` : `${counts.decisions} decision(s)`);
  if (counts.risks) summaryParts.push(isEs ? `${counts.risks} riesgo(s)` : `${counts.risks} risk(s)`);
  if (memoryOnly.length)
    summaryParts.push(isEs ? `${memoryOnly.length} solo en memoria` : `${memoryOnly.length} memory-only`);

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <GitBranch className="h-3.5 w-3.5" />
        {isEs ? "Qué produjo esta nota" : "What this note produced"}
      </h3>
      {summaryParts.length > 0 && (
        <p className="mb-2 text-xs text-muted-foreground">{summaryParts.join(" · ")}</p>
      )}
      <ul className="space-y-1.5">
        {state.artifacts.map((a) => {
          const inner = (
            <>
              {artifactIcon(a.entityType, a.itemType)}
              <span className="min-w-0 flex-1 truncate text-foreground">{a.title}</span>
              {a.status && (
                <span className="shrink-0 text-[10px] uppercase text-muted-foreground">{a.status}</span>
              )}
              {!a.entityId && (
                <span className="shrink-0 text-[10px] text-muted-foreground/70">
                  {isEs ? "memoria" : "memory"}
                </span>
              )}
            </>
          );
          return (
            <li key={a.scribeItemId}>
              {a.href ? (
                <Link
                  href={a.href}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  {inner}
                </Link>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm">
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
