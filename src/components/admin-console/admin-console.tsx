"use client";

// ============================================================================
// ProjectOps360° — Admin Console (client cockpit, read-only)
// ============================================================================
// Receives ALL aggregated data as props from the server route (which already
// passed the platform-admin gate). Drill-downs (company users, project tasks)
// go through gated server actions in ./actions — never a direct client query.
// No admin data is fetched here; this component only renders what the server
// already authorized. UI strings come from the i18n system (adminConsole +
// nav namespaces) — no Spanglish (UX-012).
// ============================================================================

import { useMemo, useState, useTransition, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck, Building2, Users, FolderKanban, ListTodo, Lock, Search,
  ChevronDown, ChevronRight, Loader2, UserCircle2, Inbox, Pencil, CreditCard,
} from "lucide-react";
import type { Locale } from "@/types/database";
import type { TaskStatus } from "@/types/database";
import type {
  AdminMetrics, CompanyRow, CompanyUserRow, UserProjectRow,
  ProjectTaskAggregate, AuthorizedAdminRow, AdminTaskPage, PlanCatalogRow,
} from "@/lib/admin-console/types";
import {
  getOrgUsersAction, getProjectTasksAction, renameOrgAdminAction,
  grantSystemAdminAction, revokeSystemAdminAction,
} from "@/app/[locale]/(app)/admin/actions";

type Tab = "overview" | "companies" | "usersProjects" | "projectTasks" | "plans" | "adminAccess";

const TASK_STATUSES: TaskStatus[] = [
  "not_started", "prompt_ready", "sent_to_ai", "in_progress",
  "implemented", "tested", "done", "blocked", "deferred",
];

const STATUS_TONE: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
  prompt_ready: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  sent_to_ai: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  implemented: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
  tested: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
  done: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  blocked: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  deferred: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
};

const ROLE_TONE: Record<string, string> = {
  owner: "bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  member: "bg-muted text-muted-foreground",
  viewer: "bg-muted text-muted-foreground",
};

const inp = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-brand-500 focus:outline-none";

