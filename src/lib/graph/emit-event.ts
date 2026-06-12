// ============================================================================
// ProjectOps360° — Living Graph Event Ingestion Pipeline (PI-003)
// ============================================================================
// Emits process_nodes and process_edges whenever key entities are created
// or transition. Uses fire-and-forget: failures are logged but never block
// the calling server action.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ProcessNodeType,
  ProcessEdgeType,
  ProcessNodeSourceType,
} from "@/types/database";

// ── Input types ────────────────────────────────────────────────────────────────

export interface EmitNodeInput {
  organizationId: string;
  projectId: string;
  nodeType: ProcessNodeType;
  sourceEntityType: ProcessNodeSourceType;
  sourceEntityId: string;
  title: string;
  metadata?: Record<string, unknown>;
  occurredAt?: string; // ISO timestamp, defaults to now()
}

export interface EmitEdgeInput {
  organizationId: string;
  projectId: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: ProcessEdgeType;
  weight?: number;
  metadata?: Record<string, unknown>;
}

// ── Core emitters ──────────────────────────────────────────────────────────────

/**
 * Insert a process_node into the Living Graph.
 * Returns the created node's ID, or null on failure.
 */
export async function emitProcessNode(
  input: EmitNodeInput,
): Promise<string | null> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("process_nodes")
      .insert({
        organization_id: input.organizationId,
        project_id: input.projectId,
        node_type: input.nodeType,
        source_entity_type: input.sourceEntityType,
        source_entity_id: input.sourceEntityId,
        title: input.title,
        metadata: input.metadata ?? {},
        occurred_at: input.occurredAt ?? new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      // Unique violation = node already exists for this source (idempotent)
      if (error.code === "23505") {
        // Fetch the existing node's ID so callers can still link edges
        const { data: existing } = await supabase
          .from("process_nodes")
          .select("id")
          .eq("project_id", input.projectId)
          .eq("source_entity_type", input.sourceEntityType)
          .eq("source_entity_id", input.sourceEntityId)
          .eq("node_type", input.nodeType)
          .is("deleted_at", null)
          .single();

        return existing?.id ?? null;
      }
      console.error("[graph] emitProcessNode failed:", error.message);
      return null;
    }

    return data.id;
  } catch (err) {
    console.error("[graph] emitProcessNode exception:", err);
    return null;
  }
}

/**
 * Insert a process_edge into the Living Graph.
 * Returns true on success, false on failure.
 * Silently skips on unique violation (duplicate edge).
 */
