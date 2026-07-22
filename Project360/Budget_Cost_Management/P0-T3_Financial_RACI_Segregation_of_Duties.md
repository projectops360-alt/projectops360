# P0-T3 — RACI financiero y segregación de funciones

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P0 — Discovery, charter and governance baseline |
| Tarea | P0-T3 — Define financial RACI and segregation of duties |
| Versión | 1.0 |
| Fecha de baseline | 2026-07-20 |
| Owner | PMO / Project Controls Lead |
| Accountable | PMO Admin |
| Consultados | Sponsor; Finance / Controller; Procurement; Project Manager; Security |
| Entregable | Authority matrix by financial truth and transaction |
| Estado | **COMPLETADO Y VALIDADO COMO BASELINE DE GOBIERNO P0** |
| Efecto | Informa P0-T5, G0 y arquitectura posterior; **no autoriza implementación** |

## 1. Decisión de gobierno

ProjectOps360° gobernará las operaciones financieras mediante una combinación de:

1. **RACI por verdad financiera**, que define quién prepara, responde, aprueba, consulta y recibe información;
2. **capacidades transaccionales separadas**, que distinguen request, prepare, approve, post, reconcile y audit;
3. **delegaciones explícitas y temporales**, en especial para la participación del Project Manager;
4. **deny by default**, de modo que pertenecer a la organización, ser owner/admin técnico o poder ver Budget no concede autoridad financiera;
5. **maker–checker–poster–reconciler**, con identidades y evidencia separadas para transacciones controladas.

PMO / Project Controls es el dueño del control presupuestario y del forecast del proyecto. Finance / Controller conserva la autoridad sobre actuals, accruals, períodos y reconciliación contable. Procurement / Contract Management conserva la autoridad sobre contratos, PO y compromisos. Sponsor / Steering conserva la autoridad sobre funding, management reserve y decisiones que excedan los umbrales delegados. Treasury / AP conserva la autoridad sobre pagos y flujo de caja oficial.

El Project Manager no recibe autoridad presupuestaria por su título. Sus derechos financieros se limitan a consulta, solicitud y contribución, salvo delegación explícita, vigente y acotada.

## 2. Principios obligatorios

### 2.1 Una sola persona accountable

Cada verdad o transacción tendrá una sola función accountable dentro del alcance aplicable. Cuando cambie por umbral, el policy resolver deberá determinar una sola autoridad final antes de permitir aprobación.

### 2.2 Separación entre rol técnico y autoridad financiera

Los roles técnicos `owner`, `admin`, `member` y `viewer`, o la capacidad de administrar una organización, no equivalen a Sponsor, PMO, Controller, Procurement o Treasury. Un platform admin tampoco adquiere autoridad para aprobar o contabilizar transacciones de negocio.

### 2.3 La aprobación no es una edición

Aprobar una transacción debe generar una decisión inmutable y trazable. No puede implementarse como modificación silenciosa de un campo `status`, importe o metadata.

### 2.4 No autoaprobación

Ninguna persona puede aprobar una solicitud o preparación en la que actuó como requester, preparer, beneficiario directo o responsable del resultado, salvo un procedimiento break-glass expresamente autorizado y posteriormente revisado.

### 2.5 No concentración de las tres funciones

Ningún rol ni principal puede **request, approve y post** la misma transacción controlada. Además:

- requester y approver deben ser personas distintas;
- approver y poster deben ser personas o principals distintos;
- en funding, original budget, baseline, reserve, payment y manual actual adjustment, requester, approver y poster deben ser tres principals distintos;
- reconciler no puede reconciliar una transacción que preparó, aprobó o posteó;
- auditor es read-only y no puede operar transacciones auditadas.

### 2.6 Autoridad por alcance y tiempo

Toda autoridad debe limitarse por organización, portfolio, proyecto, verdad financiera, tipo de transacción, acción, moneda, umbral, vigencia y, cuando corresponda, cost code/WBS/CBS.

### 2.7 La automatización no aprueba

