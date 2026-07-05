"use client";

// DEV-ONLY visual harness for GitHub Intelligence. Renders the REAL components
// with synthetic mock data — NO database, NO prod. Gated to development by the
// server page wrapper. Run `npm run gh:preview` to launch + screenshot.

import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../../../messages/en.json";
import { ProjectTabs } from "@/components/layout/project-tabs";
import { GitHubLivingGraph } from "@/components/github-intelligence/github-living-graph";
import { buildGitHubLivingGraph } from "@/lib/github-intelligence/graph-builder";
import { buildSampleSnapshots, buildSampleGraphInput } from "@/lib/github-intelligence/mock-data";
import { computeReadiness, readinessBandLabel } from "@/lib/github-intelligence/readiness";
import { buildGitHubSummary } from "@/lib/github-intelligence/summary";
import type { BranchSnapshot, PullRequestSnapshot, WorkflowRunSnapshot } from "@/lib/github-intelligence/types";
import type { ProjectModule } from "@/types/database";
import {
  GitCommitHorizontal, GitBranch, GitPullRequest, Activity, Gauge, GitGraph,
  Sparkles, Rocket, CheckCircle2, XCircle, Tag, Lock, ShieldCheck, ExternalLink, RefreshCw, Unplug,
} from "lucide-react";

const SOFTWARE_MODULES: ProjectModule[] = [
  "overview", "scope", "milestones", "tasks", "dependencies", "schedule", "critical_path",
  "resources", "people", "budget", "risks", "documents", "living_graph", "ai_recommendations",
  "reports", "materials", "github_intelligence",
];
const NON_SOFTWARE_MODULES: ProjectModule[] = SOFTWARE_MODULES.filter((m) => m !== "github_intelligence");

const graph = buildGitHubLivingGraph(buildSampleGraphInput());
const scope = { organization_id: "o", project_id: "p", repository_id: "r" };
const sample = buildSampleSnapshots(scope);
const branches = sample.branches as unknown as BranchSnapshot[];
const pulls = sample.pullRequests as unknown as PullRequestSnapshot[];
const runs = sample.workflowRuns as unknown as WorkflowRunSnapshot[];
const readiness = computeReadiness({ branches, pullRequests: pulls, workflowRuns: runs, deployments: [] });
const summary = buildGitHubSummary({ branches, pullRequests: pulls, workflowRuns: runs, releases: [], commitCount: 16, readiness });

const BAND_TONE: Record<string, string> = {
  good: "text-green-600 dark:text-green-400", watch: "text-amber-600 dark:text-amber-400",
  at_risk: "text-orange-600 dark:text-orange-400", blocked: "text-red-600 dark:text-red-400",
};

