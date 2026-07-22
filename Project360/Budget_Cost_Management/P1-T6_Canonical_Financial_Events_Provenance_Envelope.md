# P1-T6 — Eventos financieros canónicos y provenance envelope

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P1 — Canonical financial domain model |
| Tarea | P1-T6 — Define canonical financial events and provenance envelope |
| Versión | 1.0 |
| Fecha efectiva | 2026-07-21 |
| Predecesor | P1-T5 |
| Owner | Event Architecture |
| Accountable | Product Architecture |
| Consultados | PMO; Finance; Process Mining; Security |
| Entregable | Vocabulario financiero mapeado al Project Event Log existente |
| Estado | **COMPLETADO Y VALIDADO COMO BASELINE P1** |
| Efecto | Define event contracts; no registra eventos ni modifica el registry runtime |

## 1. Decisión de eventos

Todos los eventos financieros se incorporarán al **Canonical Event Ledger existente**, `project_event_log`, mediante el Event Ingestion Service y su registry/versioning. No se crea `financial_event_log`, budget history table, procurement ledger, audit ledger o event bus canónico alternativo.

El owner financiero conserva el estado vigente. El evento registra el hecho inmutable de que una acción ocurrió; no es otra tabla editable de saldos. Correcciones se expresan con eventos compensatorios y referencias al evento/objeto original.

## 2. Taxonomía base

| Campo | Valor/regla |
|---|---|
| `event_category` | `financial_control` para hechos P1; subdominio en payload/provenance |
| `event_type` | snake_case, pasado o acción material inequívoca, registrado/versionado |
| `event_lifecycle_class` | `BUSINESS_EVENT`, `EXTERNAL_EVENT`, `SYSTEM_EVENT` o `DERIVED_EVENT` conforme al source |
| `subject_type` | Canonical financial object type |
| `subject_id` | Canonical object/version/movement ID cuando exista |
| `case_id` | Lifecycle case estable del objeto/transacción |
| `source_module` | Gateway autorizado: financial-domain, procurement, finance-integration, etc. |

Un tipo de evento no codifica tenant, project, currency o version en su nombre; esos datos pertenecen al envelope.

## 3. Vocabulario canónico

### 3.1 Funding

- `funding_request_submitted`
- `funding_authorized`
- `funding_conditioned`
- `funding_allocation_posted`
- `funding_suspended`
- `funding_reduced`
- `funding_revoked`
- `funding_expired`
- `funding_closed`

### 3.2 Estimate / BOE

- `estimate_prepared`
- `estimate_submitted`
- `estimate_reviewed`
- `estimate_approved_for_budget_proposal`
- `estimate_rejected`
- `estimate_withdrawn`
- `estimate_superseded`

Estimate events no producen budget/funding effects sin eventos posteriores de sus owners.

### 3.3 Original Budget y Current Baseline

- `original_budget_submitted`
- `original_budget_approved`
- `original_budget_activated`
- `original_budget_activation_failed`
- `baseline_version_submitted`
- `baseline_version_approved`
- `baseline_version_activated`
- `baseline_version_superseded`
- `baseline_version_rejected`
- `baseline_version_withdrawn`
- `baseline_closed`

### 3.4 Commitments / Procurement

- `commitment_submitted`
- `commitment_approved`
- `commitment_posted`
- `commitment_amended`
- `commitment_consumption_reconciled`
- `commitment_cancelled`
- `commitment_closed`

Requisition, quote y selection usan eventos Procurement existentes/futuros de ese dominio y no se proyectan como `commitment_*` hasta cumplir el lifecycle canónico.

### 3.5 Actual Cost

- `actual_received`
- `actual_validated`
- `actual_posted`
- `actual_quarantined`
- `actual_rejected`
- `actual_reconciled`
- `actual_adjustment_posted`
- `actual_reversal_posted`
- `actual_reconciliation_reopened`

### 3.6 Accrual

- `accrual_proposed`
- `accrual_validated`
- `accrual_approved`
- `accrual_posted`
- `accrual_matched`
- `accrual_reversed`
- `accrual_rejected`
- `accrual_closed`

### 3.7 Forecast