export function AdminConsole({
  locale, metrics, companies, projectsByUser, projectTasks, admins, planCatalog, fallbackEmail,
}: {
  locale: Locale;
  metrics: AdminMetrics;
  companies: CompanyRow[];
  projectsByUser: UserProjectRow[];
  projectTasks: ProjectTaskAggregate[];
  admins: AuthorizedAdminRow[];
  planCatalog: PlanCatalogRow[];
  fallbackEmail: string;
}) {
  const t = useTranslations("adminConsole");
  const [tab, setTab] = useState<Tab>("overview");
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const tabs: { key: Tab; label: string; icon: typeof Building2 }[] = [
    { key: "overview", label: t("overview"), icon: ShieldCheck },
    { key: "companies", label: t("companies"), icon: Building2 },
    { key: "usersProjects", label: t("usersProjects"), icon: Users },
    { key: "projectTasks", label: t("projectTasks"), icon: ListTodo },
    { key: "plans", label: t("plansTab"), icon: CreditCard },
    { key: "adminAccess", label: t("adminAccess"), icon: Lock },
  ];

  const companyOptions = useMemo(
    () => Array.from(new Set(companies.map((c) => `${c.id}::${c.name}`))).sort(),
    [companies],
  );
  const userOptions = useMemo(
    () => Array.from(new Set(projectsByUser.map((p) => `${p.userId}::${p.ownerName || p.ownerEmail || p.userId}`))).filter((s) => !s.startsWith("::")).sort(),
    [projectsByUser],
  );
  const projectOptions = useMemo(
    () => Array.from(new Set(projectsByUser.map((p) => `${p.projectId}::${p.projectTitle}`))).sort(),
    [projectsByUser],
  );

  const filteredProjectsByUser = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projectsByUser.filter((p) => {
      if (companyFilter !== "all" && p.organizationId !== companyFilter) return false;
      if (userFilter !== "all" && p.userId !== userFilter) return false;
      if (projectFilter !== "all" && p.projectId !== projectFilter) return false;
      if (statusFilter !== "all" && p.projectStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        p.projectTitle.toLowerCase().includes(q) ||
        (p.ownerName ?? "").toLowerCase().includes(q) ||
        (p.ownerEmail ?? "").toLowerCase().includes(q) ||
        p.organizationName.toLowerCase().includes(q)
      );
    });
  }, [projectsByUser, query, companyFilter, userFilter, projectFilter, statusFilter]);

  const filteredProjectTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projectTasks.filter((p) => {
      if (companyFilter !== "all" && p.organizationId !== companyFilter) return false;
      if (statusFilter === "open" && p.openTasks === 0) return false;
      if (statusFilter === "blocked" && p.blockedTasks === 0) return false;
      if (statusFilter === "done" && p.completedTasks === p.totalTasks) return false;
      if (!q) return true;
      return p.projectTitle.toLowerCase().includes(q) || p.organizationName.toLowerCase().includes(q) || (p.ownerName ?? "").toLowerCase().includes(q);
    });
  }, [projectTasks, query, companyFilter, statusFilter]);

  const kpis = [
    { label: t("kpiCompanies"), value: metrics.totalCompanies, icon: Building2, tone: "text-foreground" },
    { label: t("kpiUsers"), value: metrics.totalUsers, icon: Users, tone: "text-foreground" },
    { label: t("kpiProjects"), value: metrics.totalProjects, icon: FolderKanban, tone: "text-foreground" },
    { label: t("kpiTasks"), value: metrics.totalTasks, icon: ListTodo, tone: "text-foreground" },
    { label: t("kpiAdminUsers"), value: metrics.activeAdminUsers, icon: Lock, tone: "text-brand-600 dark:text-brand-400" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
          <Lock className="h-3 w-3" />
          {t("badge")}
        </span>
      </div>

      {/* KPI cards (always visible) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <k.icon className={`h-4 w-4 ${k.tone}`} />
            </div>
            <p className={`mt-1.5 text-2xl font-bold tracking-tight ${k.tone}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === key ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <OverviewTab t={t} companies={companies} projectTasks={projectTasks} />
      )}

      {tab === "companies" && (
        <CompaniesTab t={t} companies={companies} />
      )}

      {tab === "usersProjects" && (
        <div className="space-y-3">
          <Filters
            t={t} query={query} setQuery={setQuery}
            companyFilter={companyFilter} setCompanyFilter={setCompanyFilter}
            companyOptions={companyOptions}
            userFilter={userFilter} setUserFilter={setUserFilter} userOptions={userOptions}
            projectFilter={projectFilter} setProjectFilter={setProjectFilter} projectOptions={projectOptions}
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            statusOptions={projectStatusOptions(t)}
            showUser showProject showStatus
          />
          <UsersProjectsTable t={t} rows={filteredProjectsByUser} />
        </div>
      )}

      {tab === "projectTasks" && (
        <div className="space-y-3">
          <Filters
            t={t} query={query} setQuery={setQuery}
            companyFilter={companyFilter} setCompanyFilter={setCompanyFilter}
            companyOptions={companyOptions}
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            statusOptions={[
              { value: "open", label: t("statusOpen") },
              { value: "blocked", label: t("statusBlocked") },
              { value: "done", label: t("statusDone") },
            ]}
          />
          <ProjectTasksTab t={t} locale={locale} rows={filteredProjectTasks} />
        </div>
      )}

      {tab === "plans" && (
        <PlansTab t={t} locale={locale} plans={planCatalog} />
      )}

      {tab === "adminAccess" && (
        <AdminAccessTab t={t} admins={admins} fallbackEmail={fallbackEmail} />
      )}
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────
function OverviewTab({
  t, companies, projectTasks,
}: {
  t: (k: string, vars?: Record<string, string | number>) => string;
  companies: CompanyRow[];
  projectTasks: ProjectTaskAggregate[];
}) {
  const topCompanies = [...companies].sort((a, b) => b.userCount - a.userCount).slice(0, 6);
  const topProjects = [...projectTasks].sort((a, b) => b.totalTasks - a.totalTasks).slice(0, 6);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Building2 className="h-4 w-4 text-brand-600 dark:text-brand-400" />
          {t("overviewCompanies")}
        </h2>
        {topCompanies.length === 0 ? <Empty t={t} text={t("noCompanies")} /> : (
          <ul className="space-y-2">
            {topCompanies.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                <span className="min-w-0 truncate font-medium text-foreground">{c.name || c.slug}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{c.userCount} {t("kpiUsers").toLowerCase()} · {c.projectCount} {t("kpiProjects").toLowerCase()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <ListTodo className="h-4 w-4 text-brand-600 dark:text-brand-400" />
          {t("overviewProjects")}
        </h2>
        {topProjects.length === 0 ? <Empty t={t} text={t("noProjects")} /> : (
          <ul className="space-y-2">
            {topProjects.map((p) => (
              <li key={p.projectId} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                <span className="min-w-0 truncate font-medium text-foreground">{p.projectTitle}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{p.totalTasks} {t("kpiTasks").toLowerCase()} · {p.openTasks} {t("colOpen").toLowerCase()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── Companies (expandable to users; renameable by platform admins) ──────────
function CompaniesTab({ t, companies }: { t: (k: string) => string; companies: CompanyRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [users, setUsers] = useState<CompanyUserRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  // Optimistic display names after a successful rename (server revalidates too).
  const [renamed, setRenamed] = useState<Map<string, string>>(new Map());

  function toggle(orgId: string) {
    if (expanded === orgId) { setExpanded(null); return; }
    setExpanded(orgId);
    setUsers([]);
    setErr(null);
    start(async () => {
      const res = await getOrgUsersAction(orgId);
      if (!res.ok) { setErr(t("denied")); return; }
      setUsers(res.users);
    });
  }

  if (companies.length === 0) return <Empty t={t} text={t("noCompanies")} />;

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">{t("colCompany")}</th>
            <th className="px-3 py-2 text-left">{t("colOrgId")}</th>
            <th className="px-3 py-2 text-left">{t("colPlan")}</th>
            <th className="px-3 py-2 text-right">{t("colUsers")}</th>
            <th className="px-3 py-2 text-right">{t("colProjects")}</th>
            <th className="px-3 py-2 text-right">{t("colTasks")}</th>
            <th className="px-3 py-2 text-left">{t("colCreated")}</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <CompanyRowItem
              key={c.id}
              c={c}
              displayName={renamed.get(c.id) ?? c.name}
              t={t}
              expanded={expanded === c.id}
              pending={pending}
              onToggle={() => toggle(c.id)}
              onRenamed={(name) => setRenamed((m) => new Map(m).set(c.id, name))}
              users={expanded === c.id ? users : []}
              err={expanded === c.id ? err : null}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompanyRowItem({
  c, displayName, t, expanded, pending, onToggle, onRenamed, users, err,
}: {
  c: CompanyRow;
  displayName: string;
  t: (k: string) => string;
  expanded: boolean;
  pending: boolean;
  onToggle: () => void;
  onRenamed: (name: string) => void;
  users: CompanyUserRow[];
  err: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [renameErr, setRenameErr] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  function startEdit() {
    setDraft(displayName || c.slug);
    setRenameErr(null);
    setEditing(true);
  }

  function save() {
    startSave(async () => {
      const res = await renameOrgAdminAction(c.id, draft);
      if (!res.ok) {
        setRenameErr(
          res.reason === "invalid_name" ? t("renameErrorInvalid")
            : res.reason === "not_authorized" ? t("denied")
              : t("renameErrorGeneric"),
        );
        return;
      }
      onRenamed(res.name);
      setEditing(false);
    });
  }

  return (
    <>
      <tr className="border-t border-border/50">
        <td className="px-3 py-2 font-medium text-foreground">
          {editing ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                minLength={2}
                maxLength={120}
                disabled={saving}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
                className="w-44 rounded-lg border border-border bg-background px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
              />
              <button onClick={save} disabled={saving} className="rounded-lg bg-brand-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : t("renameSave")}
              </button>
              <button onClick={() => setEditing(false)} disabled={saving} className="rounded-lg border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted">
                {t("renameCancel")}
              </button>
              {renameErr && <span className="w-full text-[11px] text-red-600 dark:text-red-400">{renameErr}</span>}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              {displayName || c.slug}
              <button
                onClick={startEdit}
                title={t("rename")}
                aria-label={t("rename")}
                className="rounded p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </span>
          )}
        </td>
        <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{c.id}</td>
        <td className="px-3 py-2 text-muted-foreground">
          {c.planName ? (
            <span className="inline-flex items-center gap-1">
              {c.planName}
              {c.subscriptionStatus && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{c.subscriptionStatus}</span>
              )}
            </span>
          ) : "—"}
        </td>
        <td className="px-3 py-2 text-right text-muted-foreground">{c.userCount}</td>
        <td className="px-3 py-2 text-right text-muted-foreground">{c.projectCount}</td>
        <td className="px-3 py-2 text-right text-muted-foreground">{c.taskCount}</td>
        <td className="px-3 py-2 text-muted-foreground">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}</td>
        <td className="px-3 py-2 text-right">
          <button onClick={onToggle} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-muted dark:text-brand-400">
            {pending && expanded ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {t("viewUsers")}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/20">
          <td colSpan={8} className="px-3 py-2">
            {err ? (
              <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">{err}</p>
            ) : users.length === 0 ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}{pending ? t("loadingUsers") : t("noUsers")}</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 text-left">{t("colName")}</th>
                      <th className="px-2 py-1.5 text-left">{t("colEmail")}</th>
                      <th className="px-2 py-1.5 text-left">{t("colRole")}</th>
                      <th className="px-2 py-1.5 text-left">{t("colOrgRole")}</th>
                      <th className="px-2 py-1.5 text-left">{t("colMemberStatus")}</th>
                      <th className="px-2 py-1.5 text-right">{t("colUserProjects")}</th>
                      <th className="px-2 py-1.5 text-right">{t("colAssignedTasks")}</th>
                      <th className="px-2 py-1.5 text-left">{t("colCreated")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.userId} className="border-t border-border/50">
                        <td className="px-2 py-1.5 font-medium text-foreground">{u.displayName ?? "—"}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{u.email ?? "—"}</td>
                        <td className="px-2 py-1.5">
                          {u.role ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_TONE[u.role] ?? "bg-muted text-muted-foreground"}`}>{u.role}</span> : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">{u.orgRole ?? "—"}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{u.status ?? "—"}</td>
                        <td className="px-2 py-1.5 text-right text-muted-foreground">{u.projectCount}</td>
                        <td className="px-2 py-1.5 text-right text-muted-foreground">{u.assignedTaskCount}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Users & Projects ─────────────────────────────────────────────────────────
function UsersProjectsTable({ t, rows }: { t: (k: string) => string; rows: UserProjectRow[] }) {
  if (rows.length === 0) return <Empty t={t} text={t("noResults")} />;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">{t("colUser")}</th>
            <th className="px-3 py-2 text-left">{t("colEmail")}</th>
            <th className="px-3 py-2 text-left">{t("colCompany")}</th>
            <th className="px-3 py-2 text-left">{t("colProject")}</th>
            <th className="px-3 py-2 text-left">{t("colStatus")}</th>
            <th className="px-3 py-2 text-right">{t("colTotalTasks")}</th>
            <th className="px-3 py-2 text-right">{t("colOpen")}</th>
            <th className="px-3 py-2 text-right">{t("colCompleted")}</th>
            <th className="px-3 py-2 text-right">{t("colBlocked")}</th>
            <th className="px-3 py-2 text-left">{t("colUpdated")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.projectId} className="border-t border-border/50">
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <UserCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium text-foreground">{p.ownerName ?? t("noOwner")}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{p.ownerEmail ?? "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">{p.organizationName}</td>
              <td className="px-3 py-2 font-medium text-foreground">{p.projectTitle}</td>
              <td className="px-3 py-2">
                {p.projectStatus ? <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{p.projectStatus}</span> : "—"}
              </td>
              <td className="px-3 py-2 text-right text-muted-foreground">{p.totalTasks}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{p.openTasks}</td>
              <td className="px-3 py-2 text-right text-green-600 dark:text-green-400">{p.completedTasks}</td>
              <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">{p.blockedTasks}</td>
              <td className="px-3 py-2 text-muted-foreground">{p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Project Tasks (per-project drill-down) ───────────────────────────────────
function ProjectTasksTab({
  t, locale, rows,
}: {
  t: (k: string, vars?: Record<string, string | number>) => string;
  locale: Locale;
  rows: ProjectTaskAggregate[];
}) {
  const [openProject, setOpenProject] = useState<string | null>(null);
  if (rows.length === 0) return <Empty t={t} text={t("noResults")} />;
  void locale;
  return (
    <div className="space-y-2">
      {rows.map((p) => (
        <ProjectTaskItem key={p.projectId} t={t} p={p} open={openProject === p.projectId} onToggle={() => setOpenProject((cur) => (cur === p.projectId ? null : p.projectId))} />
      ))}
    </div>
  );
}

function ProjectTaskItem({
  t, p, open, onToggle,
}: {
  t: (k: string, vars?: Record<string, string | number>) => string;
  p: ProjectTaskAggregate;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <button onClick={onToggle} className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-muted/30">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{p.projectTitle}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{p.organizationName} · {p.ownerName ?? t("noOwner")}</span>
        </span>
        <span className="hidden gap-2 text-[11px] text-muted-foreground sm:flex">
          <span>{t("colTotalTasks")}: <b className="text-foreground">{p.totalTasks}</b></span>
          <span>{t("colOpen")}: <b className="text-foreground">{p.openTasks}</b></span>
          <span className="text-green-600 dark:text-green-400">{t("colCompleted")}: <b>{p.completedTasks}</b></span>
          <span className="text-red-600 dark:text-red-400">{t("colBlocked")}: <b>{p.blockedTasks}</b></span>
        </span>
      </button>
      {open && <ProjectTaskDrilldown t={t} projectId={p.projectId} />}
    </div>
  );
}

function ProjectTaskDrilldown({ t, projectId }: { t: (k: string, vars?: Record<string, string | number>) => string; projectId: string }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | TaskStatus>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminTaskPage | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function load(p: number, s: string, st: "all" | TaskStatus) {
    start(async () => {
      const res = await getProjectTasksAction(projectId, { search: s, status: st, page: p });
      if (!res.ok) { setErr(t("denied")); setData(null); return; }
      setErr(null);
      setData(res.page);
    });
  }

  // Initial load + reload on filter/page changes (debounced for search).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(page, search, status), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, page, search, status]);

  return (
    <div className="space-y-2 border-t border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t("search")}
            className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value as "all" | TaskStatus); setPage(1); }} className={inp}>
          <option value="all">{t("allStatuses")}</option>
          {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {err && <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">{err}</p>}

      {pending && !data ? (
        <p className="flex items-center gap-1.5 py-4 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("loadingTasks")}</p>
      ) : data && data.rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-left">{t("taskTitle")}</th>
                <th className="px-2 py-1.5 text-left">{t("taskStatus")}</th>
                <th className="px-2 py-1.5 text-left">{t("taskAssignee")}</th>
                <th className="px-2 py-1.5 text-left">{t("taskMilestone")}</th>
                <th className="px-2 py-1.5 text-left">{t("taskPriority")}</th>
                <th className="px-2 py-1.5 text-left">{t("taskDue")}</th>
                <th className="px-2 py-1.5 text-left">{t("taskUpdated")}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-t border-border/50">
                  <td className="px-2 py-1.5 font-medium text-foreground">{r.title}</td>
                  <td className="px-2 py-1.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[r.status] ?? "bg-muted text-muted-foreground"}`}>{r.status}</span></td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.assigneeName ?? "—"}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.milestoneTitle ?? "—"}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.priority ?? "—"}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.endDate ? new Date(r.endDate).toLocaleDateString() : "—"}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty t={t} text={t("noTasks")} />
      )}

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("pageInfo", { page: data.page, total: Math.max(1, Math.ceil(data.total / data.pageSize)) })}</span>
          <div className="flex gap-1">
            <button disabled={data.page <= 1 || pending} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-border px-2 py-1 hover:bg-muted disabled:opacity-40">{t("prev")}</button>
            <button disabled={data.page * data.pageSize >= data.total || pending} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-border px-2 py-1 hover:bg-muted disabled:opacity-40">{t("next")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Admin Access (grant / revoke system admins) ──────────────────────────────
function AdminAccessTab({
  t, admins, fallbackEmail,
}: {
  t: (k: string, vars?: Record<string, string | number>) => string;
  admins: AuthorizedAdminRow[];
  fallbackEmail: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [rowPending, setRowPending] = useState<string | null>(null);

  function grant(target: string) {
    setFormErr(null);
    setRowPending(target);
    start(async () => {
      const res = await grantSystemAdminAction(target);
      setRowPending(null);
      if (!res.ok) {
        setFormErr(res.reason === "invalid_email" ? t("grantErrorEmail") : res.reason === "not_authorized" ? t("denied") : t("grantErrorGeneric"));
        return;
      }
      setEmail("");
      router.refresh();
    });
  }

  function revoke(target: string) {
    setFormErr(null);
    setRowPending(target);
    start(async () => {
      const res = await revokeSystemAdminAction(target);
      setRowPending(null);
      if (!res.ok) { setFormErr(t("grantErrorGeneric")); return; }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-500/30 bg-brand-500/[0.04] p-4 text-sm text-foreground">
        <p className="font-semibold">{t("adminAccessTitle")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("fallbackNote", { email: fallbackEmail })}</p>
      </div>

      {/* Grant form */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">{t("grantTitle")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("grantHint")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("grantPlaceholder")}
            disabled={pending}
            onKeyDown={(e) => { if (e.key === "Enter" && email.trim()) grant(email); }}
            className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
          />
          <button
            onClick={() => grant(email)}
            disabled={pending || !email.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending && rowPending === email && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("grantSubmit")}
          </button>
        </div>
        {formErr && (
          <p className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">{formErr}</p>
        )}
      </div>

      {admins.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <Inbox className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">{t("noAdmins")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">{t("colAdminEmail")}</th>
                <th className="px-3 py-2 text-left">{t("colAdminRole")}</th>
                <th className="px-3 py-2 text-left">{t("colAdminStatus")}</th>
                <th className="px-3 py-2 text-left">{t("colAdminGranted")}</th>
                <th className="px-3 py-2 text-right">{t("colAdminActions")}</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.email} className="border-t border-border/50">
                  <td className="px-3 py-2 font-medium text-foreground">{a.email}</td>
                  <td className="px-3 py-2 text-muted-foreground">{a.role ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${a.isActive ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
                      {a.isActive ? t("active") : t("inactive")}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{a.grantedAt ? new Date(a.grantedAt).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {a.isActive ? (
                      <button
                        onClick={() => revoke(a.email)}
                        disabled={pending}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
                      >
                        {pending && rowPending === a.email && <Loader2 className="h-3 w-3 animate-spin" />}
                        {t("revoke")}
                      </button>
                    ) : (
                      <button
                        onClick={() => grant(a.email)}
                        disabled={pending}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        {pending && rowPending === a.email && <Loader2 className="h-3 w-3 animate-spin" />}
                        {t("reactivate")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Billing & Plans (GLOBAL catalog, read-only view) ─────────────────────────
function PlansTab({
  t, locale, plans,
}: {
  t: (k: string) => string;
  locale: Locale;
  plans: PlanCatalogRow[];
}) {
  const fmtPrice = (value: number | null, currency: string | null) => {
    if (value === null || value === undefined) return "—";
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(value);
    } catch {
      return `${value} ${currency ?? ""}`.trim();
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-500/30 bg-brand-500/[0.04] p-4 text-sm text-foreground">
        <p className="font-semibold">{t("plansGlobalTitle")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("plansGlobalNote")}</p>
        <Link
          href="/organization/plans"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          <CreditCard className="h-3.5 w-3.5" />
          {t("plansEdit")}
        </Link>
      </div>

      {plans.length === 0 ? (
        <Empty t={t} text={t("noPlans")} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">{t("colPlan")}</th>
                <th className="px-3 py-2 text-left">{t("colPlanCode")}</th>
                <th className="px-3 py-2 text-right">{t("colPriceMonthly")}</th>
                <th className="px-3 py-2 text-right">{t("colPriceYearly")}</th>
                <th className="px-3 py-2 text-right">{t("colSubscribers")}</th>
                <th className="px-3 py-2 text-left">{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className="border-t border-border/50">
                  <td className="px-3 py-2 font-medium text-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {p.name}
                      {p.isEnterprise && (
                        <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                          {t("enterprise")}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{p.planCode}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{fmtPrice(p.priceMonthly, p.currency)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{fmtPrice(p.priceYearly, p.currency)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{p.subscriberCount}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${p.isActive ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
                      {p.isActive ? t("active") : t("inactive")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Shared: filters + empty state ─────────────────────────────────────────────
function Filters({
  t, query, setQuery, companyFilter, setCompanyFilter, companyOptions,
  userFilter, setUserFilter, userOptions, projectFilter, setProjectFilter, projectOptions,
  statusFilter, setStatusFilter, statusOptions, showUser, showProject, showStatus,
}: {
  t: (k: string) => string;
  query: string; setQuery: (v: string) => void;
  companyFilter: string; setCompanyFilter: (v: string) => void; companyOptions: string[];
  userFilter?: string; setUserFilter?: (v: string) => void; userOptions?: string[];
  projectFilter?: string; setProjectFilter?: (v: string) => void; projectOptions?: string[];
  statusFilter: string; setStatusFilter: (v: string) => void; statusOptions: { value: string; label: string }[];
  showUser?: boolean; showProject?: boolean; showStatus?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          className="w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>
      <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className={inp}>
        <option value="all">{t("allCompanies")}</option>
        {companyOptions.map((o) => {
          const [id, name] = o.split("::");
          return <option key={id} value={id}>{name}</option>;
        })}
      </select>
      {showUser && userFilter !== undefined && setUserFilter && userOptions && (
        <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className={inp}>
          <option value="all">{t("allUsers")}</option>
          {userOptions.map((o) => {
            const [id, label] = o.split("::");
            return <option key={id} value={id}>{label}</option>;
          })}
        </select>
      )}
      {showProject && projectFilter !== undefined && setProjectFilter && projectOptions && (
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className={inp}>
          <option value="all">{t("allProjects")}</option>
          {projectOptions.map((o) => {
            const [id, label] = o.split("::");
            return <option key={id} value={id}>{label}</option>;
          })}
        </select>
      )}
      {showStatus && (
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inp}>
          {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      )}
    </div>
  );
}

function Empty({ t, text }: { t: (k: string) => string; text: string }) {
  void t;
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center">
      <Inbox className="mx-auto h-6 w-6 text-muted-foreground" />
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
function projectStatusOptions(t: (k: string) => string): { value: string; label: string }[] {
  const statuses = ["planning", "active", "on_hold", "completed", "cancelled"];
  const labels: Record<string, string> = {
    planning: t("projectPlanning"),
    active: t("projectActive"),
    on_hold: t("projectOnHold"),
    completed: t("projectCompleted"),
    cancelled: t("projectCancelled"),
  };
  return [{ value: "all", label: t("allStatuses") }, ...statuses.map((s) => ({ value: s, label: labels[s] }))];
}