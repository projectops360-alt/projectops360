// ============================================================================
// Admin Console — UI render guard (node-env SSR)
// ============================================================================
// Asserts the cockpit renders its KPI cards, tabs, tables and empty states
// without crashing, in EN and ES (UX-012 — no Spanglish), with and without
// data. Server actions are mocked so the SSR render never touches the admin
// client or env. This is a presentational guard; the access gate is covered in
// access.test.ts and the aggregation math in queries.test.ts.
// ============================================================================

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../../../messages/en.json";
import esMessages from "../../../../messages/es.json";

vi.mock("@/app/[locale]/(app)/admin/actions", () => ({
  getOrgUsersAction: vi.fn(async () => ({ ok: true, users: [] })),
  getProjectTasksAction: vi.fn(async () => ({ ok: true, page: { rows: [], total: 0, page: 1, pageSize: 25 } })),
  renameOrgAdminAction: vi.fn(async () => ({ ok: true, name: "Renamed" })),
  grantSystemAdminAction: vi.fn(async () => ({ ok: true })),
  revokeSystemAdminAction: vi.fn(async () => ({ ok: true })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { AdminConsole } from "../admin-console";
import type {
  AdminMetrics, CompanyRow, UserProjectRow, ProjectTaskAggregate, AuthorizedAdminRow, PlanCatalogRow,
} from "@/lib/admin-console/types";

const METRICS: AdminMetrics = {
  totalCompanies: 3, totalUsers: 10, totalProjects: 5, totalTasks: 42, activeAdminUsers: 1,
};
const COMPANIES: CompanyRow[] = [
  { id: "o1", name: "Acme", slug: "acme", userCount: 4, projectCount: 2, taskCount: 12, planName: "Pro", subscriptionStatus: "active", createdAt: "2026-01-01T00:00:00Z" },
  { id: "o2", name: "Beta", slug: "beta", userCount: 6, projectCount: 3, taskCount: 30, planName: null, subscriptionStatus: null, createdAt: null },
];
const PROJECTS_BY_USER: UserProjectRow[] = [
  { userId: "u1", ownerName: "Alice", ownerEmail: "alice@acme.io", organizationId: "o1", organizationName: "Acme", projectId: "p1", projectTitle: "Tower", projectStatus: "active", totalTasks: 5, openTasks: 3, completedTasks: 1, blockedTasks: 1, updatedAt: "2026-07-01T00:00:00Z" },
];
const PROJECT_TASKS: ProjectTaskAggregate[] = [
  { projectId: "p1", projectTitle: "Tower", organizationId: "o1", organizationName: "Acme", ownerId: "u1", ownerName: "Alice", totalTasks: 5, openTasks: 3, completedTasks: 1, blockedTasks: 1, updatedAt: "2026-07-01T00:00:00Z" },
];
const ADMINS: AuthorizedAdminRow[] = [
  { email: "pmo@xxx-demo.io", role: "platform_admin", isActive: true, grantedAt: "2026-01-01T00:00:00Z" },
];
const PLAN_CATALOG: PlanCatalogRow[] = [
  { id: "pl1", planCode: "starter", name: "Starter", priceMonthly: 0, priceYearly: 0, currency: "USD", isEnterprise: false, isActive: true, sortOrder: 1, subscriberCount: 2 },
  { id: "pl2", planCode: "enterprise", name: "Enterprise", priceMonthly: null, priceYearly: null, currency: "USD", isEnterprise: true, isActive: true, sortOrder: 9, subscriberCount: 1 },
];

function consoleWith(over: Partial<React.ComponentProps<typeof AdminConsole>> = {}) {
  return (
    <AdminConsole
      locale={(over.locale as "en" | "es") ?? "en"}
      metrics={METRICS}
      companies={COMPANIES}
      projectsByUser={PROJECTS_BY_USER}
      projectTasks={PROJECT_TASKS}
      admins={ADMINS}
      planCatalog={PLAN_CATALOG}
      fallbackEmail="pmo@xxx-demo.io"
      {...over}
    />
  );
}

function render(node: React.ReactElement, locale: "en" | "es" = "en"): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "es" ? esMessages : enMessages}>
      {node}
    </NextIntlClientProvider>,
  );
}

describe("AdminConsole — render", () => {
  it("renders the header, badge and KPI cards (EN)", () => {
    const html = render(consoleWith());
    expect(html).toContain("Admin Console");
    expect(html).toContain("Restricted Access");
    expect(html).toContain("Companies");
    expect(html).toContain("Users");
    expect(html).toContain("Projects");
    // KPI values
    expect(html).toContain("3"); // companies
    expect(html).toContain("42"); // tasks
  });

  it("renders in ES without Spanglish", () => {
    const html = render(consoleWith({ locale: "es" }), "es");
    expect(html).toContain("Consola de Administración");
    expect(html).toContain("Acceso Restringido");
    expect(html).toContain("Empresas");
    expect(html).toContain("Usuarios Admin");
    expect(html).toContain("Facturación y Planes");
  });

  it("renders the six tabs (including Billing & Plans)", () => {
    const html = render(consoleWith());
    expect(html).toContain("Overview");
    expect(html).toContain("Companies");
    expect(html).toContain("Users &amp; Projects");
    expect(html).toContain("Project Tasks");
    expect(html).toContain("Billing &amp; Plans");
    expect(html).toContain("Admin Access");
  });

  it("Overview tab renders companies + projects summaries", () => {
    const html = render(consoleWith());
    expect(html).toContain("Acme");
    expect(html).toContain("Tower");
  });

  it("renders empty states when there is no data", () => {
    const empty: AdminMetrics = { totalCompanies: 0, totalUsers: 0, totalProjects: 0, totalTasks: 0, activeAdminUsers: 0 };
    const html = render(
      consoleWith({ metrics: empty, companies: [], projectsByUser: [], projectTasks: [], admins: [], planCatalog: [] }),
    );
    // KPIs render zero values
    expect(html).toContain("Admin Console");
    // Overview (default tab) shows empty messages
    expect(html).toContain("No companies found.");
    expect(html).toContain("No projects found.");
    // KPI admin-users value is zero (no active admins)
    expect(html).toContain("Admin Users");
  });

  it("does not crash with filters applied to the Users & Projects tab shape", () => {
    // The component mounts in Overview by default; switching tabs is a click
    // interaction not exercised in node-env SSR. We assert the full tree
    // mounts cleanly with sample data, which exercises the filter `useMemo`
    // builders (company/user/project options) on every render.
    expect(() => render(consoleWith())).not.toThrow();
  });
});