Service accounts e integraciones pueden validar técnicamente y postear una transacción previamente autorizada. No pueden solicitarla en nombre propio, cambiar su intención, elevar su importe, autoaprobarla ni liberar pagos o reservas sin decisión humana válida.

### 2.8 Isabella no tiene autoridad financiera

Isabella puede explicar, detectar, simular, recomendar y preparar borradores. Nunca puede ser Responsible, Accountable, Approver, Poster, Reconciler o payment releaser.

## 3. Catálogo de roles de negocio

| Rol | Mandato financiero | No puede por defecto |
|---|---|---|
| Sponsor / Steering Committee | Autorizar funding, management reserve y decisiones por encima de umbral | Preparar o postear la misma transacción que aprueba |
| PMO Admin | Gobernar políticas, approval matrix, autoridad y baseline dentro de umbral | Crear y aprobar su propia solicitud; obtener autoridad por ser admin técnico |
| PMO / Project Controls Lead | Dueño del control presupuestario, current baseline, forecast y reportes | Postear o reconciliar transacciones que aprueba |
| Project Controls Analyst / Cost Engineer | Preparar BOE, budget, forecast, variaciones, accrual proposals y reconciliaciones asignadas | Aprobar su propio trabajo o alterar actuals oficiales |
| Finance / Controller | Autoridad sobre actuals, accruals, período financiero y reconciliación contable | Originar gasto operativo o aprobar pagos que también libera |
| Finance Accountant / Authorized Poster | Registrar/importar actuals y accruals aprobados | Aprobar lo que postea o reconciliar su propio posting |
| Procurement / Contract Management | Autoridad sobre sourcing, contratos, PO y commitments | Aprobar su propia requisición o liberar pagos |
| Treasury / Accounts Payable | Operar payment scheduling y release autorizado | Aprobar invoice/servicio recibido y liberar el mismo pago sin segundo control |
| Project Manager | Solicitar, justificar, aportar evidencia y contribuir cuando fue delegado | Aprobar baseline, actuals, reserves, commitments o payments por ser PM |
| Cost / Workstream Owner | Confirmar alcance ejecutado, necesidad, progreso y evidencia | Aprobar o postear el efecto financiero que solicita |
| Portfolio Manager | Consultar, priorizar y escalar decisiones multi-project | Sustituir a Sponsor, PMO o Finance sin asignación formal |
| Independent Reviewer / Internal Audit | Revisar SoD, evidencia, exceptions y reconciliación | Crear, aprobar, postear o modificar la transacción auditada |
| Integration Service Account | Postear datos autorizados e idempotentes bajo contrato | Solicitar, aprobar o reinterpretar importes |
| Platform / System Administrator | Mantener identidad, configuración y disponibilidad | Obtener autoridad financiera por privilegio técnico |
| Isabella | Recomendar, explicar y simular con evidencia | Aprobar, postear, reconciliar, cambiar baseline, liberar reserva o pago |

Los títulos anteriores son funciones de negocio. Una persona puede desempeñar más de una función en proyectos pequeños, pero el policy engine debe impedir combinaciones incompatibles dentro de la misma transacción.

## 4. Leyenda RACI

- **R — Responsible:** prepara o ejecuta el trabajo requerido para producir la verdad.
- **A — Accountable:** autoridad final; aprueba y responde por la verdad dentro del alcance/umbral.
- **C — Consulted:** aporta evidencia, validación o criterio antes de la decisión.
- **I — Informed:** recibe el resultado aprobado o publicado.

RACI no reemplaza SoD. Una persona marcada R en una verdad no obtiene automáticamente capacidad de approve o post en todas sus transacciones.

## 5. RACI por verdad financiera

