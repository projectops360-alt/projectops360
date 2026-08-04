# INSTRUCCIÓN DE TRABAJO — AUDITORÍA PLANTILLA SAP VS. BASE DE DATOS DE PROJECTOPS360

> **Estado:** `READY_FOR_CLAUDE`  
> **Tipo de trabajo:** auditoría técnica y funcional, *read-only*  
> **Repositorio:** `projectops360-alt/projectops360`  
> **Rama obligatoria:** `agent/template-db-audit-instructions`  
> **Rama base:** `master`  
> **Fecha de emisión:** 2026-08-03  
> **Validación contra workbook real:** 2026-08-04  
> **Prohibido:** implementar, migrar, modificar datos, crear PR, hacer merge o desplegar

## 1. Orden de ejecución

Lee este archivo completo antes de actuar. Después ejecuta la auditoría exactamente dentro del alcance aquí definido.

La jerarquía de autoridad es:

1. `CLAUDE.md` y el Product Brain vigente del repositorio.
2. Esta instrucción de auditoría.
3. Instrucciones directas posteriores de Efrain Prada que no contradigan los dos puntos anteriores.

Si el código, la base de datos, la plantilla, `CLAUDE.md` o el Product Brain se contradicen, **no corrijas nada silenciosamente**. Detén esa conclusión, registra el conflicto con evidencia y repórtalo.

## 2. Objetivo

Realizar una auditoría completa entre:

- la plantilla SAP entregada para ProjectOps360;
- el plan de integración funcional SAP;
- la plantilla de proyectos que ProjectOps360 ya utiliza;
- la estructura real y vigente de la base de datos;
- las relaciones, reglas, RLS/RBAC, servicios, importadores, pantallas y capacidades que consumen esos datos.

La auditoría debe responder, con evidencia verificable:

1. Qué información solicitada por la plantilla SAP ya existe en ProjectOps360.
2. En qué tabla, columna, relación, vista, función o configuración existe.
3. Qué campos requieren transformación o una correspondencia semántica, aunque el nombre sea distinto.
4. Qué elementos pueden resolverse mediante configuración administrable.
5. Qué elementos faltan realmente y exigirían desarrollo genérico del core.
6. Qué elementos aparecen duplicados, obsoletos, sin uso, en conflicto o con más de una fuente de verdad.
7. Si la plantilla puede importarse sin romper jerarquías, relaciones, seguridad, métricas, Living Graph o Isabella.
8. Qué debe cambiarse en una fase posterior, sin implementar esos cambios durante esta auditoría.

Esta fase termina en un diagnóstico y un plan de recomendación. **No termina en código.**

## 3. Decisiones de producto ya aprobadas

Trata estas decisiones como restricciones, no como hipótesis:

1. SAP será un **perfil o framework configurable sobre el core existente de ProjectOps360**.
2. No se creará una base de datos SAP separada.
3. No se creará un módulo SAP aislado que duplique capacidades del producto.
4. Deben reutilizarse, siempre que correspondan, los objetos canónicos, eventos, KPIs, dashboards, Process Intelligence, Living Graph e Isabella.
5. No se debe hardcodear SAP en tablas, reglas, UI, servicios ni componentes si la necesidad puede modelarse de manera genérica.
6. Fases, workstreams, gates, entregables, reglas, ponderaciones y umbrales deben poder activarse, desactivarse y modificarse por configuración cuando sea razonable.
7. El MVP no debe replicar SAP Cloud ALM.
8. El MVP no incluye write-back ni una integración bidireccional con SAP.
9. Una integración SAP futura debe concebirse inicialmente como **read-only**, protegida por feature flag y sin contaminar el modelo canónico.
10. Toda alerta, recomendación o conclusión de Isabella debe citar evidencia real.
11. Toda fórmula, score, KPI y cálculo de readiness debe ser transparente, reproducible y trazable hasta sus datos fuente.
12. No reemplaces ni rompas el Living Graph existente. Debe auditarse y extenderse de forma incremental solo en una fase posterior.
13. “Lo corregido, corregido se queda”: no reabras regresiones ni sustituyas comportamiento aprobado por componentes o lógica legacy.

## 4. Artefactos fuente obligatorios

Localiza y registra la ruta exacta, tamaño, fecha y hash de cada artefacto encontrado:

1. `ProjectOps360_Plantilla_Proyecto_SAP_v1.xlsx` o una copia equivalente cuyo nombre incluya un sufijo automático, por ejemplo `ProjectOps360_Plantilla_Proyecto_SAP_v1(1).xlsx`
2. `Plan_Integracion_Proyecto_SAP_ProjectOps360.docx`
3. La plantilla o las plantillas actuales de creación/importación de proyectos de ProjectOps360.
4. Cualquier especificación, JSON, CSV, XLSX, mapper, seed o fixture vigente relacionado con plantillas de proyecto.

La plantilla SAP debe revisarse completa. Como mínimo, valida estas hojas:

- `INICIO`
- `DATOS_PROYECTO`
- `PLAN_PROYECTO`
- `EQUIPO_RACI`
- `RIESGOS`
- `CAMBIOS`
- `HITOS_GATES`
- `PLAN_PRUEBAS`
- `PRESUPUESTO`
- `DASHBOARD`

Estas hojas son el mínimo conocido, no una autorización para ignorar otras hojas, columnas ocultas, fórmulas, validaciones, tablas, nombres definidos o relaciones que existan en el archivo real.

No declares el workbook como ausente únicamente porque el sistema operativo haya agregado `(1)`, `(2)`, `- copia` u otro sufijo al nombre. Confirma su identidad mediante estructura, nombres de hojas y hash. Registra el nombre físico exacto encontrado y úsalo como `source_file` en la evidencia.

Clasifica cada hoja antes de mapearla:

- `INICIO` es una hoja **instructiva y de control de uso**. Debe revisarse para conocer reglas de importación, pero sus textos, pasos y leyenda no son campos de datos ni deben proponerse como columnas de base de datos.
- `DATOS_PROYECTO`, `PLAN_PROYECTO`, `HITOS_GATES`, `PLAN_PRUEBAS`, `EQUIPO_RACI`, `RIESGOS` y `CAMBIOS` contienen entradas o registros de negocio.
- `PRESUPUESTO` y `DASHBOARD` contienen principalmente cálculos, agregaciones y presentación. No dupliques en base de datos un valor que deba calcularse desde fuentes canónicas.

### 4.1 Huella estructural observada del workbook validado

Usa esta huella para identificar la versión examinada y luego reproduce las validaciones; no aceptes los conteos como sustituto de volver a comprobar el archivo:

- 10 hojas: `INICIO`, `DATOS_PROYECTO`, `PLAN_PROYECTO`, `HITOS_GATES`, `PLAN_PRUEBAS`, `EQUIPO_RACI`, `RIESGOS`, `CAMBIOS`, `PRESUPUESTO` y `DASHBOARD`.
- `PLAN_PROYECTO`: 291 registros y 38 columnas de negocio.
- 291 IDs de tarea presentes y únicos; una raíz conocida (`SAP-W1-001`).
- 163 referencias de predecesora observadas.
- `PLAN_PRUEBAS`: 241 pruebas con referencia a tarea.
- `HITOS_GATES`: 77 registros con referencia a tarea.
- 1,027 fórmulas observadas en total: 873 en `PLAN_PROYECTO`, 20 en `RIESGOS`, 72 en `PRESUPUESTO` y 62 en `DASHBOARD`.
- Un gráfico observado en `DASHBOARD`.

Si cualquier conteo difiere, no fuerces el resultado para hacerlo coincidir. Registra el hash, identifica la versión y explica la diferencia.

Debes preservar literalmente en el inventario:

- nombre de hoja;
- nombre de columna;
- orden y obligatoriedad;
- tipo/formato esperado;
- fórmulas y validaciones;
- identificadores de tarea;
- identificadores padre;
- claves externas;
- valores permitidos y catálogos;
- dependencias entre hojas.

Si alguno de los dos artefactos principales no está disponible después de buscar variantes de nombre razonables, no inventes su contenido. Puedes avanzar con el inventario del repositorio y la base de datos, pero debes marcar la auditoría de columnas como `BLOCKED_SOURCE_MISSING` y no declarar cobertura completa.

## 5. Guardrails operativos

### 5.1 Permitido

