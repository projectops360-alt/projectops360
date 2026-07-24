import { ChevronRight, Home } from "lucide-react";
import type {
  ProcessGraphNavigationState,
} from "@/lib/pmo-process-intelligence/process-graph.types";

export function ProcessGraphBreadcrumbs({
  locale,
  organizationName,
  navigation,
  stageLabel,
  projectLabel,
  milestoneLabel,
  onOrganization,
  onBack,
}: {
  locale: "en" | "es";
  organizationName: string;
  navigation: ProcessGraphNavigationState;
  stageLabel: string | null;
  projectLabel: string | null;
  milestoneLabel: string | null;
  onOrganization: () => void;
  onBack: () => void;
}) {
  const es = locale === "es";
  return (
    <nav
      aria-label={es ? "Ruta del grafo" : "Graph breadcrumbs"}
      className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
    >
      <button
        type="button"
        onClick={onOrganization}
        className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <Home className="h-3.5 w-3.5" />
        {organizationName}
      </button>
      {navigation.level !== "organization" ? (
        <>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 rounded px-2 py-1 text-slate-700 hover:bg-slate-100"
          >
            {stageLabel ?? (es ? "Etapa" : "Stage")}
          </button>
        </>
      ) : null}
      {navigation.level === "project" || navigation.level === "milestone" ? (
        <>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="shrink-0 rounded px-2 py-1 font-semibold text-slate-900">
            {projectLabel ?? (es ? "Proyecto" : "Project")}
          </span>
        </>
      ) : null}
      {navigation.level === "milestone" ? (
        <>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="shrink-0 rounded px-2 py-1 font-semibold text-slate-900">
            {milestoneLabel ?? (es ? "Hito" : "Milestone")}
          </span>
        </>
      ) : null}
    </nav>
  );
}