- `forecast_cycle_opened`
- `forecast_submitted`
- `forecast_reviewed`
- `forecast_approved`
- `forecast_published`
- `forecast_superseded`
- `forecast_withdrawn`

### 3.8 Financial Change

- `financial_change_submitted`
- `financial_change_impact_assessed`
- `financial_change_approved`
- `financial_change_rejected`
- `financial_change_withdrawn`
- `financial_change_posted`
- `financial_change_implemented`
- `financial_change_reversed`
- `financial_change_closed`

### 3.9 Reserve

- `reserve_authorized`
- `reserve_movement_requested`
- `reserve_movement_approved`
- `reserve_movement_posted`
- `reserve_movement_rejected`
- `reserve_movement_returned`
- `reserve_movement_reconciled`
- `reserve_closed`

`reserve_type` distingue contingency y management reserve; no se crean tipos ambiguos como `reserve_changed`.

### 3.10 Cash Flow y Payment

- `cash_flow_submitted`
- `cash_flow_approved`
- `cash_flow_published`
- `cash_flow_superseded`
- `payment_scheduled`
- `payment_approved`
- `payment_released`
- `payment_settled`
- `payment_failed`
- `payment_returned`
- `payment_reconciled`

### 3.11 Period y reconciliación

- `financial_period_soft_closed`
- `financial_period_closed`
- `financial_period_reopen_requested`
- `financial_period_reopened`
- `financial_period_reclosed`
- `financial_reconciliation_completed`
- `financial_reconciliation_exception_opened`
- `financial_reconciliation_exception_resolved`

## 4. Mapeo al envelope existente

`project_event_log` ya ofrece los campos base necesarios. Su uso financiero queda definido así:

| Campo existente | Regla financiera |
|---|---|
| `event_id`, `global_seq`, `sequence_number` | Identidad y orden del ledger; asignados por ingestion |
| `organization_id`, `project_id`, `portfolio_id` | Scope; validados contra subject/source refs |
| `case_id` | Lifecycle case estable; no cambia entre retries/version events del mismo caso |
| `event_category/type/schema_version` | Taxonomía registrada y versionada |
| `event_importance` | Materialidad operativa, no amount ni approval |
| `event_lifecycle_class` | Business/external/system/derived distinction |
| `subject_type/id` | Owner object/version/movement afectado |
| `actor_type/id` | Principal efectivo; service/AI no se presentan como human approver |
| `occurred_at`, `recorded_at` | Business occurrence vs ledger capture |
| `source_module/entity_type/entity_id` | Gateway y source local autorizado |
| `from_state`, `to_state` | Lifecycle transition cuando aplica |
| `caused_by`, `correlation_id`, `saga_id` | Causalidad y transacción distribuida |
| `provenance` | Fuente, authority, evidence, policy e idempotency metadata |
| `confidence` | Calidad de captura/inferencia; no autorización |
| impact fields | Señal cualitativa para consumers; no truth amount |
| `payload` | Snapshot mínimo del hecho/event effect |
| `visibility`, `permission_scope` | Clasificación y acceso |
| `invalidation_tags` | Rebuild de projections/caches |
| `event_hash`, `previous_event_hash` | Cadena tamper-evident |
| `dedup_key` | Idempotency scoped por proyecto/comando/objeto |
| compensation fields | Corrección inmutable ligada al evento original |

## 5. Provenance envelope financiero

Dentro de `provenance`, los eventos financieros deberán declarar los campos aplicables:

### 5.1 Origen e idempotencia

- `command_id` / operation ID;
- `idempotency_fingerprint` calculado sobre campos lógicos;
- `source_system`, `source_environment`, `source_record_type`, `source_record_id`;
- `source_record_version` o ETag/hash;
- `ingestion_batch_id`, connector/integration version y capture method;
- `source_document_refs` y checksum cuando aplique.

### 5.2 Autoridad y policy

- requester, preparer, approver, poster/publisher y reconciler IDs efectivos;
- business roles y technical roles al momento de la acción;
- delegation ID/version/scope/expiry cuando aplique;
- approval policy ID/version, threshold amount/result y accumulated-impact result;
- period/calendar policy, FX policy y formula policy versions;
- reason code, justification y exception/break-glass refs.

