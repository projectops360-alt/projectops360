"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProjectManager } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── Edit a budget line (quantity / unit cost) ─────────────────────────────────
// The estimator owns the final numbers: editing recomputes the extended cost
// and persists to material_requirements (the estimate layer).

export async function updateBudgetLineAction(input: {
  materialId: string;
  projectId: string;
  locale: string;
  quantity: number | null;
  unitCost: number | null;
}): Promise<{ error?: string; total?: number | null }> {
  const gate = await requireProjectManager(input.projectId);
  if (!gate.ok) return { error: gate.error };
  const org = gate.org;

  const schema = z.object({
    materialId: z.string().uuid(),
    projectId: z.string().uuid(),
    quantity: z.number().nonnegative().nullable(),
    unitCost: z.number().nonnegative().nullable(),
  });
  const parsed = schema.safeParse({
    materialId: input.materialId,
    projectId: input.projectId,
    quantity: input.quantity,
    unitCost: input.unitCost,
  });
  if (!parsed.success) return { error: "validation_error" };

  const { materialId, quantity, unitCost } = parsed.data;
  const total = quantity != null && unitCost != null ? Math.round(quantity * unitCost * 100) / 100 : null;

  const supabase = createAdminClient();

  // Read current metadata to merge the manual-edit flag (so re-generating the
  // estimate preserves this human-entered quantity/cost instead of wiping it).
  const { data: existing } = await supabase
    .from("material_requirements")
    .select("metadata")
    .eq("id", materialId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .single();
  const mergedMetadata = {
    ...((existing?.metadata as Record<string, unknown>) ?? {}),
    manually_edited: true,
  };

  const { error } = await supabase
    .from("material_requirements")
    .update({
      quantity,
      estimated_unit_cost: unitCost,
      estimated_total_cost: total,
      // A human touched it → no longer needs AI review for this line.
      needs_review: false,
      metadata: mergedMetadata,
    })
    .eq("id", materialId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null);

  if (error) {
    console.error("Failed to update budget line:", error);
    return { error: "unexpected" };
  }

  revalidatePath(`/${input.locale}/projects/${input.projectId}/budget`, "page");
  return { total };
}
