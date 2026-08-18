# Friction Radar v1 — FR-17 through FR-24

Status: implemented on `agent/friction-radar-v1`; acceptance pending draft-PR preview.

## Block contract

| Task | Delivery | Acceptance contract |
|---|---|---|
| FR-17 | Main dashboard | Categories, promoted signals, independent severity/score, confidence and evidence status. Category/global scores remain `null`. |
| FR-18 | Evidence panel | Affected task and milestone, observed vs expected, qualified time range, canonical-event timeline and exact source references. |
| FR-19 | Filters and navigation | Category, severity, confidence, milestone, task, Top 20/all, ordering, affected entity and Living Graph links. |
| FR-20 | Honest states | Loading, read failure, concealed unauthorized/foreign project, no promoted signals, `UNKNOWN` and `INSUFFICIENT_EVIDENCE`. |
| FR-21 | Responsive, accessible, bilingual | Mobile/desktop layout, keyboard-operated controls and modal, focus return/trap, contrast, reduced-motion loading and EN/ES key parity. |
| FR-22 | Security and tests | Authenticated SSR client, tenant/project filters, RLS, GET-only private API, cross-org 404, render/API/performance/regression tests. |
| FR-23 | Feature flag and docs | Default-OFF server flag plus project pilot allowlist, technical notes and PM/PMO guide. |
| FR-24 | Preview and review | Draft PR, green CI and non-production preview. No merge and no production deployment. |

## User surface

- Route: `/[locale]/projects/[projectId]/friction-radar`
- Protected API: `GET /api/projects/[projectId]/friction-radar?locale=en|es`
- Navigation: Project → Intelligence → Friction Radar.
- The tab, page and API are all dark while the feature flag is off.
- The API returns `Cache-Control: private, no-store, max-age=0` and has no
  mutation methods.

The browser receives promoted signals, detector gaps, referenced timeline
events, counts and the read model. It does not receive raw event payloads, full
task evidence rows, source-audit internals through the API, service-role keys or
cross-tenant identifiers.

## Controlled activation

Both server-only variables are required:

```dotenv
FRICTION_RADAR_ENABLED=true
FRICTION_RADAR_PROJECT_IDS=<project-uuid>[,<project-uuid>...]
```

Rules:

1. Unset, empty, `false` or any value other than literal `true` keeps the
   feature dark.
2. An enabled global flag without an allowed project still returns 404 and
   performs no Friction Radar data read.
3. `all` is accepted for local/preview acceptance only.
4. Vercel production rejects `all`; production requires explicit project IDs.
5. Rollback is immediate: unset `FRICTION_RADAR_ENABLED`. No migration or data
   rollback exists because the module is read-only.

Preview must continue to use the staging Supabase project required by the
repository environment guard. Do not point a preview at production.

## Security boundary

The page and API call `isFrictionRadarEnabledForProject(projectId)` before the
loader. The loader uses the regular authenticated Supabase SSR client and
`getOrgContext()`. Every project-owned SELECT is constrained by
`organization_id` and `project_id`; RLS remains the final database barrier.

Unauthorized and cross-organization project IDs are deliberately returned as
404 so the surface does not disclose whether the project exists. No admin
client, service-role bypass, write-capable RPC, INSERT, UPDATE, UPSERT or DELETE
is used.

## Evidence presentation

The dashboard never recomputes or promotes a signal. It filters and orders the
validated engine output only. Each ranked row exposes:

- independent 0–100 signal score;
- category, severity, confidence and evidence status;
- affected task/milestone when available;
- observed value and expected/baseline value;
- evidence start/end;
- exact source engine and signal ID;
- canonical events referenced by `project_event_log`, ordered by authoritative
  project sequence;
- all other table/row references and detector metadata.

When a signal has no referenced canonical event, the panel says that the event
timeline is unavailable and still presents the qualified time range and source
rows. It never creates a synthetic timeline.

## PM / PMO guide

1. Open a project and choose **Intelligence → Friction Radar**.
2. Start with the **Top 20**. A score ranks one signal only; it is not the
   project score and must not be compared as if it were an approved category
   aggregate.
3. Filter by category, severity, confidence, milestone or task to isolate the
   operational area under review.
4. Open **View evidence** before acting. Confirm the observed/baseline values,
   event sequence, source rows and confidence.
5. Use **Open affected entity** to inspect the task, milestone, risk, resource
   or financial surface. Use **Open in Living Graph** for graph context.
6. Review **Unknown and insufficient evidence**. A missing capacity, cost,
   decision or risk link means the detector cannot decide; it does not mean the
   project has no friction.
7. Do not use the unapproved category aggregation proposal for governance,
   escalation or performance evaluation.

## Validation inventory

- Engine/unit: `src/lib/friction-radar/__tests__/**`
- Dashboard render: `src/components/friction-radar/__tests__/friction-radar-client.render.test.tsx`
- Protected API: `src/app/api/projects/[projectId]/friction-radar/__tests__/route.test.ts`
- Static security boundary: `surface-boundaries.test.ts`
- Browser acceptance: `e2e/friction-radar.spec.ts`
- Navigation: `src/components/layout/__tests__/project-tabs-nav.test.ts`
- Locale parity: `src/i18n/__tests__/message-parity.test.ts`

Browser acceptance is non-mutating. It validates the authorized route, filters,
evidence drawer, private GET API and optional foreign-project 404. Required
preview variables:

```dotenv
E2E_STORAGE_STATE=<authenticated-preview-storage-state.json>
E2E_FRICTION_RADAR_PROJECT_ID=<authorized-staging-project-id>
E2E_FRICTION_RADAR_FOREIGN_PROJECT_ID=<optional-foreign-project-id>
E2E_BASE_URL=<preview-url>
```

## Known, intentional limits

- Global and category scores are not calculated.
- No recommendation is executed from this UI.
- No event, task, risk, decision, resource or financial record can be changed
  from Friction Radar.
- Event descriptions use the canonical taxonomy name; the UI does not translate
  or reinterpret user-authored task/milestone titles.
- Preview activation requires staging environment variables; production remains
  untouched until a later explicit approval.

## Production read-only validation — Aurora

Reverified on 2026-08-18 using one `WITH ... SELECT` statement only:

- 274 current non-deleted tasks;
- 16 current non-deleted milestones;
- 869 canonical events;
- task `b0ca5ded-efdc-455d-abf7-671eb3fd8670` exposes the expected timeline:
  - sequence 762 — `TaskCompleted`, event
    `5c172027-1ca5-429b-b752-637cdee317e7`, `not_started → done`;
  - sequence 763 — `TaskReopened`, event
    `44909854-4a9a-44a3-b23a-45668abbcb91`, `done → blocked`.

This validates that the FR-18 timeline fields and ordering exist in the real
schema. It did not activate the feature, write data, change schema or deploy.
