# P2-T5 — Approval, Original Budget y rebaseline lifecycle

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P2 — Estimating, classification and baseline architecture |
| Tarea | P2-T5 — Define approval, original budget and rebaseline lifecycle |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-21 |
| Predecesor | P2-T4 |
| Owner | PMO / Project Controls Lead |
| Accountable | PMO Admin / Sponsor según thresholds |
| Consultados | Finance; Project Manager; Change Control Board |
| Entregable | Baseline approval and versioning workflow |
| Estado | **COMPLETADO Y VALIDADO COMO BASELINE P2** |
| Efecto | Define promoción y rebaseline; no activa budgets ni modifica producción |

## 1. Decisión de lifecycle

Estimate, Budget Proposal, Original Budget, Financial Change y Current Baseline son objetos distintos conectados por referencias inmutables. Un Estimate/BOE aprobado puede originar una propuesta; solo el workflow de budget approval/activation crea Original Budget. Después, Current Baseline cambia exclusivamente por approved + posted change control.

Pending, submitted, assessed, rejected, withdrawn y approved-but-not-posted changes permanecen separados de la baseline activa y se muestran como potential impact.

## 2. Objetos y ownership

| Objeto | Owner | Regla central |
|---|---|---|
| Estimate/BOE Version | Cost Engineering / PMO | Evidence de costo; no autorización |
| Budget Proposal | PMO / Project Controls | Candidate para aprobación presupuestaria |
| Original Budget | PMO / Project Controls bajo authority | Primer snapshot activado e inmutable |
| Financial Change | Existing change/governance + PMO financial impact | Request/assessment/decision separado |
| Baseline Version | PMO / Project Controls | Snapshot vigente, versionado |
| Baseline Bridge | Derived/reconciled record | Explica Original → Current y version-to-version |
| Approval Decision | Existing governance primitives | Authority/policy/threshold snapshot |
| Posting/Activation | Authorized poster/service | Aplica decisión; no aprueba |

## 3. Promotion path desde Estimate

`Estimate/BOE approved_for_budget_proposal → Budget Proposal draft → submitted → reviewed → approved → Original Budget activation`

Preconditions de Budget Proposal:

- exact Estimate/BOE Version y classification determination;
- purpose permite budget proposal;
- scope/CBS/control-account mapping completo o exceptions aceptadas;
- currency, FX, base date, escalation y period policy congeladas;
- total/components/contingency reconciliation;
- funding position visible, aunque funding authorization sigue separada;
- risk/assumption/exclusion package;
- review findings y conditions;
- approval policy/threshold resueltos.

El approval puede condicionar activación, pero no modifica el snapshot. Cambios materiales requeridos crean una nueva Budget Proposal/Estimate Version.

## 4. Original Budget lifecycle

### 4.1 States

`draft → submitted → reviewed → approved → activated`

Rutas alternativas:

- `draft|submitted|reviewed → withdrawn`;
- `submitted|reviewed → rejected`;
- `reviewed → draft` por rework/new proposal revision;
- `approved → activation_failed`;
- `activation_failed → activated` solo por idempotent retry del mismo approved snapshot o nueva approval si cambió payload.

### 4.2 Activation transaction

Activation debe efectuar atómicamente:

1. validar latest proposal/version y expected state;
2. revalidar organization/project scope;
3. revalidar authority, policy, threshold y SoD;
4. congelar line/component totals y mappings;
5. crear Original Budget snapshot;
6. crear Current Baseline v1 idéntica al Original Budget salvo presentation metadata permitida;
7. registrar approval/poster/reconciliation refs;
8. emitir eventos canónicos;
9. devolver idempotency result.

Si cualquier paso falla, no existe activation parcial ni event de éxito.

### 4.3 Invariantes

