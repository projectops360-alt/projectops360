# Environment, Release and Production Operations Contract

**Status:** Approved and executable
**Owner:** Product / Founder
**Applies to:** ProjectOps360 application, Vercel deployments and Supabase databases

This contract prevents cross-environment data access and defines the minimum release and production discipline for ProjectOps360.

## 0. Corporate deployment ownership

- Vercel team: `ProjectOps360's projects` (`project-ops360-s-projects`).
- Vercel project: `projectops360` (`prj_FkwU97q9h094J5bBhaxmdLW4QChb`).
- GitHub repository: `projectops360-alt/projectops360`.
- Production domain: `projectops360.com`; `projectops360.vercel.app` redirects to it.
- Native Vercel Git integration is the only production deployment mechanism. Do not add a second Vercel project or a token-based GitHub Actions deployment for this application.
- Commits deployed from the Hobby team must be authored by the linked corporate GitHub identity. Configure this repository with `git config user.name "ProjectOps360"` and `git config user.email "291304067+projectops360-alt@users.noreply.github.com"` before committing.
- `projectops360-pretransfer-backup` is a disconnected historical backup. It must not be linked to GitHub or receive production domains.

## 1. Binding environment matrix

| Application environment | Supabase project | Project ref | Allowed data |
|---|---|---|---|
| Local development | `projectops360-staging` | `gcxcljfzleasrleyyyda` | Staging only |
| Vercel Development | `projectops360-staging` | `gcxcljfzleasrleyyyda` | Staging only |
| Vercel Preview / QA | `projectops360-staging` | `gcxcljfzleasrleyyyda` | Staging only |
| Vercel Production | `projectops360-alt's Project` | `ocopmlnkvidvmxgiwvxw` | Production only |

Non-production code must never read or write the production database. Production builds must never use staging credentials. `scripts/validate-supabase-environment.mjs` enforces this rule during local development and every Vercel build.

## 2. Secret and access rules

- Keep database passwords, service-role keys and provider credentials only in the appropriate Vercel environment or an ignored local `.env.local`.
- Never copy a production service-role key, database password, webhook secret or third-party production credential into Development or Preview.
- Browser code receives only `NEXT_PUBLIC_*` values. `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` remain server-only.
- Use least-privilege human access, MFA for GitHub/Vercel/Supabase, named accounts and periodic access review.
- Treat staging as sensitive because it can contain production-derived data. Limit access, disable outbound production integrations and sanitize personal data during future refreshes.

## 3. Change flow

1. Create a feature branch; never develop directly on `master`.
2. Express every database schema change as a timestamped file under `supabase/migrations/`. Do not make untracked schema changes in a remote dashboard.
3. Apply and validate the migration in staging first.
4. Open a pull request. CI must pass typecheck, tests and build.
5. Validate the Preview deployment against staging, including authentication, RLS, critical workflows and rollback behavior.
6. Obtain human approval through the protected pull-request review and release decision.
7. Apply the reviewed migration to production using one coordinated migration owner.
8. Deploy the exact CI-approved commit. The production build guard must confirm the production Supabase ref.
9. Run post-deploy smoke checks and monitor errors, latency and database health.

## 4. Database migration standard

- Prefer backward-compatible expand/contract migrations: add compatible structures, deploy compatible code, backfill in controlled batches, then remove obsolete structures in a later release.
- Every destructive migration requires a reviewed rollback or forward-fix plan, a recent recoverable backup and explicit approval.
- Set bounded lock/statement timeouts for risky DDL and avoid large blocking changes during peak use.
- Never run two production migration processes concurrently.
- Compare `supabase/migrations/` with `supabase_migrations.schema_migrations` before promotion; drift blocks release.

## 5. Production release gates

A production release is allowed only when all are true:

- CI is green for the exact commit.
- Preview/staging acceptance is recorded.
- Environment guard passes.
- Required production migrations are applied and verified.
- Security/RLS and data-access tests pass.
- Backup/recovery posture is current.
- A rollback owner and previous known-good deployment are identified.

Pull requests must pass CI and Vercel Preview before merge. The protected `master` branch is the Vercel production branch; merging the approved commit triggers exactly one native Vercel production deployment. Manual CLI production deployments and token-based GitHub Actions deployments are recovery-only operations and must not run in parallel with the native Git integration.

## 6. Reliability and recovery

- Keep automated Supabase backups enabled; enable PITR when the risk/size threshold warrants it.
- Perform a restore drill at least quarterly and record recovery time and data-loss windows.
- Keep the previous known-good Vercel deployment available for immediate promotion/rollback.
- Define service-level objectives for availability, error rate and latency; alert before user impact becomes widespread.
- Maintain a tested incident process: severity, owner, communication channel, timeline, mitigation, recovery and blameless postmortem.

## 7. Security and performance operations

- Keep RLS enabled with deny-by-default policies on exposed tables; run Supabase Security Advisor regularly.
- Review dependencies, leaked-secret alerts, audit logs and privileged actions on every release cycle.
- Use staging for load tests and inspect slow queries/index needs with database advisors and `pg_stat_statements`.
- Never log access tokens, service-role keys, passwords, full authorization headers or personal data.
- Use feature flags for high-risk capabilities and release progressively when practical.

## 8. Minimum smoke checks

- Public landing page responds successfully.
- Authentication works with a designated non-production test user in staging.
- An authenticated, RLS-protected read succeeds.
- A representative create/update flow succeeds in staging.
- No production ref appears in a non-production build; no staging ref appears in production.
- Error monitoring shows no release-correlated spike after promotion.

## 9. Rollback triggers

Rollback or disable the release when authentication, authorization, data integrity, critical workflows or error/latency thresholds regress. Prefer immediate Vercel rollback for application-only faults; use the reviewed database forward-fix/restore plan for data or schema faults.
