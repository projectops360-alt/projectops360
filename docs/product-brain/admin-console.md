# Admin Console — Platform Administration Surface

**Status:** Internal, read-only, server-gated. **No production deploy performed** for this
feature. **Route:** `/<locale>/admin` (inside the authenticated `(app)` group), e.g.
`/admin` (EN) or `/es/admin` (ES).

## Purpose

A platform-wide, cross-tenant administration surface giving visibility over **companies,
users, projects and tasks** across every organization — not just the caller's own org. It
is the foundation for future platform administration (configuring who may access this
console, then other platform operations).

This page is **read-only**. It does not create, edit, or delete any company, user, project,
task, milestone, or any other entity. It performs no destructive action.

## Who can access it (today)

Access is a **strict server-side** check, evaluated in `src/lib/admin-console/access.server.ts`
(`isPlatformAdmin`). Authorization order:

1. **Table allowlist** — an active (`is_active = true`) row for the normalized email in
   `admin_authorized_users`. (Future source of truth; empty/absent table falls through.)
2. **Temporary fallback** — the normalized email equals `pmo@xxx-demo.io`
   (`FALLBACK_ADMIN_EMAIL`).
3. Otherwise → **denied** (the route returns **404** and loads **no data**).

Email comparison is **case-insensitive and trimmed** (reuses `normalizeEmail` from
`src/lib/product-brain/access.ts`). `PMO@XXX-DEMO.IO` and `  pmo@xxx-demo.io  ` are
equivalent to `pmo@xxx-demo.io`.

The 404 (via `notFound()`) is deliberate and consistent with the rest of the admin pages
(`/admin/backfill`, `/product-intelligence`): it does not reveal the route exists and
guarantees no admin query runs. The spec's "403 or equivalent" is satisfied by this
equivalent — a hard denial with no data.

**Only `pmo@xxx-demo.io` is authorized today.** No role (owner/admin/member/viewer) grants
access by itself. Org `owner`/`admin` roles are org-scoped, not platform-scoped, and do
**not** open this console.

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
| Users per company | `organization_members` + `profiles` | grouped by `organization_id`; email via `auth.users` (service role) |
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

## Future authorized-users configuration (prepared, not built)

A new migration is included — **NOT applied to production** (review & apply manually):

- `supabase/migrations/20260840000000_admin_authorized_users.sql` — table
  `admin_authorized_users(id, email, role, is_active, granted_by → profiles, created_at,
  updated_at, revoked_at)`, a UNIQUE index on `lower(trim(email))`, an active-allowlist
  index, an `updated_at` trigger, and RLS that denies all anon/authenticated access
  (service role only).

The access helper (`access.server.ts`) tolerates the table being **absent** (query error or
client throw → falls back to `pmo@xxx-demo.io`), so the console keeps working before the
migration is applied. Once applied and seeded, the table becomes the source of truth and
the fallback can be removed.

The console renders an **"Admin Access"** tab (read-only) showing current authorized
admins (email, role, status, authorized-on) and a note that editing/granting will be added
in a later iteration. **No CRUD is implemented yet** — by design (read-only phase).

## Observability

`src/lib/admin-console/audit.ts` (`logAdminEvent`) emits structured server logs for
`admin_page_viewed`, `admin_access_denied`, `admin_metrics_loaded`, `admin_tasks_loaded`
with `email`, `userId`, `route`, `result`, and non-sensitive `extra` (counts, page
numbers). Non-throwing; never logs payload bodies.

The existing `audit_logs` table is **not** reused: it is org-scoped
(`organization_id NOT NULL`) and its `action` column is CHECK-constrained to task/project
lifecycle values — it cannot host platform-wide admin events without polluting an org's
audit trail and widening the CHECK constraint (out of scope). A future
`platform_audit_logs` table is the documented TODO.

## i18n

UI strings live in the `adminConsole` namespace of `messages/{en,es}.json` (key-parity
enforced by UX-012; the `src/i18n/__tests__/message-parity.test.ts` test passes) and the
`nav.adminConsole` key for the sidebar link. The client component uses `useTranslations`
(no Spanglish). Branding matches the existing Ascendia-Green / hand-rolled Tailwind
conventions (no new UI library).

## How to test locally

1. `npm run dev`.
2. Sign in as `pmo@xxx-demo.io`. The sidebar shows **Admin Console**. Open `/admin`:
   KPI cards, the five tabs (Overview, Companies, Users & Projects, Project Tasks, Admin
   Access), filters and the company/task drill-downs work against real data.
3. Sign in as any other user (including an org `owner`/`admin`). The sidebar does **not**
   show Admin Console. Hitting `/admin` (or `/es/admin`) directly returns a **404** and
   loads no admin data.
4. `npm run typecheck && npm run test:run && npm run build` — all green.

Automated tests:
- `src/lib/admin-console/__tests__/access.test.ts` — RBAC: fallback authorized,
  case-insensitive, other users denied, empty/null denied, table-first, fallback on
  absent table / missing service role, denial logging.
- `src/lib/admin-console/__tests__/queries.test.ts` — aggregation math (KPIs, users per
  company, projects per user, task-status rollups, paginated drill-down, filter recording,
  honest degradation on error).
- `src/components/admin-console/__tests__/admin-console.test.tsx` — render (EN/ES, tabs,
  KPIs, empty states, no-crash with filters).

## What is intentionally left for a next iteration

- CRUD for `admin_authorized_users` (grant/revoke/role) from the Admin Access tab.
- A dedicated `platform_audit_logs` table (today: structured server logs only).
- Removing the `pmo@xxx-demo.io` fallback once the table is seeded.
- Applying the migration to production (review required; not done here).

## Out of scope / not touched

No changes to projects, tasks, milestones, Isabella, Living Graph, Dashboard, Execution
Map, Closeout, GitHub Intelligence, RBAC/RLS, or any other module. No global visual
changes. No production deploy.