| Verdad / proceso | Responsible | Accountable | Consulted | Informed | Participación del PM |
|---|---|---|---|---|---|
| Funding request | PMO / Project Controls; PM o Portfolio Manager como solicitante | Sponsor / Steering | Finance; PMO Admin | Procurement; Project Team | Puede solicitar y justificar |
| Funding authorization | PMO prepara expediente | Sponsor / Steering | Finance; PMO Admin | PM; Procurement; Portfolio | C/I; nunca autoaprueba |
| Basis of Estimate / Estimate | Project Controls Analyst / Cost Engineer; estimadores; cost owners | PMO / Project Controls Lead | PM; Procurement; technical leads | Finance; Sponsor | Contribuye alcance/evidencia; puede preparar si fue delegado |
| Original Budget | Project Controls Analyst; PMO / Project Controls | PMO Admin; Sponsor si lo exige charter/umbral | Finance; Procurement; PM | Portfolio; Audit | C; no activa ni aprueba por defecto |
| Current Baseline | PMO / Project Controls | PMO Admin dentro de umbral; Sponsor / Steering por encima | Finance; Procurement; PM | Portfolio; Audit | Propone cambios; prepara solo por delegación |
| Commitments | Procurement / Contract Management; integration service para proyección | Procurement / Contract Authority | PMO / Project Controls; Finance; PM | Sponsor; cost owners | Solicita necesidad; no aprueba PO/contract por defecto |
| Actual Cost | Finance Accountant / authorized integration | Finance / Controller | PMO / Project Controls; Procurement | PM; Sponsor | Consulta y reporta discrepancias |
| Accruals | Finance Accountant con evidencia de PMO/cost owner | Finance / Controller | PMO / Project Controls; PM; Procurement | Sponsor; Treasury | Propone evidencia; no aprueba ni postea |
| Forecast / ETC / EAC | Project Controls Analyst / Cost Engineer | PMO / Project Controls Lead | PM si está delegado; Finance; Procurement; risk/change owners | Sponsor; Portfolio | C por defecto; R únicamente con delegación explícita |
| Contingency Reserve | PMO / Project Controls prepara y controla | PMO Admin dentro de umbral; Sponsor por encima | Finance; PM; risk owner | Portfolio; Audit | Puede solicitar draw; no aprueba su solicitud |
| Management Reserve | PMO prepara expediente | Sponsor / Steering | PMO Admin; Finance | PM; Portfolio; Audit | Solicita/escalada; nunca libera por defecto |
| Financial Change | PM/cost owner solicita; PMO analiza y cuantifica | PMO Admin dentro de umbral; Sponsor / Steering por encima | Finance; Procurement; affected owners | Portfolio; Audit | Puede ser requester; no aprueba su propia solicitud |
| Project Cash-flow Forecast | PMO / Project Controls; Finance/Treasury valida calendario | Finance / Treasury | Procurement; PM | Sponsor; Portfolio | Aporta fechas operativas; no publica cash oficial |
| Payments | Accounts Payable / Treasury | Finance / Controller o Treasury authority según política | Procurement; PMO; receptor del servicio | PM; Sponsor | Confirma recepción si aplica; no libera pago |
| Financial Period Close | Finance Accountant; PMO reconcilia proyecto | Finance / Controller | PMO / Project Controls; Procurement | PM; Sponsor; Audit | I/C sobre excepciones |
| Project Controls Close | PMO / Project Controls | PMO Admin | Finance; Procurement; PM | Sponsor; Audit | C; no certifica actuals contables |
| Financial Audit / Control Review | Independent Reviewer / Internal Audit | Audit / Compliance authority | Finance; PMO; Procurement; Security | Sponsor; PMO Admin | I; entrega evidencia si se solicita |

## 6. Matriz de autoridad por transacción

