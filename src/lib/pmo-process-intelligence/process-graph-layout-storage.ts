import type { ProcessGraphNavigationState } from "./process-graph.types";

export const PROCESS_GRAPH_LAYOUT_SCHEMA_VERSION = 1 as const;

export interface ProcessGraphSavedPosition {
  x: number;
  y: number;
}

export interface ProcessGraphSavedViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface ProcessGraphSavedLayout {
  version: number;
  userId: string;
  organizationId: string;
  viewKey: string;
  nodes: Record<string, ProcessGraphSavedPosition>;
  viewport: ProcessGraphSavedViewport;
  savedAt: string;
}

export interface ProcessGraphLayoutScope {
  userId: string;
  organizationId: string;
  navigation: ProcessGraphNavigationState;
  activeLayer: string;
  projectIds: readonly string[];
  dateFrom: string | null;
  dateTo: string | null;
}

const PREFIX = "po360.processIntelligence.layout.";

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 160);
}

export function buildProcessGraphViewKey(
  scope: Omit<ProcessGraphLayoutScope, "userId" | "organizationId">,
): string {
  const navigation = [
    scope.navigation.level,
    scope.navigation.stageKey ?? "all-stages",
    scope.navigation.projectId ?? "all-projects",
    scope.navigation.milestoneId ?? "all-milestones",
  ].join(":");
  const filters = [
    [...scope.projectIds].sort().join(",") || "all",
    scope.dateFrom ?? "open",
    scope.dateTo ?? "open",
  ].join(":");
  return safeSegment(`${navigation}:${scope.activeLayer}:${filters}`);
}

function storageKey(scope: ProcessGraphLayoutScope): string {
  return `${PREFIX}${safeSegment(scope.userId)}.${safeSegment(scope.organizationId)}.${buildProcessGraphViewKey(scope)}`;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validLayout(value: unknown): value is ProcessGraphSavedLayout {
  if (!value || typeof value !== "object") return false;
  const object = value as Record<string, unknown>;
  if (object.version !== PROCESS_GRAPH_LAYOUT_SCHEMA_VERSION) return false;
  if (!object.nodes || typeof object.nodes !== "object") return false;
  if (!object.viewport || typeof object.viewport !== "object") return false;
  for (const position of Object.values(
    object.nodes as Record<string, unknown>,
  )) {
    if (!position || typeof position !== "object") return false;
    const point = position as Record<string, unknown>;
    if (!finite(point.x) || !finite(point.y)) return false;
  }
  const viewport = object.viewport as Record<string, unknown>;
  return finite(viewport.x) && finite(viewport.y) && finite(viewport.zoom);
}

export function loadProcessGraphLayout(
  scope: ProcessGraphLayoutScope,
): ProcessGraphSavedLayout | null {
  const target = storage();
  if (!target) return null;
  try {
    const raw = target.getItem(storageKey(scope));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return validLayout(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveProcessGraphLayout(
  scope: ProcessGraphLayoutScope,
  nodes: Record<string, ProcessGraphSavedPosition>,
  viewport: ProcessGraphSavedViewport,
): boolean {
  const target = storage();
  if (!target) return false;
  try {
    const payload: ProcessGraphSavedLayout = {
      version: PROCESS_GRAPH_LAYOUT_SCHEMA_VERSION,
      userId: scope.userId,
      organizationId: scope.organizationId,
      viewKey: buildProcessGraphViewKey(scope),
      nodes,
      viewport,
      savedAt: new Date().toISOString(),
    };
    target.setItem(storageKey(scope), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearProcessGraphLayout(
  scope: ProcessGraphLayoutScope,
): void {
  const target = storage();
  if (!target) return;
  try {
    target.removeItem(storageKey(scope));
  } catch {
    // Presentation state is optional.
  }
}
