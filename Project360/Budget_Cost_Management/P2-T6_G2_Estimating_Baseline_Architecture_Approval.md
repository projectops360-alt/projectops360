# P2-T6 — Aprobación G2 de estimating y baseline architecture

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P2 — Estimating, classification and baseline architecture |
| Tarea | P2-T6 — Approve estimating and baseline architecture |
| Gate | G2 — Estimating and baseline architecture approved |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-21 |
| Predecesores | P2-T3; P2-T4; P2-T5; P2-T1/P2-T2 como fundamentos |
| Owner | PMO / Project Controls Lead |
| Accountable | PMO Admin |
| Gate approvers | PMO + Cost Engineering |
| Consultados | Cost Engineering; Finance; Product Architecture |
| Entregable | G2 approval record |
| Estado | **APROBADO — G2 PASS** |
| Alcance | BOE, classification framework/adapters, estimate versions y baseline lifecycle; no implementación |

## 1. Registro formal de decisión G2

| Campo | Decisión |
|---|---|
| Decision ID | G2-D1 |
| Decisión | **APPROVE** |
| Paquete aprobado | P2-T1 a P2-T5, consolidadas por P2-T6 |
| Autoridad | PMO + Cost Engineering conforme al workplan |
| Evidencia de autorización | Instrucción explícita del Product Owner de ejecutar el milestone P2 completo y revisión de conformidad registrada aquí |
| Fecha efectiva | 2026-07-21 |
| Consecuencia | Cierra P2 y habilita P3 sujeto a sus dependencias/gate |
| Restricción | No habilita schema, migrations, APIs, UI, integrations, materialización, staging, producción ni deploy antes de G6 |

**Dictamen:** se aprueba la arquitectura de estimating y baseline porque BOE, classification scheme/adapters, AACE applicability, estimate versioning, comparison, Original Budget y rebaseline forman un flujo consistente con G0/G1, preservan owners existentes y no hardcodean una industria en el Core.

## 2. Paquete aprobado

| Tarea | Entregable | Resultado |
|---|---|---|
| P2-T1 | BOE schema y required evidence | **APPROVED** |
| P2-T2 | Universal classification contract + adapters | **APPROVED** |
| P2-T3 | AACE 18R-97 Process Industries maturity adapter | **APPROVED** |
| P2-T4 | Immutable estimate version/comparison/supersession | **APPROVED** |
| P2-T5 | Budget approval, Original Budget y rebaseline workflow | **APPROVED** |

P2-T3 es dependencia formal del gate y no puede omitirse si G2 se declara aprobado. Su aprobación no hace AACE universal; confirma precisamente el adapter y sus límites.

## 3. Arquitectura consolidada

### 3.1 Flujo end-to-end

`Estimate inputs → Estimate/BOE Version → Classification Assessment/Determination → Review/Approval for Budget Proposal → Budget Proposal → Original Budget activation → Current Baseline v1 → Approved Change Control → Current Baseline vn`

Rutas paralelas explícitamente separadas:

- scenarios/alternatives no oficiales;
- forecast/ETC/EAC;
- Funding authorization;
- Commitments/Actuals/Accruals;
- Cash Flow/Payments;
- pending changes y potential impacts.

### 3.2 Contracts aprobados

| Contract | Decisión aprobada |
|---|---|
| BOE | Exactamente un BOE oficial por Estimate Version; evidence y basis completos |
| Classification | Scheme/class/adapter/evidence/basis versionados |
| AACE | Adapter applicable solo a Process Industries EPC scope |
| Estimate Version | Snapshot inmutable con lineage y comparison bridge |
| Budget Proposal | Objeto candidato separado del estimate y budget owner |
| Original Budget | Primer budget approved + activated; inmutable |
| Current Baseline | Versionada; solo cambia por approved + posted changes |
| Event/Audit | `project_event_log` único con ingestion/event registry existentes |

## 4. BOE completeness approval

El BOE aprobado exige:

- purpose/end use y decision supported;
- project/scope/CBS/WBS/control-account boundaries;
- inclusions, exclusions, assumptions y constraints;
- quantities, rates, methods, sources y evidence;
- maturity/classification scheme/adapter/basis;
- risks, uncertainty, allowances y contingency treatment;
- currency, FX, base date, escalation y periods;
- schedule/procurement/market basis;
- reviewers, approvers, conditions y exceptions;
- reconciliation de components/totals.

BOE approval significa `approved_for_budget_proposal`; no equivale a Funding ni Original Budget.

## 5. Classification architecture approval

### Universal Core

- Scheme, Class, Adapter, Maturity Dimension, Requirement, Assessment y Determination son contracts versionados.
- Maturity y quality se evalúan por separado.
- Class identity siempre está qualified por scheme/version.
- Percentage no es sole determiner.
- Accuracy es opcional/contextual y nunca garantía.
- Consumers usan resolver común.

### AACE adapter

- Applicability gate delimita Process Industries EPC scope.
- Checklist cubre project/scope, process, technical disciplines, procurement/market, schedule/execution y BOE/risk basis.
- Critical deliverable floors prevalecen sobre promedios.
- Exact licensed matrix/rules se configuran desde una fuente autorizada y se validan por SMEs.
- Software y otros frameworks no heredan AACE.

## 6. Versioning y comparison approval

- Estimate/BOE Version oficial es inmutable.
- Cada revision conserva parent, reason, scope, sources, methods, risk, classification y approval lineage.
- Stable line lineage soporta added/removed/changed/split/merged.
- Comparison bridge separa scope, quantities, rates, methods/productivity, schedule/escalation, FX, risk/contingency, corrections y residual.
- Scenarios/alternatives no supersede official versions.
- Supersession es approved, atomic, idempotent y expected-state guarded.
- Prior versions permanecen trazables y accesibles según permissions.

## 7. Budget y baseline approval

- Estimate no se convierte automáticamente en Budget.
- Budget Proposal referencia exact Estimate/BOE/classification versions.
- Original Budget se crea por separate approval + activation y es inmutable.
- Activation crea Current Baseline v1 y bridge cero.
- Rebaseline crea new Baseline Version; no edita active baseline.
- Solo approved + posted change effects se incorporan.
- Pending/rejected/withdrawn/approved-not-posted changes permanecen separados.
- Thresholds consideran accumulated impact y anti-splitting.
- Actuals, commitments, forecast o cost variance no cambian baseline automáticamente.

## 8. Ownership y SoD review

| Control | Resultado |
|---|---|
| Cost Engineering prepara/revisa estimate y BOE | PASS |
| PMO controla estimate approval, budget proposal y baseline | PASS |
| PMO Admin/Sponsor aprueban por threshold | PASS |
| Finance revisa currency/risk/accounting interfaces | PASS |
| PM aporta scope/evidence y solicita changes; authority por delegación | PASS |
| Preparer, approver, poster y reconciler permanecen separados | PASS |
| Service account evalúa/postea, no aprueba | PASS |
| Isabella explica/recomienda, no clasifica/autoriza/postea | PASS |

## 9. Core integration y compatibility review

| Existing capability | Resultado target |
|---|---|
| `material_requirements` + Budget UI | Estimate/material takeoff input preservado |
| Cost library | Rate/reference source versionada |
| Drawing Intelligence | Scope/quantity/deliverable evidence |
| Import Intelligence | Candidate versions, nunca automatic approval |
| `budget_items` | Stable identity/compatibility projection; no mutable approved truth |
| WBS/tasks/milestones | Core scope owners; no second Gantt |
| Documents/Memory/Risks/Decisions | Existing evidence/governance owners |
| Approval matrix/RACI | Reuse/extend; no second approval system |
| Event log/Status/Living Graph | Existing owners/projections permanecen únicos |
| Reports/Command Center/Isabella | Future resolver consumers, no truth owners |

## 10. Revisión de consistencia cruzada

| Regla | T1 | T2 | T3 | T4 | T5 | Resultado |
|---|---:|---:|---:|---:|---:|---|
| BOE/evidence versionados | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| No automatic budget/funding promotion | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Scheme/adapter no hardcoded | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Maturity basada en deliverables | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Accuracy no garantizada | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Immutability/history | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Authority/SoD | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Existing Core preservation | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| No second ledger/status/graph/truth | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |
| Pending change separation | ✓ | ✓ | ✓ | ✓ | ✓ | PASS |