| Transacción controlada | Request / Prepare | Approve / Authorize | Post / Publish | Reconcile / Monitor | Regla mínima |
|---|---|---|---|---|---|
| Funding authorization | PMO / PM / Portfolio solicita; PMO prepara | Sponsor / Steering | Separate authorized PMO poster o service account | Finance + PMO reviewer | Tres principals distintos |
| Original Budget activation | Project Controls Analyst prepara | PMO Admin; Sponsor cuando policy lo requiera | Separate PMO poster/service account | Independent PMO reviewer | Preparer ≠ approver ≠ poster |
| Current Baseline activation | PMO / Project Controls prepara | PMO Admin o Sponsor según umbral | Separate PMO poster/service account | Independent PMO reviewer + Finance | Nunca edición directa de baseline activa |
| Baseline change | PM/cost owner/PMO solicita; analyst cuantifica | PMO Admin o Sponsor según impacto acumulado | Separate PMO poster/service account | PMO reviewer + Finance | Requester no aprueba; anti-splitting |
| Commitment / PO / Contract | PM/cost owner solicita; Procurement prepara | Contract authority según matrix | Procurement integration o poster separado | PMO + Finance reviewer | Buyer no aprueba su propia requisición |
| Commitment adjustment | Procurement prepara con referencia contractual | Contract authority independiente | Integration/poster separado | PMO + Finance | Debe enlazar change/contract evidence |
| Actual cost import | Finance source system prepara; service valida | Aprobación ocurre en Finance/ERP según policy | Integration service | Finance reconciler + PMO | Service account no aprueba |
| Manual actual adjustment | Finance Accountant solicita/prepara | Finance / Controller independiente | Separate Finance poster | Independent Finance reconciler + PMO | Tres principals distintos |
| Accrual | PMO/cost owner propone evidencia; Finance prepara | Finance / Controller | Separate Finance poster/service | Finance reconciler + PMO | Proposer/preparer no aprueba ni reconcilia |
| Forecast cycle | Analyst o PM delegado prepara | PMO / Project Controls Lead | Separate publisher/service | PMO Admin / portfolio review | Forecast faltante permanece unknown |
| Contingency draw | PM/PMO/risk owner solicita; PMO cuantifica | PMO Admin o Sponsor según umbral | Separate PMO poster/service | PMO reviewer + Finance | No self-approval; link obligatorio a riesgo/cambio |
| Management reserve draw | PMO solicita y prepara | Sponsor / Steering | Separate PMO poster/service | Finance + Audit/PMO reviewer | Tres principals distintos; nunca delegación implícita |
| Change approval | PM/cost owner solicita; PMO impact analysis | PMO Admin o Sponsor/Steering | Separate PMO poster/service | PMO + Finance/Procurement según impacto | Efecto acumulado determina umbral |
| Cash-flow publication | PMO prepara; Finance/Treasury valida | Finance / Treasury authority | Separate publisher/service | Finance reconciler | Cash flow no equivale a actual/payment |
| Invoice approval | Procurement/receiver valida PO y recepción | Finance/authorized business approver | AP poster | Finance reconciler | Receptor no libera pago |
| Payment release | AP prepara payment batch | Treasury/Finance approver | Separate bank releaser o controlled service | Independent Treasury/Finance reconciler | Dual control; no requester/approver/releaser único |
| Period close / lock | Finance prepara reconciliación | Finance / Controller | Separate system custodian/service locks period | Audit/independent Finance reviewer | Lock no puede borrar history |
| Reopen closed period | Finance solicita con justificación | Controller + autoridad adicional definida | Separate system custodian | Audit review obligatorio | Siempre exception de alta criticidad |

## 7. Derechos del Project Manager

### 7.1 Derechos por defecto

Con acceso vigente al proyecto y sensibilidad permitida, el PM puede:

- consultar budget, baseline publicada, forecast publicado, commitments, actuals y variaciones;
- aportar scope, schedule, progress, risk, change y evidencia operacional;
- solicitar funding, commitments, changes, accruals o reserve draws;
- reportar discrepancias de actuals o commitments;
- confirmar recepción/avance operacional cuando no implique liberar pago;
- ser Consulted o Informed en cualquier verdad apropiada.

### 7.2 Derechos únicamente por delegación

El PM puede recibir capacidad temporal para:

- preparar estimate/BOE;
- preparar o mantener forecast/ETC en cost codes específicos;
- preparar change impact;
- proponer accruals;
- preparar commitment requests;
- publicar inputs operativos después de aprobación independiente.

### 7.3 Derechos no derivados del rol PM

El PM no puede por defecto:

