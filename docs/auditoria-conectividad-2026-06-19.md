# Informe de Auditoría de Conectividad — ProjectOps360°
**Fecha:** 2026-06-19 · **Proyecto auditado:** *Mobile App Redesign* (org **XXX**, plan Business)
**Objetivo:** verificar que el sistema esté conectado **de principio a fin** (el principio de ProjectOps360°).

---

## 1. Veredicto ejecutivo

El **núcleo de fundación y gobernanza está conectado de punta a punta** y funcionando con datos reales:
**Org/Billing → Proyecto → Charter → Equipo → Gobernanza → RACI → Delivery Framework → Backlog (IA) → Project Memory.**

El **quiebre principal** está en la **capa de EJECUCIÓN**: las **tareas/hitos no se enlazan con el equipo** que definiste. Hoy el sistema sabe *quién* participa (Team & Roles) y *qué* hay que hacer (Backlog), pero al ejecutar (Workboard/Tareas) ese trabajo **no se asigna a las personas del equipo** ni se ancla a **hitos** (el proyecto tiene 0 hitos).

- ✅ **Conectado:** 14 eslabones del flujo de planeación y gobernanza.
- 🔴 **Brechas críticas:** 2 (ejecución↔equipo, capa de hitos).
- ⚠️ **Brechas menores:** 6.

---

## 2. Estado real del proyecto (datos en producción)

| Módulo | Estado | Lectura |
|---|---|---|
| Organización / Plan | XXX · **Business** · 10 asientos facturables · sub activa | ✅ |
| Charter | **Aprobado** (pasó el gate) · 1 rol, 4 aprobaciones, 1 firma, 0 reglas | ✅ |
| Delivery Framework | **Híbrido · Activo** · 8 columnas de tablero | ✅ |
| Team & Roles | **6 miembros** (PM, 2 Dev, 1 Diseño, Sponsor, Business Owner) | ✅ |
| RACI | **10 asignaciones** (todas a miembros del equipo) | ✅ |
| Stakeholder access | 1 | ✅ |
| Backlog | **13 items** — todos generados por **IA desde el charter** | ✅ |
| Project Memory | **27 registros** (22 equipo · 4 charter · 1 delivery) | ✅ |
| **Hitos (milestones)** | **0** | 🔴 |
| **Tareas (roadmap_tasks)** | **0** (0 de 13 del backlog promovidas) | 🔴 |
| Ciclos / Sprints | 0 | ⚠️ |
| Riesgos | 0 | ⚪ |
| Eventos / Reuniones (Rhythm) | 1 / 1 | ⚠️ |

---

## 3. Mapa de conectividad end-to-end

```
[Org XXX / Billing] ──✅──> [Proyecto Mobile App]
        │                          │
        │                          ├──✅──> [Charter] ──aprobado──> (gate exigió gobernanza ✅)
        │                          │            ▲   │
        │                          │     (sugiere personas) │ (genera por IA)
        │                          ├──✅──> [Team & Roles] ─┤
        │                          │            │   └──✅──> [Backlog 13 items]
        │                          │            ├──✅──> [RACI 10]
        │                          │            ├──✅──> [Approval Matrix]
        │                          │            └──✅──> [Command Center: completitud]
        │                          ├──✅──> [Delivery Framework híbrido] ──✅──> [Workboard: columnas]
        │                          ├──✅──> [Project Memory 27] (capta equipo/charter/delivery)
        │                          │
        │                          ├──🔴──> [Hitos]  ......... 0 (sin backbone de cronograma)
        │                          ├──🔴──> [Tareas/Workboard] 0 (backlog no promovido)
        │                          └──🔴──> [Tareas ↔ Equipo]  roadmap_tasks usa `resources`,
        │                                                       NO `project_team_members`
```

---

## 4. 🔴 Brechas críticas (rompen el "de principio a fin")

### 4.1 Las **tareas no se enlazan con el equipo** *(la más importante)*
- **Hallazgo:** `roadmap_tasks` tiene `assigned_resource_id` (apunta a la tabla **`resources`**) pero **NO** tiene `project_team_member_id`. Las personas que cargas en **Team & Roles** (Carlos, Mateo, Camila…) **no se pueden asignar como dueñas de una tarea**.
- **Impacto:** se define *quién* participa pero al ejecutar el trabajo se usa otro directorio (`resources`). El "quién hace qué" del equipo **no llega a la ejecución**. El spec pedía explícitamente: *"solo los miembros del equipo del proyecto deberían poder ser dueños del trabajo".*
- **Fix recomendado (P1):** migración additiva `roadmap_tasks.project_team_member_id` (FK a `project_team_members`), y en el formulario de tarea del Workboard ofrecer como dueños a los miembros del equipo (con `resources` como compatibilidad). Conecta Team → Backlog → Tareas → Reportes/RACI por persona.

### 4.2 El proyecto **no tiene hitos (0)** — falta el backbone de cronograma
- **Hallazgo:** 0 milestones. Consecuencias en cadena:
  - **Backlog:** los 13 items no se pueden agrupar **por hito** (0 con `linked_milestone_id`); la vista "Por hito" queda vacía.
  - **RACI:** las 10 asignaciones son `entity_type='milestone'` pero con **etiqueta escrita a mano** y `entity_id = null` (no apuntan a un hito real).
  - **Status Report:** progreso 0/0 hitos.
  - **Ciclos/Sprints:** no hay hitos sobre los cuales organizar.
