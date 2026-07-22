# P0-T5 — Casos de uso PMO representativos y preguntas de control

## Control del documento

| Campo | Valor |
|---|---|
| Proyecto | ProjectOps360° Budget & Cost Management Engine |
| Fase | P0 — Discovery, charter and governance baseline |
| Tarea | P0-T5 — Define representative PMO use cases and control questions |
| Versión | 1.0 |
| Fecha de baseline | 2026-07-21 |
| Owner | PMO / Project Controls Lead |
| Accountable | PMO Admin |
| Consultados | Portfolio Manager; Finance; Project Manager; Sponsor |
| Predecesores | P0-T3; P0-T4 |
| Entregable | Prioritized use-case catalog for project and portfolio financial control |
| Estado | **COMPLETADO Y VALIDADO COMO BASELINE FUNCIONAL P0** |
| Efecto | Informa G0 y el diseño posterior; **no autoriza código, migraciones, API, UI ni despliegue** |

## 1. Decisión funcional

El Budget & Cost Management Engine se diseñará a partir de **decisiones de control PMO**, no de pantallas, reportes aislados ni formularios. Cada caso de uso comienza con una pregunta de negocio, identifica la autoridad definida en P0-T3, consume la fuente de verdad delimitada en P0-T4 y produce evidencia trazable para una decisión humana.

El catálogo cubre dos niveles inseparables:

1. **Control de proyecto:** establecer, mantener y explicar la posición financiera de un proyecto sin mezclar autorización, baseline, obligación, costo incurrido, pago o forecast.
2. **Control de portafolio:** comparar, priorizar y escalar proyectos usando únicamente verdades reconciliadas y estados de confianza explícitos; nunca recalcular una segunda verdad financiera.

PMO / Project Controls es el usuario primario y dueño operativo del control presupuestario y forecast. El Project Manager consulta, justifica, solicita y aporta evidencia por defecto; solo prepara objetos financieros cuando existe delegación explícita, acotada y vigente. Finance, Procurement, Sponsor y Treasury conservan las autoridades aprobadas en P0-T3. Isabella puede explicar, detectar, simular, recomendar y preparar borradores, pero no aprobar, postear, reconciliar ni alterar una verdad financiera.

## 2. Principios del catálogo

1. **Pregunta antes que pantalla.** Un caso representa una decisión o control, no un módulo visual.
2. **Un owner por hecho.** Cada respuesta apunta al owner de negocio y al owner técnico definidos en P0-T3/P0-T4.
3. **No fabricar certeza.** Un valor faltante permanece `unknown`; un valor pendiente permanece `unapproved`; un dato vencido permanece `stale`; una reconciliación incompleta permanece `incomplete`.
4. **No sustituir forecast.** Actuals, commitments o baseline no se usarán como forecast implícito.
5. **No doble conteo.** Total exposure será una vista derivada gobernada que identifica solapamientos entre commitments, actuals, accruals y componentes de forecast. P1 definirá su fórmula canónica.
6. **Costo no es caja.** Costo incurrido, accrual, factura, pago y cash-flow forecast conservan semánticas y fechas distintas.
7. **Aprobación humana y SoD.** Requester, approver, poster y reconciler respetan la matriz P0-T3; una recomendación no ejecuta una transacción.
8. **Proyecto antes que rollup.** Portafolio agrega la misma verdad resuelta por proyecto; no introduce fórmulas, overrides ni estados paralelos.
9. **Evidencia temporal.** Toda respuesta material declara `as_of`, versión, período, moneda, fuente, estado de aprobación y estado de reconciliación.
10. **Core integrado.** Reports, Command Center, Living Graph, Process Mining, Project Memory e Isabella consumen el resolver común; ninguno se convierte en owner.

## 3. Modelo de prioridad

| Prioridad | Significado | Regla de entrada |
|---|---|---|
| **P1 — Gate critical** | Control mínimo sin el cual no existe una posición financiera confiable | Obligatorio para piloto y gates de readiness aplicables; requiere owner, evidencia, approval state y tratamiento de unknown |
| **P2 — Operating control** | Control PMO ampliado para cierre, reconciliación, portafolio y decisiones recurrentes | Entra después de verdades P1 y sus reconciliaciones; no puede corregir datos mediante cálculos locales |
| **P3 — Decision optimization** | Escenarios, sensibilidad y priorización avanzada | Solo después de volumen histórico, calidad y calibración suficientes; siempre con aprobación humana |

La prioridad expresa dependencia de control, no fecha, esfuerzo ni autorización de implementación. G0 aprobará el catálogo; los gates posteriores decidirán cuándo construir cada capacidad.

## 4. Contrato estándar de un caso de uso

Cada caso posterior deberá conservar estos elementos durante diseño, prueba y operación:

| Elemento | Requisito |
|---|---|
| ID y alcance | Identificador estable; proyecto o portafolio |
| Actor primario | Rol que opera el control, no necesariamente quien aprueba |
| Trigger | Evento, período, excepción o solicitud que inicia el control |
| Decisión | Decisión humana que la información debe soportar |
| Preguntas de control | Preguntas concretas que deben responderse sin ambigüedad |
| Entradas | Facts, versiones y evidencia con owner conocido |
| Reglas | Authority, SoD, vigencia, moneda, período y reconciliación |
| Salida | Posición, excepción, expediente, recomendación o decisión trazable |
| Evidencia | Fuente, `as_of`, versión, actor, aprobación, links y eventos |
| Estado honesto | Comportamiento ante `unknown`, `unapproved`, `stale`, `incomplete` o conflicto |
| No objetivo | Acción o inferencia expresamente prohibida |

## 5. Catálogo priorizado — control financiero de proyecto

### UC-P01 — Establecer y monitorear autorización de funding

| Campo | Definición |
|---|---|
| Prioridad | **P1 — Gate critical** |
| Actor primario / accountable | PMO prepara y controla; Sponsor / Steering autoriza |
| Trigger | Inicio del proyecto, cambio de autorización, condición de funding o revisión de gate |
| Decisión | ¿El proyecto tiene autoridad suficiente y vigente para comprometer y ejecutar el alcance aprobado? |
| Preguntas | ¿Cuánto fue autorizado, por quién, cuándo, en qué moneda y bajo qué condiciones? ¿Cuánto queda disponible? ¿Hay funding pendiente, condicionado, vencido o suspendido? ¿La baseline o exposición excede la autorización? |
| Entradas / owner | Funding authorization del Sponsor / Steering; baseline y exposure del dominio financiero; condiciones y evidencia del expediente |
| Salida | Posición de funding, brecha, condiciones abiertas y escalamiento requerido |
| Estado honesto | Sin autorización aprobada, funding permanece `unknown/unapproved`; jamás se infiere desde budget, actuals o pagos |
| No objetivo | Crear funding por cargar un presupuesto o recibir una factura |

