"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

async function ctx() {
  try { const org = await getOrgContext(); return { org, supabase: createAdminClient() }; }
  catch { return null; }
}

export async function createContactAction(input: {
  name: string; email?: string; companyName?: string; contactType?: string; phone?: string; notes?: string; canLogin?: boolean;
}): Promise<{ error?: string; id?: string }> {
  const c = await ctx();
  if (!c) return { error: "not_authenticated" };
  if (!input.name?.trim()) return { error: "name_required" };
  const { data, error } = await c.supabase.from("external_contacts").insert({
    organization_id: c.org.organizationId, name: input.name.trim(),
    email: input.email?.trim() || null, company_name: input.companyName?.trim() || null,
    contact_type: input.contactType || null, phone: input.phone?.trim() || null,
    notes: input.notes?.trim() || null, can_login: !!input.canLogin, access_status: "active",
  }).select("id").single();
  if (error || !data) return { error: "unexpected" };
  await logAudit({ org: c.org, action: "create", entityType: "external_contacts", entityId: data.id, metadata: { name: input.name } });
  return { id: data.id };
}

export async function updateContactAction(input: {
  id: string; name?: string; email?: string; companyName?: string; contactType?: string; phone?: string; notes?: string; accessStatus?: string;
}): Promise<{ error?: string }> {
  const c = await ctx();
  if (!c) return { error: "not_authenticated" };
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.email !== undefined) patch.email = input.email.trim() || null;
  if (input.companyName !== undefined) patch.company_name = input.companyName.trim() || null;
  if (input.contactType !== undefined) patch.contact_type = input.contactType || null;
  if (input.phone !== undefined) patch.phone = input.phone.trim() || null;
  if (input.notes !== undefined) patch.notes = input.notes.trim() || null;
  if (input.accessStatus !== undefined) patch.access_status = input.accessStatus;
  const { error } = await c.supabase.from("external_contacts").update(patch).eq("id", input.id).eq("organization_id", c.org.organizationId);
  return error ? { error: "unexpected" } : {};
}

export async function deleteContactAction(input: { id: string }): Promise<{ error?: string }> {
  const c = await ctx();
  if (!c) return { error: "not_authenticated" };
  const { error } = await c.supabase.from("external_contacts").update({ deleted_at: new Date().toISOString() }).eq("id", input.id).eq("organization_id", c.org.organizationId);
  return error ? { error: "unexpected" } : {};
}
