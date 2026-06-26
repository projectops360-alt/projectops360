"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProjectManager } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { TaskDependency, DependencyType } from "@/types/database";

// ── Zod Schemas ────────────────────────────────────────────────────────────────

const dependencyTypeValues = ["finish_to_start", "start_to_start", "start_to_finish", "finish_to_finish"] as const;

const createDependencySchema = z.object({
  predecessor_id: z.string().uuid("invalid_predecessor_id"),
  successor_id: z.string().uuid("invalid_successor_id"),
  dependency_type: z.enum(dependencyTypeValues).default("finish_to_start"),
  lag_days: z.coerce.number().int().min(-365).max(365).default(0),
  projectId: z.string().uuid("invalid_project_id"),
});

const deleteDependencySchema = z.object({
  dependencyId: z.string().uuid("invalid_dependency_id"),
  projectId: z.string().uuid("invalid_project_id"),
});

const getDependenciesSchema = z.object({
  projectId: z.string().uuid("invalid_project_id"),
});

const updateTaskDatesSchema = z.object({
  taskId: z.string().uuid("invalid_task_id"),
  start_date: z.string().optional().default(""),
  end_date: z.string().optional().default(""),
  projectId: z.string().uuid("invalid_project_id"),
});

// ── Cycle Detection (DFS) ────────────────────────────────────────────────────────

/**
 * Detects whether adding an edge from `newPredecessor` to `newSuccessor`
 * would create a cycle in the dependency graph.
 * Returns true if a cycle would be created.
 */
function wouldCreateCycle(
  existingDeps: { predecessor_id: string; successor_id: string }[],
  newPredecessor: string,
  newSuccessor: string,
): boolean {
  // Build adjacency list: successor → predecessors
  const adj = new Map<string, Set<string>>();
  for (const dep of existingDeps) {
    if (!adj.has(dep.successor_id)) adj.set(dep.successor_id, new Set());
    adj.get(dep.successor_id)!.add(dep.predecessor_id);
  }
  // Add the new edge
  if (!adj.has(newSuccessor)) adj.set(newSuccessor, new Set());
  adj.get(newSuccessor)!.add(newPredecessor);

  // DFS from newPredecessor: if we can reach newSuccessor, it's a cycle
  const visited = new Set<string>();
  const stack = [newPredecessor];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === newSuccessor) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const predecessors = adj.get(current);
    if (predecessors) {
      for (const pred of predecessors) {
        if (!visited.has(pred)) stack.push(pred);
      }
    }
  }

  return false;
}

// ── Create Dependency ────────────────────────────────────────────────────────────

export async function createDependencyAction(input: {
  predecessor_id: string;
  successor_id: string;
  dependency_type?: string;
  lag_days?: number;
  projectId: string;
}): Promise<{ error?: string; dependencyId?: string }> {
  const __g = await requireProjectManager(input.projectId);
  if (!__g.ok) return { error: __g.error };
  const org = __g.org;

  const parsed = createDependencySchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const data = parsed.data;

  if (data.predecessor_id === data.successor_id) {
    return { error: "self_dependency" };
  }

  const supabase = createAdminClient();

  // Fetch existing dependencies for cycle detection
  const { data: existingDeps } = await supabase
    .from("task_dependencies")
    .select("predecessor_id, successor_id")
    .eq("project_id", data.projectId)
    .eq("organization_id", org.organizationId);

  if (wouldCreateCycle(existingDeps ?? [], data.predecessor_id, data.successor_id)) {
    return { error: "circular_dependency" };
  }

  // Verify both tasks exist and belong to this project
  const { data: tasks } = await supabase
    .from("roadmap_tasks")
    .select("id, title")
    .in("id", [data.predecessor_id, data.successor_id])
    .eq("project_id", data.projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (!tasks || tasks.length !== 2) {
    return { error: "task_not_found" };
  }

  const { data: dependency, error: insertError } = await supabase
    .from("task_dependencies")
    .insert({
      organization_id: org.organizationId,
      project_id: data.projectId,
      predecessor_id: data.predecessor_id,
      successor_id: data.successor_id,
      dependency_type: data.dependency_type,
      lag_days: data.lag_days,
    })
    .select("id")
    .single();

  if (insertError || !dependency) {
    // Handle unique constraint violation
    if (insertError?.code === "23505") {
      return { error: "duplicate_dependency" };
    }
    console.error("Failed to create dependency:", insertError);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    projectId: data.projectId,
    action: "create",
    entityType: "task_dependencies",
    entityId: dependency.id,
    metadata: {
      predecessor_id: data.predecessor_id,
      successor_id: data.successor_id,
      dependency_type: data.dependency_type,
      lag_days: data.lag_days,
    },
  });

  revalidatePath(`/(app)/projects/${data.projectId}`, "layout");

  return { dependencyId: dependency.id };
}

