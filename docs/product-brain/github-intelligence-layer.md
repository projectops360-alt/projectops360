# GitHub Intelligence Layer

> Status: **PR-ready (behind a default-OFF feature flag). Not merged. Not deployed.**
> Scope: **software projects only** (`project_type = 'software_development'`).

## 1. Purpose

GitHub Intelligence turns a software project's GitHub activity into **execution
evidence** inside ProjectOps360°. Commits, branches, pull requests, workflow
runs, deployments and releases become a clean, elegant **GitHub Living Graph**
(a Git-style fishbone timeline) plus metric cards, a release-readiness signal and
a deterministic Isabella insight — so a PM, founder or stakeholder can understand
*what changed* without reading raw GitHub activity.

It is an **evidence layer**, not a source of truth. It never mutates canonical
tasks, milestones, risks or decisions.

## 2. Software-project-only rule (hard)

GitHub Intelligence is available **only** when BOTH hold:

1. `GITHUB_INTELLIGENCE_ENABLED = true` (server-side flag), and
2. the project's `project_type = 'software_development'` (canonical owner:
   `src/types/execution.ts`).

If either is false, the module is unavailable: no navigation entry, no settings
entry, no dashboard, no API processing, no Isabella GitHub context. This is
enforced **server-side** by `assertGitHubIntelligenceAvailable()` — never by
hiding UI alone. Direct route/API access from a non-software project returns a
safe "available for software projects only" / 404 response and never leaks
whether repositories exist for another project or org.

## 3. Product behavior & information architecture

- **Navigation**: `Execution` group → **GitHub Intelligence** (beside the
  Execution Map, since it is a software-specific Living Graph extension). Injected
  by the project layout only when flag ON + software.
- **Dashboard**: `/[locale]/projects/[projectId]/github` — cards, GitHub Living
  Graph, activity summary, readiness, Isabella insight, release path.
- **Settings**: `Project Settings → Integrations → GitHub Intelligence`
  (`/projects/[projectId]/settings/integrations/github`) — connect repos, view
  sync status, manual refresh, disconnect, app-config diagnostics.
- **Overview / milestone / task** GitHub summaries are a documented follow-up
  (the read model + `github_project_links` table are ready).

## 4. Setup modes

### Mode A — Platform GitHub App install flow (production path)
When `GITHUB_APP_*` env vars are set, a manager clicks **Connect GitHub** →
`startInstallationAction` creates a one-time `github_connection_states` record and
redirects to `https://github.com/apps/<slug>/installations/new?state=…`. GitHub
redirects back to the install callback, which validates the state, fetches the
installation's repositories server-side (installation token) and maps the chosen
repos to the software project. *(The install-callback route + repo picker are the
remaining production wiring — see §17.)*

### Mode B — In-app manifest setup wizard (dev/self-hosted)
When no GitHub App is configured, `buildGitHubAppManifest()` generates a
minimal **read-only** manifest (permissions + events below). The wizard posts it
to GitHub's registration flow; the manifest callback exchanges the temporary code
for App credentials, which are **envelope-encrypted (AES-256-GCM)** via
`GITHUB_INTELLIGENCE_ENCRYPTION_KEY` before storage in `github_app_configs`.
Secrets are never logged or returned to the browser. *(UI skeleton + server
contracts are in place; full manifest exchange is a documented follow-up.)*

### Dev-safe connect (no GitHub App)
`devConnectSampleRepositoryAction` (flag + software + manager RBAC, only when no
env App is configured) seeds a **synthetic** repository + sample snapshots so the
dashboard is demonstrable locally. Clearly labelled synthetic; never calls GitHub.

## 5. Required environment variables

| Var | Purpose |
|---|---|
| `GITHUB_INTELLIGENCE_ENABLED` | Master flag (default OFF). |
| `GITHUB_APP_ID` / `GITHUB_APP_SLUG` | App identity (Mode A). |
| `GITHUB_APP_PRIVATE_KEY` | PEM (escape newlines as `\n`) — mints installation tokens. |
| `GITHUB_APP_WEBHOOK_SECRET` | Verifies `x-hub-signature-256`. |
| `GITHUB_APP_CLIENT_ID` / `GITHUB_APP_CLIENT_SECRET` | Optional OAuth. |
| `GITHUB_APP_BASE_URL` | Builds manifest/callback/webhook URLs. |
| `GITHUB_INTELLIGENCE_ENCRYPTION_KEY` | Encrypts manifest-created secrets at rest. |

## 6. GitHub permissions & events (READ-ONLY)

Permissions: `contents:read`, `metadata:read`, `pull_requests:read`,
`actions:read`, `deployments:read`, `checks:read`.
Events: `push`, `pull_request`, `pull_request_review`, `workflow_run`,
`deployment`, `release`, `create`, `delete`.

No write scopes are ever requested. The GitHub REST client
(`src/lib/github-intelligence/client.ts`) exposes only `list*`/`get*` methods and
issues only `GET` requests (enforced by `readonly-guardrail.test.ts`).

## 7. Data model (migration `20260840000000_github_intelligence.sql`)

`github_app_configs`, `github_connection_states`, `github_installations`,
`github_repositories`, `github_activity_events`, `github_branch_snapshots`,
`github_pull_request_snapshots`, `github_workflow_run_snapshots`,
`github_release_snapshots`, `github_deployment_snapshots`, `github_project_links`.

