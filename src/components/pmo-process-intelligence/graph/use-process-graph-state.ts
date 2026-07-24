"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Viewport } from "@xyflow/react";
import type {
  ProcessGraphEntity,
  ProcessGraphNavigationState,
  ProcessGraphSemanticZoom,
} from "@/lib/pmo-process-intelligence/process-graph.types";

export interface ProcessGraphContextMenuState {
  x: number;
  y: number;
  nodeId: string;
}

const ORGANIZATION_NAVIGATION: ProcessGraphNavigationState = {
  level: "organization",
  stageKey: null,
  projectId: null,
  milestoneId: null,
};

export function semanticZoomFor(zoom: number): ProcessGraphSemanticZoom {
  if (zoom < 0.72) return "far";
  if (zoom < 1.05) return "intermediate";
  if (zoom < 1.38) return "close";
  return "deep";
}

export function useProcessGraphState() {
  const [navigation, setNavigation] =
    useState<ProcessGraphNavigationState>(ORGANIZATION_NAVIGATION);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [drawerNodeId, setDrawerNodeId] = useState<string | null>(null);
  const [drawerEdgeId, setDrawerEdgeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] =
    useState<ProcessGraphContextMenuState | null>(null);
  const [viewport, setViewport] = useState<Viewport>({
    x: 0,
    y: 0,
    zoom: 1,
  });
  const semanticZoom = semanticZoomFor(viewport.zoom);

  const toggleExpanded = useCallback((nodeId: string) => {
    setExpandedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const selectNode = useCallback((nodeId: string, additive = false) => {
    setSelectedNodeIds((current) =>
      additive
        ? current.includes(nodeId)
          ? current.filter((id) => id !== nodeId)
          : [...current, nodeId]
        : [nodeId],
    );
    setSelectedEdgeIds([]);
    setDrawerNodeId(nodeId);
    setDrawerEdgeId(null);
    setContextMenu(null);
  }, []);

  const selectEdge = useCallback((edgeId: string, additive = false) => {
    setSelectedEdgeIds((current) =>
      additive
        ? current.includes(edgeId)
          ? current.filter((id) => id !== edgeId)
          : [...current, edgeId]
        : [edgeId],
    );
    setSelectedNodeIds([]);
    setDrawerEdgeId(edgeId);
    setDrawerNodeId(null);
    setContextMenu(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setDrawerNodeId(null);
    setDrawerEdgeId(null);
    setContextMenu(null);
  }, []);

  const drillDown = useCallback((entity: ProcessGraphEntity) => {
    if (entity.kind === "stage" && entity.stageKey) {
      setNavigation({
        level: "stage",
        stageKey: entity.stageKey,
        projectId: null,
        milestoneId: null,
      });
    } else if (entity.kind === "project" && entity.projectId) {
      setNavigation({
        level: "project",
        stageKey: entity.stageKey,
        projectId: entity.projectId,
        milestoneId: null,
      });
    } else if (
      entity.kind === "milestone" &&
      entity.projectId
    ) {
      setNavigation({
        level: "milestone",
        stageKey: entity.stageKey,
        projectId: entity.projectId,
        milestoneId: entity.id.slice("milestone:".length),
      });
    } else {
      return;
    }
    clearSelection();
  }, [clearSelection]);

  const goBack = useCallback(() => {
    setNavigation((current) => {
      if (current.level === "milestone") {
        return {
          ...current,
          level: "project",
          milestoneId: null,
        };
      }
      if (current.level === "project") {
        return {
          level: "stage",
          stageKey: current.stageKey,
          projectId: null,
          milestoneId: null,
        };
      }
      if (current.level === "stage") return ORGANIZATION_NAVIGATION;
      return current;
    });
    clearSelection();
  }, [clearSelection]);

  const resetNavigation = useCallback(() => {
    setNavigation(ORGANIZATION_NAVIGATION);
    setExpandedNodeIds(new Set());
    clearSelection();
  }, [clearSelection]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (contextMenu || drawerNodeId || drawerEdgeId) {
        clearSelection();
      } else if (navigation.level !== "organization") {
        goBack();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    clearSelection,
    contextMenu,
    drawerEdgeId,
    drawerNodeId,
    goBack,
    navigation.level,
  ]);

  const selectedSet = useMemo(
    () => new Set(selectedNodeIds),
    [selectedNodeIds],
  );

  return {
    navigation,
    setNavigation,
    expandedNodeIds,
    setExpandedNodeIds,
    toggleExpanded,
    hoveredNodeId,
    setHoveredNodeId,
    hoveredEdgeId,
    setHoveredEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
    selectedSet,
    selectNode,
    selectEdge,
    clearSelection,
    drawerNodeId,
    drawerEdgeId,
    contextMenu,
    setContextMenu,
    viewport,
    setViewport,
    semanticZoom,
    drillDown,
    goBack,
    resetNavigation,
  };
}