// ── Delete Dependency ────────────────────────────────────────────────────────────

export async function deleteDependencyAction(input: {
  dependencyId: string;
  projectId: string;
}): Promise<{ error?: string }> {
  const __g = await requireProjectManager(input.projectId);
  if (!__g.ok) return { error: __g.error };
  const org = __g.org;

  const parsed = deleteDependencySchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const data = parsed.data;
  const supabase = createAdminClient();

  const { error: deleteError } = await supabase
    .from("task_dependencies")
    .delete()
    .eq("id", data.dependencyId)
    .eq("organization_id", org.organizationId)
    .eq("project_id", data.projectId);

  if (deleteError) {
    console.error("Failed to delete dependency:", deleteError);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    projectId: data.projectId,
    action: "delete",
    entityType: "task_dependencies",
    entityId: data.dependencyId,
    metadata: {},
  });

  revalidatePath(`/(app)/projects/${data.projectId}`, "layout");

  return {};
}

// ── Get Dependencies ──────────────────────────────────────────────────────────────

export async function getDependenciesAction(input: {
  projectId: string;
}): Promise<{ error?: string; data?: TaskDependency[] }> {
  const __g = await requireProjectManager(input.projectId);
  if (!__g.ok) return { error: __g.error };
  const org = __g.org;

  const parsed = getDependenciesSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("task_dependencies")
    .select("*")
    .eq("project_id", input.projectId)
    .eq("organization_id", org.organizationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch dependencies:", error);
    return { error: "unexpected" };
  }

  return { data: (data as TaskDependency[]) ?? [] };
}

// ── Update Task Dates ────────────────────────────────────────────────────────────

export async function updateTaskDatesAction(input: {
  taskId: string;
  start_date?: string;
  end_date?: string;
  projectId: string;
}): Promise<{ error?: string }> {
  const __g = await requireProjectManager(input.projectId);
  if (!__g.ok) return { error: __g.error };
  const org = __g.org;

  const parsed = updateTaskDatesSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || "validation_error" };
  }

  const data = parsed.data;
  const supabase = createAdminClient();

  // Calculate duration_days
  let durationDays: number | null = null;
  if (data.start_date && data.end_date) {
    const start = new Date(data.start_date + "T00:00:00");
    const end = new Date(data.end_date + "T00:00:00");
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
      durationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
  }

  const { error: updateError } = await supabase
    .from("roadmap_tasks")
    .update({
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      duration_days: durationDays,
    })
    .eq("id", data.taskId)
    .eq("organization_id", org.organizationId)
    .eq("project_id", data.projectId)
    .is("deleted_at", null);

  if (updateError) {
    console.error("Failed to update task dates:", updateError);
    return { error: "unexpected" };
  }

  await logAudit({
    org,
    projectId: data.projectId,
    action: "update",
    entityType: "roadmap_tasks",
    entityId: data.taskId,
    metadata: {
      field: "dates",
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      duration_days: durationDays,
    },
  });

  revalidatePath(`/(app)/projects/${data.projectId}`, "layout");

  return {};
}