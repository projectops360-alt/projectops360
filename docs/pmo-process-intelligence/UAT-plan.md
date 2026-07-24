# PMO Process Intelligence — UAT Plan, Comparison Criteria & Rollout (M9)

**Module:** CAP-047 · flag `pmo_process_intelligence_dashboard` (OFF)
**Precondition:** enable the flag ONLY in a local/staging environment
(`pmo_process_intelligence_dashboard=true` in `.env.local`, restart dev
server) and sign in as owner/admin. The current dashboard must stay default.

## A. UAT scenarios (PMO operator)

| # | Scenario | Expected |
|---|---|---|
| U1 | Open home dashboard with flag OFF | No switcher; dashboard byte-identical to before |
| U2 | Enable flag, open home as owner/admin | Switcher "Current Dashboard \| Process Intelligence Beta" under the title; current stays default |
| U3 | Open as member/viewer with flag ON | No switcher; `/process-intelligence` returns 404 |
| U4 | Enter the Beta, return with one click | Both directions work; org + locale preserved |
| U5 | Interactive organization canvas | Five draggable stage nodes; pan, wheel/pinch zoom, minimap and controls work; observed edges are evidence-backed and zero-frequency reference edges are labeled honestly |
| U6 | Hover/click a node or edge | Hover shows tooltip and highlights the connected route; click keeps selection and opens the evidence drawer without changing hierarchy |
| U7 | Expand and drill-down | Expand a stage to projects; double-click stage → project → milestone; milestone view shows canonical activities/dependencies; breadcrumbs return without losing filters |
| U8 | Search/layout/semantic zoom | Search centers a node; far/intermediate/close/deep LOD changes content; Fit View, Reset Layout, Save/Restore/Clear layout work per user/org/view/layer/filter/date |
| U9 | Finance tab | Budget Command Center: separate committed/actual/accrued; EAC + P50/P80; CPI/SPI/TCPI/VAC; status date; alerts with formula+values+date+source; honest empty state without financial data |
| U10 | Risk / Resources / Dependencies tabs | Exposure + systemic risks with downstream counts; capacity pressure from the canonical engine; hubs + intra-project limitation; Benefits declares the missing data model |
| U11 | Isabella panel | Only evidence-complete insights; View evidence expands full package; Open in map highlights activities; Simulate jumps to What-if; accept/reject/defer records feedback (verify row in `audit_logs`) |
| U12 | What-if | SIMULATED banner; budget delta moves baseline+VAC only; risk mitigation toggles; availability slider; reset; NOTHING persists after reload |
| U13 | Realtime | "live · synced" indicator; create a task in another tab → view refreshes on next poll (≤20 s); hide the tab → polling pauses |
| U14 | Accessibility | Tab reaches graph nodes; Enter selects; arrows move focus; Escape closes/backs; table fallback; no color-only status; reduced motion honored |
| U15 | Tablet/mobile | KPI grid wraps; canvas pans and pinch-zooms; drawer/menu stay in viewport; panels stack |
| U16 | Isabella live context | Hover Ejecutar and ask “¿Qué significa este?”; ask node count, worst node, current view and open projects; answers must use the current authorized canvas state |
| U17 | Layout isolation | Save different layouts for two users/layers/date filters; restoring one scope never changes another and never writes project records |

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

- **Instant:** unset `pmo_process_intelligence_dashboard` → the switcher disappears and `/process-intelligence` 404s; the current dashboard was never modified beyond the conditional switcher.
- **Code:** revert the M1-M9 commits on the branch (they are additive; only `page.tsx` Header and `env.ts` touch shared files, both trivially revertible).
- **Isabella:** knowledge packages are versioned — demote `is_current` to restore the previous snapshot; feedback lives only in `audit_logs` and drives nothing automatically.

## E. Local execution record — 2026-07-23

- U5–U8: passed in authenticated Chromium.
- U14: keyboard handlers, reduced-motion behavior and table fallback covered by code/tests; browser node interaction passed.
- U15: passed at 768×1024 and 390×844 viewport emulation; physical-device confirmation remains open.
- U16: passed for node count, Ejecutar meaning, worst visible node and projects in the selected stage.
- U17: scoped local layout key created and restored without canonical data writes.
- Focused validation: 20 files / 91 tests.
- Full validation: 258 files passed / 2,385 tests passed; production build passed.
- Release actions: none. No deploy, merge, push or production mutation.