### UC-P02 — Preparar y revisar Estimate / Basis of Estimate

| Campo | Definición |
|---|---|
| Prioridad | **P1 — Gate critical** |
| Actor primario / accountable | Project Controls Analyst / Cost Engineer prepara; PMO / Project Controls Lead responde |
| Trigger | Nuevo alcance, re-estimación, cambio técnico o preparación de presupuesto |
| Decisión | ¿El estimate es completo, defendible y apto para convertirse en propuesta presupuestaria? |
| Preguntas | ¿Qué alcance, WBS/CBS, cantidades, rates, materiales, supuestos, exclusiones, riesgos y fecha base soportan el estimate? ¿Qué partes carecen de evidencia? ¿Cuál es su clase/madurez cuando aplique? |
| Entradas / owner | Alcance Core; material requirements; cost library; estimadores; riesgos y supuestos; fuentes externas autorizadas |
| Salida | Estimate versionado con BOE, gaps y readiness para revisión |
| Estado honesto | Material estimate o import legacy sin aprobación sigue siendo estimate; no se promociona a funding ni baseline |
| No objetivo | Sobrescribir Original Budget o presentar precisión falsa |

### UC-P03 — Aprobar y activar Original Budget

| Campo | Definición |
|---|---|
| Prioridad | **P1 — Gate critical** |
| Actor primario / accountable | Project Controls prepara; PMO Admin y Sponsor según política aprueban |
| Trigger | Charter aprobado y estimate/BOE listo |
| Decisión | ¿Existe una versión presupuestaria inicial completa, autorizada e inmutable contra la cual medir evolución? |
| Preguntas | ¿Qué versión se propone? ¿Cuadra por WBS/CBS, moneda y período? ¿Está cubierta por funding? ¿Quién preparó, aprobó y posteó? ¿Qué excepciones siguen abiertas? |
| Entradas / owner | Estimate/BOE aprobado; funding; scope baseline; approval matrix |
| Salida | Original Budget aprobado e inmutable, con fecha efectiva y evidencia |
| Estado honesto | Carga o borrador no aprobado permanece `unapproved`; la ausencia no se reemplaza por current baseline |
| No objetivo | Editar silenciosamente el Original Budget después de activarlo |

### UC-P04 — Mantener Current Baseline versionada

| Campo | Definición |
|---|---|
| Prioridad | **P1 — Gate critical** |
| Actor primario / accountable | PMO / Project Controls prepara; PMO Admin o Sponsor aprueba según umbral |
| Trigger | Activación inicial o cambio financiero aprobado |
| Decisión | ¿Cuál es la baseline vigente y qué decisiones explican la diferencia frente al Original Budget? |
| Preguntas | ¿Qué versión está activa, desde cuándo y con qué aprobador? ¿Qué cambios aprobados incorpora? ¿Cuánto varió por WBS/CBS? ¿Está alineada con funding? ¿Existe una solicitud pendiente que aún no debe incorporarse? |
| Entradas / owner | Original Budget; change lifecycle; reserve movements; funding; approval evidence |
| Salida | Current Baseline activa, historial de versiones y bridge desde original |
| Estado honesto | Pending changes se muestran separadas; nunca se incorporan antes de aprobación |
| No objetivo | Usar un campo mutable como único historial o crear una segunda baseline en Reports |

### UC-P05 — Controlar commitments y reconciliar Procurement

| Campo | Definición |
|---|---|
| Prioridad | **P1 — Gate critical** |
| Actor primario / accountable | Procurement / Contract Management mantiene obligación; PMO controla impacto |
| Trigger | Requisition, PO, contrato, change order, cancelación o actualización de compromiso |
| Decisión | ¿Qué importe está contractualmente obligado y qué capacidad queda sin comprometer? |
| Preguntas | ¿Qué commitments están aprobados, abiertos, consumidos, cancelados o vencidos? ¿Qué contrato/PO y cambio los soporta? ¿Están vinculados a WBS/CBS y moneda correctos? ¿Existe commitment sin baseline o duplicado? |
| Entradas / owner | Procurement/contract source; procurement items evolucionados; baseline; actual links; contract evidence |
| Salida | Posición reconciliada de commitments, excepciones y necesidad de acción |
| Estado honesto | Requisition no aprobada no es commitment; dato sin referencia contractual queda `unreconciled` |
| No objetivo | Crear un módulo Procurement paralelo o contar el mismo saldo como commitment y actual |

### UC-P06 — Importar, mapear y reconciliar Actual Cost

| Campo | Definición |
|---|---|
| Prioridad | **P1 — Gate critical** |
| Actor primario / accountable | Finance/integration postea; Finance / Controller responde; PMO reconcilia proyecto |
| Trigger | Carga desde ERP, cierre periódico, ajuste o excepción de mapping |
| Decisión | ¿Qué costo fue realmente incurrido y qué parte está reconciliada al proyecto? |
| Preguntas | ¿Cuál es el sistema source, documento, período contable, transaction date, moneda y FX? ¿Qué actuals están sin WBS/CBS, duplicados, rechazados o pendientes de reconciliación? ¿Qué ajuste fue autorizado? |
| Entradas / owner | ERP/Finance; `cost_actuals` normalizado; mapping; período; FX; reconciliation evidence |
| Salida | Actual Cost reconciliado y cola de excepciones |
| Estado honesto | Registro importado no equivale a reconciliado; ausencia de actuals no significa cero si la fuente no está completa |
| No objetivo | Permitir que PMO o PM alteren actuals oficiales o que un service account apruebe |

### UC-P07 — Proponer, aprobar y revertir accruals

