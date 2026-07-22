# P9 — Pilot, production readiness and rollout / G9

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P9 — Pilot, production readiness and rollout |
| Tareas | P9-T1 a P9-T6 |
| Predecesor | G8 PASS |
| Restricción | No release, no deploy y no cambio de producción durante esta preparación |
| Estado | **CONTROLES PREPARADOS — G9 NO AUTORIZADO** |

P9 define la evidencia necesaria para liberar de forma controlada. La fase no fabrica histórico,
no convierte datos incompletos en calidad disponible y no habilita predicciones, learning ni claims
automatizados antes de cumplir volumen, integridad y calibración.

## P9-T1 — Pilot projects and real financial datasets

**Resultado para notas de la tarea:**

Se definió el contrato de dataset piloto con autorización, trazabilidad, aislamiento, clasificación
de privacidad y documentación obligatoria de historia faltante. El piloto debe usar proyectos
representativos y autorizados; los datos sintéticos se mantienen identificados y nunca se presentan
como historia real.

**Evidencia:** `src/lib/financial/release-readiness.ts` (`assessPilotDataset`).

## P9-T2 — Reconciliation and audit traceability

**Resultado para notas de la tarea:**

El gate exige reconciliar funding, baseline, commitments, actuals, accruals, payments, forecast y
reserves contra sus owners canónicos, eventos y evidencia. Las excepciones no se ocultan ni se
redondean hasta desaparecer; una excepción abierta bloquea el gate hasta documentar corrección o
aceptación formal.

**Evidencia preparada:** `supabase/tests/p9_readiness_verification.sql`,
`src/lib/financial/reconciliation.ts`.

## P9-T3 — Forecast quality, calibration and bad-learning prevention

**Resultado para notas de la tarea:**

Se implementó un guard de calidad que exige mínimo de proyectos históricos, snapshots completados,
outcomes aprobados, integridad sin fallas y cobertura calibrada para P50/P80. Con volumen insuficiente
el resultado es `blocked` y las afirmaciones predictivas permanecen `unavailable`; no se sintetiza
histórico ni se activa organizational learning automáticamente.

**Evidencia:** `src/lib/financial/release-readiness.ts` (`assessForecastQuality`),
`src/lib/financial/__tests__/release-readiness.test.ts`.

## P9-T4 — Non-functional, security, recovery and rollback validation

**Resultado para notas de la tarea:**

El release gate requiere evidencia de performance, aislamiento tenant/proyecto, backup/restore,
rollback de flags y preservación de eventos/ledger history. El rollback aprobado es apagar UI,
Isabella y writers, conservar los hechos y volver al read path compatible; nunca borrar o down-migrate
la historia financiera.

**Evidencia preparada:** `supabase/tests/p9_readiness_verification.sql`,
`Project360/Budget_Cost_Management/P6-G6_Architecture_Implementation_Readiness_Authorization.md`.

## P9-T5 — Training, procedures and support readiness

**Resultado para notas de la tarea:**

Se dejó definida la estructura de playbooks para PMO, PM, Finance, Procurement y Sponsor: autoridad,
segregación, excepciones, evidencia requerida, period close, correcciones, escalación y límites de
Isabella. Ningún rol recibe autoridad implícita por abrir la pantalla.

**Evidencia:** P6-T3/P6-T5 y el contrato de capabilities en `src/lib/financial/capabilities.ts`.

## P9-T6 — Production release and control window

**Resultado para notas de la tarea:**

El gate G9 quedó preparado como una decisión explícita que exige aprobación de Release Owner, PMO y
Product Owner, environment guard verificado, plan de activación staged, rollback probado y todos los
gates anteriores en PASS. Mientras cualquiera falte, la activación es `prohibited`; no hay deploy
automático por completar el código.

**Evidencia:** `src/lib/financial/release-readiness.ts` (`evaluateProductionReadiness`).

## G9 decision

| Control | Estado |
|---|---|
| Pilot authorization/privacy | PENDING STAGE DATA |
| Reconciliation report | PENDING STAGE UAT |
| Forecast calibration | PENDING HISTORICAL EVIDENCE |
| NFR/security/recovery | PENDING OPERATIONAL RUN |
| Role playbooks/support | PREPARED |
| Named approvals | PENDING |
| Production activation | **PROHIBITED** |
| Deploy/push | **NOT PERFORMED** |

G9 no está autorizado en esta sesión. La prueba de la tarde debe completar la evidencia pendiente en
stage; solo después se puede decidir si procede una publicación staged a producción.
