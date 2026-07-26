import "server-only";

// ============================================================================
// PMO Portfolio Living Graph — Isabella query surface (CAP-048 §7)
// ============================================================================
// Phase 1 builds NO conversational experience and connects NO AI provider.
// What it does build is the contract Isabella will call later: typed functions
// that resolve against the same org-scoped read model the dashboard uses.
//
// Two properties are non-negotiable, because an assistant that cannot cite its
// source is worse than no assistant:
//   1. Every answer carries the evidence behind it.
//   2. Every answer is scoped by the caller's organization, never by an id the
//      caller supplies.
// ============================================================================

import type { GraphEdge, GraphEvidenceRef, GraphNode } from "./contracts";
import {
  buildAdjacency,
  findPath,
  getBlastRadius,
  getNeighbors,
  type CriticalNode,
} from "./graph-algorithms";
import { loadPortfolioGraph } from "./read-model.server";
import type { PortfolioMetrics } from "./portfolio-metrics";
import type { Locale } from "@/types/database";

/** Every reply shares this shape: an answer, or an honest absence. */
export interface GraphAnswer<T> {
  found: boolean;
  data: T | null;
  evidence: GraphEvidenceRef[];
  /** Plain-language account of how the answer was derived. Shown verbatim. */
  explanation: string;
}

function notFound<T>(explanation: string): GraphAnswer<T> {
  return { found: false, data: null, evidence: [], explanation };
}

export async function getNode(
  organizationId: string,
  locale: Locale,
  nodeId: string,
): Promise<GraphAnswer<GraphNode>> {
  const graph = await loadPortfolioGraph(organizationId, locale);
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return notFound(`No node "${nodeId}" exists in this organization's portfolio.`);
  return {
    found: true,
    data: node,
    evidence: node.evidenceRefs,
    explanation: `${node.label} is a ${node.kind} projected from ${node.canonicalEntityType}.`,
  };
}

export async function getNeighborsOf(
  organizationId: string,
  locale: Locale,
  nodeId: string,
): Promise<GraphAnswer<GraphNode[]>> {
  const graph = await loadPortfolioGraph(organizationId, locale);
  const index = buildAdjacency(graph.edges);
  const ids = new Set(getNeighbors(index, nodeId));
  if (ids.size === 0) {
    return notFound(`"${nodeId}" has no recorded relationships.`);
  }
  const neighbours = graph.nodes.filter((node) => ids.has(node.id));
  return {
    found: true,
    data: neighbours,
    evidence: graph.edges
      .filter((edge) => edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId)
      .flatMap((edge) => edge.evidenceRefs),
    explanation: `${neighbours.length} entities are directly related to this node.`,
  };
}

export async function findPathBetween(
  organizationId: string,
  locale: Locale,
  fromNodeId: string,
  toNodeId: string,
): Promise<GraphAnswer<{ nodes: GraphNode[]; edges: GraphEdge[]; hops: number }>> {
  const graph = await loadPortfolioGraph(organizationId, locale);
  const index = buildAdjacency(graph.edges);
  const path = findPath(index, fromNodeId, toNodeId);
  if (!path) {
    return notFound("No chain of recorded relationships connects these two entities.");
  }
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const nodes = path.nodeIds.map((id) => byId.get(id)).filter((node): node is GraphNode => !!node);
  return {
    found: true,
    data: { nodes, edges: path.edges, hops: path.hops },
    evidence: path.edges.flatMap((edge) => edge.evidenceRefs),
    explanation:
      `They are connected in ${path.hops} step${path.hops === 1 ? "" : "s"}: ` +
      nodes.map((node) => node.label).join(" → "),
  };
}

export async function getBlastRadiusOf(
  organizationId: string,
  locale: Locale,
  nodeId: string,
  maxHops = 3,
): Promise<GraphAnswer<{ byHop: { hop: number; nodes: GraphNode[] }[]; total: number; truncated: boolean }>> {
  const graph = await loadPortfolioGraph(organizationId, locale);
  const index = buildAdjacency(graph.edges);
  const blast = getBlastRadius(index, nodeId, maxHops);
  if (blast.totalAffected === 0) {
    return notFound("Nothing else depends on this node — moving it affects nothing recorded.");
  }
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const byHop = [...blast.byHop.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hop, ids]) => ({
      hop,
      nodes: ids.map((id) => byId.get(id)).filter((node): node is GraphNode => !!node),
    }));
  return {
    found: true,
    data: { byHop, total: blast.totalAffected, truncated: blast.truncated },
    evidence: [],
    explanation:
      `${blast.totalAffected} entities sit within ${maxHops} hops. ` +
      "Each is counted once, at its shortest distance.",
  };
}

export async function getCriticalNodes(
  organizationId: string,
  locale: Locale,
  limit = 10,
): Promise<GraphAnswer<CriticalNode[]>> {
  const graph = await loadPortfolioGraph(organizationId, locale);
  if (graph.criticalNodes.length === 0) {
    return notFound("No node currently meets any criticality condition.");
  }
  return {
    found: true,
    data: graph.criticalNodes.slice(0, limit),
    evidence: [],
    explanation: "Ranked by connectivity, cross-project reach, schedule criticality and state.",
  };
}

export async function getPortfolioMetrics(
  organizationId: string,
  locale: Locale,
): Promise<GraphAnswer<PortfolioMetrics>> {
  const graph = await loadPortfolioGraph(organizationId, locale);
  if (graph.state === "unavailable") {
    return notFound(`Portfolio data could not be read: ${graph.unavailableSources.join(", ")}.`);
  }
  return {
    found: true,
    data: graph.metrics,
    evidence: [],
    explanation:
      "Computed from canonical rows. Monetary exposure and blocked days are reported " +
      "separately and are never combined.",
  };
}

export async function explainRelationship(
  organizationId: string,
  locale: Locale,
  edgeId: string,
): Promise<GraphAnswer<GraphEdge>> {
  const graph = await loadPortfolioGraph(organizationId, locale);
  const edge = graph.edges.find((candidate) => candidate.id === edgeId);
  if (!edge) return notFound(`No relationship "${edgeId}" exists in this portfolio.`);

  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const source = byId.get(edge.sourceNodeId)?.label ?? edge.sourceNodeId;
  const target = byId.get(edge.targetNodeId)?.label ?? edge.targetNodeId;

  // The distinction that keeps the graph trustworthy: read from data, asserted
  // by a person, or computed by a rule — and the reader is told which.
  const origin =
    edge.provenance === "OBSERVED"
      ? `read directly from ${edge.evidenceRefs[0]?.sourceTable ?? "operational data"}`
      : edge.provenance === "INFERRED"
        ? "computed by a deterministic rule, not read from a record"
        : edge.provenance === "DECLARED"
          ? "asserted by a person"
          : `marked ${edge.provenance.toLowerCase()}`;

  return {
    found: true,
    data: edge,
    evidence: edge.evidenceRefs,
    explanation: `"${source}" ${edge.type.replaceAll("_", " ")} "${target}" — ${origin}.`,
  };
}