| Campo | Definición |
|---|---|
| Prioridad | **P1 — Gate critical** |
| Actor primario / accountable | PMO/cost owner aporta evidencia; Finance prepara; Controller aprueba |
| Trigger | Cierre de período con costo incurrido aún no contabilizado |
| Decisión | ¿Qué costo debe reconocerse como accrual, con qué evidencia y cuándo debe revertirse o reemplazarse por actual? |
| Preguntas | ¿Qué servicio/bien fue recibido? ¿Qué importe, método, período y owner lo sustentan? ¿Existe PO/commitment relacionado? ¿Cuándo se revierte? ¿El actual posterior lo reemplaza sin doble conteo? |
| Entradas / owner | Evidencia operativa; Procurement; Finance; períodos; actual matching |
| Salida | Accrual aprobado/posteado/reconciliado o excepción documentada |
| Estado honesto | Proposal no aprobada permanece separada; el cierre no inventa accrual por diferencia matemática |
| No objetivo | Confundir accrual con cash payment o permitir autoaprobación |

### UC-P08 — Ejecutar ciclo de Forecast / ETC / EAC

| Campo | Definición |
|---|---|
| Prioridad | **P1 — Gate critical** |
| Actor primario / accountable | Project Controls prepara; PMO / Project Controls Lead aprueba/publica bajo SoD |
| Trigger | Ciclo configurado, cambio material, tendencia, riesgo o solicitud de gate |
| Decisión | ¿Cuál es el costo esperado al completar y qué acciones requiere la desviación? |
| Preguntas | ¿Cuál es el `as_of`, método, horizonte, owner y nivel de confianza? ¿Qué ETC corresponde a trabajo restante? ¿Qué supuestos, riesgos, cambios y commitments influyen? ¿Qué varió frente al ciclo anterior y por qué? |
| Entradas / owner | Baseline; actuals; accruals; commitments; progreso; riesgos; cambios; inputs de cost owners |
| Salida | Forecast versionado, ETC/EAC, drivers, confidence y aprobación |
| Estado honesto | Forecast faltante permanece `unknown`; actual, baseline o commitment no lo sustituyen |
| No objetivo | Publicar proyección automática sin owner humano o borrar forecast anterior |

### UC-P09 — Determinar total cost exposure sin doble conteo

| Campo | Definición |
|---|---|
| Prioridad | **P1 — Gate critical** |
| Actor primario / accountable | PMO / Project Controls Lead |
| Trigger | Revisión de costo, gate, cambio, reserva o escalamiento |
| Decisión | ¿Cuál es la exposición financiera conocida y qué incertidumbre no está cuantificada? |
| Preguntas | ¿Qué componentes aprobados forman la exposición? ¿Qué commitments fueron consumidos por actuals? ¿Qué accruals serán reemplazados? ¿Qué ETC ya incluye obligaciones? ¿Qué rangos o unknowns permanecen? |
| Entradas / owner | Resolver común sobre baseline, commitments, actuals, accruals, forecast, cambios y reservas |
| Salida | Exposure breakdown reproducible, rango/confianza y alertas de solapamiento |
| Estado honesto | Si falta una verdad requerida, exposure se marca `incomplete/unknown`; no se fuerza un total engañoso |
| No objetivo | Congelar en P0 una fórmula que P1 debe definir o sumar todos los importes indiscriminadamente |

### UC-P10 — Gobernar financial changes

| Campo | Definición |
|---|---|
| Prioridad | **P1 — Gate critical** |
| Actor primario / accountable | PM/cost owner solicita; PMO cuantifica; PMO Admin o Sponsor aprueba según umbral |
| Trigger | Cambio de alcance, contrato, riesgo, condición o corrección aprobable |
| Decisión | ¿Debe aprobarse el cambio y cómo afecta baseline, forecast, funding, commitments, reservas y cash flow? |
| Preguntas | ¿Cuál es la causa, alcance, valor, fecha y efecto acumulado? ¿Qué alternativas existen? ¿Qué autoridad aplica? ¿Qué objetos afectados quedarán vinculados? ¿Está pendiente, aprobado, rechazado o retirado? |
| Entradas / owner | Existing governance/change record; impact analysis; affected facts; approval matrix |
| Salida | Decisión trazable y efectos posteados por separado tras aprobación |
| Estado honesto | Pending/rejected changes no modifican current baseline; su potencial exposure se etiqueta explícitamente |
| No objetivo | Cambio silencioso de amounts/status o fraccionamiento para evitar umbral |

### UC-P11 — Controlar Contingency Reserve

| Campo | Definición |
|---|---|
| Prioridad | **P1 — Gate critical** |
| Actor primario / accountable | PMO controla; PMO Admin o Sponsor aprueba draw según umbral |
| Trigger | Riesgo identificado/materializado, reestimación o solicitud de draw |
| Decisión | ¿La contingencia es suficiente y se justifica una asignación, draw, devolución o transferencia? |
| Preguntas | ¿Cuál es saldo autorizado, asignado, usado y disponible? ¿Qué riesgo/change justifica el movimiento? ¿Qué impacto tiene en baseline/forecast? ¿Quién solicitó, aprobó, posteó y revisó? |
| Entradas / owner | Reserve account; risk/change links; funding; forecast; approval policy |
| Salida | Posición de contingencia y movimiento autorizado con trazabilidad |
| Estado honesto | Una categoría legacy llamada `contingency` no demuestra autorización; movimiento sin link queda bloqueado |
| No objetivo | Permitir draw por PM o Isabella sin autoridad |

### UC-P12 — Controlar Management Reserve

| Campo | Definición |
|---|---|
| Prioridad | **P1 — Gate critical** |
| Actor primario / accountable | PMO prepara; Sponsor / Steering autoriza |
| Trigger | Unknown-unknown, decisión ejecutiva o reconfiguración autorizada |
| Decisión | ¿Debe liberarse management reserve y bajo qué condiciones de gobierno? |
| Preguntas | ¿Cuál es la autorización, saldo, restricción y autoridad? ¿Por qué no corresponde a contingency o cambio ordinario? ¿Qué funding y baseline resultan afectados? ¿Se preserva separación de funciones? |
| Entradas / owner | Sponsor authorization; reserve ledger domain; decision package; Finance consultation |
| Salida | Decisión ejecutiva y movimiento trazable o rechazo |
| Estado honesto | Sin aprobación Sponsor/Steering no existe draw; saldo no se infiere desde budget |
| No objetivo | Delegación implícita a PM, PMO técnico, admin o AI |

### UC-P13 — Proyectar cash flow y distinguir payments