- aprobar funding;
- activar Original Budget o Current Baseline;
- aprobar su propia change request;
- aprobar o postear actuals/accruals;
- aprobar contratos/PO;
- liberar contingency o management reserve;
- liberar payments;
- reconciliar una transacción que solicitó o preparó;
- administrar delegaciones financieras;
- usar Isabella o una service account para evitar controles.

Un PM solamente puede ejercer una autoridad adicional si también fue asignado formalmente a otra función de negocio y la combinación supera los controles de conflicto para la transacción concreta. El título PM nunca constituye la delegación.

## 8. Contrato de delegación

Toda delegación financiera deberá contener como mínimo:

| Campo | Regla |
|---|---|
| Delegator | Principal con autoridad vigente y delegable |
| Delegate | Usuario individual; no shared account |
| Business role/capability | Acción exacta delegada: prepare, request, approve, post o reconcile |
| Scope | Organización, portfolio y/o proyecto |
| Financial truth | Estimate, budget, forecast, change, reserve, etc. |
| Transaction type | Tipo exacto de transacción permitida |
| Dimensions | Cost code/WBS/CBS, moneda y otras restricciones cuando apliquen |
| Threshold | Importe/límite acumulado o `none`; nunca ambiguo |
| Effective period | `effective_from` y `effective_to`; expiración obligatoria |
| Reason | Justificación de negocio |
| Approval | Autoridad que aprueba la delegación |
| Delegation chain | No re-delegable por defecto; chain completa si se autoriza |
| Conflict evaluation | Resultado del SoD check antes de activarse |
| Status | proposed, active, expired, revoked o rejected |
| Audit evidence | actor, timestamps, policy version y evidencia |

### 8.1 Reglas de delegación

1. La delegación no puede exceder la autoridad del delegator.
2. Approve, post y reconcile se delegan por separado; nunca como paquete universal.
3. Una delegación no elimina los conflictos de requester/approver/poster/reconciler.
4. Toda delegación expira automáticamente y puede revocarse de inmediato.
5. Cambios de proyecto, rol, empleo o conflicto de interés disparan revalidación.
6. La evaluación usa la autoridad vigente en el momento de la acción y conserva snapshot histórico.
7. Si falta scope, threshold, vigencia o approver, la delegación es inválida.
8. Las delegaciones de PM permanecen limitadas a prepare/request salvo aprobación excepcional y política explícita.

## 9. Matriz de incompatibilidades

| Capacidad A | Capacidad B incompatible en la misma transacción | Motivo |
|---|---|---|
| Request | Approve | Prohíbe autoaprobación |
| Prepare | Approve | Impone revisión independiente |
| Approve | Post | Impide que la decisión y su materialización dependan del mismo principal |
| Approve | Payment release | Evita aprobación y disposición de fondos por una sola persona |
| Post | Reconcile | Preserva reconciliación independiente |
| Contract buyer/preparer | Contract/PO approver | Control de procurement |
| Invoice receiver/validator | Payment releaser | Evita certificación y pago por el mismo actor |
| Baseline preparer | Baseline approver | Protege Original Budget y Current Baseline |
| Reserve requester | Reserve approver/poster | Protege contingency y management reserve |
| Manual actual preparer | Actual approver/poster/reconciler | Protege integridad contable |
| Financial operator | Independent auditor | Mantiene independencia de auditoría |
| Platform administrator | Business approver por privilegio técnico | Separa administración técnica de autoridad financiera |
| Isabella | Cualquier capacidad transaccional | AI no es autoridad ni principal accountable |

Los conflictos se evalúan por usuario efectivo, no solamente por nombre de rol. Dos roles distintos asignados a la misma persona no satisfacen SoD.

## 10. Umbrales y escalamiento

P0-T3 no fija importes. Cada organización/proyecto deberá definir una approval policy versionada que especifique:

- moneda base y tratamiento multimoneda;
- umbrales por verdad, transacción, impacto y riesgo;
- autoridad dentro y fuera de umbral;
- acumulación de cambios relacionados para impedir fragmentación artificial;
- tratamiento de urgencias, afiliados, conflictos de interés y transacciones excepcionales;
- SLA y escalation path;
- autoridad sustituta durante ausencia;
- fecha efectiva y política aplicable a la transacción.

