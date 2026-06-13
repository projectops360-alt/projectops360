import { setRequestLocale } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth";
import { getI18nValue } from "@/types/database";
import type { Locale } from "@/types/database";
import { Users, UserRound, HardHat, Building2, Wrench, ShieldCheck } from "lucide-react";

const TYPE_META: Record<string, { icon: typeof UserRound; en: string; es: string }> = {
  person: { icon: UserRound, en: "Person", es: "Persona" },
  crew: { icon: HardHat, en: "Crew", es: "Cuadrilla" },
  team: { icon: Users, en: "Team", es: "Equipo" },
  role: { icon: ShieldCheck, en: "Role", es: "Rol" },
  vendor: { icon: Building2, en: "Vendor", es: "Proveedor" },
  subcontractor: { icon: Wrench, en: "Subcontractor", es: "Subcontratista" },
};

const ASSIGNABLE_TYPES = ["person", "crew", "team", "role", "vendor", "subcontractor"];

function normName(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isEs = locale === "es";

  const org = await getOrgContext();
  const supabase = createAdminClient();

  const [membersRes, profilesRes, resourcesRes, projectsRes] = await Promise.all([
    supabase.from("organization_members").select("user_id, role").eq("organization_id", org.organizationId),
    supabase.from("profiles").select("id, display_name, avatar_url").eq("organization_id", org.organizationId),
    supabase
      .from("resources")
      .select("id, name, resource_type, trade_key, project_id, status")
      .eq("organization_id", org.organizationId)
      .in("resource_type", ASSIGNABLE_TYPES)
      .is("deleted_at", null),
    supabase.from("projects").select("id, title_i18n, slug").eq("organization_id", org.organizationId).is("deleted_at", null),
  ]);

  const profileById = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  const members = (membersRes.data ?? []).map((m) => ({
    role: m.role,
    name: profileById.get(m.user_id)?.display_name || (m.user_id === org.userId ? org.displayName || org.email : "—"),
    isYou: m.user_id === org.userId,
  }));

  const projectName = new Map(
    (projectsRes.data ?? []).map((p) => [p.id, getI18nValue(p.title_i18n, locale as Locale) || p.slug]),
  );

  // Group resources by normalized name → one directory entry across projects.
  type Entry = { name: string; types: Set<string>; trades: Set<string>; projects: Set<string> };
  const byName = new Map<string, Entry>();
  for (const r of resourcesRes.data ?? []) {
    const key = normName(r.name);
    if (!byName.has(key)) byName.set(key, { name: r.name, types: new Set(), trades: new Set(), projects: new Set() });
    const e = byName.get(key)!;
    e.types.add(r.resource_type);
    if (r.trade_key) e.trades.add(r.trade_key);
    if (r.project_id) e.projects.add(projectName.get(r.project_id) ?? "—");
  }
  const directory = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));

  const roleLabel = (role: string) =>
    isEs
      ? ({ owner: "Propietario", admin: "Administrador", member: "Miembro", viewer: "Lector" } as Record<string, string>)[role] ?? role
      : role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Users className="h-6 w-6 text-brand-500" />
          {isEs ? "Equipo" : "Team"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEs
            ? "Usuarios del workspace y las personas, cuadrillas y proveedores que participan en tus proyectos."
            : "Workspace users plus the people, crews, and vendors working across your projects."}
        </p>
      </div>

      {/* Workspace users (real accounts) */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {isEs ? "Usuarios del workspace" : "Workspace users"}
          <span className="ml-1.5 font-normal text-muted-foreground/70">({members.length})</span>
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                {m.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {m.name}{m.isYou && <span className="ml-1 text-xs text-muted-foreground">({isEs ? "tú" : "you"})</span>}
                </p>
                <p className="text-xs text-muted-foreground">{roleLabel(m.role)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Project people, crews & vendors (resources) */}
      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {isEs ? "Personas, cuadrillas y proveedores" : "People, crews & vendors"}
          <span className="ml-1.5 font-normal text-muted-foreground/70">({directory.length})</span>
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {isEs
            ? "Creados al asignar tareas o al importar proyectos. Se reutilizan entre proyectos."
            : "Created when assigning tasks or importing projects. Reused across projects."}
        </p>

        {directory.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {isEs
              ? "Aún no hay personas ni cuadrillas. Asígnalas desde una tarea con “Agregar persona”."
              : "No people or crews yet. Add them from a task with “Add new person”."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">{isEs ? "Nombre" : "Name"}</th>
                  <th className="px-4 py-2 font-medium">{isEs ? "Tipo" : "Type"}</th>
                  <th className="px-4 py-2 font-medium">{isEs ? "Oficio / Especialidad" : "Trade"}</th>
                  <th className="px-4 py-2 font-medium">{isEs ? "Proyectos" : "Projects"}</th>
                </tr>
              </thead>
              <tbody>
                {directory.map((e, i) => {
                  const primaryType = [...e.types][0] ?? "person";
                  const meta = TYPE_META[primaryType] ?? TYPE_META.person;
                  const Icon = meta.icon;
                  return (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 font-medium text-foreground">{e.name}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                          <Icon className="h-3.5 w-3.5 text-brand-500" />
                          {isEs ? meta.es : meta.en}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {e.trades.size > 0 ? [...e.trades].join(", ") : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {[...e.projects].map((p) => (
                            <span key={p} className="max-w-[180px] truncate rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground" title={p}>{p}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