| Campo | Definición |
|---|---|
| Prioridad | **P2 — Operating control** |
| Actor primario / accountable | PMO prepara calendario; Finance/Treasury valida y publica |
| Trigger | Ciclo de tesorería, funding review, cambio de fechas o nueva obligación |
| Decisión | ¿Cuándo se necesitará caja, existe brecha de liquidez y qué pagos están realizados o pendientes? |
| Preguntas | ¿Qué cash demand se espera por período y moneda? ¿Qué parte corresponde a commitments, invoices o forecast? ¿Qué pagos fueron autorizados/liberados? ¿Hay mismatch entre funding timing y cash need? |
| Entradas / owner | Cash-flow projection; payment status de Finance/Treasury; procurement schedule; forecast; funding schedule |
| Salida | Curva de cash need, brechas, payment visibility y acción recomendada |
| Estado honesto | Payment desconocido no se deduce desde actual; actual date no reemplaza payment date |
| No objetivo | Convertir ProjectOps360° en sistema AP/Treasury o conflar costo con caja |

### UC-P14 — Ejecutar cierre y reconciliación de período

| Campo | Definición |
|---|---|
| Prioridad | **P2 — Operating control** |
| Actor primario / accountable | Finance cierra contabilidad; PMO cierra control del proyecto |
| Trigger | Fin de período configurado |
| Decisión | ¿La posición del período es suficientemente completa y reconciliada para publicar control y forecast? |
| Preguntas | ¿Se recibieron todos los actuals? ¿Qué accruals faltan, revierten o hacen match? ¿Qué commitments y mappings presentan diferencias? ¿Qué período está cerrado, reabierto o pendiente? ¿Qué exceptions se aceptaron y por quién? |
| Entradas / owner | Finance period state; actuals; accruals; commitments; reconciliation queue; forecast cycle |
| Salida | Certificación separada de Finance y PMO, exceptions y snapshot `as_of` |
| Estado honesto | Cierre incompleto se publica como `incomplete`; cero no sustituye feeds faltantes |
| No objetivo | Que PMO certifique actuals contables o que Finance apruebe forecast PMO por defecto |

### UC-P15 — Preparar paquete de decisión y explicar variación

| Campo | Definición |
|---|---|
| Prioridad | **P2 — Operating control** |
| Actor primario / accountable | PMO / Project Controls; autoridad depende de la decisión solicitada |
| Trigger | Umbral de variación, gate, steering review o excepción material |
| Decisión | ¿Qué decisión se necesita, por qué, con qué opciones y antes de cuándo? |
| Preguntas | ¿Qué cambió frente a original, current baseline y forecast anterior? ¿Cuáles son los drivers controlables/no controlables? ¿Qué opciones, costo, riesgo, cash y reversibilidad tiene cada una? ¿Quién decide? |
| Entradas / owner | Resolver común; variance bridge; risks; changes; schedule/execution context; approval matrix |
| Salida | Decision package con recomendación, alternativas, evidencia y deadline |
| Estado honesto | Isabella puede redactar y explicar, pero toda inferencia se etiqueta y la decisión sigue humana |
| No objetivo | Presentar recomendación AI como aprobación o alterar datos para ajustar narrativa |

### UC-P16 — Gestionar excepciones de calidad y confianza

| Campo | Definición |
|---|---|
| Prioridad | **P1 — Gate critical** |
| Actor primario / accountable | PMO administra readiness; cada source owner corrige su hecho |
| Trigger | Dato faltante, stale, conflictivo, no reconciliado, sin mapping o sin aprobación |
| Decisión | ¿Puede usarse la posición para una decisión y quién debe resolver cada excepción? |
| Preguntas | ¿Qué fuentes están completas y vigentes? ¿Qué período, proyecto o cost code está afectado? ¿Cuál es severidad e impacto? ¿Quién es owner y fecha de resolución? ¿Debe bloquear gate, forecast o rollup? |
| Entradas / owner | Data quality signals del resolver; source metadata; reconciliation/approval states |
| Salida | Trust state, exception queue, owner y gate recommendation |
| Estado honesto | Calidad insuficiente bloquea afirmaciones concluyentes; no se rellena con cero ni con heurística oculta |
| No objetivo | Corregir el source mediante override local o esconder incompletitud en un score agregado |

## 6. Catálogo priorizado — control financiero de portafolio

### UC-F01 — Controlar asignación de funding del portafolio

| Campo | Definición |
|---|---|
| Prioridad | **P1 — Gate critical** |
| Actor primario / accountable | Portfolio Manager y PMO preparan; Sponsor / Steering decide |
| Trigger | Ciclo de capital, nuevo proyecto, cambio de autorización o brecha agregada |
| Decisión | ¿Cómo se distribuye la autoridad de funding y dónde existe sobreasignación o capacidad disponible? |
| Preguntas | ¿Qué funding está autorizado, condicionado, asignado y disponible por proyecto/programa? ¿Qué proyectos exceden autoridad? ¿Qué asignaciones compiten por la misma fuente? |
| Entradas / owner | Funding facts aprobados de cada proyecto/programa; autorizaciones Sponsor; portfolio hierarchy |
| Salida | Funding allocation map, brechas y expediente de decisión |
| Estado honesto | Proyecto sin funding confiable aparece `unknown`; no se excluye silenciosamente del total |
| No objetivo | Crear autorización portfolio mediante suma de budgets |

### UC-F02 — Consolidar baseline y forecast del portafolio

| Campo | Definición |
|---|---|
| Prioridad | **P1 — Gate critical** |
| Actor primario / accountable | Portfolio PMO / PMO Admin |
| Trigger | Ciclo portfolio, steering review o cambio material |
| Decisión | ¿Cuál es la posición baseline/forecast del portafolio y qué proyectos explican el movimiento? |
| Preguntas | ¿Qué versiones y `as_of` participan? ¿Cuánto representa original/current baseline y EAC? ¿Qué proyectos están stale, incomplete o sin forecast? ¿Qué bridge explica el cambio? |
| Entradas / owner | Resolved project facts; portfolio hierarchy; currency policy; trust states |
| Salida | Rollup reproducible con cobertura, variance bridge y excepciones |
| Estado honesto | No mezcla ciclos incompatibles sin indicarlo; forecast faltante no se reemplaza por actual |
| No objetivo | Recalcular forecast proyecto o guardar un total paralelo como nueva verdad |

### UC-F03 — Comparar commitments, actuals y exposure entre proyectos

