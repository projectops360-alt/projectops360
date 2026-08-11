"use client";

// ============================================================================
// Turning Isabella's new knowledge on
// ============================================================================
// Seeding a knowledge package writes its text and marks its chunks `pending`.
// Lexical search finds them straight away; SEMANTIC search does not, because
// that needs an embedding per chunk.
//
// `indexLivingGuideAction` has existed for a while and nothing ever called it —
// the documented way to run it was a local script that reads `.env.local`,
// which points at STAGING. So the last step of retraining Isabella could only
// be done by someone willing to hand-wire production credentials, and the
// likeliest outcome of that was embedding the wrong database.
//
// This is the button. It runs server-side, in whichever environment the app is
// actually deployed to, under the action's own owner/admin check.
// ============================================================================

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { BrainCircuit, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { indexLivingGuideAction } from "@/components/living-guide/actions";

export interface KnowledgeIndexPanelProps {
  /** Chunks with no embedding, counted server-side at page load. */
  pendingChunks: number;
}

export function KnowledgeIndexPanel({ pendingChunks }: KnowledgeIndexPanelProps) {
  const t = useTranslations("adminConsole");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    { ok: true; embedded: number; processed: number } | { ok: false; message: string } | null
  >(null);

  // The count comes from page load, so once indexing has run the stale number
  // would contradict the result sitting right next to it.
  const remaining = result?.ok ? Math.max(0, pendingChunks - result.embedded) : pendingChunks;

  function run() {
    startTransition(async () => {
      const res = await indexLivingGuideAction();
      setResult(
        res.ok
          ? { ok: true, embedded: res.embedded ?? 0, processed: res.processed ?? 0 }
          : { ok: false, message: res.message ?? "unknown" },
      );
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <BrainCircuit className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden />
            {t("knowledgeTitle")}
          </p>
          <p className="mt-1 max-w-xl text-xs leading-snug text-muted-foreground">
            {t("knowledgeDesc")}
          </p>
        </div>

        <button
          type="button"
          onClick={run}
          disabled={pending || remaining === 0}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {pending ? t("knowledgeIndexing") : t("knowledgeIndex")}
        </button>
      </div>

      <p className="mt-2 text-xs font-medium">
        {remaining > 0 ? (
          <span className="text-amber-600 dark:text-amber-400">
            {t("knowledgePending", { count: remaining })}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            {t("knowledgeUpToDate")}
          </span>
        )}
      </p>

      {/* A failure has to be visible: silently doing nothing would leave the
          admin believing Isabella was retrained when she was not. */}
      {result && (
        <p
          role="status"
          className={`mt-1.5 flex items-center gap-1.5 text-xs ${
            result.ok ? "text-muted-foreground" : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {!result.ok && <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />}
          {result.ok
            ? t("knowledgeDone", { embedded: result.embedded, processed: result.processed })
            : t("knowledgeFailed", { message: result.message })}
        </p>
      )}
    </div>
  );
}