Si falta una política aplicable, el resultado será **deny / escalate**, nunca aprobación implícita. Si una transacción cruza varios umbrales, prevalece la autoridad más alta.

## 11. Break-glass y equipos pequeños

La falta de personal no elimina SoD.

### 11.1 Modelo mínimo

- Las transacciones ordinarias requieren al menos requester/preparer y approver independientes.
- Approver y poster siempre serán distintos.
- Las transacciones de alta criticidad requieren tres principals distintos: requester/preparer, approver y poster.
- Si una organización no tiene tres personas elegibles, deberá incorporar un Controller, PMO Admin, Sponsor o proveedor fiduciario independiente para completar el control.

### 11.2 Break-glass

Solo se permite cuando existe riesgo operacional inmediato y no hay ruta normal disponible. Requiere:

1. reason code y evidencia;
2. alcance e importe máximos;
3. expiración corta y automática;
4. dos autorizaciones humanas independientes cuando afecte fondos, baseline, reserve o payment;
5. evento inmutable de exception;
6. revisión retrospectiva por Controller/Audit;
7. reconciliación obligatoria;
8. prohibición de usar break-glass para conveniencia o incumplimiento de SLA.

Un platform admin no puede activar break-glass financiero unilateralmente.

## 12. Evidencia y trazabilidad obligatoria

Cada transacción controlada deberá conservar:

- transaction ID y tipo;
- organization/project/portfolio scope;
- financial truth y dimensiones WBS/CBS/cost code;
- amount, currency, period/effective date;
- before/after y versión;
- requester, preparer, approver, poster y reconciler efectivos;
- business roles y technical roles al momento de la acción;
- delegation ID, si aplica;
- approval policy ID/version y threshold result;
- reason, evidence, source document y external source IDs;
- timestamps de request, approval, posting y reconciliation;
- rechazo, devolución, revocación, compensación o reopen;
- canonical event IDs y audit references;
- conflict checks ejecutados y resultado.

Los registros históricos preservarán la asignación efectiva; cambios futuros de roles no reescriben quién tenía autoridad al ejecutar una transacción pasada.

## 13. Relación con capacidades actuales de ProjectOps360°

La plataforma contiene primitives reutilizables, pero no debe confundirse su existencia con enforcement financiero:

| Primitive actual | Utilidad futura | Brecha actual |
|---|---|---|
| `organization_members.role` (`owner/admin/member/viewer`) | Acceso técnico general | No representa autoridad financiera |
| `organization_members.org_role` | Etiqueta organizacional ampliable | No demuestra policy financiero transaccional |
| `project_team_members.permission_level` | Acceso por proyecto | `project_manager/approver` es demasiado amplio para SoD financiero |
| `project_team_members.governance_role` y `authority_level` | Contexto de función | Texto genérico; no evalúa scope/threshold/conflict |
| `can_view_budget` | Control de lectura | Ver presupuesto no autoriza modificarlo |
| `can_approve_changes` | Seed de permiso | No distingue requester, approver, poster ni umbral |
| `project_raci_assignments` | Registrar R/A/C/I por entidad | No aplica incompatibilidades transaccionales |
| `project_approval_matrix` | Registrar approval area, threshold y escalation | Campos textuales; no prueba enforcement ni versionado de policy |
| Canonical Event Ledger | Trazabilidad futura | P0-T2 confirmó 0 eventos financieros productivos |
| RLS financiera actual | Scope organizacional | P0-T2 confirmó CRUD amplio a miembros, sin PMO/Finance/Procurement SoD |

La arquitectura posterior deberá reutilizar o extender estas primitives de forma aditiva y evitar un segundo sistema de roles, approval matrix o audit trail. Esta decisión de reutilización concreta pertenece a P0-T4/G6.

## 14. Escenarios de validación

