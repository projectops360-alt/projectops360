# P3-T1 — Diseño del funding authorization ledger

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P3 — Financial ledger, changes, reserves and governance |
| Tarea | P3-T1 — Design funding authorization ledger |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-21 |
| Predecesor | P2-T6 / G2 PASS |
| Owner | PMO / Project Controls Lead |
| Accountable | Sponsor / Steering Committee |
| Consultados | Finance; Product Architecture |
| Entregable | Funding authorization and release model |
| Estado | **COMPLETADO Y VALIDADO COMO BASELINE P3** |
| Efecto | Define contrato y controles; no autoriza schema, código, migraciones ni deploy |

## 1. Decisión de arquitectura

Funding será una verdad financiera canónica separada de Estimate, Original Budget, Current Baseline, Commitments, Actual Cost, Forecast, Cash Flow y Payments. El modelo registra autoridad para financiar, disponibilidad condicionada y movimientos aprobados; no infiere funding desde presupuesto, gasto, pago o saldo bancario.

El término *funding ledger* designa el subledger de dominio que conserva autorizaciones y movimientos. Su historia temporal y de aprobación se registra exclusivamente en el Canonical Event Ledger existente, `project_event_log`, mediante el Event Ingestion Service. No se crea un `funding_event_log`, approval system o financial truth paralelo.

## 2. Objetos canónicos

| Objeto | Propósito | Inmutabilidad |
|---|---|---|
| Funding Program | Agrupa autoridad por proyecto, sponsor, fuente y marco de decisión | Identidad estable; cambios por versión |
| Funding Authorization | Autoridad máxima aprobada para scope, moneda y periodo | Versionada; una versión aprobada no se edita |
| Funding Release | Hace disponible una porción autorizada, sujeta a condiciones | Movimiento inmutable después de posting |
| Funding Restriction | Reserva o limita uso por scope, CBS, fase, fecha o condición | Versionada y fechada |
| Funding Allocation | Asigna disponibilidad a proyecto/control account sin crear budget | Movimiento trazable |
| Funding Movement | Aumento, reducción, transferencia, suspensión, liberación o revocación | Append-only; corrección compensatoria |
| Funding Position | Proyección calculada a una fecha efectiva | Derivada; nunca entrada manual |

Cada objeto conserva `organization_id`, `project_id`, identidad/version, fuente, autoridad, effective period, moneda, policy/version, evidence, actor y referencias a portfolio, CBS/WBS/control account, change, decision y approval cuando correspondan.

## 3. Posiciones separadas

| Posición | Definición |
|---|---|
| Authorized | Límite aprobado vigente, incluyendo aumentos/reducciones aprobados |
| Released | Porción autorizada hecha disponible mediante release efectivo |
| Restricted | Porción released no utilizable por condición, retención o scope |
| Allocated | Porción released asignada a scope/control account |
| Available | Released menos restricciones vigentes y movimientos que consumen disponibilidad según policy |
| Remaining authorization | Authorized menos releases netos efectivos |
| Suspended | Disponibilidad temporalmente bloqueada sin revocar autoridad |
| Revoked | Autoridad retirada mediante decisión formal, nunca borrada |

Reglas de balance por moneda y effective period:

- `Current Authorized = Original Authorization + approved increases - approved reductions - revocations`.
- `Net Released = releases + transfers in - returns - transfers out - release reversals`.
- `Remaining Authorization = Current Authorized - Net Released`.
- `Available Released = Net Released - active restrictions - approved uses governed by the selected funding policy`.
- No se agregan monedas diferentes sin conversión y FX provenance conforme a P1-T4.
- Un valor negativo solo se permite si la policy lo define y la excepción está aprobada; por defecto se rechaza.

El consumo de funding es una clasificación gobernada. Actuals, commitments o payments pueden compararse contra disponibilidad, pero no reducen funding automáticamente sin un movimiento autorizado y reconciliable.

## 4. Lifecycle

### 4.1 Funding Authorization