| Campo | Definición |
|---|---|
| Prioridad | **P2 — Operating control** |
| Actor primario / accountable | Portfolio Manager / PMO Admin |
| Trigger | Revisión de desempeño, concentración o intervención |
| Decisión | ¿Dónde se concentra la obligación, el costo incurrido y la exposición, y cuáles comparaciones son confiables? |
| Preguntas | ¿Qué proyectos tienen mayor committed/uncommitted balance, actual burn o exposure? ¿La moneda/período es comparable? ¿Hay doble conteo o diferencias de reconciliación? |
| Entradas / owner | Project-level resolver; FX policy; data quality state |
| Salida | Comparación normalizada, outliers y drill-through a evidencia de proyecto |
| Estado honesto | Ranking con cobertura insuficiente se etiqueta; unknown no se trata como cero favorable |
| No objetivo | Crear métricas portfolio con fórmulas distintas a las de proyecto |

### UC-F04 — Supervisar changes y reserves del portafolio

| Campo | Definición |
|---|---|
| Prioridad | **P2 — Operating control** |
| Actor primario / accountable | Portfolio PMO; Sponsor / Steering para decisiones sobre umbral |
| Trigger | Acumulación de changes, reserve draw o concentración de riesgo |
| Decisión | ¿La tendencia de cambios y uso de reservas requiere intervención o autoridad superior? |
| Preguntas | ¿Qué changes están pending/approved/rejected? ¿Cuál es su efecto acumulado? ¿Qué contingency y management reserve se consumió? ¿Hay fraccionamiento, concentración o draws sin risk/change link? |
| Entradas / owner | Project change/reserve facts; approval thresholds; portfolio hierarchy |
| Salida | Heatmap de gobierno, escalamiento y decisión requerida |
| Estado honesto | Pending se separa de aprobado y no altera baseline portfolio |
| No objetivo | Aprobar en masa sin respetar autoridad y SoD de cada transacción |

### UC-F05 — Proyectar demanda de caja y brecha de funding

| Campo | Definición |
|---|---|
| Prioridad | **P2 — Operating control** |
| Actor primario / accountable | Portfolio PMO prepara; Finance/Treasury valida |
| Trigger | Ciclo de tesorería, restricción de capital o cambio de timing |
| Decisión | ¿Qué demanda de caja agregada se espera y dónde existe mismatch con funding disponible? |
| Preguntas | ¿Cuál es cash need por período, moneda y proyecto? ¿Qué pagos/obligaciones impulsan picos? ¿Qué funding timing cubre la demanda? ¿Qué escenarios requieren reprogramación? |
| Entradas / owner | Cash-flow forecasts publicados; funding schedules; Treasury payment data |
| Salida | Portfolio cash curve, brechas y escenarios para decisión humana |
| Estado honesto | Curva incompleta declara cobertura; actuals no se usan como proxy de pagos |
| No objetivo | Ejecutar pagos o redistribuir funding automáticamente |

### UC-F06 — Priorizar intervención y decisión ejecutiva

| Campo | Definición |
|---|---|
| Prioridad | **P2 — Operating control** |
| Actor primario / accountable | Portfolio Manager recomienda; Sponsor / Steering decide |
| Trigger | Umbral configurado, tendencia material, gate o capacidad limitada |
| Decisión | ¿Qué proyectos requieren continuar, corregir, rebaselinar, financiar, pausar o escalar? |
| Preguntas | ¿Cuál es impacto financiero, operativo, estratégico y de riesgo? ¿Qué decisión está pendiente? ¿Qué opciones y trade-offs existen? ¿La evidencia es comparable y vigente? |
| Entradas / owner | Financial resolver; execution/risk/status owners existentes; strategy metadata; decision history |
| Salida | Lista priorizada explicable, opciones y authority routing |
| Estado honesto | Recomendación separa hechos, reglas e inferencias; baja confianza impide automatización |
| No objetivo | Score opaco, decisión autónoma o segundo status engine |

### UC-F07 — Aplicar gate de calidad y readiness del portafolio

| Campo | Definición |
|---|---|
| Prioridad | **P1 — Gate critical** |
| Actor primario / accountable | Portfolio PMO / PMO Admin |
| Trigger | Cierre portfolio, steering pack, gate o publicación ejecutiva |
| Decisión | ¿La información agregada es apta para decisión y qué proyectos deben quedar exceptuados o bloqueados? |
| Preguntas | ¿Qué porcentaje tiene funding, baseline, reconciliación y forecast vigentes? ¿Qué feeds están stale? ¿Qué excepciones cambian materialmente el total? ¿Quién debe corregirlas? |
| Entradas / owner | Trust states por proyecto; source freshness; approvals; reconciliations |
| Salida | Readiness result, cobertura, excepciones y owner de remediación |
| Estado honesto | Un PASS agregado no oculta proyecto material fallido; exception acceptance requiere autoridad y evidencia |
| No objetivo | Mejorar artificialmente calidad excluyendo unknowns del denominador |

### UC-F08 — Evaluar escenarios de reasignación y sensibilidad

| Campo | Definición |
|---|---|
| Prioridad | **P3 — Decision optimization** |
| Actor primario / accountable | Portfolio Manager/PMO simula; Sponsor / Steering decide |
| Trigger | Restricción de capital, cambio estratégico o shock de forecast |
| Decisión | ¿Qué combinación de reasignación, timing o alcance ofrece un resultado aceptable bajo restricciones? |
| Preguntas | ¿Qué supuestos cambian? ¿Qué proyectos/objetivos se afectan? ¿Qué funding, cash, exposure y riesgo resultan? ¿Qué restricciones y decisiones humanas siguen vigentes? |
| Entradas / owner | Copia inmutable de facts aprobados; escenarios separados; constraints autorizadas |
| Salida | Alternativas comparables con supuestos, sensibilidad y recomendación no vinculante |
| Estado honesto | Scenario no es baseline, forecast publicado ni autorización; resultados no calibrados se etiquetan experimentales |
| No objetivo | Optimización autónoma, escritura a producción o promoción automática de escenario |

## 7. Catálogo maestro de preguntas de control

### 7.1 Funding

1. ¿Cuánto funding fue autorizado, por quién, cuándo y para qué alcance?
2. ¿Qué condiciones, expiraciones o restricciones siguen abiertas?
3. ¿Cuánto está asignado, disponible, suspendido o pendiente?
4. ¿Current Baseline, commitments o exposure exceden funding vigente?
5. ¿Qué autorización específica soporta cada cambio material?

### 7.2 Estimate, Original Budget y Current Baseline