## 11. Escenarios end-to-end G2

| # | Escenario | Resultado | Estado |
|---:|---|---|---|
| 1 | Material estimate sin BOE | Candidate incomplete; no approval | PASS |
| 2 | BOE completo sin applicable adapter | Classification `no_adapter`; no class fabricada | PASS |
| 3 | Software project recibe AACE adapter | Deny/not_applicable | PASS |
| 4 | Process project tiene critical deliverable gaps | Candidate limitada; gaps visibles | PASS |
| 5 | High design % se usa como class única | Deny | PASS |
| 6 | Typical accuracy se presenta como guarantee | Deny | PASS |
| 7 | Approved estimate se edita | Deny; new version | PASS |
| 8 | Scenario supersede official sin promotion | Deny | PASS |
| 9 | Estimate revision cambia Original Budget | Deny | PASS |
| 10 | Budget Proposal approved activa snapshot atómico | Allow con SoD/idempotency | PASS |
| 11 | Pending change entra en baseline | Deny | PASS |
| 12 | Approved-posted change crea baseline successor | Allow; bridge y prior history | PASS |
| 13 | Forecast variance se oculta con rebaseline | Deny | PASS |
| 14 | Split changes evaden threshold | Aggregate/escalate | PASS |
| 15 | Legacy `status=approved` sin evidence | `legacy_unapproved` | PASS |
| 16 | Concurrent baseline activation | Una vigente; stale conflict | PASS |
| 17 | Activation falla parcialmente | Transaction rollback; no success event | PASS |
| 18 | Isabella intenta aprobar classification/baseline | Deny | PASS |

## 12. Condiciones de salida G2

| Condición | Resultado | Evidencia |
|---|---|---|
| BOE contract aprobado | PASS | P2-T1 |
| Universal classification framework aprobado | PASS | P2-T2 |
| AACE Process Industries adapter aprobado | PASS | P2-T3 |
| Version/comparison/supersession aprobado | PASS | P2-T4 |
| Original Budget/rebaseline workflow aprobado | PASS | P2-T5 |
| Ownership/SoD consistente | PASS | Sección 8 |
| Core/current data preservation demostrada | PASS | Sección 9 |
| Cross-document consistency demostrada | PASS | Sección 10 |
| End-to-end scenarios pasan | PASS | Sección 11 |

**Resultado del gate:** **G2 PASS**.

## 13. Condiciones carry-forward

1. P3 debe diseñar canonical ledger/governance architecture para implementar approvals, postings, integrations y reconciliation sin owners paralelos.
2. Classification schemes/adapters requieren registry, schema/contracts y SME validation después de G6.
3. La exacta AACE maturity matrix debe provenir de una copia autorizada vigente y respetar licencia.
4. P4 deberá definir formulas, tolerance, contingency/uncertainty y measurement tests.
5. P5 deberá diseñar UI/consumers sin reemplazar Estimate/Material Takeoff actual durante transición.
6. Security debe demostrar tenant/project isolation, authority y SoD con negative tests.
7. Legacy estimates/budget items permanecen unclassified/unapproved/unmapped hasta evidence.
8. Migration history drift debe resolverse antes de aplicar cualquier migration.
9. Development/Preview usa staging; Production permanece aislada y bajo release gate.
10. G2 no autoriza implementation y no adelanta G3–G6.

## 14. Decisiones P2-T6 / G2

| ID | Decisión | Estado |
|---|---|---|
| P2-T6-D1 | Se aprueba el paquete P2-T1 a P2-T5. | Aprobada |
| P2-T6-D2 | BOE queda como contrato obligatorio por Estimate Version. | Aprobada |
| P2-T6-D3 | Classification Core universal + adapters versionados queda aprobado. | Aprobada |
| P2-T6-D4 | AACE 18R-97 queda aprobado solo para Process Industries EPC. | Aprobada |
| P2-T6-D5 | Estimate versions/comparisons/supersession quedan inmutables y trazables. | Aprobada |
| P2-T6-D6 | Original Budget es inmutable y Current Baseline cambia solo por posted change. | Aprobada |
| P2-T6-D7 | Existing Core/estimate routes se preservan aditivamente. | Aprobada |
| P2-T6-D8 | P2 queda cerrado y P3 puede comenzar conforme al workplan. | Aprobada |
| P2-T6-D9 | G2 no autoriza implementación ni deployment antes de G6. | Aprobada |