`draft → submitted → approved → active → superseded | suspended | closed`

Rutas terminales alternativas: `rejected`, `withdrawn`, `revoked`. La activación exige approval vigente, effective period, scope, moneda, evidencia, expected state, idempotency key y SoD.

### 4.2 Funding Release

`draft → requested → approved → posted → partially_allocated → fully_allocated → closed`

`rejected`, `cancelled` y `reversed` son estados explícitos. Approved-not-posted no afecta posiciones. Una reversión referencia el movimiento compensado.

### 4.3 Restriction y suspensión

`proposed → approved → active → released | expired | revoked`

Una fecha de expiración no elimina evidencia. El resolver aplica la vigencia a la fecha consultada y conserva el historial.

## 5. Autoridad y segregación de funciones

| Acción | Responsible | Accountable/Approver | Restricción SoD |
|---|---|---|---|
| Preparar request/authorization | PMO / Project Controls | Sponsor / Steering | Preparer no aprueba |
| Aprobar autorización o aumento | Sponsor / Steering | Sponsor / Steering | Authority por threshold/scope |
| Preparar release | PMO | Sponsor o delegado autorizado | No autoaprobación |
| Postear movimiento aprobado | Financial poster/service account autorizado | PMO Admin | Poster no aprueba |
| Reconciliar posición | Finance / independent PMO control | Finance / Controller | Reconciler no postea su propio movimiento |
| Auditar | Audit / independent reviewer | PMO Admin | Read-only |

Platform admin no hereda autoridad financiera. Isabella puede explicar disponibilidad, detectar inconsistencias y simular escenarios, pero no solicita, aprueba, postea ni reconcilia.

## 6. Fechas, moneda y alcance

Se conservan por separado:

- decision/approval date;
- authorization effective-from/effective-to;
- release effective date;
- accounting/recorded timestamps;
- forecast period y payment date cuando se comparan;
- source currency, transaction currency y reporting currency;
- FX rate, rate type, source, date y policy version.

Una autorización futura no aumenta disponibilidad actual. Un release retroactivo requiere periodo abierto o controlled reopening. Transfers exigen misma organization, scopes permitidos, dos lados balanceados y aprobación de ambos owners cuando aplique.

## 7. Eventos y provenance

Vocabulario conceptual:

- `funding_authorization_submitted`, `funding_authorized`, `funding_authorization_rejected`;
- `funding_release_requested`, `funding_release_approved`, `funding_released`;
- `funding_restricted`, `funding_restriction_released`;
- `funding_transferred`, `funding_suspended`, `funding_revoked`;
- `funding_movement_reversed`, `funding_reconciled`.

Todos se incorporarán al registry existente y a `project_event_log`. El envelope conserva subject/source IDs, actor, authority, approval, effective period, amount/currency, policy, evidence, causation/correlation, idempotency fingerprint y compensating reference. UI y módulos financieros no escriben directamente al ledger.

## 8. Compatibilidad current→target

| Capacidad actual | Decisión target |
|---|---|
| `budget_items` | No representa Funding; conserva identidad y compatibility projections |
| Original Budget / Current Baseline | Se comparan con funding, pero no lo crean |
| `project_approval_matrix` | Base de authority/threshold; se extiende aditivamente |
| `project_raci_assignments` / team | Base de roles y scope; no se crea RACI paralelo |
| `project_event_log` | Único ledger inmutable de lifecycle y evidencia |
| Reports/Living Graph/Process Mining | Proyecciones/consumers; no owners |

No existe hoy una tabla productiva que deba reinterpretarse como Funding. Legacy labels o montos con palabra “funding” permanecen `unverified` hasta reconciliación y evidencia.

## 9. Controles mínimos

1. Stable IDs y versiones inmutables.
2. Expected-state y optimistic concurrency.
3. Idempotency key estable por comando/import.
4. Scope, authority, threshold y SoD deny-by-default.
5. Balance por moneda, effective period y movement pair.
6. Approved-not-posted no modifica posición.
7. Correcciones por reversal/adjustment, nunca rewrite.
8. Evidence obligatoria para autorización, release, restriction y revocation.
9. Tenant/project isolation y visibility para fuentes confidenciales.
10. Reconciliation reproducible a cualquier `as_of`.