- Original Budget activado es inmutable.
- Existe un solo Original Budget por canonical project/scope charter, salvo re-charter explícito aprobado que conserva todos los records.
- Original Budget no se corrige editando líneas; una correction/re-charter crea governed successor context sin borrar el original.
- Estimate refresh, actuals, commitments o forecast no cambian Original Budget.
- Funding insuficiente puede bloquear o condicionar activation según policy; nunca se infiere funding desde el budget.
- Preparer ≠ approver ≠ poster; reconciler separado.

## 5. Current Baseline initialization

Al activar Original Budget:

- se crea Baseline Version `v1` con exact line/component identity y totals;
- effective date y control period quedan definidos;
- bridge Original→v1 es cero y reconciliado;
- active version uniqueness se establece;
- legacy compatibility projections se actualizan solo después de shadow/reconciliation gate futuro;
- Estimate/BOE refs permanecen como provenance, no como editable owner.

## 6. Financial Change lifecycle

`draft → submitted → impact_assessed → recommended → approved|rejected|withdrawn → posted → implemented → closed`

### 6.1 Change package obligatorio

- change ID/type/reason/cause;
- requester y affected scope;
- CBS/WBS/control-account effects;
- amount/currency/period y uncertainty range cuando aplique;
- impact en baseline, forecast, funding, commitment, reserve, cash y schedule;
- source estimate/comparison/evidence;
- alternatives y recommendation;
- individual y accumulated threshold results;
- risk/reserve/decision refs;
- approval policy/version y required approvers;
- proposed effective date;
- implementation/posting plan.

### 6.2 Separation de pending change

| Estado | Baseline oficial | Reporting |
|---|---|---|
| Draft/submitted | Sin efecto | Separate pending register |
| Impact assessed/recommended | Sin efecto | Potential impact con confidence |
| Approved, not posted | Sin efecto | Approved awaiting posting |
| Posted | Elegible/incluido en nueva Baseline Version | Bridge y event refs |
| Rejected/withdrawn | Sin efecto | Historical decision |
| Reversed | Compensating effect en nueva version | No rewrite histórico |

## 7. Rebaseline workflow

### 7.1 Preconditions

- active baseline version identificada;
- todos los changes incluidos están approved y listos/posteados conforme a policy;
- no change ya incluido se duplica;
- accumulated thresholds y anti-splitting evaluados;
- scope/CBS/WBS mappings completos o exceptions aprobadas;
- currency/FX/period policies comparables;
- baseline bridge reconcilia;
- pending/unapproved changes excluidos;
- PMO/Finance/CCB/Sponsor reviews completadas según materiality.

### 7.2 States por Baseline Version

`draft → submitted → reviewed → approved → active → superseded → archived`

Rutas alternativas: `submitted|reviewed → rejected|withdrawn`; `approved → activation_failed`; `active → closed` al cierre del proyecto.

### 7.3 Activation de nueva baseline

La transacción debe:

1. lock/validate expected active version;
2. validar approved change set y no duplication;
3. aplicar effects al nuevo snapshot, no al anterior;
4. reconciliar line/component totals y bridge;
5. activar new version y supersede prior de forma atómica;
6. conservar effective windows y approval/poster refs;
7. emitir baseline/change events en el ledger único;
8. invalidar projections/resolvers mediante tags, no raw rewrites.

## 8. Baseline bridge

Todo rebaseline produce:

- starting baseline version/amount;
- approved scope additions/removals;
- approved quantity/rate effects cuando el change los autoriza;
- transfers/allocations entre CBS/control accounts;
- approved contingency/reserve movements incluidos por policy;
- currency/FX treatment;
- corrections/reversals;
- residual/unexplained difference;
- ending baseline version/amount.

`Starting + approved posted effects = Ending` dentro de tolerance. Forecast variance, actuals y commitments no se incorporan al bridge salvo que originaron un approved change separado.

## 9. Thresholds, authority y anti-splitting

Authority evaluation considera:

- individual amount/percentage;
- accumulated related changes por cause/scope/time window;
- impact en funding/baseline/reserves;
- contingency vs management reserve source;
- organization/project policy y charter;
- conflicts/delegations;
- requester/preparer history.

Dividir un cambio no reduce authority. Si accumulated impact supera threshold, escala a Sponsor/Steering/CCB correspondiente.

## 10. Roles y SoD

| Acción | Responsible/authority |
|---|---|
| Prepare Budget Proposal | Cost Engineer / Project Controls Analyst |
| Review Estimate/BOE | Cost Engineering + discipline reviewers |
| Approve Original Budget | PMO Admin / Sponsor según policy |
| Post/activate | Separate authorized PMO poster/service |
| Request change | PM/cost owner/PMO según scope |
| Assess financial impact | PMO / Project Controls |
| Approve change | PMO Admin/CCB/Sponsor según accumulated threshold |
| Reconcile baseline | Independent PMO reviewer + Finance |
| Audit | Independent read-only reviewer |

El PM no adquiere budget authority por administrar scope; puede solicitar/aportar evidencia y preparar solo mediante delegación vigente. Isabella no aprueba ni postea.

## 11. Re-estimate, forecast y rebaseline separados

| Acción | Cambia estimate | Cambia forecast | Cambia baseline |
|---|---:|---:|---:|
| New scope evidence | Puede | Puede | No |
| Estimate revision | Sí | Solo si forecast workflow la adopta | No |
| Forecast publication | No | Sí | No |
| Pending change | Puede informar | Puede mostrarse por scenario/policy | No |
| Approved + posted change | Puede originar successor estimate | Puede incorporarse | Sí, mediante new baseline version |
| Actual/commitment movement | No | Puede afectar ETC/EAC | No automáticamente |

Rebaseline no se usa para esconder performance variance. Requiere change authority y bridge explícito.

## 12. Corrections, rollback y failure handling

- Approved snapshot con payload cambiado exige nueva approval.
- Activation failure no deja baseline parcial.
- Incorrect posted change se corrige por reversing/compensating change y new baseline version.
- Baseline history no se elimina durante rollback.
- Feature rollback detiene new writes/consumers; owners/events permanecen.
- Closed-period effects respetan P1-T4.
- Break-glass requiere authority adicional, reason, expiry y post-review; no permite self-approval.

## 13. Compatibility current→target

| Elemento actual | Decisión |
|---|---|
| `budget_items` | Preservar IDs/links; amounts se vuelven compatibility projections después de resolver owners target |
| `budget_items.status='approved'` | No prueba approval; legacy/unapproved hasta evidence/policy |
| `budget_items.metadata` | No almacena como única fuente approval/baseline history |
| Material Budget UI | Continúa Estimate/Material Takeoff; no activa budget |
| Import/template budget rows | Candidates/placeholders; nunca Original Budget automático |
| Existing approval matrix/RACI | Reutilizar/extender para authority; no second approval system |
| `project_event_log` | Único ledger de approval/activation/change events |
| Reports/Command Center | Migran a baseline resolver; no leen mutable field como truth final |

## 14. Eventos conceptuales

- `budget_proposal_submitted` / `reviewed` / `approved` / `rejected`;
- `original_budget_approved` / `activated` / `activation_failed`;
- `baseline_version_created` / `submitted` / `approved` / `activated` / `superseded`;
- `financial_change_submitted` / `impact_assessed` / `approved` / `rejected` / `posted` / `reversed`;
- `baseline_reconciliation_completed` / `exception_opened`.

Todos se registrarán mediante Event Ingestion Service en `project_event_log`.

## 15. Escenarios de validación