1. ¿Qué BOE, alcance, WBS/CBS, cantidades, rates, supuestos y exclusiones soportan el estimate?
2. ¿Cuál es el Original Budget aprobado y qué lo hace inmutable?
3. ¿Cuál es la Current Baseline activa, su versión, fecha efectiva y aprobador?
4. ¿Qué bridge explica la diferencia entre Original Budget y Current Baseline?
5. ¿Qué pending changes se muestran fuera de baseline?

### 7.3 Commitments

1. ¿Qué obligación contractual está aprobada y todavía abierta?
2. ¿Qué contrato, PO o change order la origina?
3. ¿Qué parte fue consumida por actuals, cancelada o liberada?
4. ¿Qué requisitions siguen sin convertirse en commitment?
5. ¿Qué commitments carecen de mapping, evidencia o baseline?

### 7.4 Actuals y accruals

1. ¿Qué costo fue incurrido y desde qué sistema/documento procede?
2. ¿Qué período, transaction date, moneda y FX aplican?
3. ¿Qué actuals están reconciliados, duplicados, rechazados o sin mapping?
4. ¿Qué costo incurrido aún no fue contabilizado y requiere accrual?
5. ¿Qué accrual se revirtió o fue reemplazado por actual sin doble conteo?

### 7.5 Forecast / ETC / EAC

1. ¿Cuál es el `as_of`, ciclo, versión, método, owner y confidence?
2. ¿Qué trabajo restante sustenta ETC y qué EAC resulta?
3. ¿Qué drivers explican el cambio frente al forecast anterior?
4. ¿Qué riesgos, changes, commitments y ejecución están incorporados?
5. ¿Qué forecast falta y permanece explícitamente `unknown`?

### 7.6 Total cost exposure

1. ¿Qué componentes aprobados integran exposure y bajo qué definición vigente?
2. ¿Qué solapamientos fueron eliminados entre commitment, actual, accrual y ETC?
3. ¿Qué pending changes o riesgos se muestran separadamente?
4. ¿Qué parte es conocida, estimada, rango o unknown?
5. ¿La exposición excede funding, baseline, autorización o reserva disponible?

### 7.7 Changes y reserves

1. ¿Qué change está pending, approved, rejected, withdrawn o posted?
2. ¿Cuál es su impacto individual y acumulado en baseline, forecast, funding, commitments y cash?
3. ¿Qué authority threshold aplica y existe señal de fraccionamiento?
4. ¿Qué reserve account, riesgo o decisión soporta el movimiento?
5. ¿Cuánto contingency/management reserve está autorizado, asignado, usado y disponible?

### 7.8 Cash flow y payments

1. ¿Qué cash need se espera por período, moneda y fuente?
2. ¿Qué funding timing cubre o no cubre esa demanda?
3. ¿Qué importe está incurrido, facturado, aprobado para pago, liberado y pagado?
4. ¿Qué payment date es oficial y cuál es solo supuesto de forecast?
5. ¿Qué pico o brecha requiere decisión de Treasury/Sponsor?

### 7.9 Calidad, trazabilidad y decisión

1. ¿Qué dato es approved, reconciled, complete y fresh al `as_of`?
2. ¿Qué facts están `unknown`, `unapproved`, `stale`, `incomplete` o conflictivos?
3. ¿Quién es owner de la excepción y qué decisión queda bloqueada?
4. ¿Qué decisión se requiere, quién tiene autoridad y antes de cuándo?
5. ¿Qué opciones, trade-offs, evidencia y reversibilidad existen?
6. ¿Qué parte de una explicación proviene de facts, reglas deterministas o inferencia de Isabella?

### 7.10 Portafolio

1. ¿Qué proyectos concentran funding, commitments, actuals, exposure, changes, reserve use o cash demand?
2. ¿Qué versiones, períodos y monedas son realmente comparables?
3. ¿Qué proyectos no tienen forecast, reconciliación o calidad suficiente?
4. ¿Qué intervención produce mayor valor bajo restricciones explícitas?
5. ¿Qué decisión corresponde a PMO, Finance, Sponsor, Procurement o Treasury?

## 8. Cadencias y momentos de control

Las cadencias serán configurables por organización, proyecto y gate. Este baseline define el propósito, no hardcodea frecuencias universales.

| Momento | Controles representativos | Resultado esperado |
|---|---|---|
| Evento / excepción | Funding change, commitment, actual import, accrual, threshold breach, stale feed | Exception routing y evidencia inmediata |
| Revisión Project Controls | Commitments, actuals, forecast drivers, changes, reserves, quality | Action list y forecast readiness |
| Cierre de período | Actuals, accruals, reconciliación, cash, forecast cycle | Snapshot certificado y exceptions |
| Gate / Steering | Funding, baseline, exposure, decision package, reserves | Decisión humana trazable |
| Revisión de portafolio | Rollups, comparabilidad, funding/cash gaps, intervención | Portfolio decision package |

## 9. Datos y evidencia mínimos para responder

Toda respuesta material deberá incluir, cuando aplique:

- organization, portfolio/program, project y scope IDs;
- WBS/CBS/cost code y links al Core;
- business fact type y canonical object ID;
- amount, currency, FX source/date y rounding policy;
- accounting/forecast period y `as_of`;
- source system, source record y ingestion timestamp;
- version, lifecycle state, approval state y effective date;
- requester, preparer, approver, poster/publisher y reconciler;
- reconciliation status y exception IDs;
- links a funding, baseline, commitment, actual, accrual, forecast, change, reserve, risk, contract o payment cuando correspondan;
- confidence, freshness y completeness state;
- decisión, alternativas, comentarios y evidencia adjunta.

Un consumer podrá mostrar menos campos por contexto, pero deberá conservar drill-through a esta evidencia y no recalcular la verdad.

## 10. Reglas de respuesta y confianza

| Condición | Respuesta obligatoria |
|---|---|
| Fuente no disponible | `unknown` + source owner + impacto; nunca cero |
| Versión no aprobada | `unapproved` y separada de la posición oficial |
| Feed fuera de vigencia | `stale` con último `as_of`; no ocultar en total |
| Mapping/reconciliación pendiente | `incomplete/unreconciled` con exception owner |
| Fuentes en conflicto | Mostrar conflicto y bloquear afirmación única hasta resolución |
| Monedas/períodos incompatibles | No agregar sin policy de conversión/alineación trazable |
| Forecast ausente | `unknown`; jamás `forecast = actual`, baseline o commitment |
| Posible doble conteo | Bloquear exposure final y mostrar componentes en conflicto |
| Recomendación AI | Separar facts/reglas/inferencia; aprobación siempre humana |
| Portfolio incompleto | Mostrar cobertura y materialidad de ausencias, no solo total parcial |

