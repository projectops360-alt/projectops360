// ============================================================================
// PMO Portfolio Living Graph — node projection (CAP-048)
// ============================================================================
// Canonical rows in, GraphNodes out. Pure: no Supabase, no React, no clock.
// Every node keeps a pointer back to the record it came from, so the UI can
// always answer "where does this come from?" with a link rather than a claim.
// ============================================================================

import type {
  GraphHealth,
  GraphNode,
  GraphNodeKind,
} from "./contracts";

/**
 * The columns this module actually reads. Deliberately narrower than the real
 * tables: a projection should not depend on columns it never looks at.
 */
export interface CanonicalRows {
  organization: { id: string; name: string } | null;
  projects: readonly {
    id: string;
    organization_id: string;
    title: string;
    status: string | null;
    start_date: string | null;
    target_end_date: string | null;
    updated_at: string | null;
  }[];
  milestones: readonly {
    id: string;
    organization_id: string;
    project_id: string;
    title: string;
    description: string | null;
    status: string | null;
    target_date: string | null;
    progress_percent: number | null;
    updated_at: string | null;
  }[];
  tasks: readonly {
    id: string;
    organization_id: string;
    project_id: string;
    milestone_id: string | null;
    title: string;
    description: string | null;
    status: string | null;
    priority: string | null;
    start_date: string | null;
    end_date: string | null;
    is_critical: boolean | null;
    slack_days: number | null;
    estimate_hours: number | null;
    actual_hours: number | null;
    updated_at: string | null;
  }[];
  subtasks: readonly {
    id: string;
    organization_id: string;
    project_id: string;
    task_id: string;
    title: string;
    description: string | null;
    status: string | null;
    start_date: string | null;
    due_date: string | null;
    estimated_hours: number | null;
    actual_hours: number | null;
    progress: number | null;
    updated_at: string | null;
  }[];
  risks: readonly {
    id: string;
    organization_id: string;
    project_id: string;
    title: string;
    description: string | null;
    status: string | null;
    severity: string | null;
    probability: string | null;
    impact: string | null;
    updated_at: string | null;
  }[];
  decisions: readonly {
    id: string;
    organization_id: string;
    project_id: string;
    title: string;
    status: string | null;
    decision_date: string | null;
    updated_at: string | null;
  }[];
  resources: readonly {
    id: string;
    organization_id: string;
    project_id: string | null;
    name: string;
    resource_type: string | null;
    status: string | null;
    capacity_per_day: number | null;
    updated_at: string | null;
  }[];
  stakeholders: readonly {
    id: string;
    organization_id: string;
    project_id: string;
    name: string;
    influence: string | null;
    interest: string | null;
    updated_at: string | null;
  }[];
  kpis: readonly {
    id: string;
    organization_id: string;
    project_id: string | null;
    name: string;
    target: number | null;
    unit: string | null;
    updated_at: string | null;
  }[];
  budgetItems: readonly {
    id: string;
    organization_id: string;
    project_id: string;
    name: string;
    status: string | null;
    estimated_cost: number | null;
    actual_cost: number | null;
    updated_at: string | null;
  }[];
}

/** Stable, collision-free node id. Kind is part of it because ids are only unique per table. */
export function nodeId(kind: GraphNodeKind, canonicalId: string): string {
  return `${kind}:${canonicalId}`;
}

/**
 * Health from a status string.
 *
 * Anything we do not recognise becomes `unknown` rather than `healthy` — an
 * unrecognised status is missing information, and colouring it green would be
 * a lie the PMO cannot see through.
 */
export function healthFromStatus(status: string | null): GraphHealth {
  if (!status) return "unknown";
  switch (status) {
    case "blocked":
    case "cancelled":
    case "overrun":
      return "critical";
    case "at_risk":
    case "on_hold":
    case "deferred":
    case "mitigating":
      return "at_risk";
    case "active":
    case "in_progress":
    case "completed":
    case "done":
    case "planned":
    case "planning":
    case "not_started":
    case "approved":
    case "resolved":
    case "closed":
      return "healthy";
    default:
      return "unknown";
  }
}

/** Risk severity drives health directly — an open critical risk is not "unknown". */
function healthFromRisk(status: string | null, severity: string | null): GraphHealth {
  const settled = status === "resolved" || status === "closed" || status === "accepted";
  if (settled) return "healthy";
  if (severity === "critical") return "critical";
  if (severity === "high") return "at_risk";
  if (severity === "medium" || severity === "low") return "healthy";
  return "unknown";
}

function base(
  kind: GraphNodeKind,
  table: string,
  row: { id: string; organization_id: string; updated_at?: string | null },
  projectId: string | null,
): Pick<
  GraphNode,
  | "id"
  | "organizationId"
  | "projectId"
  | "kind"
  | "canonicalEntityType"
  | "canonicalEntityId"
  | "provenance"
  | "confidence"
  | "evidenceRefs"
  | "validFrom"
  | "validTo"
  | "updatedAt"