| Escenario | Resultado esperado | Resultado RACI/SoD |
|---|---|---|
| PM sin delegación intenta editar forecast | Deny | PASS — PM es C por defecto |
| PM con delegación vigente prepara ETC de cost codes asignados | Allow prepare; deny approve/post | PASS |
| PM solicita baseline change y después intenta aprobarla | Deny approve | PASS — request incompatible con approve |
| Analyst prepara Original Budget, PMO Admin aprueba y service account postea | Allow | PASS — tres funciones separadas |
| PMO Admin es también org admin y crea/aprueba su propia baseline | Deny | PASS — rol técnico no elimina SoD |
| Procurement buyer prepara PO y lo aprueba | Deny approve | PASS |
| Contract authority aprueba PO preparado por buyer; integration postea commitment | Allow | PASS |
| Finance Accountant prepara y postea manual actual adjustment | Deny post si no existe poster separado | PASS |
| Finance integration postea actual aprobado en ERP y Controller/PMO reconcilian | Allow | PASS |
| Reserve requester intenta liberar la reserva | Deny | PASS |
| Treasury approver intenta preparar, aprobar y liberar el mismo pago | Deny | PASS |
| Service account intenta aprobar un importe | Deny | PASS |
| Platform admin intenta aprobar funding sin business role | Deny | PASS |
| Delegación del PM está expirada | Deny | PASS |
| Isabella recomienda reserve draw | Allow recommendation; deny transaction | PASS |
| Cambio grande se fragmenta en solicitudes pequeñas | Aggregate/escalate | PASS — anti-splitting |
| Equipo pequeño no tiene tercer principal para baseline activation | Deny/escalate a independiente | PASS |

## 15. Decisiones P0-T3

| ID | Decisión | Estado |
|---|---|---|
| P0-T3-D1 | PMO / Project Controls es dueño del control presupuestario y forecast. | Aprobada |
| P0-T3-D2 | Finance, Procurement, Sponsor y Treasury conservan sus autoridades especializadas. | Aprobada |
| P0-T3-D3 | Los derechos financieros del PM son de consulta/solicitud por defecto y de preparación solo por delegación. | Aprobada |
| P0-T3-D4 | Ningún rol o principal puede request, approve y post la misma transacción. | Aprobada |
| P0-T3-D5 | Requester ≠ approver, approver ≠ poster y poster ≠ reconciler. | Aprobada |
| P0-T3-D6 | Funding, baseline, reserve, payment y manual actual adjustment requieren tres principals distintos. | Aprobada |
| P0-T3-D7 | Roles técnicos de owner/admin no conceden autoridad financiera. | Aprobada |
| P0-T3-D8 | Delegaciones son explícitas, limitadas, versionadas, revocables y con expiración. | Aprobada |
| P0-T3-D9 | Service accounts pueden postear, pero nunca solicitar o aprobar. | Aprobada |
| P0-T3-D10 | Isabella es exclusivamente advisor/read-only para decisiones financieras. | Aprobada |
| P0-T3-D11 | Ambigüedad de policy produce deny/escalate. | Aprobada |
| P0-T3-D12 | Las primitives actuales se reutilizarán aditivamente; no se crea gobierno paralelo. | Constraint para P0-T4/G6 |

## 16. Evidencia de alineación

| Evidencia | Ubicación |
|---|---|
| Contrato, owner, accountable y aceptación P0-T3 | `Project360/ProjectOps360_Budget_Cost_Management_Workplan_v1.json:139` |
| Fronteras de autoridad aprobadas | `Project360/Budget_Cost_Management/P0-T1_Objective_Scope_Non_Goals_Approval.md:106` |
| Fuentes de verdad externas y PMO | `Project360/Budget_Cost_Management/P0-T1_Objective_Scope_Non_Goals_Approval.md:150` |
| Auditoría de seguridad/RLS financiera actual | `Project360/Budget_Cost_Management/P0-T2_Current_Financial_Capability_Production_Data_Paths_Audit.md:275` |
| Project team roles y budget/change permissions | `supabase/migrations/20260723000000_team_architecture.sql:68` |
| RACI assignments existentes | `supabase/migrations/20260723000000_team_architecture.sql:104` |
| Charter governance roles | `supabase/migrations/20260720000000_project_charter.sql:86` |
| Approval matrix existente | `supabase/migrations/20260720000000_project_charter.sql:138` |
| Protección contra autoasignación de roles privilegiados | `supabase/migrations/20260817000000_fix_membership_guard_bootstrap.sql:21` |