## 11. Escenarios de validación

| # | Escenario | Resultado esperado |
|---:|---|---|
| 1 | Proyecto tiene budget cargado pero no funding authorization | Funding = `unknown/unapproved`; no inferir autorización |
| 2 | Estimate de materiales existe sin BOE aprobado | Mostrar estimate; no Original Budget ni baseline |
| 3 | Original Budget aprobado intenta editarse | Deny; crear change/version según gobierno |
| 4 | Pending change pretende alterar Current Baseline | Deny; mostrar impacto potencial separado |
| 5 | Requisition sin PO aprobada se incluye como commitment | Deny; permanece pre-commitment |
| 6 | Actual importado carece de mapping CBS | Actual `unreconciled`; exception a Finance/PMO |
| 7 | Feed de actuals no llegó y total aparece cero | Deny; estado `unknown/incomplete` |
| 8 | Accrual aprobado recibe actual correspondiente | Match/reverse sin doble conteo y con evidencia |
| 9 | Forecast no existe y consumer usa actual como fallback | Deny; forecast `unknown` |
| 10 | Forecast publicado declara método, as-of y confidence | Allow; conservar versión y approver |
| 11 | Exposure suma commitment completo más actual que ya lo consumió | Deny; resolver solapamiento antes de total final |
| 12 | Change se divide para evadir approval threshold | Escalar por impacto acumulado; deny bypass |
| 13 | PM solicita contingency draw ligado a riesgo | Allow request; approval según umbral y sin autoaprobación |
| 14 | Isabella recomienda management reserve draw | Allow recommendation; deny transaction/approval |
| 15 | Actual cost se usa como payment date | Deny; payment permanece separado |
| 16 | Cash flow muestra brecha contra funding schedule | Mostrar brecha y route a Finance/Treasury/Sponsor |
| 17 | Cierre tiene accruals pendientes materiales | Estado `incomplete`; no certificar silenciosamente |
| 18 | Decision package mezcla facts e inferencias sin etiquetas | Deny publicación hasta separar procedencia |
| 19 | PM sin delegación intenta mantener forecast | Deny; PM conserva consulta/aporte de evidencia |
| 20 | PM con delegación vigente prepara ETC acotado | Allow preparación; no hereda aprobación/publicación |
| 21 | Portfolio suma proyectos con monedas sin FX policy | Deny total comparable; mostrar breakdown |
| 22 | Portfolio reemplaza forecast faltante por baseline | Deny; cobertura y unknown explícitos |
| 23 | Proyecto material stale se excluye para lograr readiness PASS | Deny; mostrar materialidad y bloqueo |
| 24 | Portfolio scenario intenta escribir nueva baseline | Deny; scenario es aislado/no vinculante |
| 25 | Living Graph calcula un saldo distinto al resolver | Deny; graph consume la proyección canónica |
| 26 | Reports y Command Center aplican fórmulas diferentes | Deny; ambos consumen el resolver común |
| 27 | Service account postea transacción no aprobada | Deny; service account no aprueba |
| 28 | PMO altera actual oficial para cuadrar forecast | Deny; Finance conserva actual truth |

## 12. Decisiones P0-T5

| ID | Decisión | Estado |
|---|---|---|
| P0-T5-D1 | Los casos de uso se organizan alrededor de decisiones y preguntas PMO, no de pantallas. | Aprobada |
| P0-T5-D2 | El catálogo cubre control de proyecto y portafolio sobre el mismo resolver financiero. | Aprobada |
| P0-T5-D3 | PMO / Project Controls es el actor primario de budget control y forecast; el PM participa conforme a delegación P0-T3. | Aprobada |
| P0-T5-D4 | P1 es gate-critical, P2 amplía operación y P3 queda condicionado a calidad/calibración; prioridad no autoriza implementación. | Aprobada |
| P0-T5-D5 | Funding nunca se infiere desde budget, actuals, payments o forecast. | Aprobada |
| P0-T5-D6 | Forecast faltante permanece `unknown` y no tiene fallback financiero. | Aprobada |
| P0-T5-D7 | Exposure es derivado, reproducible y anti-double-count; su fórmula canónica se define en P1. | Aprobada |
| P0-T5-D8 | Cost incurred, accrual, invoice, payment y cash flow permanecen semánticamente separados. | Aprobada |
| P0-T5-D9 | Pending changes y escenarios no alteran Current Baseline ni posición oficial. | Aprobada |
| P0-T5-D10 | Contingency y Management Reserve conservan owners, umbrales y links de evidencia distintos. | Aprobada |
| P0-T5-D11 | `unknown`, `unapproved`, `stale`, `incomplete` y conflicto son estados visibles y no se convierten en cero. | Aprobada |
| P0-T5-D12 | Portfolio solo agrega project truths resueltas; no introduce una segunda verdad, fórmula o status. | Aprobada |
| P0-T5-D13 | Isabella es advisor: puede explicar/simular/recomendar, nunca aprobar, postear, reconciliar o publicar. | Aprobada |
| P0-T5-D14 | Todos los casos requieren fuente, `as_of`, versión, authority y drill-through a evidencia. | Aprobada |
| P0-T5-D15 | Este baseline no autoriza código, datos, migraciones, API, UI, staging, producción ni deploy. | Aprobada |

## 13. Trazabilidad del criterio de aceptación

| Área requerida | Casos principales | Preguntas maestras | Resultado |
|---|---|---|---|
| Funding | UC-P01; UC-F01 | 7.1 | PASS |
| Baseline | UC-P03; UC-P04; UC-F02 | 7.2 | PASS |
| Commitments | UC-P05; UC-F03 | 7.3 | PASS |
| Actuals | UC-P06; UC-P14; UC-F03 | 7.4 | PASS |
| Accruals | UC-P07; UC-P14 | 7.4 | PASS |
| Forecast | UC-P08; UC-F02 | 7.5 | PASS |
| Exposure | UC-P09; UC-F03 | 7.6 | PASS |
| Changes | UC-P10; UC-F04 | 7.7 | PASS |
| Reserves | UC-P11; UC-P12; UC-F04 | 7.7 | PASS |
| Cash flow | UC-P13; UC-F05 | 7.8 | PASS |
| Decision support | UC-P15; UC-F06; UC-F08 | 7.9; 7.10 | PASS |
| Calidad y confianza | UC-P16; UC-F07 | 7.9 | PASS |

