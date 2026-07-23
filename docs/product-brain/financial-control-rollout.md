# Financial Control — P4–P9 rollout contract

## Canonical boundary

Financial Control is an additive capability inside the ProjectOps360° Core. Its sources of truth
remain the approved financial domain owners and the existing `project_event_log`; its views are
projections. The existing Budget material-estimate workflow, Workboard, Living Graph, Process
Mining, Reports and Isabella are preserved and connected through read-only projections or controlled
server/database writers.

The capability is not a second budget application, event ledger, status engine, graph, cash ledger or
approval system. Funding, commitment, actual, accrual, payment, reserve, baseline and forecast remain
separate truths and must not be summed as if they were interchangeable.

## Protected rollout rules

- Development and preview use stage only; production remains untouched until G9.
- `FINANCIAL_PILOT_PROJECT_IDS=all` enables every existing and newly created project; an empty
  value disables the capability and explicit IDs remain available for quarantine/recovery operations.
- Foundation, writers, projections, UI and Isabella flags are independent and default OFF.
- Writes require authenticated server context, capability, project scope, evidence, expected state,
  idempotency and the existing canonical event gateway.
- Approval is human-only and segregation-of-duties is enforced server-side and in the database.
- Isabella is read-only: she can explain, compare and trace; she cannot approve, post, release,
  reopen, execute or create predictive claims without calibration.
- Missing history, invalid denominators, unverified legacy rows, multi-currency exclusions and
  reconciliation exceptions remain visible quality states.
- Rollback disables the relevant flags and returns consumers to the compatible path; it never deletes
  financial facts or event history.

## Gate status

| Gate | Result | Boundary |
|---|---|---|
| G4 | Approved | EVM, forecast scenarios and golden calculations |
| G5 | Approved | PMO-first Core integration and Isabella boundaries |
| G6 | Approved | P7–P9 authorized under stage-first controls |
| G7 | Accepted in stage | Additive schema, writers, RLS and projections |
| G8 | Accepted in stage | PMO setup, rate management, cockpit and Isabella screen guidance validated |
| G9 | Authorized for production | All existing and newly created projects; rollback remains flag-only |

## Production activation

Production enables foundation, writers, projections, UI and Isabella for every existing and newly
created project. Process Mining canonical event capture and the read-only canonical relationship view
are also enabled by default for every project. Global switches remain the immediate rollback controls;
project-specific deny/quarantine controls remain available where supported. Isabella Process
Intelligence is enabled so financial and Process Mining explanations use deterministic screen and
project evidence; human approval, posting and causality boundaries remain unchanged.

## Evidence map

- P4–P6 architecture and approval records: `Project360/Budget_Cost_Management/P4-G4_*`,
  `P5-G5_*`, `P6-G6_*`.
- Foundation acceptance: `Project360/Budget_Cost_Management/P7-G7_*`.
- P8 workflow/surface acceptance: `Project360/Budget_Cost_Management/P8-G8_*`.
- P9 readiness/rollout contract: `Project360/Budget_Cost_Management/P9-G9_*`.
- Pure production-readiness gates: `src/lib/financial/release-readiness.ts`.
- Stage checks: `supabase/tests/p8_*.sql` and `supabase/tests/p9_readiness_verification.sql`.
