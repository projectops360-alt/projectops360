# P8 — Financial workflows and Core surfaces / G8

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P8 — Financial workflows and Core surfaces |
| Tareas | P8-T1 a P8-T6 |
| Predecesor | G7 PASS |
| Restricción | Stage-first, additive, feature-gated; no producción |
| Estado | **IMPLEMENTACIÓN LOCAL COMPLETA — G8 PENDIENTE DE UAT EN STAGE** |

P8 integra los workflows financieros al Core existente. La pantalla Budget conserva el estimado
de materiales y añade el cockpit financiero únicamente cuando el proyecto está permitido por las
flags de piloto. No se crea una aplicación financiera separada, otro Gantt, otro event ledger ni
otra fuente de verdad.

## P8-T1 — Estimating, Basis of Estimate, versioning and baseline

**Resultado para notas de la tarea:**

Se implementó el contrato de transiciones controladas para estimate, BOE y baseline. La preparación,
la aprobación y la activación exigen estado esperado, evidencia, actor humano, alcance de proyecto y
una ruta service-only. La activación de baseline supersede la versión anterior y conserva el
original budget; no reescribe el estimado de materiales existente.

**Evidencia:** `src/lib/financial/workflow.ts`, `src/lib/financial/workflow.server.ts`,
`supabase/migrations/20260859000000_financial_workflows_cockpit.sql`.

## P8-T2 — Funding, commitments, actuals, accruals, payments and reconciliation

**Resultado para notas de la tarea:**

Se conectaron las transiciones de funding, accrual, payment y change al mismo gateway de eventos
canónico. Los actuals controlados usan un RPC atómico separado, con idempotencia, scope de parent y
subject, append-only y compensación en vez de edición. Las posiciones siguen separadas: commitment,
actual, accrual y cash payment nunca se mezclan.

**Evidencia:** `src/lib/financial/writer.server.ts`,
`supabase/migrations/20260859000000_financial_workflows_cockpit.sql`,
`src/lib/financial/reconciliation.ts`.

## P8-T3 — Changes, reserves, EVM and forecast scenarios

**Resultado para notas de la tarea:**

Los cambios pendientes o rechazados no alteran el baseline. Un cambio aprobado y posteado crea una
nueva versión de current baseline, marca la versión anterior como superseded y conserva el vínculo
al change. EVM, EAC, CPI/SPI, TCPI y escenarios P50/P80 consumen las primitivas versionadas y los
golden results; datos insuficientes permanecen `unavailable`.

**Evidencia:** `src/lib/financial/calculations.ts`,
`Project360/Budget_Cost_Management/reference/P4_Golden_Financial_Calculations_v1.json`,
`src/lib/financial/__tests__/calculations.test.ts`.

## P8-T4 — PMO cockpit and role-specific project views

**Resultado para notas de la tarea:**

Se añadió un cockpit PMO responsive dentro de la página Budget existente. Expone baseline, funding,
commitment, cost exposure, cash, reserves, forecast, CPI/SPI, quality y control queue. PMO conserva
visibilidad y reconciliación sin recibir automáticamente autoridad de pago; el PM no queda obligado a
administrar presupuesto. La interfaz usa grid responsive y no reemplaza el Workboard, Living Graph ni
el estimado actual.

**Evidencia:** `src/app/[locale]/(app)/projects/[projectId]/budget/page.tsx`,
`src/app/[locale]/(app)/projects/[projectId]/budget/financial-cockpit.tsx`,
`src/lib/financial/capabilities.ts`.

## P8-T5 — Living Graph, Process Mining, reports and Isabella

**Resultado para notas de la tarea:**

Reports e Isabella leen exclusivamente la proyección `financial_project_cockpit`. Isabella recibe
hechos sanitizados, citas y limitaciones; solo puede explicar, comparar y rastrear. No puede aprobar,
postear, liberar reservas, reabrir periodos ni ejecutar acciones. El cockpit enlaza a Living Graph y
Reports para mantener el flujo dentro del Core y no dibuja un grafo financiero paralelo.

**Evidencia:** `src/lib/financial/intelligence.ts`,
`src/lib/isabella/process-context/financial-evidence.ts`,
`src/lib/reports/query-service.ts`, `src/lib/reports/registry.ts`.

## P8-T6 — End-to-end PMO and Finance UAT in stage

**Resultado para notas de la tarea:**

Se prepararon las verificaciones de migración, workflow/UAT, segregación de funciones, baseline
versioning, atomicidad de actuals, reconciliación del cockpit y protección append-only. La ejecución
remota en stage queda como la siguiente actividad operativa y no se afirma como PASS hasta correrla
con proyectos y usuarios autorizados. Producción permanece intacta.

**Evidencia preparada:** `supabase/tests/p8_stage_verification.sql`,
`supabase/tests/p8_workflow_uat.sql`, `src/lib/financial/__tests__/p8-migration-contract.test.ts`,
`src/lib/financial/__tests__/workflow.test.ts`,
`src/lib/financial/__tests__/cockpit-integration.test.ts`.

## G8 decision

| Control | Estado |
|---|---|
| Typed workflows and SoD | READY |
| Additive baseline/change behavior | READY |
| Canonical event atomicity | READY |
| PMO/Core surfaces | READY |
| Local contract tests | PENDING EXECUTION |
| Stage UAT with authorized data | PENDING |
| Production | NOT TOUCHED |
| Deploy/push | NOT PERFORMED |

G8 no se marca como aprobado hasta completar la validación en stage. Esta retención no cambia ningún
estado de datos ni requiere publicar la aplicación.