All project-scoped tables carry `organization_id` + `project_id`. RLS: org
members read; writes go through the service role (server actions / webhook).
`github_app_configs` and `github_connection_states` hold secrets/nonces and are
**service-role-only** (no client read). GitHub data lives entirely in this
integration layer — never inside canonical task/milestone/risk tables.

## 8. Webhook ingestion

`POST /api/integrations/github/webhook`:
1. If flag OFF → accept-and-ignore (202), never process.
2. Verify `x-hub-signature-256` HMAC (timing-safe). Missing/invalid → 401.
3. Map `repository.id` → connected repository → active **software** project.
   Not connected / non-software / deleted → ignored (audited, no secrets logged).
4. Idempotency via `x-github-delivery` (unique per repo) → duplicates ignored.
5. Normalize into `github_activity_events` + upsert snapshot tables.

Never creates GitHub activity for non-software projects.

## 9. Manual sync

`manualSyncAction` → `syncRepository()` (server-side, service role): mints a
short-lived installation token, pulls branches/PRs/workflow-runs/releases/
deployments via the read-only client, upserts snapshots, records
`last_synced_at` / `last_sync_status`. Scoped by org/project/repository; guarded
(flag + software + manager RBAC); audited; fails gracefully. No background
scheduler in this PR (documented follow-up).

## 10. Fishbone / Git Living Graph

`GitHubLivingGraph.tsx` (custom SVG). Horizontal `main` spine; feature branches
above (ProjectOps green), hotfix (orange) / release (purple) below; commits as
circles; release tags as pills on the spine; merge curves return to the spine.
**Overcrowding guardrails** live in `graph-builder.ts` (tested): max 6 branches
(priority: active hotfix → open-PR → release → recent feature → main), max 7
commit nodes/branch with older commits collapsed into a `+N` marker. Accessible:
`aria-label` + text summary + native `<title>` tooltips; never color-only.

## 11. Release readiness score

Deterministic (`readiness.ts`). Start 100; subtract: −20 failed workflow, −15 PR
changes-requested, −10 active hotfix, −10 commits without PR, −10 release branch
without green CI, −5 no deployment signal. Clamp 0–100. Bands: 85–100 Good,
65–84 Watch, 40–64 At Risk, 0–39 Blocked. **A signal, not canonical truth — does
not replace human approval.**

## 12. Isabella summary provider

`getGitHubIntelligenceSummary(projectId, …)` returns a deterministic
`{ summary, risk, recommendation, readinessScore }` **only** when flag ON +
software + repo connected + permission — otherwise `null`. For non-software
projects Isabella must not mention GitHub unless the user explicitly asks why it
is unavailable (`whyGitHubUnavailable()`). No LLM call; never mutates canonical
data.

## 13. Security / RBAC / tenancy

- View: any org member of a software project. Connect/disconnect/refresh/config:
  owner/admin/member (manager+). Viewers cannot configure credentials.
- All queries scoped by `organization_id` + `project_id`; cross-org access
  rejected; callback `state` validated; no cross-org installation mapping.
- Secrets (private key, webhook secret, client secret, tokens) never reach the
  client and are never logged. Installation tokens are short-lived and never
  persisted.

## 14. Read-only GitHub policy

No commit/merge/close/comment/status/dispatch/trigger. Only reads metadata and
receives webhooks. GitHub events never auto-complete tasks, close milestones, or
change risks/decisions/roadmap — evidence is stored separately; status changes
may be *suggested* later, never applied automatically.

## 15. Testing strategy

`src/lib/github-intelligence/__tests__/` (62 tests): branch classification,
readiness scoring + clamp, graph overcrowding/collapse/empty, payload
normalization, webhook signature (valid/invalid/missing/tampered) + envelope
parse, ingestion (idempotency, non-software ignore, repo-not-connected, tenant
scope injection), deterministic summary, envelope encryption round-trip + fail-
closed, feature flag default-OFF, software gating, nav module gate, and the
read-only client guardrail. No live GitHub API is called in tests.

## 16. Rollback plan

Set `GITHUB_INTELLIGENCE_ENABLED` unset/`false`. The module goes dark instantly:
nav entry disappears, routes/APIs stop processing, the webhook accept-and-ignores,
Isabella loses GitHub context. `github_*` data stays inert. No migration rollback
required; `github_*` tables are additive and can be dropped if desired.

## 17. Limitations & next steps

- Production GitHub App registration not performed (env vars are placeholders).
- Manifest setup wizard: server contracts + read-only manifest builder in place;
  full temporary-code exchange + install callback route are follow-ups.
- Install callback + live repo picker (Mode A) are follow-ups; the dev-safe
  synthetic connect covers local exploration.
- No background scheduled sync (manual refresh only).
- Deployment data depends on available GitHub permissions/API.
- Isabella uses a deterministic placeholder summary (no LLM).
- Graph uses snapshot approximation, not full Git DAG reconstruction.
- No automatic task/milestone status mutation (by design).

## Operational notes

- **Dev setup**: leave `GITHUB_APP_*` unset, set `GITHUB_INTELLIGENCE_ENABLED=true`
  on a software project, open Settings → Integrations → GitHub Intelligence →
  *Connect sample repository* to explore the dashboard with synthetic data.
- **Webhook URL**: `https://<host>/api/integrations/github/webhook`; set the same
  secret in the GitHub App and `GITHUB_APP_WEBHOOK_SECRET`.
- **Verify delivery**: GitHub App → Advanced → Recent Deliveries (expect 200/202;
  401 = signature mismatch).
- **Disable**: unset `GITHUB_INTELLIGENCE_ENABLED`.
