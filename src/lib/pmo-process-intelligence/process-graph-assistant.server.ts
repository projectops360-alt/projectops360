import type { OrgContext } from "@/lib/auth";
import type {
  AskGuideInput,
  GuideAnswer,
} from "@/lib/knowledge-os/types";
import type { Locale } from "@/types/database";
import { loadPmoPiFlowModel } from "./read-model.server";
import { loadPmoPiFinanceOverlay } from "./financial-read.server";
import { loadPmoPiOverlays } from "./overlays-read.server";
import { buildExecutivePortfolioModel } from "./executive-projection";
import { loadPmoPiHierarchy } from "./hierarchy-read.server";
import {
  resolveProcessGraphEntity,
} from "./process-graph.adapter";
import type {
  ProcessGraphEntity,
  ProcessGraphScreenContext,
} from "./process-graph.types";

type ExpertInfo = {
  key: string;
  displayName: string;
  title: string;
};

const NODE_ID_RE = /^(stage:(initiate|plan|execute|control|close)|(project|milestone|activity):[0-9a-f-]{36})$/i;
const EDGE_ID_RE = /^[a-z0-9:_-]{1,240}$/i;

function cappedStrings(
  values: readonly string[] | undefined,
  max: number,
  pattern: RegExp,
): string[] {
  return [...new Set((values ?? []).filter((value) => pattern.test(value)))].slice(
    0,
    max,
  );
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

export function sanitizeProcessGraphScreenContext(
  context: ProcessGraphScreenContext | undefined,
  organizationId: string,
): ProcessGraphScreenContext | undefined {
  if (!context || context.dashboardMode !== "process-intelligence-beta") {
    return undefined;
  }
  return {
    route: String(context.route ?? "/process-intelligence").slice(0, 300),
    dashboardMode: "process-intelligence-beta",
    organizationId,
    portfolioId: null,
    programId: null,
    projectId:
      typeof context.projectId === "string" &&
      /^[0-9a-f-]{36}$/i.test(context.projectId)
        ? context.projectId
        : null,
    hierarchyLevel: [
      "organization",
      "stage",
      "project",
      "milestone",
    ].includes(context.hierarchyLevel)
      ? context.hierarchyLevel
      : "organization",
    activeLayer: [
      "process",
      "risk",
      "finance",
      "resources",
      "dependencies",
      "benefits",
      "whatif",
    ].includes(context.activeLayer)
      ? context.activeLayer
      : "process",
    hoveredNodeId:
      context.hoveredNodeId && NODE_ID_RE.test(context.hoveredNodeId)
        ? context.hoveredNodeId
        : null,
    hoveredEdgeId:
      context.hoveredEdgeId && EDGE_ID_RE.test(context.hoveredEdgeId)
        ? context.hoveredEdgeId
        : null,
    selectedNodeIds: cappedStrings(
      context.selectedNodeIds,
      50,
      NODE_ID_RE,
    ),
    selectedEdgeIds: cappedStrings(
      context.selectedEdgeIds,
      50,
      EDGE_ID_RE,
    ),
    visibleNodeIds: cappedStrings(context.visibleNodeIds, 200, NODE_ID_RE),
    visibleNodeCount: Math.max(
      0,
      Math.min(200, Math.round(finite(context.visibleNodeCount))),
    ),
    visibleEdgeIds: cappedStrings(context.visibleEdgeIds, 400, EDGE_ID_RE),
    visibleEdgeCount: Math.max(
      0,
      Math.min(400, Math.round(finite(context.visibleEdgeCount))),
    ),
    dateRange: {
      from: context.dateRange?.from?.slice(0, 10) ?? null,
      to: context.dateRange?.to?.slice(0, 10) ?? null,
    },
    filters: {
      projectIds: cappedStrings(
        context.filters?.projectIds,
        100,
        /^[0-9a-f-]{36}$/i,
      ),
      search: String(context.filters?.search ?? "").slice(0, 160),
      stageKey: context.filters?.stageKey ?? null,
    },
    viewport: {
      x: finite(context.viewport?.x),
      y: finite(context.viewport?.y),
      zoom: Math.max(0.1, Math.min(4, finite(context.viewport?.zoom, 1))),
    },
    currentMetrics:
      context.currentMetrics && typeof context.currentMetrics === "object"
        ? context.currentMetrics
        : null,
    activeBottleneck:
      context.activeBottleneck &&
      NODE_ID_RE.test(context.activeBottleneck)
        ? context.activeBottleneck
        : null,
    activeVariant: context.activeVariant?.slice(0, 160) ?? null,
    dataQuality: Math.max(0, Math.min(1, finite(context.dataQuality))),
    language: context.language === "es" ? "es" : "en",
    visibleNodeLabels: (context.visibleNodeLabels ?? [])
      .filter((value) => typeof value === "string")
      .slice(0, 200)
      .map((value) => value.slice(0, 160)),
  };
}

const COUNT_QUERY =
  /how many (nodes|boxes|cubes)|cu[aá]ntos? (nodos|cubos|cajas)|nodos? (hay|visibles?)/i;
const MEANING_QUERY =
  /what does this mean|what is this|qu[eé] significa (este|esto)|expl[ií]came (este|esto)/i;
const WORST_QUERY =
  /which (one )?is (the )?worst|cu[aá]l est[aá] peor|peor desempe[nñ]o/i;
const OPEN_PROJECTS_QUERY =
  /open (the )?projects|abre (los )?proyectos|mostrar? (los )?proyectos/i;
const SEEING_QUERY =
  /what am i (seeing|looking at)|qu[eé] estoy viendo|expl[ií]ca(me)? (la|esta) (vista|pantalla)/i;

function entityPressure(entity: ProcessGraphEntity): number {
  const metrics = entity.metrics;
  if (entity.kind === "project") {
    return (
      100 -
      (metrics.healthScore ?? 100) +
      (metrics.criticalRisks ?? 0) * 12 +
      (metrics.overallocatedResources ?? 0) * 8 +
      (metrics.delayProbabilityPct ?? 0) * 0.4
    );
  }
  if (entity.kind === "stage") {
    const status = {
      critical: 80,
      attention: 55,
      stable: 20,
      on_target: 5,
      insufficient: 35,
    }[entity.status] ?? 30;
    return (
      status +
      (metrics.criticalRisks ?? 0) * 6 +
      (metrics.reworkOccurrences ?? 0) * 0.5 +
      (metrics.overallocatedResources ?? 0) * 8 +
      Math.max(0, -(metrics.forecastVariance ?? 0)) / 10_000
    );
  }
  return (
    (entity.status === "blocked" ? 100 : 0) +
    (entity.metrics.progressPercent == null
      ? 0
      : 100 - entity.metrics.progressPercent)
  );
}

function verifiedAnswer(
  answer: string,
  locale: Locale,
  expert: ExpertInfo,
  steps: string[] = [],
): GuideAnswer {
  return {
    answerId: null,
    grounded: true,
    answer,
    steps,
    followups: [],
    tier: "verified",
    confidenceScore: 1,
    language: locale,
    sources: [],
    expert,
    degraded: false,
  };
}

export async function maybeAnswerWithProcessGraphContext(
  org: OrgContext,
  input: AskGuideInput,
  expert: ExpertInfo,
): Promise<GuideAnswer | null> {
  const graph = input.context.processGraph;
  if (!graph) return null;
  const query = input.query.trim();
  if (
    !COUNT_QUERY.test(query) &&
    !MEANING_QUERY.test(query) &&
    !WORST_QUERY.test(query) &&
    !OPEN_PROJECTS_QUERY.test(query) &&
    !SEEING_QUERY.test(query)
  ) {
    return null;
  }

  const locale: Locale =
    (input.answerLanguage ?? input.locale) === "es" ? "es" : "en";
  const flow = await loadPmoPiFlowModel(locale, null);
  if (flow.status !== "ok") return null;
  const projectIds = flow.projects.map((project) => project.id);
  const [finance, overlays, hierarchy] = await Promise.all([
    projectIds.length > 0
      ? loadPmoPiFinanceOverlay(org.organizationId, projectIds)
      : Promise.resolve(null),
    projectIds.length > 0
      ? loadPmoPiOverlays(org, projectIds)
      : Promise.resolve(null),
    loadPmoPiHierarchy(org, projectIds),
  ]);
  const executive = buildExecutivePortfolioModel({
    cases: flow.cases,
    technicalFlow: flow.model,
    projects: flow.projects,
    finance,
    overlays,
    generatedAt: flow.model.generatedAt,
  });
  const resolverInput = {
    locale: locale === "es" ? ("es" as const) : ("en" as const),
    base: locale === "es" ? "/es" : "",
    executive,
    hierarchy,
  };
  const visible = graph.visibleNodeIds
    .map((id) => resolveProcessGraphEntity(id, resolverInput))
    .filter((entity): entity is ProcessGraphEntity => entity !== null);
  const targetId =
    graph.hoveredNodeId ??
    graph.selectedNodeIds[0] ??
    graph.visibleNodeIds[0] ??
    null;
  const target = targetId
    ? resolveProcessGraphEntity(targetId, resolverInput)
    : null;

  if (COUNT_QUERY.test(query)) {
    const labels = visible.map((entity) => entity.label);
    const count = labels.length;
    return verifiedAnswer(
      locale === "es"
        ? `Hay ${count} nodos visibles${labels.length > 0 ? `: ${labels.join(", ")}` : "."}.`
        : `There are ${count} visible nodes${labels.length > 0 ? `: ${labels.join(", ")}` : "."}.`,
      locale,
      expert,
    );
  }

  if (MEANING_QUERY.test(query)) {
    if (!target) {
      return verifiedAnswer(
        locale === "es"
          ? "No hay un nodo señalado o seleccionado en el canvas."
          : "No node is currently hovered or selected on the canvas.",
        locale,
        expert,
      );
    }
    return verifiedAnswer(
      locale === "es"
        ? `Estás señalando **${target.label}**. ${target.definition}`
        : `You are pointing at **${target.label}**. ${target.definition}`,
      locale,
      expert,
    );
  }

  if (WORST_QUERY.test(query)) {
    const ranked = [...visible].sort(
      (left, right) => entityPressure(right) - entityPressure(left),
    );
    const worst = ranked[0] ?? null;
    if (!worst) return null;
    return verifiedAnswer(
      locale === "es"
        ? `El nodo con mayor presión entre los visibles es **${worst.label}**. La comparación usa salud, retraso, riesgo, presupuesto, recursos y calidad de datos disponibles; no convierte datos faltantes en cero.`
        : `The highest-pressure visible node is **${worst.label}**. The comparison uses available health, delay, risk, budget, resource and data-quality evidence; missing values are not treated as zero.`,
      locale,
      expert,
    );
  }

  if (OPEN_PROJECTS_QUERY.test(query)) {
    if (!target || target.kind !== "stage") {
      return verifiedAnswer(
        locale === "es"
          ? "Selecciona o señala una etapa del proceso y vuelve a pedir abrir sus proyectos."
          : "Select or point to a process stage, then ask again to open its projects.",
        locale,
        expert,
      );
    }
    const projects = executive.projects.filter(
      (project) => project.currentStage === target.stageKey,
    );
    return verifiedAnswer(
      locale === "es"
        ? `${target.label} contiene ${projects.length} proyectos autorizados: ${projects.map((project) => project.title).join(", ") || "ninguno"}.`
        : `${target.label} contains ${projects.length} authorized projects: ${projects.map((project) => project.title).join(", ") || "none"}.`,
      locale,
      expert,
      [
        locale === "es"
          ? `Haz doble clic en ${target.label} o usa Expandir para navegar.`
          : `Double-click ${target.label} or use Expand to navigate.`,
      ],
    );
  }

  if (SEEING_QUERY.test(query)) {
    return verifiedAnswer(
      locale === "es"
        ? `Estás viendo el canvas interactivo de Process Intelligence en nivel **${graph.hierarchyLevel}**, capa **${graph.activeLayer}**, con ${visible.length} nodos y ${graph.visibleEdgeCount} conexiones visibles. Puedes arrastrar, hacer zoom, seleccionar, expandir y profundizar con doble clic.`
        : `You are viewing the interactive Process Intelligence canvas at the **${graph.hierarchyLevel}** level, **${graph.activeLayer}** layer, with ${visible.length} visible nodes and ${graph.visibleEdgeCount} visible connections. You can drag, zoom, select, expand and drill down with a double click.`,
      locale,
      expert,
    );
  }

  return null;
}