### 5.3 Valor y tiempo

- canonical financial truth/object type;
- object/version/movement IDs;
- original amount/currency y converted representation refs;
- FX rate source/type/date/version;
- effective date, accounting/control/forecast/cash period IDs;
- business dates relevantes: incurred, posting, invoice, due, payment, `as_of`;
- CBS/control account/WBS mapping refs y mapping state.

### 5.4 Evidencia y calidad

- evidence/document IDs y source links autorizados;
- reconciliation ID/state y exception IDs;
- completeness, freshness y confidence states;
- prior/new version IDs;
- correlation/causation refs a risk, change, decision, contract, actual, accrual o payment.

Secrets, credentials, raw tokens, passwords y contenido no necesario de documentos están prohibidos en provenance/payload/logs.

## 6. Payload mínimo y data minimization

El payload contiene lo necesario para explicar el evento y reconstruir proyecciones autorizadas, no una copia irrestricta del owner. Como mínimo según el tipo:

- event effect y lifecycle transition;
- object/version refs;
- amount/currency summary cuando el evento cambia posición;
- scope/CBS/control refs;
- policy/approval/evidence refs;
- before/after summary material y reason.

PII, banking data, supplier confidential detail y source documents completos se almacenan en sus owners con access control; el evento conserva referencias y hashes.

## 7. Idempotencia y concurrencia

### 7.1 Dedup identity

La dedup identity mínima incluye:

`organization + project + command/operation + event_type + subject_type + logical subject/source identity`

Retries con la misma identidad y fingerprint producen el mismo resultado/evento. Reutilizar una key con payload lógico distinto produce conflicto, no overwrite ni segundo hecho silencioso.

### 7.2 Expected state

La transición declara expected owner version/from_state. Si otra operación avanzó el objeto, el comando falla como stale/conflict y no emite un success event.

### 7.3 Atomicidad

La arquitectura posterior deberá garantizar:

1. validación de scope/authority/SoD;
2. mutación/versionado del canonical owner;
3. append del evento canónico;
4. idempotency result;

como una unidad transaccional o saga con compensación demostrada. Un evento no puede afirmar que algo fue posteado si el owner write falló.

## 8. Correcciones y compensación

- `UPDATE`/`DELETE` del evento están prohibidos por el ledger.
- Un evento incorrecto se compensa mediante un tipo registrado, `is_compensating_event=true` y `compensates_event_id`.
- El owner usa reversal/adjustment/version según su lifecycle.
- El compensating event conserva reason, authority, source evidence y relación causal.
- Las projections replay ambos eventos y producen la posición vigente sin borrar historia.

## 9. Consumers y proyecciones

| Consumer | Uso permitido |
|---|---|
| Process Mining | Analizar orden, duración, rework, exceptions y handoffs desde `project_event_log` |
| Living Graph | Proyectar nodos/edges y explicar causality; nunca calcular truth dentro del renderer |
| Project Memory | Indexar decisiones/evidencia conforme a permissions |
| Reports/Command Center | Consumir resolvers; usar events para drill-through/audit, no saldo raw |
| Audit | Ver actor, authority, policy, source, evidence y cadena |
| Isabella | Explicar facts/events con provenance; read-only, sin emitir business events de aprobación |

Derived events deben estar registrados como `DERIVED_EVENT`, declarar algoritmo/policy version y nunca presentarse como human/official source fact.

## 10. Compatibility y rollout

1. Extender el event registry existente después de G6.
2. Reusar Event Ingestion Service; ningún writer directo desde UI.
3. Feature-gate financial event writers por transaction gateway.
4. Shadow-capture y reconciliar owner mutations antes de hacer consumers dependientes.
5. Backfill legacy solo como `SYNTHETIC_BACKFILL_EVENT`, con source/provenance y sin fabricar approvals.
6. Proyectar en `process_nodes/process_edges` y canonical event relationships existentes.
7. Mantener rollback deshabilitando writers/projections, no borrando ledger.

## 11. Escenarios de validación

