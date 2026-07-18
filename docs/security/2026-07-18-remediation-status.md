# ProjectOps360 security remediation status

**Date:** 2026-07-18  
**Scope:** production containment and compatible hardening following the deep security assessment.

## Closed and deployed

- **SEC-001:** all public `SECURITY DEFINER` functions lost anonymous execution; graph implementations moved to `private`, public wrappers enforce project access, and internal functions are service-role only.
- **SEC-002:** tenant administrators can no longer enumerate Auth, reset another user's password, change a global email, delete a global account, or auto-link an existing account.
- **SEC-003:** only `active` organization memberships authorize access; suspended membership behavior was verified transactionally and rolled back.
- **SEC-004 (partial):** the shared demo account was removed from the hardcoded and database platform-admin allowlists. Credential rotation and session revocation remain an operator action.
- **SEC-005:** `must_change_password` is enforced in central organization context, and application/Auth password minimums are aligned at 12 characters. Hosted Auth breached-password detection is enabled.
- **SEC-006 (partial):** AI/voice and webhook routes enforce strict JSON content types and streamed byte limits before parsing. Distributed rate limiting and cost quotas remain pending.
- **SEC-007:** vulnerable `expr-eval` was replaced by a bounded internal parser; the high transitive `hono` advisory was also removed.
- **SEC-008 (partial):** the service-role client is protected by `server-only`, tenant pages no longer enumerate the global Auth directory, and admin email lookup is service-role only. Broader service-role reduction remains pending.
- **SEC-009:** multi-organization context deterministically selects an active preferred membership and never auto-heals an existing suspended/removed user.
- **SEC-012:** `nosniff`, frame denial, strict referrer policy and a restrictive permissions policy are active.
- **SEC-014:** environment variants and personal MCP configuration are ignored by default while examples remain allowed.
- **SEC-016:** `/navigator-preview` now requires an authenticated session.

## Production evidence

- Anonymous `get_process_timeline` returns `401`; an authorized user receives `200` for an accessible project.
- Catalog audit returns zero public `SECURITY DEFINER` functions executable by `anon`.
- Auth user creation/profile/membership triggers passed in an isolated data-cloned branch and cleanup succeeded.
- Full validation: typecheck passed, production build passed, 2,220 tests passed and 59 were skipped.
- Authenticated production smoke test passed for projects, team, Living Graph, landing assets and tablet overflow.

## Scheduled controls

These require maintenance planning, enrollment, workload baselines or infrastructure and were intentionally not enabled blindly:

1. Rotate the shared demo password, revoke its sessions and move operators to individual accounts.
2. Require MFA/AAL2 for platform and tenant administrators after enrollment and recovery paths exist.
3. Add distributed user/organization/IP rate limiting, cost quotas and alert thresholds.
4. Enable database SSL enforcement after checking every direct database client; evaluate network restrictions with stable egress.
5. Define per-bucket MIME/size policies and a quarantine/malware-scanning workflow from real upload requirements.
6. Continue replacing ordinary `service_role` reads with session clients and RLS.
7. Introduce CSP in report-only mode, then enforce after integration violations are resolved.
8. Enable CodeQL, Dependabot/dependency review and stronger human review gates in GitHub.
