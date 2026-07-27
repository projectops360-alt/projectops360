import type { ControlState, EvidenceOutcome, FindingCondition } from "@/lib/eki-evidence/types";
import type { TrustControlView } from "@/lib/eki-trust-context/types";

// ============================================================================
// Living Graph — Enterprise Trust lens (read-only projection)
// ============================================================================
// A FILTERED SEMANTIC VIEW of the canonical model, not a second graph. Nothing
// here is persisted: the nodes are derived from knowledge objects, the EKI
// runtime and open findings on every read, exactly like the canonical-events
// lens. A separate graph store would be the "second model" ADR-014 exists to
// prevent, and it would start disagreeing with the source the first time an
// evaluation ran while nobody was looking at the screen.
// ============================================================================

export const TRUST_NODE_KINDS = ["control", "evidence_binding", "finding", "owner", "obligation"] as const;
export type TrustNodeKind = (typeof TRUST_NODE_KINDS)[number];

/**
 * Relationship kinds shown by the lens.
 *
 * `contradicts` is a first-class edge and is never hidden. An unresolved
 * contradiction is one of the six conditions that stops a control operating, so
 * a view that omitted it would show a degraded control with no visible cause.
 */
export const TRUST_EDGE_KINDS = ["supports", "raises", "owned_by", "satisfies", "contradicts"] as const;
export type TrustEdgeKind = (typeof TRUST_EDGE_KINDS)[number];

export interface TrustLensNode {
  id: string;
  kind: TrustNodeKind;
  label: string;
  /** Present on control nodes. Null means never measured — never a default. */
  controlState: ControlState | null;
  /** Present on binding nodes. Null when the binding has not been evaluated yet. */
  evidenceOutcome: EvidenceOutcome | null;
  /** Present on finding nodes. */
  conditionCode: FindingCondition | null;
  severity: "low" | "medium" | "high" | "critical" | null;
  /** Freshness for the badge: how the last measurement described the evidence. */
  freshness: TrustFreshness;
  ownerUserId: string | null;
  /** The canonical object this node opens. Detail navigation reuses this. */
  canonicalObjectId: string;
  occurrenceCount: number | null;
  organizationId: string;
}

export interface TrustLensEdge {
  id: string;
  kind: TrustEdgeKind;
  sourceId: string;
  targetId: string;
  /** True for `contradicts`. Rendered distinctly; never filtered out silently. */
  contradictory: boolean;
  resolutionStatus: string | null;
}

/**
 * Evidence freshness as the lens shows it.
 *
 * `never_measured` is deliberately distinct from `stale`: a control that has
 * never produced evidence and one whose evidence lapsed need different work, and
 * a single "not fresh" badge would send both to the same place.
 */
export const TRUST_FRESHNESS = ["fresh", "warning", "stale", "unreadable", "never_measured"] as const;
export type TrustFreshness = (typeof TRUST_FRESHNESS)[number];

export function freshnessOf(outcome: EvidenceOutcome | null): TrustFreshness {
  if (outcome === null) return "never_measured";
  switch (outcome) {
    case "current":
      return "fresh";
    case "approaching_stale":
      return "warning";
    case "stale":
    case "contradictory":
      return "stale";
    case "unavailable":
    case "invalid":
      return "unreadable";
  }
}

export interface TrustLensProjection {
  nodes: TrustLensNode[];
  edges: TrustLensEdge[];
  organizationId: string;
}

export interface TrustLensFilters {
  controlStates?: readonly ControlState[];
  freshness?: readonly TrustFreshness[];
  findingConditions?: readonly FindingCondition[];
  /** Show only controls with an unresolved contradiction. */
  contradictoryOnly?: boolean;
  /** Show only controls with no assigned owner. */
  unownedOnly?: boolean;
}

/**
 * Build the lens from control views already scoped to one organization.
 *
 * Pure and deterministic: the same views always produce the same graph, so a
 * node the user clicks resolves to the same canonical object on the next read.
 */