## 14. Evidencia de alineación

| Evidencia | Referencia |
|---|---|
| Contrato, prioridad, roles y aceptación P0-T5 | `Project360/ProjectOps360_Budget_Cost_Management_Workplan_v1.json:163` |
| Objetivo, scope y non-goals aprobados | `Project360/Budget_Cost_Management/P0-T1_Objective_Scope_Non_Goals_Approval.md:19` |
| Financial truths y owners externos | `Project360/Budget_Cost_Management/P0-T1_Objective_Scope_Non_Goals_Approval.md:106` |
| Auditoría de capacidades y data paths actuales | `Project360/Budget_Cost_Management/P0-T2_Current_Financial_Capability_Production_Data_Paths_Audit.md:103` |
| Gaps y observaciones de producción | `Project360/Budget_Cost_Management/P0-T2_Current_Financial_Capability_Production_Data_Paths_Audit.md:207` |
| RACI por verdad financiera | `Project360/Budget_Cost_Management/P0-T3_Financial_RACI_Segregation_of_Duties.md:104` |
| Autoridad por transacción y SoD | `Project360/Budget_Cost_Management/P0-T3_Financial_RACI_Segregation_of_Duties.md:126` |
| Derechos y delegación del Project Manager | `Project360/Budget_Cost_Management/P0-T3_Financial_RACI_Segregation_of_Duties.md:149` |
| Ownership map por business fact | `Project360/Budget_Cost_Management/P0-T4_Source_of_Truth_Compatibility_Boundaries.md:88` |
| Current-to-target ownership map | `Project360/Budget_Cost_Management/P0-T4_Source_of_Truth_Compatibility_Boundaries.md:114` |
| Resolver común y consumers | `Project360/Budget_Cost_Management/P0-T4_Source_of_Truth_Compatibility_Boundaries.md:260` |

## 15. Matriz de aceptación P0-T5

| Criterio | Resultado | Evidencia |
|---|---|---|
| Existe catálogo priorizado | PASS | Secciones 3, 5 y 6 |
| Incluye casos de proyecto | PASS | 16 casos UC-P01–UC-P16 |
| Incluye casos de portafolio | PASS | 8 casos UC-F01–UC-F08 |
| Funding está cubierto | PASS | UC-P01; UC-F01; 7.1 |
| Baseline está cubierto | PASS | UC-P03; UC-P04; UC-F02; 7.2 |
| Commitments están cubiertos | PASS | UC-P05; UC-F03; 7.3 |
| Actuals están cubiertos | PASS | UC-P06; UC-P14; UC-F03; 7.4 |
| Accruals están cubiertos | PASS | UC-P07; UC-P14; 7.4 |
| Forecast está cubierto | PASS | UC-P08; UC-F02; 7.5 |
| Exposure está cubierto sin fijar fórmula prematura | PASS | UC-P09; P0-T5-D7 |
| Changes están cubiertos | PASS | UC-P10; UC-F04; 7.7 |
| Reserves están cubiertas | PASS | UC-P11; UC-P12; UC-F04; 7.7 |
| Cash flow está cubierto y separado de payments | PASS | UC-P13; UC-F05; 7.8 |
| Decision support está cubierto | PASS | UC-P15; UC-F06; UC-F08 |
| Authority/RACI se conserva | PASS | Secciones 1, 2 y todos los casos |
| Unknown y calidad se tratan honestamente | PASS | UC-P16; UC-F07; sección 10 |
| Portfolio no crea una segunda verdad | PASS | Sección 2; P0-T5-D12 |
| Isabella no recibe autoridad | PASS | Secciones 1, 10 y P0-T5-D13 |
| Escenarios positivos y negativos definidos | PASS | 28 escenarios en sección 11 |
| No se autorizó implementación | PASS | Control del documento y P0-T5-D15 |
| Cumple criterio original de aceptación | **PASS** | Funding, baseline, commitments, actuals, accruals, forecast, exposure, changes, reserves, cash flow y decision support cubiertos |

## 16. Control de cambio y handoff

P0-T5 fija las decisiones y preguntas que el producto debe responder; no fija todavía fórmulas canónicas, modelo físico, eventos, APIs, pantallas o políticas de umbral. P1 deberá convertir este catálogo en definiciones financieras precisas, especialmente para exposure, variance, ETC/EAC, reserves y cash-flow separation. Las fases posteriores deberán demostrar cada caso con el mismo resolver, los owners de P0-T4 y la autoridad de P0-T3.

Cualquier caso nuevo deberá indicar si es project o portfolio, reutilizar una verdad existente, declarar autoridad, evidencia, comportamiento ante unknown y criterio anti-double-count. Si necesita un nuevo owner, ledger, status engine, graph, truth o capacidad transaccional para Isabella, requiere ADR y nueva aprobación del Product Owner antes de diseño.

## Nota de cierre lista para ProjectOps360°

P0-T5 completada y validada. Se aprobó un catálogo priorizado de 24 casos de uso: 16 de control financiero de proyecto y 8 de control de portafolio. Los casos se organizan por decisiones PMO, no por pantallas, y cubren funding, estimate/BOE, Original Budget, Current Baseline, commitments, actuals, accruals, forecast/ETC/EAC, total cost exposure, changes, contingency y management reserve, cash flow, payments, cierre, calidad y decision support. P1 contiene los controles gate-critical; P2 amplía cierre, portafolio y decisiones operativas; P3 reserva escenarios avanzados para cuando existan calidad y calibración suficientes. Se fijaron preguntas maestras, evidencia mínima, estados honestos (`unknown`, `unapproved`, `stale`, `incomplete`), protección contra doble conteo y separación estricta entre costo incurrido, accrual, factura, pago y cash flow. PMO / Project Controls mantiene budget control y forecast; el PM solo prepara mediante delegación explícita; Finance, Procurement, Sponsor y Treasury conservan sus autoridades; Isabella solo explica, simula y recomienda. Portfolio agrega las mismas verdades resueltas por proyecto y no crea fórmulas, status ni financial truth paralelos. Se aprobaron 15 decisiones, se validaron 28 escenarios y todos los criterios de aceptación pasaron. No se modificó código, base de datos ni producción y no se realizó deploy. Evidencia: `Project360/Budget_Cost_Management/P0-T5_Representative_PMO_Use_Cases_Control_Questions.md`.
