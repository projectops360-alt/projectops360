# Manual de uso de ProjectOps360° — del login al Reporte de Cierre

Guía de usuario paso a paso que recorre el ciclo de vida completo de un proyecto dentro de la plataforma: desde que entras por primera vez hasta que generas el documento de cierre del proyecto.

> La app está en producción en **projectops360.vercel.app** y es bilingüe (Español / English). Puedes cambiar el idioma con el selector de la barra lateral. Este manual está en español; los nombres de botones aparecen en español, pero en paréntesis se indica el equivalente en inglés cuando difiere.

---

## Tabla de contenidos

1. [Crear cuenta e iniciar sesión](#1-crear-cuenta-e-iniciar-sesión)
2. [Conocer la interfaz principal](#2-conocer-la-interfaz-principal)
3. [Crear o importar un proyecto](#3-crear-o-importar-un-proyecto)
4. [Charter & Governance — la fundación del proyecto](#4-charter--governance--la-fundación-del-proyecto)
5. [Delivery Framework — cómo se va a ejecutar](#5-delivery-framework--cómo-se-va-a-ejecutar)
6. [Team & Roles y Stakeholders](#6-team--roles-y-stakeholders)
7. [Execution Map — el mapa de ejecución](#7-execution-map--el-mapa-de-ejecución)
8. [Workboard — ejecutar el trabajo](#8-workboard--ejecutar-el-trabajo)
9. [Rhythm Center — reuniones y cadencia](#9-rhythm-center--reuniones-y-cadencia)
10. [Comunicaciones, Decisiones, Documentos y Memoria](#10-comunicaciones-decisiones-documentos-y-memoria)
11. [Budget, BIM y Labor Capacity](#11-budget-bim-y-labor-capacity)
12. [Status Report](#12-status-report)
13. [Closeout — el Reporte de Cierre del proyecto](#13-closeout--el-reporte-de-cierre-del-proyecto)
14. [Chequeo rápido del ciclo completo](#14-chequeo-rápido-del-ciclo-completo)

---

## 1. Crear cuenta e iniciar sesión

### Iniciar sesión
1. Entra a **projectops360.vercel.app**. Si no estás autenticado, la app te lleva a `/login`.
2. Ingresa tu **email** y **contraseña** (mínimo 6 caracteres).
3. Pulsa **Iniciar sesión** (*Sign in*).
4. Si las credenciales son correctas, aterrizas en el **Centro de Mando** (*Command Center*).

> La autenticación es por **email y contraseña** (vía Supabase). Si tu email no está confirmado, verás un mensaje indicándolo; si las credenciales no son válidas, verás "Credenciales inválidas".

### Crear una cuenta nueva
1. Desde `/login`, pulsa **¿No tienes cuenta? Crea una** (*Don't have an account? Create one*) → te lleva a `/signup`.
2. Completa: **Nombre para mostrar**, **email**, **contraseña** y **confirmar contraseña** (deben coincidir y tener ≥ 6 caracteres).
3. Pulsa **Crear cuenta** (*Create account*).
4. Aparece la pantalla **"Revisa tu correo"** (*Check your email*). Te enviamos un enlace de confirmación a tu email.
5. Abre ese enlace en tu correo. Al confirmar, la app intercambia la sesión y te lleva al Centro de Mando.

> No hay inicio de sesión automático tras el registro: debes confirmar el email primero. Si el enlace de confirmación falla, vuelve a `/login` y vuelve a intentarlo.

### Cerrar sesión
Pulsa tu avatar (arriba a la derecha) → **Cerrar sesión** (*Sign out*).

---

## 2. Conocer la interfaz principal

Una vez dentro, la app tiene tres zonas:

- **Barra lateral izquierda** (colapsable): navegación global.
- **Barra superior** (*header*): nombre de la organización, **búsqueda global** (ábrela con `⌘K` / `Ctrl+K`) que busca en proyectos, tareas, hitos, riesgos, materiales, RFIs, recursos, decisiones y presupuestos; notificaciones (campana); y tu menú de usuario.
- **Área central**: el contenido de cada módulo.

### Navegación de la barra lateral (en orden)

**Global (siempre visible):**
1. **Centro de Mando** (*Command Center*) — `/` → resumen general de tu organización.
2. **Proyectos** (*Projects*) — `/projects` → lista y gestión de proyectos.
3. **AI Operator** — `/ai-operator` → hub de inteligencia artificial (incluye Importar proyecto y BIM).
4. **Reportes** (*Reports*) — `/reports`.
5. **Equipo** (*Team*) — `/team`.

**Dentro de un proyecto (aparecen solo cuando estás navegando un proyecto):**
6. **Mapa de Ejecución** (*Execution Map*).
7. **Tablero de Trabajo** (*Workboard*).
8. **Memoria del Proyecto** (*Project Memory*).

**Abajo del todo:**
9. **Facturación y Plan** (*Billing & Plan*) — `/organization/billing`.
10. **Configuración** (*Settings*) — `/settings`.

> Cuando entras a un proyecto, aparece además una **barra de pestañas** (*ProjectTabs*) encima del contenido con todos los módulos del proyecto: Centro de Mando, Charter & Governance, Delivery Framework, Team & Roles, Workboard, Execution Map, Labor Capacity, BIM, Memoria, Rhythm, Status y Settings. Algunos módulos adicionales (Comunicaciones, Decisiones, Documentos, Budget, Stakeholders, Closeout, Audit, Search) se alcanzan desde enlaces del dashboard del proyecto o por URL directa.

---

## 3. Crear o importar un proyecto

### Crear un proyecto desde cero
1. Ve a **Proyectos** (`/projects`) y pulsa **Nuevo proyecto** (*New project*).
2. En el diálogo, completa:
   - **Nombre del proyecto** (obligatorio, máx. 200 caracteres).
   - **Descripción** (opcional).
   - **Estado** (*Planning* o *Active* — por defecto *Planning*).
   - **Tipo de proyecto**: General, Desarrollo de software, Construcción de data center, Construcción residencial, Construcción comercial, Infraestructura, Industrial.
   - **Crear desde plantilla** (checkbox): si lo marcas, se instancian fases, tareas, dependencias, recursos, presupuesto y riesgos de marcador.
   - **Idioma por defecto** del proyecto (Español/English).
3. Pulsa **Crear proyecto**.

El proyecto se crea y te lleva automáticamente al **Charter** con un banner de onboarding (*"Comienza definiendo la base del proyecto…"*). Esa es la primera parada oficial: definir el charter.

> El **framework de entrega** (Predictivo / Ágil / Scrum / Kanban / Híbrido / XP) **no** se elige aquí. Se configura después, en el módulo **Delivery Framework**.

### Importar un proyecto existente
Si ya tienes un proyecto documentado en un archivo, puedes importarlo:
1. Desde el diálogo de *Nuevo proyecto*, pulsa **"O importa un archivo de proyecto existente…"** → te lleva a `/import` (también accesible desde **AI Operator**).
2. Sube tu archivo. Formatos soportados: **Excel (.xlsx/.xlsm), CSV, JSON, Word (.docx), PDF, TXT, Markdown (.md)** — hasta 25 MB.
3. Elige el modo: **Crear proyecto nuevo** o **Fusionar en proyecto existente** (en este caso, elige el proyecto destino).
4. Pulsa **Analizar archivo**. La IA extrae tareas, hitos, dependencias, recursos, materiales, presupuesto y riesgos.
5. En la fase de **revisión**, verás el conteo de todo lo detectado y el tipo de proyecto detectado (editable). Revisa pestaña por pestaña (*Resumen, Tareas, Hitos, Dependencias, Recursos, Materiales, Presupuesto, Riesgos, Advertencias, Datos crudos*) y marca/desmarca lo que quieras importar. Cada fila muestra su nivel de confianza (*Valid, Needs review, Invalid, Duplicate, Missing data*).
6. Pulsa **Aprobar e importar**. Al terminar, **Abrir proyecto** te lleva al Execution Map con el spotlight de onboarding.

---

## 4. Charter & Governance — la fundación del proyecto

El Charter es el documento vivo que define **por qué** existe el proyecto, **qué** entrega, **cómo** se gobierna y **quién** aprueba. Es la base que guía toda la ejecución y los reportes. Es la primera parada tras crear el proyecto.

### Flujo de estados del charter
`borrador → en revisión → pendiente de aprobación → aprobado/activo` (locked). Mientras no esté aprobado, el proyecto se considera sin fundación formal.

### Secciones que debes completar
Trabaja estas pestañas en orden:

1. **Resumen del charter** — resumen ejecutivo, antecedentes, **caso de negocio** (requerido), impulsores del negocio. Define *por qué*.
2. **Alcance y objetivos** — **meta** (req), **objetivos** (req), **dentro/fuera de alcance** (req), supuestos, restricciones, limitaciones, dependencias. Define *qué* y los límites.
3. **Entregables y criterios de éxito** — **entregables principales** (req), criterios de aceptación, **criterios de éxito** (req), transferencia de conocimiento. Define *qué se entrega y cómo se mide*.
4. **Reglas de gobernanza** — **modelo de gobernanza** (req), toma de decisiones, **proceso de escalamiento** (req), **cadencia de reportes** (req), gestión de incidencias, cambios, riesgos, calidad, comunicación.
5. **Roles** — tabla de roles (Sponsor, PM, Steering, PMO…), persona, responsabilidad y **nivel de autoridad** (Decisión final / Aprobar / Recomendar / Revisar / Consultado / Ejecutar / Informado). Reutiliza personas del Team Center.
6. **Matriz de aprobación** — reglas por área (cambio de alcance, presupuesto, cronograma, aceptación de riesgo, escalamiento, cambio de vendor, aceptación de hito, cierre del proyecto): *quién aprueba qué*.
7. **Reglas de gobernanza** (extra) — reglas por tipo (incidencias, cambios, riesgos, calidad, comunicación, status reporting, stakeholder review, budget/schedule control).
8. **Firmas / Sign-Off** — registro de firmas de aprobación del charter.
9. **IA y Control** — herramientas de IA: **Gap Analysis** (vacíos vs. estándar PMO), **Scope Creep Check**, **Stakeholder Summary** (explicación en lenguaje de negocio), **Charter Q&A** y **Generar Gobernanza con IA**.

### Asistencia de IA
- Botón **"Generar con IA"** en el encabezado: rellena los campos vacíos del charter.
- Cada campo tiene su botón **IA** para generar ese campo puntualmente.

### Aprobar el charter
- Para enviar a aprobación necesitas: **100% de los campos requeridos** + **Roles** + **Matriz de aprobación** + **Sign-Off** con contenido (las reglas de gobernanza son recomendadas, no bloqueantes).
- Pulsa **Enviar a aprobación** → luego **Aprobar / Rechazar**. Al aprobar, el charter queda *locked* y se crea una versión en el historial.
- Editar un charter aprobado abre una nueva revisión (no se pierde el historial).

### Vistas adicionales
- **Resumen del charter** (`/charter/summary`): vista de solo lectura orientada a stakeholders.
- **Imprimir / PDF** (`/charter/print`): versión imprimible del charter completo. Botón *Imprimir/PDF* en el encabezado.
- Botón **"Marco de ejecución"**: el puente que te lleva a `/delivery?setup=true` tras aprobar.

> Mientras el charter no esté aprobado, verás un aviso en el dashboard: *"Completa y aprueba el charter antes de la ejecución real"*. Al aprobarlo cambia a *"Charter aprobado. La fundación del proyecto está lista."*

---

## 5. Delivery Framework — cómo se va a ejecutar

Aquí diagnosticas el contexto del proyecto y eliges el **modelo de entrega** (Predictivo/Ágil/Scrum/Kanban/Híbrido/XP), gestionas el backlog, los ciclos/sprints y la salud del marco. Es el puente natural tras aprobar el charter.

### Asistente de diagnóstico (Wizard)
1. Entra a **Delivery Framework** (`/delivery`) y abre el **Wizard / Diagnóstico**.
2. Responde 8 selectores de contexto: tipo de proyecto, incertidumbre, gobernanza, documentación, control de cambios, frecuencia de feedback, dependencia de vendors, cadencia.
3. Pulsa **Recomendar marco**. La IA devuelve método recomendado + nivel de confianza + razón + columnas sugeridas.
4. Puedes **sobreescribir** el método si lo prefieres y pulsas **Guardar configuración**.

### Pestañas del módulo
- **Resumen** (*Overview*): métricas adaptativas según el método (Kanban → WIP/bloqueados/cola/entregados; Predictivo → avance/hitos/pendientes; Scrum/Ágil → ciclos activos/backlog/en curso/completado), tarjetas de contexto, **tablero de ejecución con límites WIP editables** (se pone rojo si excedes el límite) y **ritmo de reuniones sugerido** con botón *"Programar en el Rhythm Center"* (crea las reuniones semanales sin duplicar). Acción **"Activar ejecución"**.
- **Backlog**: backbone de **hitos** (fases del proyecto) con botón *"Generar hitos con IA"* desde el charter; ítems del backlog alineados a objetivo/hito/riesgo, con prioridad y tipo; vistas de lista o por hito; botones *"Priorizar con IA"* y *"Generar con IA"*; **promoción selectiva o masiva al Workboard**.
- **Ciclos**: crea sprints/ciclos con meta y fechas; agrega ítems del backlog; estados `planificado → activo → completado`; promueve ítems *"Al Workboard"*; botón *"Lecciones aprendidas con IA"* por ciclo.
- **IA y Salud**: **detección de scope creep** (alertas convertibles en *solicitud de cambio* o resueltas/descartadas), **resumen para stakeholders** y **salud del marco** (recomienda ajustes si el proyecto se desvía).

> El método que elijas aquí **adapta las etiquetas del Workboard** (las columnas cambian de nombre según el framework) y define el **ritmo de reuniones** sugerido en el Rhythm Center.

---

## 6. Team & Roles y Stakeholders

### Team & Roles Center (`/team`)
Aquí compones el equipo, asignas roles y permisos, defines responsabilidades RACI y otorgas acceso de solo lectura a stakeholders. Tres pestañas:

- **Miembros y roles**: agrega personas desde el **directorio de la organización**, un **equipo de empresa** completo, un **contacto externo** (vendor), por **invitación por email**, o un **rol manual** sin persona. Cada miembro tiene rol de proyecto / rol de entrega / rol de gobernanza y nivel de permiso. **Flags rápidas** de acceso: aprobar cambios, ver presupuesto, acceder a memoria, gestionar tareas. Botón **"Recomendar roles con IA"** (sugiere roles según el charter). *Nota: stakeholders y observadores no consumen asiento facturable.*
- **RACI**: asigna **R/A/C/I** (Responsable/Aprueba/Consultado/Informado) sobre hitos y entregables a cada miembro, agrupado por entidad. Botón **"Borrador RACI con IA"**.
- **Acceso de stakeholders**: otorga acceso ligero/gratuito a observadores, ejecutivos y aprobadores externos, con nivel de acceso y permisos de *comentar* y *aprobar*. No consume asiento.

> El módulo muestra un **score de completitud** del equipo y avisa si falta un rol crítico (p. ej. PM) o la gobernanza de aprobación.

### Stakeholders (`/stakeholders`)
Registra el mapa de stakeholders del proyecto con su nivel de **influencia** y **interés** (alto/medio/bajo) — la matriz clásica de gestión de stakeholders. Puedes crear y archivar stakeholders. Este catálogo alimenta al Team Center (acceso) y al Charter (resumen para stakeholders).

---

## 7. Execution Map — el mapa de ejecución

El Execution Map (`/execution-map`) es el mapa de hitos y tareas del proyecto, con dependencias y orden topológico. Tiene **7 pestañas internas + Living Graph**:

1. **Vista General** (*Overview*): el *Roadmap Hero* (fase actual, hito actual, siguiente hito, progreso general, bloqueos), el panel de **próximo paso** (recomendación de siguiente acción) y el dashboard de ejecución (conteos por estado, sprint actual, cambios recientes).
2. **Línea de Tiempo** (*Timeline*): cronología visual del roadmap.
3. **Tareas** (*Tasks*): lista de tareas agrupadas por hito, con gestión de dependencias (predecesores, validación de ciclos).
4. **Flujo** (*Flow*): flujo de proceso en vivo con KPIs, conformidad, distribución de hitos y bloqueos.
5. **Cronograma / Gantt**: edición visual de fechas.
6. **Ruta Crítica** (*Critical Path*): próximamente.
7. **Dependencias** (*Dependencies*): añade y edita dependencias con tipos FS/SS/SF/FF y actualización de fechas.
8. **Living Graph** (*Grafo Vivo*): botón adicional que abre la vista de grafo en `/execution-map/living-graph`.

### Crear hitos y tareas
- En el encabezado del Execution Map: botones **Crear tarea** y **Crear hito**.
- **Formulario de hito**: título, descripción, estado, prioridad, sprint, horas estimadas, criterios de aceptación, notas de dependencia/ejecución, razón de bloqueo, programación con fechas/progreso/duración, y **sección de prompt para IA** (cuerpo, contexto, objetivo de herramienta AI), notas de implementación y pruebas.
- Al llegar desde el import con `?onboard=true`, verás un **spotlight de onboarding** invitándote a crear tu primer hito.

> El orden de tareas respeta dependencias (orden topológico) y es **consistente entre Workboard y Timeline**.

---

## 8. Workboard — ejecutar el trabajo

El Workboard (`/workboard`) es el tablero único de ejecución. Aquí mueves las tareas por columnas de estado con **arrastrar y soltar**, respetando dependencias y límites WIP.

- **Columnas adaptadas al método de entrega**: las etiquetas cambian según el framework elegido en Delivery, pero los estados de tarea son siempre: `not_started, prompt_ready, sent_to_ai, in_progress, implemented, tested, done, blocked, deferred`.
- **Cambio de estado**: al mover una tarea, un diálogo pide una **nota obligatoria** según el destino (p. ej. al marcar *done* o *blocked*).
- **Filtros**: por sprint y por hito.
- **Bloqueo por dependencia**: no puedes avanzar una tarea si su predecesora no está cumplida (verás *"dependencia no cumplida"*).

> Tareas y dependencias son las mismas que en el Execution Map: aquí las **ejecutas**, allí las **planeas y visualizas**.

---

## 9. Rhythm Center — reuniones y cadencia

El Rhythm Center (`/rhythm`) gestiona el calendario y las reuniones del proyecto. Cada reunión se crea desde una **plantilla** que autocompleta título, objetivo, resultado y agenda.

### Tipos de reunión (plantillas)
`kickoff`, `status_update`, `stakeholder_review`, `project_review`, `closing`, `other`. Cada una trae una **agenda con secciones ordenadas** (p. ej. el *kickoff* tiene 8 secciones; el *closing* tiene 8: aceptación de entregables, cronograma/presupuesto final, pendientes, cierre de riesgos, lecciones, liberación de recursos, reconocimientos, archivo).

### Crear una reunión
1. Pulsa **Crear reunión**, elige el **tipo** → se autocompleta la agenda desde la plantilla.
2. Completa fecha, prioridad, link y asistentes.
3. Guarda.

### Durante la reunión (Meeting Drawer)
Abre la reunión en el drawer lateral: edita la agenda, marca asistencia, captura **decisiones** y **action items** en vivo, toma notas y genera el **resumen con IA**.

### Completar la reunión
Pulsa **"Completar reunión"**. Esto:
1. Genera el **resumen IA** de la reunión.
2. Sincroniza la reunión a la **Memoria del Proyecto**.
3. Marca reunión y evento como `completed`.
4. **Si era una reunión de tipo `closing`** → dispara todo el flujo de cierre del proyecto (ver [sección 13](#13-closeout--el-reporte-de-cierre-del-proyecto)).

> El Rhythm Center tiene vistas de **Lista** y **Calendario**, filtros por tipo/estado/fecha y un panel de *próximos eventos*. Puedes programar el ritmo sugerido directamente desde el Overview del Delivery Framework.

---

## 10. Comunicaciones, Decisiones, Documentos y Memoria

Estos módulos (alcanzables desde enlaces del dashboard del proyecto o por URL directa) son la **memoria operativa** del proyecto.

### Comunicaciones (`/communications`)
Registra y categoriza todas las comunicaciones (email, reunión, teléfono, Teams, Slack, presencial, documento, nota manual) con fecha, estado (borrador/registrada) y **flag de seguimiento**. Las comunicaciones con seguimiento pendiente alimentan la puerta de Closeout.

### Decisiones (`/decisions`)
Log de decisiones del proyecto con estado (`proposed/accepted/rejected/deferred/revoked`) y **área de impacto** (alcance/cronograma/presupuesto/riesgo/calidad/comunicación/documento/otro). Las decisiones `proposed` sin resolver son un criterio de Closeout. Pueden vincularse a reuniones del Rhythm Center.

### Documentos (`/documents`)
Gestión de documentación por **estado** (borrador/revisión/aprobado/archivado) y **tipo** (evidencia/contrato/especificación/reporte/presentación/otro), por upload o URL externa. Vista de detalle por documento.

### Memoria del Proyecto (`/memory`)
La "memoria viva" del proyecto: ítems de conocimiento con autoría, participantes, importancia, sentimiento, tags, **clasificación IA** y **links de trazabilidad** hacia tareas, hitos, riesgos, stakeholders, decisiones, documentos, comunicaciones y reuniones. Recibe automáticamente el resumen de cada reunión completada y, al cierre, el **Reporte de Cierre del Proyecto**.

---

## 11. Budget, BIM y Labor Capacity

### Budget (`/budget`)
Revisa y edita la estimación de presupuesto agrupada por categoría, con subtotales y total. Las **cantidades y costos unitarios son editables inline**; los subtotales y el total se recalculan en vivo y se persisten al salir del campo. Botón **Imprimir / PDF**. Los datos vienen de los `material_requirements` (alimentados por el takeoff del BIM).

### Drawing Intelligence / BIM (`/drawing-intelligence`)
Sube planos/dibujos (manual o vía conectores Autodesk/Procore/Google Drive), procésalos con IA (OCR + interpretación) y extrae **takeoff, insights, riesgos, RFIs y versiones**. Modos de procesamiento: *quick_scan / standard_analysis / deep_analysis*. Pestañas: upload, library, extractions, risks, rfis, submittals, takeoff, versions, schedule, cost, actions, evidence, logs. Los insights pueden convertirse en draft RFI, submittal, inspección, constraint de cronograma o impacto de costo. El **takeoff alimenta el Budget** (materiales).

### Labor Capacity (`/labor-capacity`)
Planifica y vigila la capacidad de mano de obra (módulo que aparece según el tipo de proyecto):
- **Matrix**: capacidad por trade/semana/zona con horas requeridas/disponibles/gap, % utilización, riesgo y ruta crítica.
- **Lookahead**: ventana de 3 y 6 semanas con readiness (ready/at_risk/not_ready/blocked), narrativa explicativa y **riesgo de cuadrillas ociosas** con acciones recomendadas (reasignar/escalonar/acelerar prerrequisito/confirmar vendor/monitorear).
- **Workface**: vista por actividad con semanas, % readiness, prerrequisitos faltantes, tipos de bloqueo y riesgo de idle.

---

## 12. Status Report

El Status Report (`/status`) genera un **reporte de estado** en lenguaje sencillo y visual, orientado a un lector no técnico, con todo **auto-calculado** desde los datos vivos del proyecto. Es **solo lectura**: no se edita, se genera y se exporta.

Incluye:
- **Encabezado** con logo, tipo de proyecto, fecha de generación, ventana planificada y **meta del proyecto** (traída del Charter).
- **Banner de bloqueos** si hay tareas en pausa.
- **Anillo de progreso** con % y titular en lenguaje natural, más stats (hecho/en curso/en pausa/por hacer).
- **"Qué hacer ahora"** — plan diario agrupado por responsable, con acciones (desbloquear/hacer ahora/iniciar/asignar) e indicación de tareas esperando predecesora.
- **El recorrido** — viaje por fases con estado y barra de progreso.
- **Hecho / Ahora mismo / Lo que viene**.
- Otros puntos por revisar y **materiales**.
- Botón **"Descargar PDF"**.

---

## 13. Closeout — el Reporte de Cierre del proyecto

El Closeout (`/closeout`) es la fase final. Muestra la **puerta de readiness de cierre** y, al completar la reunión de Cierre, el **reporte de cierre autogenerado** con métricas y narrativa IA, imprimible a PDF.

### La puerta de readiness (semáforo)
Antes de cerrar, revisa 10 criterios:

- **Bloqueantes** (si fallan, no puedes cerrar): actividades cerradas (0 tareas abiertas), sin tareas bloqueadas, riesgos resueltos, RFIs respondidos, action items cerrados.
- **No bloqueantes** (solo advierten): hitos completados, seguimientos resueltos, submittals resueltos, decisiones tomadas, presupuesto reconciliado.

El panel muestra semáforo, score % y cada check con detalle.

### Cómo se dispara el cierre del proyecto

> El cierre **no** es un botón "cerrar proyecto" aislado. El disparador es **completar la reunión de Cierre en el Rhythm Center**.

Flujo completo:
1. **Programa una reunión de tipo `closing`** desde el Rhythm Center. La plantilla *closing* define la agenda (aceptación de entregables, cronograma/presupuesto final, pendientes, cierre de riesgos, lecciones, liberación de recursos, reconocimientos, archivo).
2. **Durante la reunión**, en el Meeting Drawer, captura decisiones, action items y notas.
3. Pulsa **"Completar reunión"**. Esto genera el resumen IA, sincroniza a Project Memory y, por ser `closing`, ejecuta `generateCloseoutReport`:
   - Guarda el reporte en la reunión (campo `ai_summary.closeout`).
   - Inserta un ítem en **Project Memory** titulado *"Reporte de Cierre del Proyecto"* (origen: rhythm_center, importancia alta, tipo closeout_report).
4. **Abre el módulo Closeout** (`/closeout`): la página lee el reporte autogenerado y lo muestra.

### Qué contiene el Reporte de Cierre
- **Encabezado** con logo, "Reporte de cierre del proyecto", fecha y **stamp de estado** (Listo/Pendiente).
- **Resumen ejecutivo** IA (si no se generó, avisa que se produce al completar la reunión de Cierre).
- **KPIs**: % de tareas completadas, variación de cronograma, variación de presupuesto, % de riesgos resueltos.
- **Logros clave**, **tabla de duración de hitos** y tarjetas de desempeño (cronograma / presupuesto / riesgos e incidencias / gobernanza y participación).
- **Lecciones aprendidas** (qué salió bien / retos y cómo se manejaron), **asuntos abiertos** y **próximos pasos** — todo parte de la narrativa IA generada al cerrar.
- **Recursos y archivo del proyecto**.
- Botón **"Descargar PDF"** (nombre de archivo `CLS…`).

> El reporte se construye desde **todos los datos acumulados** del proyecto: charter, tareas, riesgos, RFIs, submittals, decisiones, presupuesto y reuniones. Por eso es importante haber mantenido al día cada módulo a lo largo del ciclo.

---

## 14. Chequeo rápido del ciclo completo

Repaso del recorrido ideal de un proyecto de principio a fin:

1. **Crear cuenta / iniciar sesión** → aterrizar en el Centro de Mando.
2. **Crear proyecto** (o **importar** uno existente) → se abre el Charter.
3. **Charter**: completar resumen, alcance, entregables, gobernanza, roles, matriz de aprobación y firmas → **aprobar el charter**.
4. **Delivery Framework**: diagnosticar y elegir el método de entrega → activar ejecución → programar el ritmo en el Rhythm Center.
5. **Team & Roles**: componer equipo, asignar RACI y dar acceso a stakeholders. **Stakeholders**: registrar el mapa de influencers.
6. **Execution Map**: crear hitos y tareas con dependencias → definir el plan.
7. **Workboard**: ejecutar las tareas (arrastrar y soltar), respetando dependencias.
8. **Rhythm**: cadencia de reuniones (kickoff → status → reviews…).
9. **Comunicaciones / Decisiones / Documentos / Memoria**: ir registrando todo durante la ejecución.
10. **Budget / BIM / Labor Capacity** (según tipo de proyecto): controlar costo, planos y capacidad.
11. **Status**: generar y descargar el reporte de estado cuando haga falta.
12. **Rhythm → reunión `closing`**: completar la reunión de Cierre → dispara el reporte.
13. **Closeout**: revisar la puerta de readiness, descargar el **Reporte de Cierre del proyecto** en PDF.

Con eso, el proyecto queda formalmente cerrado y su memoria preservada para futuros proyectos.