"use server";

// ============================================================================
// ProjectOps360° — Settings server actions
// ============================================================================
// renameOrganizationAction: lets an org owner/admin rename their OWN
// organization. Runs through the user's RLS session — the DB policy
// "PMO can update own organizations" (is_pmo_level) is the final authority;
// the role check here is a fast, friendly pre-check. The name is a proper
// noun so it is written verbatim to BOTH locales of name_i18n (UX-012: we
// never auto-translate user-generated content).
// ============================================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";

const MIN_NAME = 2;
const MAX_NAME = 120;

export type RenameOrgState =
  | { ok: true; name: string }
  | { ok: false; reason: "not_authorized" | "invalid_name" | "error" }
  | null;

export async function renameOrganizationAction(
  _prev: RenameOrgState,
  formData: FormData,
): Promise<RenameOrgState> {
  const ctx = await getOrgContext().catch(() => null);
  if (!ctx) return { ok: false, reason: "not_authorized" };
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { ok: false, reason: "not_authorized" };
  }

  const name = ((formData.get("organizationName") as string) ?? "").trim();
  if (name.length < MIN_NAME || name.length > MAX_NAME) {
    return { ok: false, reason: "invalid_name" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ name_i18n: { en: name, es: name } })
    .eq("id", ctx.organizationId);

  if (error) return { ok: false, reason: "error" };

  revalidatePath("/", "layout");
  return { ok: true, name };
}