export async function emitProcessEdge(input: EmitEdgeInput): Promise<boolean> {
  try {
    const supabase = createAdminClient();

    const { error } = await supabase.from("process_edges").insert({
      organization_id: input.organizationId,
      project_id: input.projectId,
      from_node_id: input.fromNodeId,
      to_node_id: input.toNodeId,
      edge_type: input.edgeType,
      weight: input.weight ?? 1.0,
      metadata: input.metadata ?? {},
    });

    if (error) {
      // Unique violation = edge already exists — silently skip
      if (error.code === "23505") return true;
      console.error("[graph] emitProcessEdge failed:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[graph] emitProcessEdge exception:", err);
    return false;
  }
}

// ── Auto-link: find related nodes and create edges ────────────────────────────

/**
 * After creating a new process_node, automatically discover and link related
 * existing nodes in the same project. This creates causal/temporal edges:
 *
 * - task_transition → task_transition: if they occurred within 1 hour
 * - decision_cascade → task_transition: if a traceability_link exists
 * - communication_flow → task_transition: if a traceability_link exists
 * - milestone_gate → task_transition: if task milestone matches
 *
 * @param newNodeId  - The just-created process_node ID
 * @param input      - The same EmitNodeInput used to create the node
 */
export async function autoLinkProcessNode(
  newNodeId: string,
  input: EmitNodeInput,
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { projectId, organizationId, nodeType, sourceEntityType } = input;

    // ── 1. Task transition → recent task transitions (temporal/caused) ────
    if (nodeType === "task_transition" && sourceEntityType === "roadmap_tasks") {
      // Find other task_transition nodes in this project that occurred
      // within the last hour (excluding self)
      const oneHourAgo = new Date(
        Date.now() - 60 * 60 * 1000,
      ).toISOString();

      const { data: recentNodes } = await supabase
        .from("process_nodes")
        .select("id")
        .eq("project_id", projectId)
        .eq("node_type", "task_transition")
        .eq("source_entity_type", "roadmap_tasks")
        .neq("id", newNodeId)
        .is("deleted_at", null)
        .gte("occurred_at", oneHourAgo)
        .order("occurred_at", { ascending: false })
        .limit(20);

      if (recentNodes && recentNodes.length > 0) {
        // Create edges: recent → new (caused relationship)
        for (const node of recentNodes) {
          await emitProcessEdge({
            organizationId,
            projectId,
            fromNodeId: node.id,
            toNodeId: newNodeId,
            edgeType: "caused",
            weight: 1.0,
            metadata: { auto_linked: true, reason: "temporal_proximity" },
          });
        }
      }
    }

    // ── 2. Decision cascade → linked tasks via traceability_links ──────────
    if (nodeType === "decision_cascade" && sourceEntityType === "decisions") {
      // Find traceability_links where target is this decision
      const { data: links } = await supabase
        .from("traceability_links")
        .select("source_type, source_id")
        .eq("organization_id", organizationId)
        .eq("target_type", "decision")
        .eq("target_id", input.sourceEntityId);

      if (links && links.length > 0) {
        for (const link of links) {
          // Map source_type to process_nodes source_entity_type
          const mappedSourceType =
            link.source_type === "action_item"
              ? "roadmap_tasks"
              : link.source_type;

          // Find matching process_nodes
          const { data: linkedNodes } = await supabase
            .from("process_nodes")
            .select("id")
            .eq("project_id", projectId)
            .eq("source_entity_type", mappedSourceType)
            .eq("source_entity_id", link.source_id)
            .is("deleted_at", null)
            .limit(5);

          if (linkedNodes) {
            for (const linkedNode of linkedNodes) {
              await emitProcessEdge({
                organizationId,
                projectId,
                fromNodeId: newNodeId, // decision → task
                toNodeId: linkedNode.id,
                edgeType: "caused",
                weight: 1.0,
                metadata: {
                  auto_linked: true,
                  reason: "traceability_link",
                  link_source_type: link.source_type,
                },
              });
            }
          }
        }
      }
    }

    // ── 3. Communication flow → linked tasks via traceability_links ────────
    if (
      nodeType === "communication_flow" &&
      sourceEntityType === "communication_items"
    ) {
      const { data: links } = await supabase
        .from("traceability_links")
        .select("source_type, source_id, target_type, target_id")
        .eq("organization_id", organizationId)
        .or(
          `source_id.eq.${input.sourceEntityId},target_id.eq.${input.sourceEntityId}`,
        );

      if (links && links.length > 0) {
        for (const link of links) {
          // Determine the "other" entity in the link
          const isSource = link.source_id === input.sourceEntityId;
          const otherType = isSource ? link.target_type : link.source_type;
          const otherId = isSource ? link.target_id : link.source_id;

          const mappedType =
            otherType === "action_item" ? "roadmap_tasks" : otherType;

          const { data: linkedNodes } = await supabase
            .from("process_nodes")
            .select("id")
            .eq("project_id", projectId)
            .eq("source_entity_type", mappedType)
            .eq("source_entity_id", otherId)
            .is("deleted_at", null)
            .limit(5);

          if (linkedNodes) {
            for (const linkedNode of linkedNodes) {
              await emitProcessEdge({
                organizationId,
                projectId,
                fromNodeId: newNodeId,
                toNodeId: linkedNode.id,
                edgeType: "informed",
                weight: 0.5,
                metadata: {
                  auto_linked: true,
                  reason: "traceability_link",
                  linked_entity_type: otherType,
                },
              });
            }
          }
        }
      }
    }

    // ── 4. Milestone gate → tasks in that milestone ────────────────────────
    if (nodeType === "milestone_gate" && sourceEntityType === "milestones") {
      const { data: tasksInMilestone } = await supabase
        .from("roadmap_tasks")
        .select("id")
        .eq("project_id", projectId)
        .eq("milestone_id", input.sourceEntityId)
        .is("deleted_at", null)
        .limit(20);

      if (tasksInMilestone && tasksInMilestone.length > 0) {
        for (const task of tasksInMilestone) {
          const { data: taskNodes } = await supabase
            .from("process_nodes")
            .select("id")
            .eq("project_id", projectId)
            .eq("source_entity_type", "roadmap_tasks")
            .eq("source_entity_id", task.id)
            .eq("node_type", "task_transition")
            .is("deleted_at", null)
            .limit(5);

          if (taskNodes) {
            for (const taskNode of taskNodes) {
              await emitProcessEdge({
                organizationId,
                projectId,
                fromNodeId: newNodeId,
                toNodeId: taskNode.id,
                edgeType: "enabled",
                weight: 1.0,
                metadata: {
                  auto_linked: true,
                  reason: "milestone_contains_task",
                },
              });
            }
          }
        }
      }
    }

    // ── 5. Labor risk → affected milestone gates and task transitions ──────
    if (nodeType === "labor_risk" && sourceEntityType === "construction_activities") {
      const affectedMilestoneIds = (input.metadata?.affectedMilestoneIds as string[]) ?? [];

      if (affectedMilestoneIds.length > 0) {
        // Link to milestone_gate nodes for affected milestones
        const { data: milestoneNodes } = await supabase
          .from("process_nodes")
          .select("id")
          .eq("project_id", projectId)
          .eq("node_type", "milestone_gate")
          .in("source_entity_id", affectedMilestoneIds)
          .is("deleted_at", null);

        if (milestoneNodes && milestoneNodes.length > 0) {
          for (const node of milestoneNodes) {
            await emitProcessEdge({
              organizationId,
              projectId,
              fromNodeId: newNodeId,
              toNodeId: node.id,
              edgeType: "labor_constrained",
              weight: 1.0,
              metadata: {
                auto_linked: true,
                reason: "labor_risk_affects_milestone",
              },
            });
          }
        }

        // Link to task_transition nodes whose task belongs to an affected milestone
        const { data: taskNodes } = await supabase
          .from("process_nodes")
          .select("id, metadata")
          .eq("project_id", projectId)
          .eq("node_type", "task_transition")
          .eq("source_entity_type", "roadmap_tasks")
          .is("deleted_at", null)
          .limit(100);

        if (taskNodes && taskNodes.length > 0) {
          for (const node of taskNodes) {
            const taskMilestoneId = (node.metadata as Record<string, unknown>)?.milestone_id as string | undefined;
            if (taskMilestoneId && affectedMilestoneIds.includes(taskMilestoneId)) {
              await emitProcessEdge({
                organizationId,
                projectId,
                fromNodeId: newNodeId,
                toNodeId: node.id,
                edgeType: "delayed",
                weight: 0.8,
                metadata: {
                  auto_linked: true,
                  reason: "labor_risk_delays_task",
                },
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("[graph] autoLinkProcessNode exception:", err);
    // Never throw — this is fire-and-forget
  }
}

// ── Convenience: emit + auto-link in one call ──────────────────────────────────

/**
 * Emit a process node and automatically link it to related existing nodes.
 * This is the primary API for server actions.
 * Fire-and-forget: failures are logged but never block the caller.
 */
export function emitAndAutoLink(input: EmitNodeInput): void {
  // Fire-and-forget: start the async work but don't await it
  emitProcessNode(input)
    .then((nodeId) => {
      if (nodeId) {
        return autoLinkProcessNode(nodeId, input);
      }
    })
    .catch((err) => {
      console.error("[graph] emitAndAutoLink error:", err);
    });
}