| # | Escenario | Resultado |
|---:|---|---|
| 1 | Retry del mismo actual import | Un owner record y un evento por dedup identity |
| 2 | Misma key con amount distinto | Conflict; no overwrite ni segundo success |
| 3 | Owner write falla | No emitir `*_posted` |
| 4 | Evento intenta cruzar project scope | Deny antes del append |
| 5 | Corrección de actual posteado | Reversal/adjustment + compensating linkage; history intacta |
| 6 | UI inserta directo en `project_event_log` | Deny; solo ingestion service autorizado |
| 7 | Isabella recomienda baseline change | Puede registrar AI/recommendation event si policy lo permite; no `baseline_version_approved` |
| 8 | Backfill de budget legacy sin approval evidence | Synthetic backfill/unapproved; no activation event |
| 9 | Graph edge se elimina/rebuild | Ledger y financial owner permanecen intactos |
| 10 | Payload contiene SMTP/API secret | Reject/sanitize; secret nunca persiste |
| 11 | Concurrent baseline activations | Expected-state conflict; una sola active + event sequence coherente |
| 12 | Process Mining requiere lifecycle | Consume taxonomy registrada del ledger único |

## 12. Decisiones P1-T6

| ID | Decisión | Estado |
|---|---|---|
| P1-T6-D1 | `project_event_log` permanece como único Canonical Event Ledger. | Aprobada |
| P1-T6-D2 | Se aprueba el vocabulario de eventos por subdominio financiero. | Aprobada |
| P1-T6-D3 | Owner records mantienen estado vigente; events registran hechos inmutables. | Aprobada |
| P1-T6-D4 | Provenance conserva source, authority, policy, evidence, scope, value/time y quality. | Aprobada |
| P1-T6-D5 | Idempotency fingerprint y expected state impiden duplicate/conflicting writes. | Aprobada |
| P1-T6-D6 | Owner mutation y event append deberán ser atómicos. | Aprobada |
| P1-T6-D7 | Correcciones usan reversal/version + compensating event. | Aprobada |
| P1-T6-D8 | Graph/Reports/Isabella consumen resolvers/projections y nunca escriben truth. | Aprobada |
| P1-T6-D9 | Backfill legacy no fabrica approvals y queda synthetic/unapproved. | Aprobada |
| P1-T6-D10 | Secrets y datos sensibles innecesarios están prohibidos en event payload/provenance. | Aprobada |

## 13. Matriz de aceptación P1-T6

| Criterio | Resultado | Evidencia |
|---|---|---|
| Existe vocabulario por lifecycle financiero | PASS | Sección 3 |
| Vocabulario se mapea al envelope existente | PASS | Sección 4 |
| Actor, source, evidence y financial refs son obligatorios | PASS | Sección 5 |
| Idempotency y expected-state están definidos | PASS | Sección 7 |
| Corrections preservan immutability | PASS | Sección 8 |
| Consumers/Process Mining usan ledger único | PASS | Sección 9 |
| No se propone segundo event store | PASS | Secciones 1 y 10 |
| Criterio original de aceptación | **PASS** | Eventos inmutables, trazables e idempotentes en `project_event_log` |

## Nota de cierre lista para ProjectOps360°

P1-T6 completada y validada. Se definió el vocabulario de eventos para Funding, Estimate, Original Budget, Current Baseline, Commitments, Actual Cost, Accruals, Forecast, Financial Changes, Reserves, Cash Flow, Payments, Period Close y Reconciliation. Todos se mapean al `project_event_log` existente y al Event Ingestion Service; no se propone un segundo event store. El envelope usa actor, source, subject, scope, state transition, amount/currency/period refs, authority/SoD, policy versions, evidence, quality, causality e idempotency fingerprint. Retries idénticos deduplican y una key reutilizada con contenido lógico distinto falla; owner mutation y event append deberán ser atómicos. Correcciones usan reversal/version y compensating events, backfills legacy permanecen synthetic/unapproved, y secrets están prohibidos. Process Mining, Living Graph, Reports, Audit e Isabella consumen resolvers/projections del ledger único. Se aprobaron 10 decisiones y 12 escenarios. No se modificó código, schema, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P1-T6_Canonical_Financial_Events_Provenance_Envelope.md`.
