import { notFound } from "next/navigation";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { getOrgContext } from "@/lib/auth";
import { requirePlatformAdmin } from "@/lib/admin-console/access.server";
import { findAdminUserByEmail } from "@/lib/admin-console/user-integrity";
import { createAdminClient } from "@/lib/supabase/admin";
import { repairUserOrganizationAction } from "./actions";

function orgName(value: unknown): string {
  if (!value || typeof value !== "object") return "—";
  const v = value as Record<string, unknown>;
  return String(v.es || v.en || "—");
}

export default async function UserIntegrityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; fixed?: string; error?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const isEs = locale === "es";

  const ctx = await getOrgContext().catch(() => null);
  if (!ctx || !(await requirePlatformAdmin(ctx.email, "/admin/user-integrity"))) notFound();

  const admin = createAdminClient();
  const q = (sp.q || "").trim().toLowerCase();

  const { data: organizations } = await admin
    .from("organizations")
    .select("id,name_i18n,deleted_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  let user: { id: string; email?: string | null } | null = null;
  let profile: Record<string, unknown> | null = null;
  let memberships: Array<Record<string, unknown>> = [];
  let lookupError = false;

  if (q) {
    const lookup = await findAdminUserByEmail(q);

    if (lookup.status === "error") {
      lookupError = true;
    } else if (lookup.status === "found") {
      user = lookup.user;
      const [{ data: p }, { data: ms }] = await Promise.all([
        admin.from("profiles").select("id,display_name,organization_id,default_organization_id").eq("id", lookup.user.id).maybeSingle(),
        admin
          .from("organization_members")
          .select("id,organization_id,role,org_role,workspace_role,billing_seat_type,status,organizations(name_i18n)")
          .eq("user_id", lookup.user.id)
          .order("created_at", { ascending: true }),
      ]);
      profile = p as Record<string, unknown> | null;
      memberships = (ms ?? []) as Array<Record<string, unknown>>;
    }
  }

  const activeMemberships = memberships.filter((m) => m.status === "active");
  const defaultOrgId = profile?.default_organization_id ? String(profile.default_organization_id) : null;
  const defaultIsActive = defaultOrgId ? activeMemberships.some((m) => String(m.organization_id) === defaultOrgId) : false;
  const issues: string[] = [];
  if (user && activeMemberships.length === 0) issues.push(isEs ? "No tiene membresía activa en ninguna organización." : "No active organization membership.");
  if (user && !defaultOrgId) issues.push(isEs ? "No tiene organización predeterminada." : "No default organization is set.");
  if (user && defaultOrgId && !defaultIsActive) issues.push(isEs ? "La organización predeterminada no coincide con una membresía activa." : "Default organization does not match an active membership.");

  return (
    <div className="space-y-6 p-1 sm:p-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{isEs ? "Admin · Integridad de usuarios" : "Admin · User integrity"}</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">{isEs ? "Diagnóstico y reparación de usuarios" : "User diagnosis and repair"}</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            {isEs
              ? "Busca una cuenta, revisa su organización predeterminada y membresías, y corrige desalineaciones sin editar directamente profiles.organization_id."
              : "Search an account, inspect its default organization and memberships, and repair alignment without directly changing profiles.organization_id."}
          </p>
        </div>
        <Link href={`/${locale}/admin`} className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
          {isEs ? "← Volver a Admin" : "← Back to Admin"}
        </Link>
      </div>

      <form method="get" className="rounded-xl border border-border bg-card p-4">
        <label className="text-sm font-medium">{isEs ? "Correo exacto del usuario" : "Exact user email"}</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input name="q" defaultValue={q} type="email" required placeholder="usuario@empresa.com" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">{isEs ? "Diagnosticar" : "Diagnose"}</button>
        </div>
      </form>

      {sp.fixed === "1" && <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-300">{isEs ? "Reparación aplicada. Pide al usuario cerrar sesión y volver a entrar." : "Repair applied. Ask the user to sign out and sign in again."}</div>}
      {sp.error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">{isEs ? `No se pudo completar la reparación (${sp.error}).` : `Repair could not be completed (${sp.error}).`}</div>}

      {q && lookupError && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-5 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
          {isEs
            ? "No se pudo consultar el directorio de usuarios. El usuario no se marcará como inexistente. Revisa los logs del servidor e inténtalo de nuevo."
            : "The user directory lookup failed. The user will not be reported as missing. Check server logs and try again."}
        </div>
      )}

      {q && !user && !lookupError && <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">{isEs ? "No se encontró un usuario con ese correo." : "No user was found with that email."}</div>}

      {user && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium">{user.email}</p></div>
              <div><p className="text-xs text-muted-foreground">{isEs ? "Perfil" : "Profile"}</p><p className="font-medium">{String(profile?.display_name || "—")}</p></div>
              <div><p className="text-xs text-muted-foreground">{isEs ? "Organización predeterminada" : "Default organization"}</p><p className="font-medium">{defaultOrgId ? orgName(organizations?.find((o) => o.id === defaultOrgId)?.name_i18n) : "—"}</p></div>
            </div>
            <div className="mt-4">
              {issues.length === 0 ? (
                <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-300">{isEs ? "Sin inconsistencias críticas" : "No critical inconsistencies"}</span>
              ) : (
                <div className="space-y-1">{issues.map((issue) => <p key={issue} className="text-sm text-amber-700 dark:text-amber-300">⚠ {issue}</p>)}</div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3 font-semibold">{isEs ? "Membresías actuales" : "Current memberships"}</div>
            {memberships.length === 0 ? <p className="p-4 text-sm text-muted-foreground">{isEs ? "Sin membresías." : "No memberships."}</p> : (
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-left"><tr><th className="px-3 py-2">{isEs ? "Organización" : "Organization"}</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Org role</th><th className="px-3 py-2">Status</th></tr></thead><tbody>{memberships.map((m) => <tr key={String(m.id)} className="border-t border-border"><td className="px-3 py-2">{orgName((m.organizations as Record<string, unknown> | null)?.name_i18n)}</td><td className="px-3 py-2">{String(m.workspace_role || m.role || "—")}</td><td className="px-3 py-2">{String(m.org_role || "—")}</td><td className="px-3 py-2">{String(m.status || "—")}</td></tr>)}</tbody></table></div>
            )}
          </div>

          <form action={repairUserOrganizationAction} className="rounded-xl border border-brand-200 bg-card p-5">
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="email" value={user.email || q} />
            <input type="hidden" name="locale" value={locale} />
            <h2 className="font-semibold">{isEs ? "Reparar organización y acceso" : "Repair organization and access"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{isEs ? "Crea o reactiva la membresía seleccionada y la establece como organización predeterminada." : "Creates or reactivates the selected membership and makes it the default organization."}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm"><span className="mb-1 block font-medium">{isEs ? "Organización" : "Organization"}</span><select name="organizationId" required className="w-full rounded-lg border border-border bg-background px-3 py-2">{organizations?.map((o) => <option key={o.id} value={o.id}>{orgName(o.name_i18n)}</option>)}</select></label>
              <label className="text-sm"><span className="mb-1 block font-medium">{isEs ? "Nivel de acceso" : "Access preset"}</span><select name="preset" defaultValue="team_member" className="w-full rounded-lg border border-border bg-background px-3 py-2"><option value="team_member">Team Member</option><option value="project_manager">Project Manager</option><option value="admin">Admin</option></select></label>
            </div>
            <button className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">{isEs ? "Aplicar reparación" : "Apply repair"}</button>
          </form>
        </div>
      )}
    </div>
  );
}