- Leer archivos del repositorio y de los artefactos fuente autorizados.
- Buscar código con herramientas de solo lectura.
- Ejecutar tests o validadores que no alteren datos ni dependencias.
- Consultar catálogos de PostgreSQL/Supabase mediante `SELECT` de solo lectura, si ya existe acceso configurado y autorizado.
- Crear únicamente los archivos de resultados definidos en la sección 11, dejándolos sin commit y sin push salvo autorización posterior expresa.

### 5.2 Prohibido

- Modificar código de aplicación, componentes, APIs, configuración o tests.
- Crear o modificar migraciones.
- Ejecutar DDL o DML: `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `INSERT`, `UPDATE`, `DELETE`, `MERGE` o equivalentes.
- Ejecutar `supabase db push`, `db reset`, seeds, repairs, restores o migraciones.
- Cambiar RLS, políticas, grants, funciones, triggers, índices o datos.
- Instalar dependencias sin autorización.
- Imprimir secretos, tokens, connection strings o valores sensibles.
- Usar producción para pruebas o escrituras.
- Descartar, sobrescribir, mezclar o limpiar cambios ajenos del worktree.
- Crear commits, hacer push, abrir PR, hacer merge o desplegar.
- Corregir “de paso” cualquier hallazgo, aunque parezca obvio.

Si una herramienta intenta escribir o una consulta no puede demostrarse como read-only, no la ejecutes.

## 6. Fase 0 — Preflight y control de alcance

Antes de auditar:

1. Registra:
   - `pwd`
   - `git remote -v` sin exponer credenciales
   - `git status -sb`
   - `git branch --show-current`
   - `git rev-parse HEAD`
2. Confirma que el repositorio sea `projectops360-alt/projectops360`.
3. Confirma que la rama sea `agent/template-db-audit-instructions`.
4. Si existen cambios previos ajenos, no los modifiques ni los incluyas en los resultados. Registra el riesgo antes de continuar.
5. Lee `CLAUDE.md` completo.
6. Lee, como mínimo, las fuentes pertinentes del Product Brain:
   - `docs/product-brain/00-index.md`
   - `docs/product-brain/01-product-vision.md`
   - `docs/product-brain/10-regression-log.md`
   - `docs/product-brain/11-ai-development-rules.md`
   - `docs/product-brain/12-living-graph-strategy.md`
   - `docs/product-brain/16-isabella-ai-workforce.md`
   - `docs/product-brain/18-execution-status-engine.md`
   - `docs/product-brain/30-product-decision-log.md`
   - `docs/product-brain/32-product-ux-contracts.md`
   - `docs/product-brain/33-environment-release-operations.md`
   - `docs/product-brain/adrs/ADR-000-product-intelligence-source-of-truth.md`
   - `docs/product-brain/isabella-evidence-contract.md`
   - `docs/product-brain/isabella-process-intelligence-architecture.md`
   - `docs/product-brain/task-execution-map.md`
   - `docs/product-brain/financial-control-rollout.md`
7. Registra cualquier archivo requerido que no exista; no sustituyas su contenido con memoria o suposiciones.
8. Identifica qué entorno o fuente representa el esquema real auditado. No confundas staging con producción.

## 7. Fase 1 — Inventario de la implementación vigente

Localiza y documenta, sin modificar:

1. Migraciones y ledger de migraciones aplicadas.
2. Tipos generados de base de datos.
3. Tablas, vistas, materialized views y relaciones.
4. PK, FK, claves únicas, checks, enums, defaults, nullability e índices.
5. Funciones, triggers, RPCs y jobs relacionados.
6. RLS, políticas, grants y límites por organización, PMO, proyecto y usuario.
7. Soft-delete, auditoría, versionado y trazabilidad temporal.
8. Objetos de proyectos, tareas, subtareas, dependencias, recursos y miembros.
9. Riesgos, issues, cambios, decisiones, hitos, gates, aprobaciones, pruebas y defectos.
10. Presupuesto, costes, horas reales, EVM, BAC, EV, PV, AC, CPI, SPI, EAC y VAC donde existan.
11. Sistema de plantillas, importadores, exportadores, mappers, validadores, seeds y fixtures.
12. Servicios/API que escriben o leen cada objeto.
13. Pantallas que crean, editan, muestran o calculan cada dato.
14. Event log, proyecciones, Process Intelligence y reglas del Living Graph.
15. Fuentes de datos y contratos de evidencia utilizados por Isabella.

No aceptes la existencia de una tabla como prueba de capacidad completa. Verifica la cadena completa cuando aplique:

`plantilla → validación → importador/API → objeto canónico → relaciones/RLS → lectura/UI → eventos/proyección → Living Graph/Isabella`

## 8. Fase 2 — Auditoría de la plantilla SAP

### 8.1 Modelo SAP Activate

Contrasta explícitamente las seis fases canónicas de SAP Activate:

- Discover
- Prepare
- Explore
- Realize
- Deploy
- Run

El workbook validado usa una descomposición operativa en español que no coincide uno-a-uno con esas seis etiquetas. Aplica inicialmente este crosswalk y valida si es correcto según la semántica real:

| Etiqueta observada en `PLAN_PROYECTO` | Conteo observado | Correspondencia SAP Activate a validar |
|---|---:|---|
| `Programa` | 1 | Contenedor superior; no es fase Activate |
| `Ola 1` | 1 | Contenedor de ola; no es fase Activate |
| `Preparación` | 56 | Prepare |
| `Exploración` | 96 | Explore |
| `Realización` | 80 | Realize |
| `Despliegue` | 30 | Deploy |
| `Salida en Vivo - GoLive` | 1 | Hito o subfase de Deploy |
| `Soporte a la Operación` | 25 | Run / estabilización |
| `Cierre Ola 1` | 1 | Cierre de ola; validar si pertenece a Run o al gobierno del programa |

`Discover` no aparece como fase explícita en esta versión. Determina con evidencia si:

1. ocurre antes de la creación formal del proyecto;
2. está representada por datos de intake, oportunidad, business case o portfolio en otra parte de ProjectOps360;
3. debe incorporarse como configuración opcional de la plantilla;
4. o es una omisión real.

No marques automáticamente como conflicto una traducción, un hito GoLive o una subdivisión de Run. Tampoco renombres fases. Primero separa:

- fase canónica;
- etiqueta visible de la plantilla;
- tipo de nodo (`Proyecto`, `Ola`, `Fase`, `Hito`, `Quality Gate`, etc.);
- configuración necesaria para mapearlas.

Para cada fase identifica workstreams, actividades, entregables, hitos, gates, criterios de entrada/salida, responsables, dependencias, evidencias y estados.

Determina si cada concepto se representa mediante:

- objetos canónicos existentes;
- una plantilla/configuración;
- tags, tipos o catálogos existentes;
- una transformación durante importación;
- una extensión genérica pendiente;
- o un concepto sin soporte.

### 8.2 Cadena de trazabilidad obligatoria

Audita la capacidad de representar y navegar esta cadena completa:

`Proceso → Requerimiento/Gap → Decisión → Trabajo → Prueba → Defecto → Aprobación → Resultado`

Para cada salto identifica:

- objeto origen y destino;
- tabla/columna o relación;
- cardinalidad;
- dirección;
- evento o proyección asociada;
- evidencia visible para usuario;
- representación actual o potencial en Living Graph;
- contexto recuperable por Isabella;
- huecos y riesgos de integridad.

El workbook ofrece cobertura parcial de esta cadena, pero no debes confundir una celda de texto con un objeto canónico relacionado:

- `PLAN_PROYECTO` aporta trabajo, jerarquía, dependencias, criterios y evidencia requerida.
- `PLAN_PRUEBAS` enlaza pruebas con `ID de tarea` y dispone de `Defecto / Ticket`, pero esa referencia puede ser solo texto.
- `HITOS_GATES` contiene decisión, aprobación y evidencia asociadas a hitos, entregables y gates.
- `CAMBIOS` contiene decisión y aprobación de solicitudes de cambio.
- No se observaron en el workbook hojas u objetos explícitos e independientes para `Proceso`, `Requerimiento/Gap` o `Resultado`.

La ausencia de una hoja en Excel no demuestra que la capacidad falte en ProjectOps360. Busca primero objetos canónicos, relaciones y eventos existentes. Registra por separado:

1. `SOURCE_TEMPLATE_GAP`: la plantilla no captura el concepto.
2. `PLATFORM_GAP`: la plataforma tampoco lo soporta con evidencia suficiente.
3. `MAPPING_GAP`: ambos lados existen, pero no hay transformación o relación de importación.

### 8.3 Jerarquía del plan

Valida de forma especial:

- unicidad y estabilidad del ID de tarea;
- preservación del ID padre;
- WBS y profundidad soportada;
- orden de importación padre-hijo;
- dependencias y restricciones de calendario;
- hitos frente a tareas normales;
- asignaciones y RACI;
- duplicados, ciclos, padres inexistentes y referencias cruzadas;
- idempotencia de una reimportación;
- manejo de errores parciales y rollback lógico.

No recomiendes regenerar IDs si eso rompe trazabilidad o reimportación.

Reproduce y documenta como controles de integridad:

- IDs vacíos o duplicados;
- padres inexistentes, autorreferencias y ciclos;
- predecesoras inexistentes;
- pruebas y gates que apunten a tareas inexistentes;
- registros ejecutables sin validación esperada;
- diferencias entre nodos resumen y actividades ejecutables.

La versión observada tenía 291 IDs únicos, cero padres inexistentes, cero ciclos, cero predecesoras inválidas, 241 referencias válidas desde pruebas y 77 referencias válidas desde hitos/gates. Si no reproduces esos resultados, registra la diferencia de versión o el defecto.

### 8.4 Equipo, asignación y RACI real

No concluyas que existe una matriz RACI solo porque la hoja se llama `EQUIPO_RACI`.

En la versión observada, esa hoja funciona principalmente como catálogo de 19 roles/personas e incluye organización, correo, disponibilidad, fechas y confirmación. `PLAN_PROYECTO` contiene `Responsable` y `Rol responsable`, pero el workbook no presenta una matriz explícita R/A/C/I por actividad.

Audita por separado:

1. roster de personas y roles;
2. membresía y disponibilidad/capacidad;
3. asignación de responsable a la tarea;
4. accountability y aprobación;
5. consultas y participación (`Consulted` / `Informed`);
6. RACI por tarea, entregable, gate o decisión;
7. capacidad actual de ProjectOps360 para importar y mantener esas relaciones.

Si solo existen `Responsable` y `Rol responsable`, no declares cobertura RACI completa. Determina si la solución correcta es reutilizar relaciones existentes, añadir configuración/import mapping o reconocer un gap genérico de responsabilidad múltiple.

## 9. Fase 3 — Matriz campo por campo

Primero clasifica cada hoja como `INSTRUCTIONAL_CONTROL`, `SOURCE_INPUT`, `TRANSACTION_REGISTER`, `CALCULATED_SUMMARY` o `PRESENTATION`.

Crea una fila por cada campo de negocio no vacío de las hojas que capturan datos. No agrupes varios campos bajo una descripción genérica. Para una hoja instructiva como `INICIO`, crea una sola fila de control de hoja y **no conviertas sus pasos, colores o mensajes en supuestos campos importables**. Para `PRESUPUESTO` y `DASHBOARD`, crea una fila por indicador o fórmula material, no por cada celda vacía o espacio de diseño.

La matriz debe incluir como mínimo:

| Columna | Descripción |
|---|---|
| `source_file` | Archivo fuente |
| `sheet` | Hoja exacta |
| `sheet_role` | Clasificación funcional de la hoja |
| `source_range` | Celda, columna o rango exacto |
| `excel_column` | Encabezado literal |
| `business_meaning` | Significado funcional |
| `required_or_optional` | Obligatoriedad real |
| `format_or_formula` | Tipo, formato, validación o fórmula |
| `sample_or_allowed_values` | Ejemplo no sensible o catálogo |
| `canonical_object` | Objeto canónico de ProjectOps360 |
| `db_schema` | Esquema |
| `db_table_or_view` | Tabla o vista |
| `db_column_or_expression` | Columna, expresión o cálculo |
| `db_type` | Tipo de dato |
| `key_and_relationship` | PK, FK, unique y cardinalidad |
| `rls_rbac_scope` | Alcance y políticas relevantes |
| `write_path` | Importador/API/servicio de escritura |
| `read_path` | Consulta/API/servicio de lectura |
| `ui_surface` | Pantalla o reporte consumidor |
| `event_projection` | Evento/proyección si aplica |
| `living_graph` | Nodo/arista/atributo si aplica |
| `isabella_context` | Fuente y evidencia disponible para Isabella |
| `mapping_status` | Estado normalizado |
| `gap_severity` | `P0`, `P1`, `P2`, `P3` o `NONE` |
| `evidence` | Archivo:línea, migración, objeto SQL o consulta |
| `recommendation` | Reutilizar, configurar, transformar o extender |

Usa únicamente estos estados de mapeo:

- `EXISTS_DIRECT`: existe con el mismo significado y granularidad.
- `EXISTS_TRANSFORM`: existe, pero necesita conversión o mapping controlado.
- `EXISTS_GENERIC`: el core ya cubre el concepto mediante un objeto genérico.
- `CONFIG_ONLY`: no requiere schema nuevo; necesita configuración administrable.
- `CALCULATED`: debe derivarse y no persistirse como dato fuente duplicado.
- `MISSING_GENERIC_CAPABILITY`: falta una capacidad genérica justificable.
- `DUPLICATED_SOURCE_OF_TRUTH`: existe más de una fuente incompatible.
- `CONFLICT`: plantilla, código, Product Brain o base de datos discrepan.
- `UNKNOWN_NO_EVIDENCE`: no existe evidencia suficiente.
- `BLOCKED_SOURCE_MISSING`: falta el artefacto necesario para auditarlo.
- `NOT_IMPORTABLE_CONTROL`: instrucción, leyenda o presentación que no debe persistirse como dato de negocio.

Una coincidencia de nombre no es suficiente para declarar `EXISTS_DIRECT`; compara significado, granularidad, lifecycle, seguridad y consumidores.

## 10. Fase 4 — Validaciones transversales

### 10.1 Seguridad y tenancy

- Confirma que todas las rutas respeten organización, PMO, proyecto, membresía, rol y estado de membresía cuando corresponda.
- Distingue permisos de lectura, creación, actualización, archivado y eliminación.
- Identifica tablas sin RLS, políticas demasiado amplias, dependencias de service role o bypasses.
- No propongas acceso org-wide si contradice el modelo de gobernanza vigente.

### 10.2 KPIs, dashboard y readiness

- Traza cada KPI desde la fórmula de Excel hasta sus datos fuente.
- Registra numerador, denominador, ventana temporal, unidades, redondeo, tratamiento de null/zero y frecuencia de actualización.
- Distingue dato fuente, dato calculado y dato presentado.
- Detecta KPIs que duplican EVM u otras métricas canónicas.
- Toda recomendación de readiness debe explicar pesos, umbrales y evidencia.

La versión observada incluye:

- presupuesto por actividad;
- costo comprometido;
- costo real (`AC` si la semántica coincide);
- `ETC`;
- `EAC`;
- `VAC`;
- porcentaje consumido;
- horas estimadas, reales, restantes y variación.

No se observaron campos explícitos para `PV`, `EV`, `CPI` o `SPI`; `BAC` podría corresponder a `Presupuesto aprobado`, pero debe validarse semánticamente. No declares EVM completo solo por la presencia de `EAC` y `VAC`.

Traza y valida de manera especial:

- `PLAN_PROYECTO!AA`: variación de horas respecto a estimado, real y restante;
- `PLAN_PROYECTO!AF`: cálculo de `EAC` desde costo real y `ETC`;
- `PLAN_PROYECTO!AG`: cálculo de `VAC` desde presupuesto y `EAC`;
- `PRESUPUESTO`: agregaciones globales y por fase;
- el tratamiento de reservas de contingencia frente a `BAC`;
- la fuente necesaria para plan value y earned value antes de recomendar `CPI` o `SPI`.

### 10.2.1 Semántica y rollups del dashboard

No valides un dashboard únicamente porque sus fórmulas calculen sin error. Comprueba que el universo contado represente el indicador anunciado.

En la versión observada:

- `Actividades incluidas` cuenta todas las filas con `Incluir = Sí`, incluidas filas de tipo `Proyecto`, `Ola`, `Fase`, grupos, entregables, gates, hitos y tareas.
- `Avance promedio` puede promediar nodos resumen y actividades ejecutables sin ponderación.
- los agregados por fase pueden mezclar padres e hijos y producir doble conteo de horas, presupuesto, costo o avance si ambos almacenan valores.

Audita y reporta por separado:

1. todos los nodos del plan;
2. actividades ejecutables;
3. nodos resumen;
4. entregables, hitos y quality gates;
5. rollups calculados frente a valores persistidos;
6. promedio simple frente a avance ponderado por duración, esfuerzo, costo o peso aprobado.

Si el KPI no define claramente su población y ponderación, marca `CONFLICT` o `UNKNOWN_NO_EVIDENCE`; no elijas una interpretación silenciosamente.

### 10.3 Living Graph y Process Intelligence

- Identifica nodos, aristas, eventos y proyecciones que ya existen.
- Comprueba si el modelo soporta la cadena de trazabilidad SAP sin bifurcar el motor.
- Preserva realtime, layouts guardados, Focus Mode y contratos existentes.
- No propongas una segunda implementación del Living Graph.

### 10.4 Isabella

- Identifica qué datos reales puede consultar hoy y por qué camino.
- Verifica que las respuestas puedan citar proyecto, objeto, evento, documento, cálculo o relación fuente.
- Señala campos presentes solo en UI o Excel que Isabella no puede recuperar.
- No declares soporte de Isabella basándote únicamente en texto de prompts o documentación.

### 10.5 Perfil configurable SAP

Para cada gap, responde primero:

1. ¿Ya existe una capacidad equivalente?
2. ¿Puede resolverse con configuración o catálogo?
3. ¿Puede resolverse con mapping/importación?
4. Si necesita desarrollo, ¿la extensión beneficia a cualquier tipo de proyecto y mantiene el core agnóstico?

Solo usa `MISSING_GENERIC_CAPABILITY` cuando las tres primeras respuestas sean negativas y exista evidencia suficiente.

## 11. Entregables

Crea únicamente esta carpeta de resultados local:

`docs/audits/sap-template-database/`

Y dentro de ella:

1. `01_EXECUTIVE_SUMMARY.md`
   - alcance y fuentes;
   - veredicto ejecutivo;
   - porcentajes y conteos por estado de mapeo;
   - principales P0/P1;
   - integridad estructural reproducida del workbook;
   - veredicto específico sobre fases, RACI, EVM, trazabilidad y rollups;
   - nivel de confianza y limitaciones.
2. `02_TEMPLATE_DATABASE_MATRIX.csv`
   - una fila por campo;
   - todas las columnas definidas en la sección 9.
3. `03_RELATIONSHIP_TRACEABILITY.md`
   - fases SAP Activate;
   - workstreams, gates y entregables;
   - cadena Proceso → Resultado;
   - jerarquía y dependencias del plan.
4. `04_GAP_REGISTER.md`
   - gap, evidencia, impacto, severidad, recomendación y dependencia;
   - separar `SOURCE_TEMPLATE_GAP`, `PLATFORM_GAP` y `MAPPING_GAP`;
   - separar configuración, transformación y desarrollo genérico.
5. `05_EVIDENCE_LOG.md`
   - archivos y líneas revisadas;
   - migraciones y objetos SQL;
   - consultas read-only ejecutadas;
   - entorno y timestamp;
   - fuentes faltantes o contradictorias.
6. `06_RECOMMENDED_NEXT_PHASE.md`
   - plan posterior ordenado por dependencia;
   - sin SQL, migraciones ni implementación;
   - pruebas, seguridad y contratos que una futura fase deberá proteger.

No hagas commit ni push de estos resultados. Efrain debe revisar primero el diagnóstico.

## 12. Requisitos de evidencia

Cada afirmación material debe apuntar al menos a una evidencia:

- `ruta:línea` del código o documento;
- nombre y timestamp de migración;
- esquema.tabla.columna;
- función, trigger, vista, policy o índice;
- consulta read-only reproducible;
- hoja y celda/rango del workbook;
- fórmula exacta, sin exponer datos sensibles.

Reglas:

1. Sin evidencia, usa `UNKNOWN_NO_EVIDENCE`.
2. Distingue claramente estado observado, inferencia y recomendación.
3. No uses documentación antigua como prueba única si contradice el código o el esquema aplicado.
4. Si migraciones, tipos generados y base aplicada no coinciden, registra las tres versiones y marca `CONFLICT`.
5. No copies datos personales ni secretos en los entregables.

## 13. Criterios de aceptación

La auditoría solo puede declararse completa cuando:

- [ ] Se revisó `CLAUDE.md` y el Product Brain pertinente.
- [ ] Se identificaron y versionaron los dos artefactos SAP principales, o se declaró formalmente el bloqueo.
- [ ] Se inventariaron todas las hojas reales del workbook.
- [ ] Se aceptaron variantes de nombre del workbook después de verificar su identidad por estructura y hash.
- [ ] `INICIO` se clasificó como hoja instructiva y no se modelaron sus textos como campos de base de datos.
- [ ] Se mapeó el 100 % de los campos de negocio no vacíos, incluidas columnas ocultas; indicadores y fórmulas materiales quedaron trazados por rango.
- [ ] Se preservaron y validaron IDs de tarea e IDs padre.
- [ ] Se reprodujeron controles de duplicados, padres, ciclos, predecesoras y referencias desde pruebas y gates.
- [ ] Se auditaron claves, relaciones, tipos, constraints, índices, RLS y RBAC.
- [ ] Se compararon migraciones, tipos generados, código consumidor y esquema aplicado disponible.
- [ ] Se distinguió claramente entre capacidad existente, configuración, transformación y desarrollo genérico.
- [ ] Se validaron las seis fases SAP Activate mediante un crosswalk explícito con las etiquetas operativas del workbook.
- [ ] Se determinó con evidencia el tratamiento de `Discover`, GoLive, Soporte a la Operación y Cierre de Ola.
- [ ] Se distinguió el roster de `EQUIPO_RACI` de una matriz R/A/C/I real por actividad.
- [ ] Se auditó la cadena Proceso → Requerimiento/Gap → Decisión → Trabajo → Prueba → Defecto → Aprobación → Resultado.
- [ ] Se separaron gaps de plantilla, plataforma y mapping en la cadena de trazabilidad.
- [ ] Se trazaron KPIs, dashboard y readiness hasta sus datos y fórmulas fuente.
- [ ] Se determinó si existe EVM completo; no se asumió soporte de PV, EV, CPI, SPI o BAC por analogía de nombres.
- [ ] Se verificó que conteos y rollups del dashboard separen nodos resumen de actividades ejecutables y eviten doble conteo.
- [ ] Se evaluó la cobertura de Living Graph, Process Intelligence e Isabella con evidencia.
- [ ] No se propuso una base, módulo o lógica SAP aislada.
- [ ] No se modificó código, schema, datos, RLS, migraciones ni comportamiento.
- [ ] No se creó PR, merge o deploy.
- [ ] Los seis entregables fueron creados, o cada omisión quedó explicada como bloqueo verificable.

## 14. Condiciones de parada

Detente y solicita dirección antes de ampliar el alcance si ocurre cualquiera de estas situaciones:

- el repositorio o la rama no son los indicados;
- se requiere acceso o credenciales nuevas;
- la única forma de validar algo exige escribir en una base de datos;
- se detectan cambios ajenos que no pueden aislarse;
- se requiere consultar producción fuera del flujo read-only ya autorizado;
- aparece una decisión que cambiaría la arquitectura aprobada;
- se necesita implementar para continuar la auditoría.

La ausencia de acceso al esquema aplicado no impide una auditoría documental del repositorio, pero obliga a marcar sus conclusiones como no verificadas contra runtime.

## 15. Informe final obligatorio en la terminal

Al terminar, responde a Efrain con este orden exacto:

1. **Veredicto ejecutivo** en lenguaje claro.
2. **HEAD inicial y final**, rama y estado del worktree.
3. **Fuentes encontradas y faltantes** con rutas.
4. **Entorno y fuente de esquema auditados**.
5. **Conteos por `mapping_status`** y cobertura porcentual.
6. **P0/P1 principales**, sin mezclar recomendaciones menores.
7. **Conflictos entre plantilla, base, código y Product Brain**.
8. **Archivos de auditoría creados**.
9. **Bloqueos o preguntas que requieren decisión**.
10. Confirmación literal:

> No se modificó código, base de datos, migraciones, RLS ni comportamiento. No se creó PR, no se hizo merge y no se realizó deploy.

11. Salida de:
   - `git diff --stat`
   - `git status -sb`

No ocultes limitaciones. No declares “completo” si falta la plantilla real o no se alcanzó el 100 % de la matriz.