| # | Escenario | Resultado |
|---:|---|---|
| 1 | Estimate aprobado se importa como Original Budget | Deny; requiere Budget Proposal + approval + activation |
| 2 | Original Budget activado intenta editarse | Deny; permanece inmutable |
| 3 | Pending change se suma a Current Baseline | Deny; mostrar separado |
| 4 | Change approved pero posting falla | Baseline sin cambio; activation/posting retry controlado |
| 5 | Dos baseline activations concurrentes | Una gana; expected-state conflict para la otra |
| 6 | Change se divide para evadir threshold | Aggregate/anti-splitting; escalar authority |
| 7 | Forecast variance se elimina por rebaseline sin change | Deny |
| 8 | Actual/commitment cambia | Baseline intacta; forecast/control positions se actualizan aparte |
| 9 | Incorrect change ya posteado | Reversing change + new baseline version |
| 10 | PM prepara y aprueba su change | Deny por SoD/authority |
| 11 | Legacy status approved carece de evidence | `legacy_unapproved`; no promotion |
| 12 | Activation transaction falla a mitad | Rollback completo; no success event |

## 16. Decisiones P2-T5

| ID | Decisión | Estado |
|---|---|---|
| P2-T5-D1 | Estimate, Budget Proposal, Original Budget, Change y Baseline son objetos distintos. | Aprobada |
| P2-T5-D2 | Original Budget solo nace por approved + atomic activation y es inmutable. | Aprobada |
| P2-T5-D3 | Baseline v1 se crea al activar Original Budget y conserva exact provenance. | Aprobada |
| P2-T5-D4 | Current Baseline cambia solo mediante approved + posted change y nueva version. | Aprobada |
| P2-T5-D5 | Pending/approved-not-posted changes permanecen separados. | Aprobada |
| P2-T5-D6 | Baseline bridge reconcilia todos los efectos y residual. | Aprobada |
| P2-T5-D7 | Thresholds usan accumulated impact y anti-splitting. | Aprobada |
| P2-T5-D8 | Re-estimate, forecast y rebaseline permanecen separados. | Aprobada |
| P2-T5-D9 | Activation/supersession es atómica, idempotente y expected-state guarded. | Aprobada |
| P2-T5-D10 | Existing data/governance/events evolucionan aditivamente. | Aprobada |

## 17. Matriz de aceptación P2-T5

| Criterio | Resultado | Evidencia |
|---|---|---|
| Approval/promotion path está definido | PASS | Secciones 3–4 |
| Original Budget es inmutable | PASS | Sección 4.3 |
| Current Baseline es versionada | PASS | Secciones 5 y 7 |
| Solo approved change control modifica baseline | PASS | Secciones 6–7 |
| Pending changes permanecen separados | PASS | Sección 6.2 |
| Authority/SoD/anti-splitting están definidos | PASS | Secciones 9–10 |
| Existing paths evolucionan aditivamente | PASS | Sección 13 |
| Criterio original de aceptación | **PASS** | Original inmutable; rebaseline solo por change aprobado; pending separado |

## Nota de cierre lista para ProjectOps360°

P2-T5 completada y validada. Se definió la promoción controlada Estimate/BOE → Budget Proposal → Original Budget, manteniendo objetos y approvals separados. Original Budget nace únicamente mediante approved + atomic activation, crea Current Baseline v1 y permanece inmutable. Rebaseline crea una nueva Baseline Version y solo incorpora Financial Changes approved + posted; draft, pending, assessed, rejected, withdrawn y approved-not-posted permanecen separados como potential/awaiting impact. Cada change declara efectos en scope, CBS/WBS, baseline, forecast, funding, commitments, reserves, cash y schedule. Baseline bridge reconcilia starting, approved effects, currency/reserve/corrections, residual y ending. Thresholds consideran impacto acumulado y anti-splitting. Re-estimate, forecast y rebaseline no se sustituyen entre sí. Activations/supersessions usan expected-state, idempotencia, SoD y eventos atómicos. Existing `budget_items`, UI, governance y ledger se preservan aditivamente. Se aprobaron 10 decisiones y 12 escenarios. No se modificó código, schema, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P2-T5_Approval_Original_Budget_Rebaseline_Lifecycle.md`.
