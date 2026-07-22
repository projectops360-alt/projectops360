# P0-T1 — Aprobación de objetivo, alcance y exclusiones

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P0 — Discovery, charter and governance baseline |
| Tarea | P0-T1 — Approve objective, scope and non-goals |
| Versión | 1.0 |
| Fecha de baseline | 2026-07-20 |
| Owner | PMO / Project Controls Lead |
| Accountable | PMO Admin / Product Owner |
| Consultados | Product Architecture; Finance / Controller; Project Manager |
| Estado del entregable | **APROBADO PARA BASELINE P0** |

## 1. Decisión aprobada

ProjectOps360° incorporará un **Project Financial Control Engine** conectado al Core existente. No será una pantalla de gastos, un sistema contable general, un Gantt financiero ni un producto paralelo.

El motor controlará la verdad financiera del proyecto desde la autorización hasta el forecast final, preservando trazabilidad hacia alcance, WBS/CBS, fases, milestones, tareas, recursos, proveedores, contratos, riesgos, cambios, decisiones y eventos operativos.

El PMO / Project Controls será el dueño principal del control presupuestario. El Project Manager consumirá información y solamente podrá contribuir, proponer o mantener información financiera cuando exista delegación explícita. La aplicación no presumirá que el PM administra el presupuesto.

## 2. Problema aprobado

ProjectOps360° ya controla alcance, ejecución, tareas, riesgos, decisiones y relaciones operativas, pero no dispone todavía de un control financiero profesional que separe y gobierne:

- fondos autorizados;
- presupuesto original aprobado;
- baseline vigente;
- compromisos contractuales;
- costos reales y accruals;
- forecast, ETC y costo final proyectado;
- contingencia, management reserve y cambios pendientes;
- flujo de caja y pagos como dimensiones distintas del costo incurrido.

Sin esta separación, una lectura basada únicamente en gasto histórico puede ocultar compromisos, trabajo ejecutado sin accrual, cambios todavía no aprobados y costos futuros necesarios para terminar.

## 3. Objetivo aprobado

Diseñar e implementar, por fases y gates de aprobación, un motor de control financiero que permita a los responsables autorizados conocer:

1. cuánto dinero fue autorizado;
2. cuál es el presupuesto original y cuál es la baseline vigente;
3. cuánto debía haberse consumido y cuánto valor se ha producido;
4. cuánto costo se ha incurrido y cuánto permanece comprometido;
5. cuánto falta por gastar y cuál es el costo probable al terminar;
6. qué riesgos, cambios, decisiones o desviaciones explican el resultado;
7. qué decisión requiere atención y quién tiene autoridad para tomarla.

El resultado deberá ser auditable, versionado, explicable y compatible con el Canonical Source of Truth, Event Ledger, Workboard, Living Graph, Process Mining y los controles existentes de ProjectOps360°.

## 4. Alcance funcional aprobado

### 4.1 Verdades financieras

- Funding.
- Original Budget.
- Current Baseline.
- Commitments.
- Actual Cost y Accruals.
- Forecast, ETC y EAC.
- Contingency Reserve y Management Reserve.
- Pending, Approved y Rejected Changes.
- Cash Flow y Payments como dimensiones separadas del reconocimiento de costo.

### 4.2 Estructura y trazabilidad

- Cost Breakdown Structure relacionada con WBS y estructura de proyecto.
- Trazabilidad a proyecto, fase, milestone, tarea y subtarea cuando aplique.
- Códigos de costo, categorías, períodos financieros, monedas y tasas de conversión.
- Recursos, equipos, materiales, proveedores, contratos, PO y departamentos.
- Riesgos, cambios, decisiones, supuestos, fuentes y evidencia.
- Versiones, estado de aprobación, procedencia, usuario y fecha efectiva.

### 4.3 Ciclo de control

- Estimación y Basis of Estimate.
- Revisión, aprobación y establecimiento de baseline.
- Captura y reconciliación de compromisos, actuals, accruals y pagos.
- Forecast periódico y escenarios autorizados.
- Control formal de cambios y reservas.
- Cierre financiero, lecciones y datos históricos confiables.

### 4.4 Analítica autorizada

- BAC, PV, EV, AC, CPI, SPI, CV, EAC, ETC, VAC y TCPI cuando existan datos válidos.
- Burn Rate, Remaining Funds y Cost Exposure.
- Variaciones explicadas por ejecución, riesgo, cambio, contrato y decisión.
- Forecast determinístico y probabilístico únicamente después de cumplir los gates de calidad y suficiencia histórica.