export function projectTrustLens(
  views: readonly TrustControlView[],
  organizationId: string,
): TrustLensProjection {
  const nodes: TrustLensNode[] = [];
  const edges: TrustLensEdge[] = [];
  const seenOwners = new Set<string>();

  for (const view of views) {
    const latestByBinding = new Map(view.latestEvaluations.map((e) => [e.bindingObjectId, e]));

    // The control itself. Its freshness is the WORST of its bindings: a control
    // supported by one fresh and one lapsed binding is not fresh, and showing the
    // better of the two would be the reassuring lie.
    const bindingOutcomes = view.bindings.map((b) => latestByBinding.get(b.bindingObjectId)?.outcome ?? null);
    nodes.push({
      id: `ctl:${view.controlObjectId}`,
      kind: "control",
      label: view.title,
      controlState: view.controlState,
      evidenceOutcome: null,
      conditionCode: null,
      severity: null,
      freshness: worstFreshness(bindingOutcomes),
      ownerUserId: view.ownerUserId,
      canonicalObjectId: view.controlObjectId,
      occurrenceCount: null,
      organizationId,
    });

    for (const binding of view.bindings) {
      const outcome = latestByBinding.get(binding.bindingObjectId)?.outcome ?? null;
      nodes.push({
        id: `bnd:${binding.bindingObjectId}`,
        kind: "evidence_binding",
        label: binding.title,
        controlState: null,
        evidenceOutcome: outcome,
        conditionCode: null,
        severity: null,
        freshness: freshnessOf(outcome),
        ownerUserId: null,
        canonicalObjectId: binding.bindingObjectId,
        occurrenceCount: null,
        organizationId,
      });
      edges.push({
        id: `sup:${view.controlObjectId}:${binding.bindingObjectId}`,
        kind: "supports",
        sourceId: `ctl:${view.controlObjectId}`,
        targetId: `bnd:${binding.bindingObjectId}`,
        contradictory: false,
        resolutionStatus: null,
      });
    }

    for (const finding of view.openFindings) {
      nodes.push({
        id: `fnd:${finding.findingObjectId}`,
        kind: "finding",
        label: finding.conditionCode,
        controlState: null,
        evidenceOutcome: null,
        conditionCode: finding.conditionCode,
        severity: severityOf(finding.conditionCode),
        freshness: "stale",
        ownerUserId: finding.ownerUserId,
        canonicalObjectId: finding.findingObjectId,
        occurrenceCount: finding.occurrenceCount,
        organizationId,
      });
      edges.push({
        id: `rai:${view.controlObjectId}:${finding.findingObjectId}`,
        kind: "raises",
        sourceId: `ctl:${view.controlObjectId}`,
        targetId: `fnd:${finding.findingObjectId}`,
        contradictory: false,
        resolutionStatus: null,
      });
    }

    // Ownership is an edge to a person node here even though the canonical model
    // stores it as a column (Macrophase 1 refused `owned_by` as a relation). The
    // lens is a VIEW: showing who is accountable is the point, and nothing is
    // written back.
    if (view.ownerUserId) {
      const ownerNodeId = `own:${view.ownerUserId}`;
      if (!seenOwners.has(ownerNodeId)) {
        seenOwners.add(ownerNodeId);
        nodes.push({
          id: ownerNodeId,
          kind: "owner",
          label: view.ownerName ?? view.ownerUserId,
          controlState: null,
          evidenceOutcome: null,
          conditionCode: null,
          severity: null,
          freshness: "fresh",
          ownerUserId: view.ownerUserId,
          canonicalObjectId: view.ownerUserId,
          occurrenceCount: null,
          organizationId,
        });
      }
      edges.push({
        id: `own:${view.controlObjectId}:${view.ownerUserId}`,
        kind: "owned_by",
        sourceId: `ctl:${view.controlObjectId}`,
        targetId: ownerNodeId,
        contradictory: false,
        resolutionStatus: null,
      });
    }

    for (const relation of view.contradictoryRelations) {
      edges.push({
        id: `con:${relation.sourceObjectId}:${relation.targetObjectId}`,
        kind: "contradicts",
        sourceId: `ctl:${relation.sourceObjectId}`,
        targetId: `ctl:${relation.targetObjectId}`,
        contradictory: true,
        resolutionStatus: relation.resolutionStatus,
      });
    }

    for (const requirement of view.normativeRequirements) {
      const obligationId = `obl:${requirement.packageId}`;
      if (!nodes.some((n) => n.id === obligationId)) {
        nodes.push({
          id: obligationId,
          kind: "obligation",
          label: requirement.packageTitle,
          controlState: null,
          evidenceOutcome: null,
          conditionCode: null,
          severity: null,
          // A requirement is normative. It has no evidence and no lifecycle, so
          // it never carries a freshness verdict of its own.
          freshness: "never_measured",
          ownerUserId: null,
          canonicalObjectId: requirement.packageId,
          occurrenceCount: null,
          organizationId,
        });
      }
      edges.push({
        id: `sat:${view.controlObjectId}:${requirement.packageId}`,
        kind: "satisfies",
        sourceId: `ctl:${view.controlObjectId}`,
        targetId: obligationId,
        contradictory: false,
        resolutionStatus: null,
      });
    }
  }

  return { nodes, edges, organizationId };
}

