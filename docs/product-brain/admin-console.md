# Admin Console — Platform Administration Surface

**Status:** Internal, server-gated. Deployed to production (PR #158; allowlist fix #159/#160;
admin platform foundation — company users RPC fix, renames, system-admin management,
global plan catalog — in the 20260841/20260842 iteration). **Route:** `/<locale>/admin`
(inside the authenticated `(app)` group), e.g. `/admin` (EN) or `/es/admin` (ES).

## Purpose

A platform-wide, cross-tenant administration surface giving visibility over **companies,
users, projects and tasks** across every organization — not just the caller's own org, plus
a small, explicit set of platform-admin writes.

**Reads:** everything (cross-tenant aggregates and drill-downs).
**Writes (exhaustive list):** rename any company (`admin_rename_organization` RPC),
grant/revoke system-admin access (`admin_authorized_users`), and edit the GLOBAL plan
catalog (via `/organization/plans`, same gate). Nothing else — no project/task/user
mutation exists on this surface. Every write is persisted to `audit_logs`
(`organization_renamed`, `admin_granted`, `admin_revoked`).

## Who can access it (today)

Access is a **strict server-side** check, evaluated in `src/lib/admin-console/access.server.ts`
(`isPlatformAdmin`). Authorization order:

1. **Table allowlist** — an active (`is_active = true`) row for the normalized email in
   `admin_authorized_users` (source of truth; managed from the Admin Access tab).