## 10. Escenarios de validación

| # | Escenario | Resultado |
|---:|---|---|
| 1 | Original Budget aprobado sin funding | Funding permanece cero/unknown; no inferencia |
| 2 | Authorization USD 10M, release USD 4M | Authorized 10M; released 4M; remaining 6M |
| 3 | Release aprobado pero no posteado | No afecta posición |
| 4 | Restriction USD 1M sobre release USD 4M | Restricted 1M visible; disponibilidad conforme a policy |
| 5 | Release futuro consultado hoy | No disponible hoy |
| 6 | Retry idéntico del mismo release | Dedup; un solo movimiento/evento |
| 7 | Misma idempotency key con amount distinto | Rechazo por payload conflict |
| 8 | Sponsor reduce autorización ya liberada | Requiere devolución/restricción o excepción; no saldo imposible silencioso |
| 9 | Transfer entre monedas sin FX provenance | Deny |
| 10 | PM prepara y aprueba autorización | Deny por SoD |
| 11 | Correction intenta editar movement posteado | Deny; reversal/adjustment |
| 12 | Evidence de otra organización | Deny por isolation |

## 11. Decisiones P3-T1

| ID | Decisión | Estado |
|---|---|---|
| P3-T1-D1 | Funding permanece verdad separada de budget, commitments, actuals y cash. | Aprobada |
| P3-T1-D2 | Authorization, release, restriction, allocation y movement son objetos distintos. | Aprobada |
| P3-T1-D3 | Posiciones se calculan por movimientos efectivos, moneda y `as_of`. | Aprobada |
| P3-T1-D4 | Approved-not-posted no afecta posición. | Aprobada |
| P3-T1-D5 | Sponsor/Steering conserva autoridad; PMO prepara/controla. | Aprobada |
| P3-T1-D6 | Correcciones son compensatorias y auditables. | Aprobada |
| P3-T1-D7 | Existing governance primitives se reutilizan aditivamente. | Aprobada |
| P3-T1-D8 | `project_event_log` permanece único Canonical Event Ledger. | Aprobada |
| P3-T1-D9 | Legacy data no se promueve a funding sin evidencia. | Aprobada |
| P3-T1-D10 | Funding ledger es subledger de dominio, no event ledger paralelo. | Aprobada |

## 12. Matriz de aceptación P3-T1

| Criterio | Resultado | Evidencia |
|---|---|---|
| Authorized y released están separados | PASS | Secciones 2–3 |
| Restricted y remaining están separados | PASS | Secciones 3–4 |
| Approval y effective period son trazables | PASS | Secciones 4–7 |
| Authority y SoD están definidos | PASS | Sección 5 |
| Currency/time semantics están definidos | PASS | Sección 6 |
| Existing owners se preservan | PASS | Sección 8 |
| Criterio original de aceptación | **PASS** | Authorized, released, restricted and remaining funds are separately traceable by approval and effective period. |

## Nota de cierre lista para ProjectOps360°

P3-T1 completada y validada. Se diseñó el funding authorization subledger con objetos separados para authorization, release, restriction, allocation y movement; authorized, released, restricted, available y remaining se calculan por moneda y periodo efectivo sin inferirse desde budget, commitments, actuals o payments. Sponsor / Steering conserva la autoridad, PMO prepara y controla, Finance reconcilia y se aplica maker–checker–poster–reconciler. Approved-not-posted no altera posiciones; transfers balancean ambos lados; correcciones usan reversal/adjustment; retries usan idempotency estable. Existing governance se reutiliza y todos los lifecycle events se registrarán únicamente en `project_event_log`. Se aprobaron 10 decisiones y 12 escenarios. No se modificó código, schema, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P3-T1_Funding_Authorization_Ledger.md`.