function worstFreshness(outcomes: readonly (EvidenceOutcome | null)[]): TrustFreshness {
  if (outcomes.length === 0) return "never_measured";
  const rank: Record<TrustFreshness, number> = {
    unreadable: 0, stale: 1, never_measured: 2, warning: 3, fresh: 4,
  };
  return outcomes
    .map(freshnessOf)
    .reduce((worst, current) => (rank[current] < rank[worst] ? current : worst), "fresh" as TrustFreshness);
}

function severityOf(condition: FindingCondition): "medium" | "high" {
  return condition === "evidence_missing" ||
    condition === "evidence_contradictory" ||
    condition === "control_lost_operating"
    ? "high"
    : "medium";
}

/**
 * Filter the lens.
 *
 * Applied to CONTROLS; the bindings, findings, owners and obligations attached to
 * a hidden control go with it. Filtering nodes independently would leave orphan
 * findings floating with nothing to explain them.
 */
export function filterTrustLens(
  projection: TrustLensProjection,
  filters: TrustLensFilters,
): TrustLensProjection {
  const controls = projection.nodes.filter((n) => n.kind === "control");
  const kept = new Set(
    controls
      .filter((control) => {
        if (filters.controlStates?.length && (!control.controlState || !filters.controlStates.includes(control.controlState))) {
          return false;
        }
        if (filters.freshness?.length && !filters.freshness.includes(control.freshness)) return false;
        if (filters.unownedOnly && control.ownerUserId) return false;
        if (filters.contradictoryOnly) {
          const hasContradiction = projection.edges.some(
            (e) => e.contradictory && (e.sourceId === control.id || e.targetId === control.id),
          );
          if (!hasContradiction) return false;
        }
        if (filters.findingConditions?.length) {
          const conditions = projection.edges
            .filter((e) => e.kind === "raises" && e.sourceId === control.id)
            .map((e) => projection.nodes.find((n) => n.id === e.targetId)?.conditionCode)
            .filter((c): c is FindingCondition => Boolean(c));
          if (!conditions.some((c) => filters.findingConditions!.includes(c))) return false;
        }
        return true;
      })
      .map((control) => control.id),
  );

  const reachable = new Set<string>(kept);
  for (const edge of projection.edges) {
    if (kept.has(edge.sourceId)) reachable.add(edge.targetId);
    if (kept.has(edge.targetId)) reachable.add(edge.sourceId);
  }

  return {
    organizationId: projection.organizationId,
    nodes: projection.nodes.filter((n) => reachable.has(n.id)),
    edges: projection.edges.filter((e) => reachable.has(e.sourceId) && reachable.has(e.targetId)),
  };
}

/**
 * Every node in the projection belongs to one organization.
 *
 * Checked rather than assumed: the loader scopes its reads, but a projection that
 * silently mixed tenants would render a cross-tenant graph that looks entirely
 * normal.
 */
export function assertSingleTenant(projection: TrustLensProjection): void {
  const foreign = projection.nodes.filter((n) => n.organizationId !== projection.organizationId);
  if (foreign.length > 0) {
    throw new Error(`trust_lens_cross_tenant_nodes:${foreign.length}`);
  }
}
