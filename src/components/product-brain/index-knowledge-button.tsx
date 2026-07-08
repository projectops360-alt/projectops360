"use client";

// ============================================================================
// ProjectOps360° — Product Brain Control Center — "Index knowledge" button
// ============================================================================
// Wires the existing `indexLivingGuideAction` (owner/admin enforced SERVER-SIDE
// inside the action) to the cockpit so an admin can embed pending Knowledge OS
// chunks after seeding without a deploy. Read-only UI state; the action itself
// is idempotent (only pending/failed chunks are processed). Bilingual EN/ES.
// ============================================================================

import { useState, useTransition } from "react";
import { DatabaseZap, LoaderCircle } from "lucide-react";
import { indexLivingGuideAction } from "@/components/living-guide/actions";

export interface IndexKnowledgeResult {
  ok: boolean;
  processed?: number;
  embedded?: number;
  failed?: number;
  message?: string;
}

/** Pure, testable formatter for the action result (never Spanglish — UX-012). */
export function formatIndexKnowledgeResult(res: IndexKnowledgeResult, es: boolean): string {
  if (!res.ok) {
    return res.message ?? (es ? "No se pudo indexar el conocimiento." : "Could not index knowledge.");
  }
  const processed = res.processed ?? 0;
  const embedded = res.embedded ?? 0;
  const failed = res.failed ?? 0;
  if (processed === 0) {
    return es
      ? "Nada pendiente: todo el conocimiento ya está indexado."
      : "Nothing pending: all knowledge is already indexed.";
  }
  return es
    ? `Procesados: ${processed} · Indexados: ${embedded} · Fallidos: ${failed}`
    : `Processed: ${processed} · Embedded: ${embedded} · Failed: ${failed}`;
}

export function IndexKnowledgeButton({ es }: { es: boolean }) {
  const [result, setResult] = useState<string | null>(null);
  const [hasProblem, setHasProblem] = useState(false);
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      try {
        const res = await indexLivingGuideAction();
        setResult(formatIndexKnowledgeResult(res, es));
        setHasProblem(!res.ok || (res.failed ?? 0) > 0);
      } catch {
        setResult(es ? "No se pudo indexar el conocimiento." : "Could not index knowledge.");
        setHasProblem(true);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:border-brand-500 hover:text-brand-600 disabled:opacity-50 dark:hover:text-brand-400"
      >
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <DatabaseZap className="h-4 w-4" />}
        {pending
          ? (es ? "Indexando…" : "Indexing…")
          : (es ? "Indexar conocimiento" : "Index knowledge")}
      </button>
      {result && (
        <p
          className={`text-[11px] ${hasProblem ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}
          role="status"
        >
          {result}
        </p>
      )}
    </div>
  );
}
