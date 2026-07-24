# PMO Process Intelligence — UAT Plan, Comparison Criteria & Rollout (M9)

**Module:** CAP-047 · flag `PMO_PROCESS_INTELLIGENCE_DASHBOARD_ENABLED` (OFF)
**Precondition:** enable the flag ONLY in a local/staging environment
(`PMO_PROCESS_INTELLIGENCE_DASHBOARD_ENABLED=true` in `.env.local`, restart dev
server) and sign in as owner/admin. The current dashboard must stay default.

## A. UAT scenarios (PMO operator)

| # | Scenario | Expected |
|---|---|---|
| U1 | Open home dashboard with flag OFF | No switcher; dashboard byte-identical to before |
| U2 | Enable flag, open home as owner/admin | Switcher "Current Dashboard \| Process Intelligence Beta" under the title; current stays default |
| U3 | Open as member/viewer with flag ON | No switcher; `/process-intelligence` returns 404 |
| U4 | Enter the Beta, return with one click | Both directions work; org + locale preserved |
| U5 | Process map | Nodes/edges from real events; dominant path solid; rework dashed red WITH "↩" text; bottleneck badge only when calculated ≥ 0.7 |
| U6 | Click a node/edge | Evidence drawer: metrics + data quality + events used/seen + formula + temporal≠causal note |
| U7 | Drill-down | Select a project → cases become object journeys; breadcrumb returns to org level |
| U8 | Variant isolation + min-frequency + rework filters | Map responds; saved view persists after reload (localStorage) |
| U9 | Finance tab | Budget Command Center: separate committed/actual/accrued; EAC + P50/P80; CPI/SPI/TCPI/VAC; status date; alerts with formula+values+date+source; honest empty state without financial data |
| U10 | Risk / Resources / Dependencies tabs | Exposure + systemic risks with downstream counts; capacity pressure from the canonical engine; hubs + intra-project limitation; Benefits declares the missing data model |
| U11 | Isabella panel | Only evidence-complete insights; View evidence expands full package; Open in map highlights activities; Simulate jumps to What-if; accept/reject/defer records feedback (verify row in `audit_logs`) |
| U12 | What-if | SIMULATED banner; budget delta moves baseline+VAC only; risk mitigation toggles; availability slider; reset; NOTHING persists after reload |
| U13 | Realtime | "live · synced" indicator; create a task in another tab → view refreshes on next poll (≤20 s); hide the tab → polling pauses |
| U14 | Accessibility | Keyboard navigation across tabs/buttons; table view fallback; no color-only status; no animation |
| U15 | Tablet/mobile | KPI grid wraps; canvas scrolls; panels stack |

## B. Current vs Beta comparison criteria (spec §16)

| Dimension | How to measure during UAT |
|---|---|
| Time to insight | Stopwatch: identify top-3 threats/opportunities in each dashboard (target < 2 min in Beta) |
| Explainability | For 5 conclusions, trace to source events/formulas/timestamps (target 100% in Beta) |
| Decision support | Count concrete, simulable actions offered per session |
| Finance | Verify reconciliation exceptions surfaced; EVM values match the Financial Control page |
| Preference | Structured PMO questionnaire after both sessions |
| Performance | Interaction smoothness at the real event volume; LOD behavior with min-frequency 1 |

## C. Rollout plan (post-UAT, requires explicit approval)

1. UAT signed off → enable flag in **staging** env vars; operator smoke (U1-U13) against staging data, including cross-tenant negative probes (second org sees nothing).
2. PR of `feat/pmo-process-intelligence` → master (CI green) — merge is a HUMAN decision.
3. Enable flag in production env vars for the pilot org only after the PMO formally approves; the current dashboard remains default regardless.
4. Isabella knowledge ingestion: apply the 9 versioned packages (manifest.json) to staging Knowledge OS first, then production, then index embeddings.

## D. Rollback

- **Instant:** unset `PMO_PROCESS_INTELLIGENCE_DASHBOARD_ENABLED` → the switcher disappears and `/process-intelligence` 404s; the current dashboard was never modified beyond the conditional switcher.
- **Code:** revert the M1-M9 commits on the branch (they are additive; only `page.tsx` Header and `env.ts` touch shared files, both trivially revertible).
- **Isabella:** knowledge packages are versioned — demote `is_current` to restore the previous snapshot; feedback lives only in `audit_logs` and drives nothing automatically.