> {
  return {
    id: nodeId(kind, row.id),
    organizationId: row.organization_id,
    projectId,
    kind,
    canonicalEntityType: table,
    canonicalEntityId: row.id,
    // Nodes read straight from operational tables are observed by definition.
    provenance: "OBSERVED",
    confidence: 1,
    evidenceRefs: [{ sourceTable: table, sourceId: row.id }],
    validFrom: null,
    validTo: null,
    updatedAt: row.updated_at ?? null,
  };
}

/**
 * Project canonical rows into graph nodes.
 *
 * `criticality` is left at 0 here on purpose: it depends on graph position, so
 * it is computed later by the centrality pass, which is the only place that can
 * see the whole graph.
 */
export function projectNodes(rows: CanonicalRows): GraphNode[] {
  const nodes: GraphNode[] = [];

  if (rows.organization) {
    nodes.push({
      ...base(
        "organization",
        "organizations",
        { id: rows.organization.id, organization_id: rows.organization.id },
        null,
      ),
      label: rows.organization.name,
      description: null,
      status: null,
      health: "unknown",
      criticality: 0,
      metrics: {},
    });
  }

  for (const row of rows.projects) {
    nodes.push({
      ...base("project", "projects", row, row.id),
      label: row.title,
      description: null,
      status: row.status,
      health: healthFromStatus(row.status),
      criticality: 0,
      metrics: {},
      validFrom: row.start_date,
      validTo: row.target_end_date,
    });
  }

  for (const row of rows.milestones) {
    nodes.push({
      ...base("milestone", "milestones", row, row.project_id),
      label: row.title,
      description: row.description,
      status: row.status,
      health: healthFromStatus(row.status),
      criticality: 0,
      metrics: { progressPercent: row.progress_percent },
      validTo: row.target_date,
    });
  }

  for (const row of rows.tasks) {
    nodes.push({
      ...base("task", "roadmap_tasks", row, row.project_id),
      label: row.title,
      description: row.description,
      status: row.status,
      health: healthFromStatus(row.status),
      criticality: 0,
      metrics: {
        estimateHours: row.estimate_hours,
        actualHours: row.actual_hours,
        slackDays: row.slack_days,
        priority: row.priority,
        isCritical: row.is_critical ? 1 : 0,
      },
      validFrom: row.start_date,
      validTo: row.end_date,
    });
  }

  for (const row of rows.subtasks) {
    nodes.push({
      ...base("subtask", "task_subtasks", row, row.project_id),
      label: row.title,
      description: row.description,
      status: row.status,
      health: healthFromStatus(row.status),
      criticality: 0,
      metrics: {
        estimateHours: row.estimated_hours,
        actualHours: row.actual_hours,
        progressPercent: row.progress,
      },
      validFrom: row.start_date,
      validTo: row.due_date,
    });
  }

  for (const row of rows.risks) {
    nodes.push({
      ...base("risk", "risks", row, row.project_id),
      label: row.title,
      description: row.description,
      status: row.status,
      health: healthFromRisk(row.status, row.severity),
      criticality: 0,
      metrics: {
        severity: row.severity,
        probability: row.probability,
        impact: row.impact,
      },
    });
  }

  for (const row of rows.decisions) {
    nodes.push({
      ...base("decision", "decisions", row, row.project_id),
      label: row.title,
      description: null,
      status: row.status,
      health: healthFromStatus(row.status),
      criticality: 0,
      metrics: {},
      validFrom: row.decision_date,
    });
  }

  for (const row of rows.resources) {
    nodes.push({
      ...base("resource", "resources", row, row.project_id),
      label: row.name,
      description: null,
      status: row.status,
      health: healthFromStatus(row.status),
      criticality: 0,
      metrics: {
        capacityPerDay: row.capacity_per_day,
        resourceType: row.resource_type,
      },
    });
  }

  for (const row of rows.stakeholders) {
    nodes.push({
      ...base("stakeholder", "stakeholders", row, row.project_id),
      label: row.name,
      description: null,
      status: null,
      health: "unknown",
      criticality: 0,
      metrics: { influence: row.influence, interest: row.interest },
    });
  }

  for (const row of rows.kpis) {
    nodes.push({
      ...base("kpi", "kpi_definitions", row, row.project_id),
      label: row.name,
      description: null,
      status: null,
      health: "unknown",
      criticality: 0,
      metrics: { target: row.target, unit: row.unit },
    });
  }

  for (const row of rows.budgetItems) {
    nodes.push({
      ...base("budget_item", "budget_items", row, row.project_id),
      label: row.name,
      description: null,
      status: row.status,
      health: healthFromStatus(row.status),
      criticality: 0,
      metrics: {
        estimatedCost: row.estimated_cost,
        actualCost: row.actual_cost,
      },
    });
  }

  return nodes;
}

/**
 * Last line of defence against tenant bleed.
 *
 * The read model already scopes every query by organization and RLS enforces it
 * again in the database, but a projection bug must never be the thing that
 * surfaces another tenant's project. Anything foreign is dropped here.
 */
export function assertSingleOrganization(
  nodes: readonly GraphNode[],
  organizationId: string,
): GraphNode[] {
  return nodes.filter((node) => node.organizationId === organizationId);
}