### 4.5 Integración con el Core

- Reutilizar la identidad de proyecto y sus estructuras existentes.
- Integrar Workboard, Living Graph, Process Mining, riesgos, cambios, decisiones, recursos y eventos.
- Mantener una experiencia financiera dentro del proyecto, no una aplicación aislada.
- Extender la experiencia actual de presupuesto mediante compatibilidad y transición aprobada; no reemplazarla de forma abrupta.

### 4.6 Adaptación por framework

El núcleo será universal y las reglas especializadas se implementarán mediante adaptadores configurables para Software, SAP, Construction/Data Center, Oil & Gas, Process Industries y General.

AACE 18R-97 se utilizará únicamente como referencia para el adaptador de industrias de proceso. La clase del estimado dependerá de la madurez y calidad de los entregables de definición; no será una regla universal ni una garantía fija de precisión.

## 5. Fronteras de autoridad aprobadas

| Verdad o proceso | Autoridad principal | Participación del PM |
|---|---|---|
| Funding | Sponsor / Steering Committee | Consultar y solicitar |
| Original Budget | PMO / Project Controls | Consultar y contribuir si es requerido |
| Current Baseline | PMO / Project Controls | Proponer cambios solamente |
| Commitments | PMO con Procurement / Contract Management | Consultar y solicitar |
| Actual Cost y Accruals | Finance / Controller | Consultar y reportar discrepancias |
| Forecast y ETC | PMO / Project Controls | Contribuir únicamente si fue delegado |
| Contingency y Management Reserve | Sponsor / PMO según umbrales | Solicitar |
| Payments y Cash Flow | Finance / Treasury | Consultar |

Ningún rol podrá modificar silenciosamente el Original Budget o la Current Baseline. Toda modificación deberá producir una versión y un evento de auditoría con justificación, impacto, solicitante, aprobadores, fecha efectiva y evidencia.

## 6. Exclusiones permanentes

El proyecto no autoriza:

- convertir ProjectOps360° en ERP, General Ledger, Accounts Payable, nómina o sistema bancario;
- duplicar la fuente contable de Finance o la fuente contractual de Procurement;
- crear un segundo Gantt, un segundo proyecto o un módulo financiero separado del Core;
- tratar el gasto histórico como forecast final;
- permitir cambios silenciosos o destructivos sobre presupuestos y baselines aprobados;
- asumir que todos los Project Managers administran presupuesto;
- permitir que Isabella apruebe, contabilice, libere reservas, cambie baselines o altere ledgers;
- aplicar AACE 18R-97 universalmente a software u otras industrias fuera de su alcance;
- publicar accuracy ranges, probabilidades o recomendaciones como hechos sin evidencia y calibración;
- inventar fechas, costos, esfuerzo, productividad, baselines o resultados históricos.

## 7. Exclusiones temporales hasta el gate G6

Antes de aprobar la arquitectura en G6 no se autoriza:

- escribir código de producto para el motor financiero;
- crear o ejecutar migraciones de base de datos;
- crear tablas, APIs, Server Actions, integraciones o componentes UI;
- modificar la pantalla de presupuesto existente;
- materializar KPIs o forecasts;
- conectar Isabella a operaciones financieras;
- desplegar cambios de esta iniciativa a staging o producción.

Las fases P7-P9 permanecerán deferred hasta que G6 apruebe contratos, autoridad, seguridad, integración, trazabilidad, compatibilidad y estrategia de migración.

## 8. Límites de fuentes de verdad

- **ProjectOps360°:** baseline financiera del proyecto, forecast, relaciones con ejecución, cambios, riesgos, decisiones y trazabilidad de aprobación.
- **Finance / ERP:** actuals contables, accruals oficiales, pagos, período financiero y reconciliación contable.
- **Procurement / Contract Management:** contratos, órdenes de compra, cambios contractuales y compromisos.
- **Sponsor / Steering:** funding y autorizaciones según umbrales.
- **PMO / Project Controls:** gobierno del presupuesto, baseline, forecast, reservas operadas bajo autoridad y reportes de control.

La arquitectura deberá definir contratos de integración e idempotencia para evitar ledgers paralelos o doble contabilización.

## 9. Criterios de éxito del alcance

El alcance será exitoso cuando:

- las verdades financieras permanezcan separadas y reconciliables;
- cada importe tenga moneda, período, versión, estado, procedencia y autoridad;
- el presupuesto pueda rastrearse hacia la estructura y ejecución del proyecto;
- PMO pueda gobernar y el PM tenga acceso acorde con delegación explícita;
- cambios, reservas y forecasts tengan aprobación y auditoría;
- Isabella se limite a recomendar, explicar y simular;
- no exista un producto financiero paralelo al Core;
- ninguna capacidad predictiva se habilite sin datos y validación suficientes.

## 10. Criterios fuera de esta tarea

P0-T1 no decide todavía:

- modelo físico de datos;
- nombres definitivos de tablas o eventos;
- fórmulas técnicas y reglas de materialización;
- interfaces, navegación o diseño visual;
- proveedores de integración;
- fechas, duración, capacidad o costo de implementación;
- estrategia detallada de migración y compatibilidad.

Estas decisiones pertenecen a tareas posteriores y no deben inferirse como aprobadas por este documento.

## 11. Registro de decisiones

| ID | Decisión | Estado |
|---|---|---|
| P0-T1-D1 | La iniciativa es un Project Financial Control Engine integrado al Core. | Aprobada |
| P0-T1-D2 | PMO / Project Controls es el dueño principal del control presupuestario. | Aprobada |
| P0-T1-D3 | El PM participa únicamente según responsabilidad y delegación explícita. | Aprobada |
| P0-T1-D4 | Finance, Procurement y Sponsor conservan sus fuentes y autoridades propias. | Aprobada |
| P0-T1-D5 | Isabella solamente recomienda, explica y simula. | Aprobada |
| P0-T1-D6 | La implementación permanece bloqueada hasta aprobar G6. | Aprobada |
| P0-T1-D7 | AACE 18R-97 será un adaptador de Process Industries, no una regla universal. | Aprobada |

## 12. Matriz de aceptación P0-T1

| Verificación | Resultado | Evidencia |
|---|---|---|
| El problema está definido | PASS | Sección 2 |
| El objetivo es explícito y verificable | PASS | Sección 3 |
| El alcance define control financiero profesional | PASS | Sección 4 |
| Se integra al Core y no crea un producto paralelo | PASS | Sección 4.5 |
| PMO es dueño principal y el PM depende de delegación | PASS | Sección 5 |
| Las fuentes de verdad externas están delimitadas | PASS | Sección 8 |
| Isabella carece de autoridad financiera | PASS | Secciones 5, 6 y 9 |
| Los non-goals permanentes y temporales son explícitos | PASS | Secciones 6 y 7 |
| No se autorizó implementación antes de G6 | PASS | Sección 7 |
| Cumple el criterio original de aceptación | **PASS** | Define un financial control engine conectado al Core, no una expense screen ni un producto de planificación paralelo |

## 13. Aprobación y control de cambios

Este documento establece la baseline de objetivo, alcance y exclusiones de P0-T1. Cualquier ampliación, reducción o reinterpretación deberá registrarse como decisión o cambio, evaluar impacto y recibir nueva aprobación del PMO Admin / Product Owner.

La aprobación de P0-T1 no autoriza implementación técnica. Autoriza continuar con las siguientes tareas de discovery y arquitectura conforme a sus dependencias y gates.

## Referencia normativa

- AACE International, Recommended Practice 18R-97, *Cost Estimate Classification System — As Applied in Engineering, Procurement, and Construction for the Process Industries*: https://web.aacei.org/docs/default-source/toc/toc_18r-97.pdf

## Nota de cierre lista para ProjectOps360°

P0-T1 completada y aprobada. Se estableció que la iniciativa será un Project Financial Control Engine integrado al Core de ProjectOps360°, no una pantalla de gastos, un ERP, un segundo Gantt ni un producto financiero paralelo. El alcance aprobado cubre las verdades financieras, trazabilidad WBS/CBS, ciclo de estimación y baseline, compromisos, actuals, accruals, forecast, cambios, reservas, analítica y conexión con Workboard, Living Graph, Process Mining, riesgos y decisiones. PMO / Project Controls queda como dueño principal del control presupuestario; el PM participa únicamente según delegación explícita; Finance, Procurement y Sponsor conservan sus fuentes y autoridades. Isabella solo podrá recomendar, explicar y simular. Se aprobaron siete decisiones de alcance y todos los criterios de aceptación pasaron. La implementación técnica, migraciones, APIs, UI y despliegues permanecen bloqueados hasta aprobar G6. Evidencia: `Project360/Budget_Cost_Management/P0-T1_Objective_Scope_Non_Goals_Approval.md`.