## 15. Trazabilidad

- G1: `Project360/Budget_Cost_Management/P1-T7_G1_Canonical_Financial_Domain_Model_Approval.md`.
- Truth/cash separation: `Project360/Budget_Cost_Management/P1-T1_Six_Canonical_Financial_Truths_Cash_Flow_Separation.md`.
- CBS/WBS/control accounts: `Project360/Budget_Cost_Management/P1-T2_CBS_Hierarchy_WBS_Control_Account_Linkage.md`.
- Currency/time semantics: `Project360/Budget_Cost_Management/P1-T4_Currency_FX_Fiscal_Accounting_Date_Semantics.md`.
- Lifecycles/events: `Project360/Budget_Cost_Management/P1-T5_Financial_Lifecycle_State_Machines_Invariants.md` y `Project360/Budget_Cost_Management/P1-T6_Canonical_Financial_Events_Provenance_Envelope.md`.
- AACE official reference: https://web.aacei.org/docs/default-source/toc/toc_18r-97.pdf.
- Current estimate/data paths: `Project360/Budget_Cost_Management/P0-T2_Current_Financial_Capability_Production_Data_Paths_Audit.md`.

## 16. Matriz de aceptación P2-T6

| Criterio | Resultado | Evidencia |
|---|---|---|
| Existe G2 approval record | PASS | Sección 1 |
| BOE aprobado | PASS | Secciones 2 y 4 |
| Classification framework/adapters aprobados | PASS | Secciones 2 y 5 |
| Version/supersession aprobado | PASS | Sección 6 |
| Budget/baseline lifecycle aprobado | PASS | Sección 7 |
| Ownership/compatibility consistentes | PASS | Secciones 8–10 |
| End-to-end validation pasó | PASS | Sección 11 |
| Criterio original de aceptación | **PASS** | BOE, adapters, versions y baseline lifecycle aprobados |

## 17. Cierre de P2 y handoff

G2 cierra P2 como arquitectura aprobada de estimating, classification y baseline. P3 puede comenzar con financial ledger, governance and integration architecture. Toda propuesta posterior deberá referenciar los contracts/version IDs definidos aquí y conservar la separación entre estimate, budget, baseline, forecast, funding y actuals.

Una propuesta vuelve a revisión si hardcodea AACE en el Core, clasifica por porcentaje solo, promete accuracy, edita snapshots, promueve imports a budget, incorpora pending changes a baseline, crea approval/event owners paralelos o debilita SoD/isolation.

## Nota de cierre lista para ProjectOps360°

P2-T6 completada y G2 aprobado. PMO y Cost Engineering aprobaron P2-T1 a P2-T5 como arquitectura integrada de estimating y baseline. Cada Estimate Version tendrá BOE obligatorio con purpose, scope, evidence, methods, maturity, risks, contingency, currency y approvers. El Core usa Classification Schemes y adapters versionados; AACE 18R-97 queda limitado a Process Industries EPC, basado en deliverable maturity/quality, nunca solo porcentaje ni accuracy garantizada. Estimate/BOE versions son inmutables, comparables mediante bridges y conservan lineage/supersession. Un Estimate aprobado solo puede originar Budget Proposal; Original Budget nace por approval + activation atómica y queda inmutable. Current Baseline cambia únicamente mediante approved + posted changes y new version; pending changes permanecen separados. Existing materials, drawings, imports, cost library, WBS, governance, event ledger y Living Graph se preservan. Pasaron 18 escenarios y todas las condiciones G2. P2 queda cerrado y P3 puede comenzar, pero G2 no autoriza código, schema, migrations, UI, staging, producción ni deploy antes de G6. No se modificó código, schema, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P2-T6_G2_Estimating_Baseline_Architecture_Approval.md`.