- **Fix recomendado (P1/P2):** sembrar/crear hitos del proyecto (manual o por IA desde el charter/deliverables), y enlazar backlog + RACI a esos hitos reales (`entity_id`). Así el cronograma queda conectado con todo lo demás.

### 4.3 El **Backlog no fluye al Workboard** (0 de 13 promovidos)
- **Hallazgo:** 13 items en backlog, **0 tareas** en el Workboard.
- **Matiz:** la acción `promoteBacklogItemsAction` **existe y funciona** (revisada en código); simplemente **no se ha ejecutado** en este proyecto. No es un bug, pero el flujo de ejecución **aún no se ha demostrado de punta a punta**.
- **Fix recomendado (P2):** promover el backlog (botón "Enviar todas") para validar Backlog→Tareas→Workboard en vivo. Idealmente después de 4.1/4.2 para que las tareas nazcan con dueño + hito.

---

## 5. ⚠️ Brechas menores

1. **Dos conceptos de "stakeholder"**: la tabla antigua `stakeholders` (módulo Stakeholders del proyecto) y la nueva `stakeholder_access` (Charter/Team) coexisten y **no están unificadas**. Riesgo de duplicar gente y confundir accesos.
2. **Rhythm**: `scheduleFrameworkMeetingsAction` crea eventos del ritmo, pero las **reuniones no jalan asistentes** desde el Equipo/RACI/gobernanza (el spec lo pedía). Hoy 1 evento / 1 reunión.
3. **Ciclos/Sprints vacíos**: el flujo Backlog → Ciclo → Workboard (con `sprint_name`) existe pero no se ha ejercitado.
4. **RACI sin entidad real**: como no hay hitos, el RACI guarda etiquetas de texto, no referencias (`entity_id`) a entregables/hitos reales. Cuando existan hitos, conviene enlazarlos.
5. **Cambio de plan / Stripe**: no hay UI para cambiar el plan de una org (se hace por SQL); los campos `billing_provider_*` están listos pero **Stripe no está cableado**.
6. **Flujo de arranque guiado**: existe la pestaña Team & Roles tras Charter+Delivery, pero **no hay un wizard que fuerce** la secuencia Charter → Delivery → Team → Hitos → Backlog (hoy es navegación libre).

---

## 6. ✅ Lo que SÍ está conectado (verificado con datos reales)

1. **Org → Proyecto** (organization_id) y **Billing** (plan Business, 10 asientos, subscripción activa).
2. **Proyecto → Charter** (auto-creado al crear el proyecto).
3. **Team → Charter**: roles y **matriz de aprobación referencian a las personas del equipo** (Ana, Carlos) — los datalists del equipo funcionaron.
4. **Gate del Charter**: exigió Roles + Matriz + Firmas → el charter quedó **aprobado** correctamente.
5. **Charter → Backlog (IA)**: los 13 items se generaron desde el charter (todos con `linked_charter_objective`).
6. **Team → RACI**: 10 asignaciones, todas a miembros reales del equipo.
7. **Team → Command Center**: franja de completitud del equipo.
8. **Delivery Framework → Workboard**: columnas relabeladas al perfil híbrido (8 columnas).
9. **Project Memory**: 27 registros capturando automáticamente **equipo (22) + charter (4) + delivery (1)** — la memoria viva está profundamente conectada.
10. **Reportes** (Status/Closeout/Budget/Charter) con **nomenclatura de PDF** unificada (`Pops360-…`).
11. **IA respeta el idioma** de la interfaz (charter por campo + plantillas de resumen/extracción/clasificación).
12. **Deploy ↔ GitHub**: `git push` → dashboard de `projectops360@gmail.com` (ya conectado).

---

## 7. Recomendaciones priorizadas (para la próxima sesión)

| Prioridad | Acción | Conecta |
|---|---|---|
| **P1** | `roadmap_tasks.project_team_member_id` + asignar dueños desde el Equipo en el Workboard | Equipo ↔ Ejecución ↔ Reportes/RACI |
| **P1** | Crear/sembrar **hitos** (manual o IA desde deliverables) y enlazar backlog + RACI a ellos | Cronograma ↔ Backlog ↔ RACI ↔ Status |
| **P2** | Promover backlog → tareas (demostrar Backlog→Workboard en vivo) | Planeación ↔ Ejecución |
| **P2** | Unificar **stakeholders** (`stakeholders` vs `stakeholder_access`) | Stakeholders coherentes |
| **P3** | Rhythm: sugerir **asistentes** desde Equipo/RACI/gobernanza | Equipo ↔ Reuniones |
| **P3** | Wizard de arranque guiado Charter→Delivery→Team→Hitos→Backlog | Onboarding de proyecto |
| **P4** | Cambio de plan por UI + integración **Stripe** | Billing self-service |

---

## 8. Conclusión

El **principio de ProjectOps360° está sólido**: fundación, gobernanza, equipo, memoria viva e IA están conectados y operando con datos reales sobre *Mobile App Redesign*. Para que sea verdaderamente **"de principio a fin"** falta cerrar el puente hacia la **ejecución**: **enlazar las tareas con las personas del equipo** y **darle al proyecto su backbone de hitos**. Con esos dos arreglos (P1), el ciclo completo —*planear → asignar → ejecutar → medir → reportar*— queda cosido de punta a punta.
