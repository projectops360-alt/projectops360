# P7 / G7 — Foundation implementation accepted in stage

**Estado:** PASS  
**Fecha:** 2026-07-22  
**Entorno validado:** Supabase `projectops360-staging` (`gcxcljfzleasrleyyyda`)  
**Producción:** no modificada  
**Publicación:** no realizada

## Resultado ejecutivo

La fundación financiera fue implementada como una extensión aditiva del Core de ProjectOps360°. No se creó un segundo ledger de eventos, motor de estados, grafo ni verdad financiera. Los hechos financieros controlados se escriben junto con su evento canónico en `project_event_log` dentro de una única transacción, con idempotencia, alcance de tenant/proyecto, evidencia y referencias de objeto.

G7 se aprueba para continuar con P8. Las superficies y escritores permanecen deshabilitados por defecto y limitados a proyectos piloto mediante feature flags.

## P7-T1 — Implement additive financial schema and compatibility layer

**Resultado para notas de la tarea:**

Se implementó y aplicó en stage un esquema financiero aditivo con periodos, versiones de estimación y BOE, baselines, funding, compromisos, actuals/accruals, pagos, cambios, reservas, snapshots, escenarios y reconciliaciones. Las tablas existentes `procurement_items` y `cost_actuals` se evolucionaron únicamente con columnas compatibles. No se eliminaron ni reemplazaron objetos existentes y no se introdujo un ledger financiero paralelo.

**Evidencia:**

- Migración: `supabase/migrations/20260858000000_financial_domain_foundation.sql`.
- 21 tablas financieras presentes en stage.
- Versiones `20260858000000` y `20260858010000` registradas como aplicadas en el historial de stage.
- La migración se ejecutó mediante el canal SQL administrado porque el historial heredado de stage contiene versiones antiguas no presentes en este worktree; no se alteraron ni marcaron esas versiones heredadas.

## P7-T2 — Implement canonical financial domain contracts and pure calculation primitives

**Resultado para notas de la tarea:**

Se implementaron contratos TypeScript para calidad financiera, EVM, escenarios determinísticos, distribuciones ponderadas, capacidades, delegaciones, segregación de funciones y reconciliación. Las primitivas son puras, versionables y devuelven estados explícitos cuando faltan datos o existen denominadores inválidos; nunca fabrican ceros, infinitos ni resultados predictivos sin base.

**Evidencia:**

- Contratos: `src/lib/financial/types.ts`.
- Cálculos: `src/lib/financial/calculations.ts`.
- Golden dataset aprobado: `Project360/Budget_Cost_Management/reference/P4_Golden_Financial_Calculations_v1.json`.
- Casos normales, EV faltante, denominadores cero, TCPI inalcanzable y P50/P80 aprobados.

## P7-T3 — Implement controlled financial event writers and object references

**Resultado para notas de la tarea:**

Se implementó un escritor server-only que normaliza y valida el evento con el gateway canónico existente y llama un RPC service-role para insertar el movimiento y anexar `project_event_log`/`project_event_objects` atómicamente. La operación exige una clave estable, fingerprint SHA-256, correspondencia de dominio/evento, parent scope y subject scope. No existe fire-and-forget para hechos financieros.

**Evidencia:**

- Escritor: `src/lib/financial/writer.server.ts`.
- RPC: `capture_financial_movement_atomic`.
- Smoke test transaccional en stage: primer write + evento PASS; retry deduplicado PASS; cardinalidad 1:1 PASS; UPDATE bloqueado PASS; transacción de prueba revertida.

## P7-T4 — Implement RBAC, RLS and approval enforcement

**Resultado para notas de la tarea:**

Se implementaron capacidades financieras explícitas, delegación acotada por proyecto/importe/fecha y controles de segregación requester–approver–poster–reconciler. AI y actores externos no pueden ejercer autoridad financiera. Las 21 tablas tienen RLS; usuarios autenticados pueden leer únicamente por membresía organizacional y acceso de proyecto, pero no escribir directamente. El RPC de captura solo puede ejecutarlo `service_role`.

**Evidencia:**

- Autorización: `src/lib/financial/authorization.ts`.
- Stage: 21/21 tablas con RLS, 21/21 legibles bajo política, 0/21 con INSERT directo para `authenticated`.
- RPC: `service_role_execute=true`; `authenticated_execute=false`.
- Pruebas negativas de cross-org, cross-project, SoD, AI y delegación fuera de límites.

## P7-T5 — Implement financial projections, reconciliations and observability

**Resultado para notas de la tarea:**

Se implementaron proyecciones SQL para funding, commitments, accruals, payments y reserves, además de primitivas de reconciliación que distinguen `reconciled`, `within_tolerance` y `exception`. Los rollups derivan exclusivamente de movimientos append-only. Los snapshots conservan versión de fórmula, calidad, limitaciones y provenance; datos incompletos permanecen explícitos.

**Evidencia:**

- Proyecciones: `financial_funding_positions`, `financial_commitment_positions`, `financial_accrual_positions`, `financial_payment_positions`, `financial_reserve_positions`.
- Reconciliación: `src/lib/financial/reconciliation.ts`.
- Cinco triggers append-only presentes en stage.
- Los 17 eventos financieros tienen semántica explícita para Milestone Flow/Process Mining; snapshots derivados se clasifican como inference, nunca prediction.

## P7-T6 — Validate foundation implementation in stage

**Resultado para notas de la tarea:**

La fundación fue validada en stage contra los criterios de G7. El environment guard confirmó staging, las migraciones y objetos se verificaron en la base remota, la captura atómica se probó dentro de una transacción reversible, y las suites de contratos, seguridad, integración y regresión pasaron. El build local completó usando la base de stage.

**Resultados:**

| Control | Resultado |
|---|---:|
| Supabase target guard | PASS — staging `gcxcljfzleasrleyyyda` |
| Tablas financieras | PASS — 21/21 |
| RLS | PASS — 21/21 |
| Escritura directa authenticated | PASS — 0/21 |
| RPC service-only | PASS |
| Append-only triggers | PASS — 5/5 |
| Captura atómica e idempotencia | PASS |
| Typecheck | PASS |
| Tests | PASS — 2,247 passed; 58 skipped intencionalmente |
| Build local | PASS — 57 páginas generadas |
| Producción | NOT TOUCHED |
| Push/deploy | NOT PERFORMED |

## Gate G7

**Decisión:** FOUNDATION IMPLEMENTATION ACCEPTED IN STAGE.

P8 queda autorizado para implementar workflows y superficies integradas al Core bajo feature flags, usando stage y sin publicar hasta completar P9.