2. **Hardcoded platform owners** — `ADMIN_CONSOLE_ALLOWED_EMAILS`
   (`efrain.pradas@gmail.com` + `pmo@xxx-demo.io`), self-contained on purpose (no env-var,
   no migration dependency) so the owners can never be locked out (PR #160).
3. Otherwise → **denied** (the route returns **404** and loads **no data**).

Email comparison is **case-insensitive and trimmed** (reuses `normalizeEmail` from
`src/lib/product-brain/access.ts`). `PMO@XXX-DEMO.IO` and `  pmo@xxx-demo.io  ` are
equivalent to `pmo@xxx-demo.io`.

The 404 (via `notFound()`) is deliberate and consistent with the rest of the admin pages
(`/admin/backfill`, `/product-intelligence`): it does not reveal the route exists and
guarantees no admin query runs. The spec's "403 or equivalent" is satisfied by this
equivalent — a hard denial with no data.

**Authorized today:** `efrain.pradas@gmail.com` and `pmo@xxx-demo.io` (hardcoded owners),
plus any active row in `admin_authorized_users` (granted from the Admin Access tab). No
role (owner/admin/member/viewer) grants access by itself. Org `owner`/`admin` roles are
org-scoped, not platform-scoped, and do **not** open this console.

## How the route is protected

Three layers, in load-bearing order — **no admin query runs before the gate**:

1. **Edge middleware** (`src/middleware.ts`): locale routing + Supabase session refresh +
   blanket auth guard. Unauthenticated users never reach `(app)` routes.
2. **`(app)` layout** (`src/app/[locale]/(app)/layout.tsx`): resolves `getOrgContext()`
   (redirects to login if unauthenticated) and computes `canViewAdminConsole =
   await isPlatformAdmin(org.email)`, threaded to the Sidebar.
3. **The page itself** (`src/app/[locale]/(app)/admin/page.tsx`):
   - `getOrgContext()` → if null, `notFound()`.
   - `requirePlatformAdmin(ctx.email, "/admin")` → if false, log `admin_access_denied`
     and `notFound()`. **Only after this passes** are the admin queries executed.

**Server actions** (`src/app/[locale]/(app)/admin/actions.ts`) re-validate the gate on
every call (`getOrgContext` → `requirePlatformAdmin`). A client cannot bypass the page
gate by calling an action directly — denied actions return
`{ ok: false, reason: "not_authorized" }` and run **no** business query. They never throw
`notFound()` (that is reserved for render).

**Sidebar link visibility** is UX-only: `src/config/navigation.ts` adds the `adminConsole`
item to `internalNav` with `gate: "adminConsole"`; `Sidebar` filters by the server-computed
`canViewAdminConsole` flag. The flag (and the allowlist) never reach the client bundle.
Hiding the link is not the protection — the route and actions are.

## Data sources (real table/column names)

All queries use the **service role** (`createAdminClient()`, server-only, RLS-bypassing) in
`src/lib/admin-console/queries.ts`, because aggregates span every tenant. RLS would
otherwise scope reads to the caller's org. Soft-deleted rows (`deleted_at IS NULL`) are
excluded.

| Metric / view | Source | How computed |
|---|---|---|
| Total companies | `organizations` | `count` where `deleted_at IS NULL` |
| Total users | `profiles` | `count` (1:1 extension of `auth.users`) |
| Total projects | `projects` | `count` where `deleted_at IS NULL` |
| Total tasks | `roadmap_tasks` | `count` where `deleted_at IS NULL` |
| Admin users | `admin_authorized_users` | `count` where `is_active = true` (excludes fallback) |
| Users per company | RPC `admin_list_company_users` | `organization_members` LEFT JOIN `profiles` + `auth.users` inside the DB (see "Admin RPCs" below) |
| Owner emails | RPC `admin_get_user_emails` | batch lookup against `auth.users` inside the DB |
| Company plan | `subscriptions` + `plans` | informational per-company subscription (name + status) |
| Global plan catalog | `plans` + `subscriptions` | catalog rows + subscriber counts (Billing & Plans tab) |
| Projects per user | `projects.created_by` | grouped by owner (`created_by` = `auth.users.id`) |
| Tasks per project | `roadmap_tasks` | grouped by `(project_id, status)`: total / open (≠done/deferred) / completed (done) / blocked (blocked) |
| Tasks assigned per user | `roadmap_tasks.assigned_to` | grouped by assignee |
| Task drill-down | `roadmap_tasks` | paginated (25/page), server-filtered by status + title `ilike`; joined to `milestones` (title) and `profiles` (assignee name) |

Column-name gotchas respected: org/project names are `name_i18n`/`title_i18n` (jsonb,
localized via `getI18nValue`); task assignee is `assigned_to`; task due date is `end_date`;
task status is the 9-value enum (`not_started … done/blocked/deferred`) — there is no
`open`/`assignee`/`due_date` column.

Aggregation is server-side (counts and group-bys); we never fetch all rows to count them.
The task drill-down is paginated (`limit/offset` via `.range()`) to bound volume.

## Admin RPCs (migrations 20260841 + 20260842)

Two production bugs shared one root cause: `organization_members.user_id` references
**`auth.users`**, not `profiles`, so the PostgREST embed
`profiles!organization_members_user_id_fkey` always errored ("No users in this company"),
and `auth.users` is not reachable via `.from()` even with the service role (EMAIL column
always "—"). The fix moves those reads **inside the database** as `SECURITY DEFINER`
functions, all gated the same way (`service_role` OR `public.is_platform_admin()` — an
active row in `admin_authorized_users` matching the caller's email):

- `is_platform_admin()` — DB-level gate over `admin_authorized_users`.
- `admin_list_company_users(p_org_id)` — members + display name + email + role/org_role/status.
- `admin_get_user_emails(p_user_ids)` — batch email lookup for owner columns.
- `admin_rename_organization(p_org_id, p_name)` — validated rename (2–120 chars), writes
  `name_i18n` for BOTH locales (proper noun — never auto-translated).

**Security stance (deliberate):** business-table RLS is **NOT** widened for admins.
Platform admins read cross-org data only through these gated RPCs or the service role on
the server, always AFTER `requirePlatformAdmin`. The two hardcoded platform owners pass
the app-level gate even with an empty table; DB-level RPC access for anyone else requires
an active `admin_authorized_users` row.

The same migration set also:
- makes `handle_new_user()` / `ensure_user_org()` honor the optional signup metadata
  `company_name` (fixes "every org is called My Organization"); the signup form
  (`signup-form.tsx` → `signupAction`) captures it.
- adds the `on_auth_user_deleted` trigger that deletes a deleted user's personal org
  (`org_<user_id>`) when it has no other members and no projects — the source of the 25
  orphaned orgs found in prod. `scripts/cleanup-orphan-orgs.sql` is the reviewable,
  two-step (report → delete) cleanup for the pre-existing orphans; it is NOT run
  automatically.
- widens the `audit_logs.action` CHECK with `admin_granted` / `admin_revoked` /
  `organization_renamed` so platform-admin writes are persisted (org-scoped: renames on
  the renamed org; grants/revokes on the actor's org with `targetEmail` in metadata).

Regular owners/admins rename their OWN org in **Settings → Organization**
(`/settings`, `renameOrganizationAction`) through their RLS session — the existing
policy "PMO can update own organizations" (`is_pmo_level`) authorizes it; no new grant.

## Billing & Plans tab (GLOBAL catalog)

The **Billing & Plans** tab shows the **global plan catalog** (`plans` +
`plan_entitlements`): the plans and prices rendered on the public landing-page pricing.
It is NOT any company's individual billing — each company's subscription appears as an
informational column in the Companies tab. Editing goes through `/organization/plans`,
which (as of this iteration) is gated by the **same** platform-admin check as the Admin
Console (`isPlatformAdmin(email)` from `access.server.ts`). The old
`lib/billing/service.isPlatformAdmin(org)` is deprecated: its `role === "owner"` fallback
was a false positive (every personal org makes its user an owner).

## System-admin management (Admin Access tab)

The **Admin Access** tab manages `admin_authorized_users` (table applied to production;
migration `20260840000000_admin_authorized_users.sql`):

- **Grant** ("Make system admin"): enter an email → inserts (or re-activates) a row with
  `role='system_admin'`, `is_active=true`, `granted_by=<actor>`. Server action
  `grantSystemAdminAction`, gated by `requirePlatformAdmin`, writes via service role.
- **Revoke**: soft-revoke (`is_active=false`, `revoked_at=now()`); access disappears
  immediately (the gate reads active rows only). **Reactivate** flips it back.
- Only an already-authorized platform admin can grant/revoke. The two hardcoded platform
  owners (`ADMIN_CONSOLE_ALLOWED_EMAILS`) keep app-level access regardless of table state
  — by design, anti-lockout.
- Every change is persisted to `audit_logs` (`admin_granted` / `admin_revoked`) plus a
  structured server log.

The access helper (`access.server.ts`) still tolerates the table being absent (falls
through to the hardcoded owners), so the console can never lock out the owners.

## Observability

`src/lib/admin-console/audit.ts` (`logAdminEvent`) emits structured server logs for
`admin_page_viewed`, `admin_access_denied`, `admin_metrics_loaded`, `admin_tasks_loaded`
with `email`, `userId`, `route`, `result`, and non-sensitive `extra` (counts, page
numbers). Non-throwing; never logs payload bodies.

Platform-admin **writes** (rename / grant / revoke) ARE persisted to `audit_logs` via
`recordAdminAudit` (the CHECK was widened by migration 20260841; rows are org-scoped —
renames attach to the renamed org, grants/revokes to the actor's org). Read/access events
(`admin_page_viewed`, …) stay as structured logs only; a dedicated `platform_audit_logs`
table remains the documented TODO for those.

## i18n

UI strings live in the `adminConsole` namespace of `messages/{en,es}.json` (key-parity
enforced by UX-012; the `src/i18n/__tests__/message-parity.test.ts` test passes) and the
`nav.adminConsole` key for the sidebar link. The client component uses `useTranslations`
(no Spanglish). Branding matches the existing Ascendia-Green / hand-rolled Tailwind
conventions (no new UI library).

## How to test locally

1. `npm run dev`.
2. Sign in as `pmo@xxx-demo.io` **or** `efrain.pradas@gmail.com` (hardcoded platform
   owners). The sidebar shows **Admin Console**. Open `/admin`: KPI cards, the six tabs
   (Overview, Companies, Users & Projects, Project Tasks, Billing & Plans, Admin Access),
   filters, company rename, the company/task drill-downs and system-admin grant/revoke
   work against real data.
3. Sign in as any other user (including an org `owner`/`admin`). The sidebar does **not**
   show Admin Console. Hitting `/admin` (or `/es/admin`) directly returns a **404** and
   loads no admin data.
4. `npm run typecheck && npm run test:run && npm run build` — all green.

Automated tests:
- `src/lib/admin-console/__tests__/access.test.ts` — RBAC: fallback authorized,
  case-insensitive, shared Product Brain allowlist (defaults + env override) authorized,
  other users denied, empty/null denied, table-first, fallback on absent table / missing
  service role, denial logging.
- `src/lib/admin-console/__tests__/queries.test.ts` — aggregation math (KPIs, users per
  company, projects per user, task-status rollups, paginated drill-down, filter recording,
  honest degradation on error).
- `src/components/admin-console/__tests__/admin-console.test.tsx` — render (EN/ES, tabs,
  KPIs, empty states, no-crash with filters).

## What is intentionally left for a next iteration

- A dedicated `platform_audit_logs` table for read/access events (writes are already
  persisted to `audit_logs`).
- Running `scripts/cleanup-orphan-orgs.sql` against prod (manual, reviewable, two-step).
- In-app cross-org navigation for system admins (today: all cross-org visibility lives in
  this console; the normal app remains strictly org-scoped by RLS — deliberate).

## Out of scope / not touched

No changes to projects, tasks, milestones, Isabella, Living Graph, Dashboard, Execution
Map, Closeout, GitHub Intelligence, or business-table RLS policies (deliberately NOT
widened for admins). No global visual changes.