## 17. Matriz de aceptación P0-T3

| Criterio | Resultado | Evidencia |
|---|---|---|
| Existe matriz de autoridad por verdad financiera | PASS | Sección 5 |
| Existe matriz de autoridad por transacción | PASS | Sección 6 |
| PMO ownership es explícito | PASS | Secciones 1, 3, 5 y P0-T3-D1 |
| Derechos del PM dependen de delegación | PASS | Secciones 7 y 8 |
| Ningún rol puede request, approve y post la misma transacción | PASS | Secciones 2.5, 6, 9 y P0-T3-D4 |
| Requester y approver están separados | PASS | Secciones 2.5 y 9 |
| Approver y poster están separados | PASS | Secciones 2.5 y 9 |
| Poster y reconciler están separados | PASS | Secciones 2.5 y 9 |
| Finance, Procurement, Sponsor y Treasury conservan autoridad | PASS | Secciones 1, 3 y 5 |
| Service accounts no pueden aprobar | PASS | Secciones 2.7, 3 y 6 |
| Platform admin no hereda autoridad financiera | PASS | Secciones 2.2, 3 y 9 |
| Isabella carece de autoridad transaccional | PASS | Secciones 2.8, 3 y 14 |
| Delegación tiene scope, threshold, vigencia y evidencia | PASS | Sección 8 |
| Existe tratamiento para equipos pequeños y break-glass | PASS | Sección 11 |
| Los escenarios negativos y positivos fueron validados | PASS | Sección 14 |
| No se autorizó implementación | PASS | Control del documento y sección 18 |
| Cumple el criterio original de aceptación | **PASS** | PMO ownership explícito; PM delegation-based; request/approve/post separados |

## 18. Control de cambio y siguiente uso

P0-T3 establece la baseline de autoridad y SoD. No define todavía tablas, eventos, APIs, componentes UI, policies RLS, nombres de permisos, montos de umbral ni estrategia de migración. Esas decisiones requieren P0-T4 y las fases de arquitectura posteriores, y continúan bloqueadas hasta G6.

P0-T5 deberá utilizar este RACI para formular use cases sin asignar al PM autoridad que no posee. G0 deberá confirmar que Sponsor, PMO, Finance, Procurement y Security aceptan estas fronteras.

## Nota de cierre lista para ProjectOps360°

P0-T3 completada y validada. Se definió la matriz RACI por verdad financiera y la autoridad por transacción bajo un modelo maker–checker–poster–reconciler. PMO / Project Controls queda como dueño del control presupuestario y forecast; Finance / Controller conserva actuals, accruals y cierre contable; Procurement / Contract Management conserva contratos, PO y commitments; Sponsor / Steering conserva funding, management reserve y decisiones por encima de umbral; Treasury / AP conserva payment release y cash oficial. El PM puede consultar, solicitar y aportar evidencia por defecto, pero solo puede preparar estimate, forecast, changes, accrual proposals o commitment requests mediante delegación explícita, acotada y vigente. Se prohíbe que una misma persona o rol solicite, apruebe y postee una transacción; requester y approver, approver y poster, y poster y reconciler deben estar separados. Funding, baseline, reserve, payment y manual actual adjustments requieren tres principals distintos. Service accounts solo pueden postear datos previamente autorizados; platform admins no heredan autoridad financiera; Isabella solo recomienda, explica y simula. Se aprobaron 12 decisiones, se validaron 17 escenarios y todos los criterios de aceptación pasaron. No se modificó código, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P0-T3_Financial_RACI_Segregation_of_Duties.md`.