export function GhHarness() {
  const metrics = { commits: 16, activeBranches: 5, openPr: 1, mergedPr: 1, failed: 1, success: 2, releases: 1 };
  const cards = [
    { label: "Commits", value: metrics.commits, icon: GitCommitHorizontal, tone: "text-foreground", sub: "14 days" },
    { label: "Active Branches", value: metrics.activeBranches, icon: GitBranch, tone: "text-foreground", sub: "" },
    { label: "Open PRs", value: metrics.openPr, icon: GitPullRequest, tone: "text-foreground", sub: `${metrics.mergedPr} merged` },
    { label: "Workflow Health", value: `${metrics.failed} ✗`, icon: Activity, tone: "text-red-600 dark:text-red-400", sub: "workflows" },
    { label: "Release Readiness", value: `${readiness.score}`, icon: Gauge, tone: BAND_TONE[readiness.band], sub: readinessBandLabel(readiness.band, false) },
  ];

  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <div className="min-h-screen space-y-10 bg-background p-8">
        <h1 className="text-xl font-bold text-foreground">GitHub Intelligence — Visual Harness (synthetic data, no DB)</h1>

        <section data-testid="sec-nav-software" className="min-h-[320px]">
          <Label>C · Software project — nav shows “GitHub Intelligence” (open the Execution group)</Label>
          <ProjectTabs projectId="demo" locale="en" projectTitle="Acme Web App (software)" enabledModules={SOFTWARE_MODULES} />
        </section>

        <section data-testid="sec-nav-nonsoftware" className="min-h-[320px]">
          <Label>E · Non-software project (and G · flag OFF) — no “GitHub Intelligence” in nav</Label>
          <ProjectTabs projectId="demo" locale="en" projectTitle="Downtown Tower (construction)" enabledModules={NON_SOFTWARE_MODULES} />
        </section>

        <section data-testid="sec-dashboard" className="space-y-4">
          <Label>A · GitHub Intelligence dashboard &nbsp;|&nbsp; B · GitHub Living Graph (fishbone)</Label>
          <div className="flex items-center gap-2">
            <GitGraph className="h-6 w-6 text-brand-500" />
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">GitHub Intelligence</h2>
              <p className="text-sm text-muted-foreground">Real execution evidence from your repository.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {cards.map((c) => (
              <div key={c.label} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
                  <c.icon className={`h-4 w-4 ${c.tone}`} />
                </div>
                <p className={`mt-1.5 text-2xl font-bold tracking-tight ${c.tone}`}>{c.value}</p>
                {c.sub && <p className="mt-0.5 text-xs text-muted-foreground">{c.sub}</p>}
              </div>
            ))}
          </div>

          <div data-testid="sec-fishbone"><GitHubLivingGraph data={graph} /></div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"><Activity className="h-4 w-4 text-brand-500" />Activity Summary</h3>
              <ul className="space-y-2 text-sm">
                <Row icon={<GitCommitHorizontal className="h-4 w-4 text-muted-foreground" />} label="Commits" value={metrics.commits} />
                <Row icon={<GitPullRequest className="h-4 w-4 text-muted-foreground" />} label="Merged PRs" value={metrics.mergedPr} />
                <Row icon={<XCircle className="h-4 w-4 text-red-500" />} label="Failed workflows" value={metrics.failed} />
                <Row icon={<Tag className="h-4 w-4 text-purple-500" />} label="Releases" value={metrics.releases} />
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-gradient-to-br from-purple-500/5 to-brand-500/5 p-5">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"><Sparkles className="h-4 w-4 text-purple-500" />Isabella Insight</h3>
              <p className="text-sm font-medium text-foreground">{summary.summary}</p>
              {summary.risk && <p className="mt-2 text-sm text-orange-700 dark:text-orange-300">⚠ {summary.risk}</p>}
              {summary.recommendation && <p className="mt-1 text-sm text-foreground">→ {summary.recommendation}</p>}
              <p className="mt-3 text-[11px] text-muted-foreground">Release readiness is calculated from recent GitHub evidence. It does not replace human approval.</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"><Rocket className="h-4 w-4 text-brand-500" />Release Path</h3>
              <ol className="space-y-2">
                {[["Branch active", true], ["PR open", true], ["CI passing", false], ["Staging deploy", false], ["Production ready", false]].map(([l, done]) => (
                  <li key={l as string} className="flex items-center gap-2 text-sm">
                    {done ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <span className="h-4 w-4 rounded-full border border-muted-foreground/40" />}
                    <span className={done ? "text-foreground" : "text-muted-foreground"}>{l as string}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section data-testid="sec-settings" className="space-y-3">
          <Label>D · Project Settings → Integrations → GitHub Intelligence (connected)</Label>
          <div className="flex flex-wrap gap-3">
            <Badge icon={<Lock className="h-3.5 w-3.5" />} text="Read-only" />
            <Badge icon={<ShieldCheck className="h-3.5 w-3.5" />} text="Software projects only" />
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Connected repositories</h3>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400">Open dashboard <ExternalLink className="h-3 w-3" /></span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground"><GitGraph className="h-4 w-4 text-muted-foreground" />acme/web-app</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Last sync: just now · success</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground"><RefreshCw className="h-4 w-4" />Refresh data</span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground"><Unplug className="h-3.5 w-3.5" />Disconnect</span>
              </div>
            </div>
          </div>
        </section>

        <section data-testid="sec-unavailable">
          <Label>F · Direct access /projects/[nonSoftwareId]/github — blocked (unavailable state)</Label>
          <div className="mx-auto max-w-lg rounded-2xl border border-border py-16 text-center">
            <GitGraph className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">GitHub Intelligence is unavailable</h2>
            <p className="mt-2 text-sm text-muted-foreground">GitHub Intelligence is available for software projects only.</p>
          </div>
        </section>
      </div>
    </NextIntlClientProvider>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">{children}</p>;
}
function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <li className="flex items-center justify-between"><span className="flex items-center gap-2 text-foreground">{icon}{label}</span><span className="font-semibold text-foreground">{value}</span></li>;
}
function Badge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">{icon}{text}</span>;
}
