"use client";

import { useState } from "react";
import { Loader2, Play, FlaskConical, Download, ShieldAlert, AlertTriangle } from "lucide-react";
import { runBackfillAction, type BackfillRunResult } from "./actions";

interface ProjectOption { id: string; title: string; type: string; status: string; }

const ERR: Record<string, string> = {
  not_authenticated: "Not authenticated.",
  forbidden: "You are not authorized to run Backfill (owner/admin only).",
  invalid_input: "Invalid input.",
  project_required: "Select a project.",
  reason_required: "A reason is required to execute (dry run first).",
  project_not_found: "Project not found.",
};

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}

export function BackfillConsole({ projects }: { projects: ProjectOption[]; locale: string }) {
  const [scope, setScope] = useState<"organization" | "project">("project");
  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [running, setRunning] = useState<null | "dry_run" | "execute">(null);
  const [result, setResult] = useState<BackfillRunResult | null>(null);
  const [dryRanKey, setDryRanKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scopeKey = scope === "project" ? `project:${projectId}` : "organization";
  const canExecute = dryRanKey === scopeKey && reason.trim().length > 0 && running === null;

  async function run(mode: "dry_run" | "execute") {
    if (mode === "execute") {
      const label = scope === "project" ? projects.find((p) => p.id === projectId)?.title : "the ENTIRE organization";
      if (!confirm(`Execute Historical Backfill for ${label}? This permanently enriches the Project Event Graph (idempotent, additive).`)) return;
    }
    setRunning(mode); setError(null);
    try {
      const res = await runBackfillAction({ mode, scope, projectId: scope === "project" ? projectId : undefined, reason });
      if (res.error) { setError(ERR[res.error] ?? res.error); setResult(null); }
      else { setResult(res); if (mode === "dry_run") setDryRanKey(scopeKey); }
    } catch {
      setError("Unexpected error.");
    } finally {
      setRunning(null);
    }
  }

  function downloadReport() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `backfill-${result.executionId}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 py-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <ShieldAlert className="h-5 w-5 text-brand-500" /> Backfill Administration Console
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The only approved mechanism for reconstructing historical events into the Project Event Graph.
          Safe, idempotent, evidence-aware. Never modifies canonical data or process_nodes/process_edges.
        </p>
      </div>

      {/* Target + reason */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-foreground">Scope</label>
          <select value={scope} onChange={(e) => { setScope(e.target.value as "organization" | "project"); setResult(null); setDryRanKey(null); }}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
            <option value="project">Single project</option>
            <option value="organization">Entire organization ({projects.length})</option>
          </select>
          {scope === "project" && (
            <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setResult(null); setDryRanKey(null); }}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title} · {p.type}</option>)}
            </select>
          )}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Reason (required to execute — recorded in the audit event)</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500}
            placeholder="e.g. Seed historical memory for pilot analytics"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => run("dry_run")} disabled={running !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60">
            {running === "dry_run" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />} Dry run (preview)
          </button>
          <button type="button" onClick={() => run("execute")} disabled={!canExecute}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            title={!canExecute ? "Run a dry run and enter a reason first" : undefined}>
            {running === "execute" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Execute
          </button>
          {dryRanKey !== scopeKey && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" /> Dry run required before executing.</span>
          )}
        </div>
        {error && <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}
      </div>

      {/* Results */}
      {result?.projects && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${result.mode === "execute" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>
                {result.mode === "execute" ? "EXECUTED" : "DRY RUN (no writes)"}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">{result.executionId}</span>
            </div>
            <button type="button" onClick={downloadReport} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-muted">
              <Download className="h-3.5 w-3.5" /> Download report
            </button>
          </div>

          {result.orgMemory && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-muted/40 p-2"><div className="text-lg font-bold">{result.orgMemory.projectsProcessed}</div><div className="text-[11px] text-muted-foreground">projects</div></div>
              <div className="rounded-lg bg-muted/40 p-2"><div className="text-lg font-bold">{result.orgMemory.totalEvents}</div><div className="text-[11px] text-muted-foreground">events {result.mode === "execute" ? "created" : "would create"}</div></div>
              <div className="rounded-lg bg-muted/40 p-2"><div className="text-lg font-bold">{result.orgMemory.averageConfidence}</div><div className="text-[11px] text-muted-foreground">avg confidence</div></div>
            </div>
          )}

          <div className="space-y-2">
            {result.projects.map((p) => (
              <details key={p.projectId} className="rounded-lg border border-border">
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {p.report.eventsCreated} evt · {p.report.eventsSkipped} dup · {p.report.eventsFailed} fail
                  </span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${p.replay.label === "replay_ready" ? "text-emerald-600" : p.replay.label === "partial" ? "text-amber-600" : "text-red-600"}`}>
                    replay {p.replay.score}%
                  </span>
                </summary>
                <div className="space-y-2 border-t border-border px-3 py-2 text-xs">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    <span>Explicit: <b>{p.quality.explicitPct}%</b></span>
                    <span>Inferred: <b>{p.quality.inferredPct}%</b></span>
                    <span>Avg confidence: <b>{p.quality.averageConfidence}</b></span>
                    <span>Range: <b>{p.quality.lowestConfidence}–{p.quality.highestConfidence}</b></span>
                  </div>
                  <div><span className="text-muted-foreground">Confidence: </span>
                    <Bar value={p.quality.confidenceDistribution.high / Math.max(1, p.quality.totalEvents) * 100} color="#10b981" />
                  </div>
                  <div>
                    <span className="text-muted-foreground">Replay readiness ({p.replay.label}):</span>
                    <ul className="ml-4 list-disc">{p.replay.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  </div>
                  {p.report.unsupportedSources.length > 0 && (
                    <p className="text-amber-600">Unsupported: {p.report.unsupportedSources.join(", ")}</p>
                  )}
                  {p.report.errorSummary.length > 0 && (
                    <p className="text-red-600">Errors: {p.report.errorSummary.slice(0, 5).join("; ")}</p>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
