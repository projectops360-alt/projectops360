# ProjectOps360° — Auditoría de Autorización (Incidente Developer→PMO)

**Fecha:** 2026-06-25
**Alcance:** autenticación, autorización, RLS de Supabase, server actions, límites de organización/proyecto, escalada de privilegios, logging de auditoría.
**Entorno auditado:** producción (`ocopmlnkvidvmxgiwvxw`), rama `feat/rythm`.
**Severidad global:** 🔴 **ALTA** — existen rutas de escalada de privilegios explotables vía API directa.

---

## 0. Resumen ejecutivo

El incidente reportado (un Developer realizó un cambio de nivel PMO) **no es un caso aislado**: es un síntoma de un patrón sistémico. La auditoría revela dos clases de vulnerabilidad:

1. **Capa de aplicación (server actions):** ~39 de 43 archivos de server actions validan **solo pertenencia a la organización** (`getOrgContext()` + filtro `organization_id`), **no** acceso al proyecto ni rol. Como todas usan el cliente service-role (`createAdminClient`, que **ignora RLS**), un usuario de la org puede invocarlas directamente con un `projectId` y mutar charter, gobernanza, decisiones, riesgos, etc.

2. **Capa de base de datos (RLS):** RLS está habilitado en las 98 tablas, pero las políticas son **scoping por org+proyecto, sin discriminación de rol ni de campo**. Peor: varias políticas permiten a **cualquier miembro** escalar privilegios o alterar evidencia **vía API directa con la anon key pública** (sin pasar por el código de la app).

> **Principio violado:** la visibilidad del frontend (ocultar pestañas/botones) se está usando como control de seguridad. El backend y la BD deben rechazar la acción aunque el frontend la permita. Hoy, en muchos casos, no lo hacen.

---

## 1. Root Cause Analysis — el incidente Developer→PMO

**Incidente concreto investigado:** Carlos Prada (rol de proyecto *Developer*, `permission_level=contributor`) movió la tarea "Incorporate Accessibility Features" de Mateo Rojas a *Blocked* (audit log `task_blocked`, 2026-06-26 01:56).

**Causa raíz inmediata (ya corregida, commit `7c1548c`):** el helper `canWriteTask()` y el `canEditAll` del Workboard concedían autoridad total sobre cualquier tarea a quien tuviera el flag `project_team_members.can_manage_tasks`, que **viene en `true` por defecto** al añadir a alguien al equipo. Se cambió para que solo el manager tier (PMO/PM/creador/`can_manage_team`) toque tareas ajenas.

**Falso positivo descartado:** el rol `owner` que aparecía para Carlos pertenece a **su organización personal** (`776cc32a…`), no a la del proyecto (`dc8205c1…`), donde es `member`/Developer. No influyó.

**Causa raíz estructural (el hallazgo real de la auditoría):** el patrón "validar solo la org, confiar en el flag, ocultar en el frontend" se repite en casi todo el sistema. La corrección de tareas tapó **un** agujero; quedan equivalentes en charter, gobernanza, sign-offs, decisiones, riesgos y a nivel RLS.

---

## 2. Modelo de identidad y confianza (revisión)

| Aspecto | Estado | Notas |
|---|---|---|
| Autenticación | ✅ Correcto | `getOrgContext()` usa `supabase.auth.getUser()` (verificado server-side, no confía en estado del cliente). |
| Identidad | ✅ Correcto | `auth.uid()` usado consistentemente en helpers SQL (`SECURITY DEFINER` + `search_path=public`). |
| Rol de org | ⚠️ | Derivado de `organization_members.org_role` con fallback a `role` legacy. Correcto como **fuente**, pero ver §4 (es modificable por el propio usuario vía RLS). |
| Service role key | ✅ No expuesta | Solo `SUPABASE_SERVICE_ROLE_KEY` (sin `NEXT_PUBLIC`); `admin.ts` con guardas; no se importa en componentes cliente. |
| Anon/publishable key | ⚠️ Pública por diseño | Correcto **si y solo si** RLS es estricto. Hoy no lo es (ver §4). |

---

## 3. Hallazgos — capa de aplicación (server actions)

**Cobertura de autorización por proyecto/rol:** solo `roadmap`, `team`, `resource-capacity` y `organization/members` referencian helpers de acceso (`getProjectAccess`/`isProjectManagerTier`/etc.). Los demás (charter, decisions, communications, documents, delivery, meetings, budget, risks, rhythm, memory, scribe, execution-map, links, stakeholders, import, reports) **no**.

| # | Vulnerabilidad | Archivos | Riesgo | Fix propuesto |
|---|---|---|---|---|
| A1 | Acciones de **charter/gobernanza** (`updateCharterAction`, `submitCharterAction`, aprobación, roles, matriz de aprobación, sign-offs) validan solo org; sin acceso al proyecto ni rol. Un Developer de la org puede editar/enviar/aprobar charter de cualquier proyecto vía llamada directa. | `charter/actions.ts` | 🔴 Alto | `assertProjectManager(projectId)` al inicio. |
| A2 | **Decisiones, riesgos, comunicaciones, documentos, delivery, meetings, budget** mutables por cualquier miembro de la org con un `projectId` válido. | `decisions/`, `communications/`, `documents/`, `delivery/`, `meetings/`, `budget/actions.ts` | 🔴 Alto | Guard de acceso a proyecto + rol según matriz §6. |
| A3 | `createTaskAction` no valida rol: un contributor puede crear tareas y **asignárselas a otros**. | `roadmap/actions.ts` | 🟠 Medio | Restringir creación/asignación a manager tier (o solo auto-asignación). |
| A4 | Acciones **AI** (Scribe, memory, charter AI, delivery AI, rhythm intelligence, meeting extract) heredan el mismo patrón org-only y pueden crear/actualizar entidades sin pasar por rol/campo. | `*/ai*.ts`, `scribe-actions.ts`, `memory/actions.ts` | 🟠 Medio | La IA debe pasar por la misma capa de autorización. |
| A5 | Mensajes de error y `revalidatePath` correctos; logging presente pero incompleto (ver §7). | varios | 🟡 Bajo | — |

**Mitigación parcial existente:** `guardProjectTab()` en los `layout/page` oculta pestañas a contributors (UX), pero **no** protege las server actions invocadas directamente (replay del endpoint de la action).

---

## 4. Hallazgos — Supabase RLS (lo más grave)

RLS habilitado en 98/98 tablas. **Pero** el patrón de políticas `po_*` (aplicado a ~90 tablas) concede CRUD completo a cualquier miembro con acceso al proyecto, **sin rol ni campo**. Y varias políticas de tablas de identidad son explotables **directamente con la anon key + JWT del usuario contra PostgREST**, sin tocar el código de la app.

| # | Tabla / Política | Problema | Riesgo |
|---|---|---|---|
| R1 | `organization_members` UPDATE: `using/check = is_org_member(organization_id)` | **Cualquier miembro puede UPDATE cualquier fila de su org**, incluida la columna `org_role`/`role`. Un Developer puede ponerse `COMPANY_OWNER`/`PMO_ADMIN`. **Escalada de privilegios directa.** | 🔴 **Crítico** |
| R2 | `project_team_members` UPDATE: `is_org_member AND can_access_project` | Un miembro del proyecto puede **UPDATE su propia fila** y activarse `can_manage_team`, `can_approve_changes`, `permission_level=manager`. Escalada a nivel proyecto. | 🔴 **Crítico** |
| R3 | `audit_logs` tiene `po_update` y `po_delete` para miembros | El log **no es append-only**: un usuario puede **borrar/alterar evidencia** de sus acciones. | 🔴 **Crítico** |
| R4 | `organizations` UPDATE: `is_org_member(id)` | Cualquier miembro puede modificar la organización (nombre, ajustes, posibles campos de propiedad). | 🟠 Alto |
| R5 | `project_governance_rules`, `project_signoffs`, `project_approval_matrix`, `project_charters`, `project_charter_roles`, `risks`, `decisions`, etc. | UPDATE/INSERT/DELETE para **cualquier miembro del proyecto** (sin rol). A nivel BD, un Developer puede aprobar sign-offs/cambiar gobernanza si usa el cliente authenticated/API directa. | 🟠 Alto |
| R6 | `projects` UPDATE: `using=can_access_project(id)`, `check=is_org_member(organization_id)` | Un miembro del proyecto puede cambiar `project_manager_id` (apropiarse del PM) o mover `organization_id` a otra org donde sea miembro. | 🟠 Alto |
| R7 | `stakeholder_access` INSERT/UPDATE por cualquier miembro del proyecto | Un miembro puede conceder/alterar accesos externos. | 🟡 Medio |
| R8 | `profiles` UPDATE: `auth.uid()=id` | Correcto (solo su fila), pero no impide cambiar su propio `organization_id`/`default_organization_id`. Impacto bajo (la pertenencia real está en `organization_members`). | 🟡 Bajo |

> Helpers SQL (`is_org_member`, `is_pmo_level`, `can_access_project`) están **bien escritos** (SECURITY DEFINER, search_path fijo, `auth.uid()`). El problema no son los helpers, son las **políticas que faltan usar rol/campo**.

---

## 5. Riesgos de escalada de privilegios (resumen)

| ¿Un Developer puede…? | Hoy | Vía |
|---|---|---|
| Cambiar su propio `org_role` a PMO/Owner | ✅ Sí | R1 (API directa) |
| Concederse `can_manage_team`/aprobar cambios en un proyecto | ✅ Sí | R2 (API directa) |
| Editar/enviar/aprobar charter y gobernanza de cualquier proyecto de su org | ✅ Sí | A1 (server action directa) |
| Mutar decisiones/riesgos/budget de cualquier proyecto de su org | ✅ Sí | A2 |
| Apropiarse del PM de un proyecto | ✅ Sí | R6 |
| Borrar/alterar logs de auditoría | ✅ Sí | R3 |
| Mover una tarea ajena en el Workboard | ❌ Ya no | corregido `7c1548c` |
| Ver datos de otra organización | ❌ No | aislamiento por org correcto |
| Ver/editar proyecto de su org al que no pertenece (vía action) | ⚠️ Parcial | depende de la action (muchas solo filtran por org) |

---

## 6. Matriz de autorización objetivo (least privilege)

Roles canónicos: `COMPANY_OWNER`, `PMO_ADMIN`, `PORTFOLIO_MANAGER` (PMO tier), `PROJECT_MANAGER` (+ creador/`can_manage_team`), `TEAM_MEMBER`/Developer (contributor), `STAKEHOLDER`, `CLIENT`, `VIEWER`.

| Permiso | PMO tier | PM (su proyecto) | Developer/Team | Stakeholder | Viewer/Client |
|---|---|---|---|---|---|
| project.read | ✅ todos | ✅ asignados | ✅ asignados | ✅ compartido | 👁 compartido |
| project.create / update / delete | ✅ | ✅ | ❌ | ❌ | ❌ |
| project.governance.update / approve | ✅ | ✅ | ❌ | ❌ | ❌ |
| milestone.create/update/approve | ✅ | ✅ | ❌ | ❌ | ❌ |
| task.create / assign | ✅ | ✅ | ⚠️ solo propias | ❌ | ❌ |
| task.update.any | ✅ | ✅ | ❌ | ❌ | ❌ |
| task.update.assigned | ✅ | ✅ | ✅ | ❌ | ❌ |
| risk/issue/decision.write | ✅ | ✅ | ⚠️ limitado | ❌ | ❌ |
| resource/labor_capacity.update | ✅ | ✅ | ❌ (solo propias si se habilita) | ❌ | ❌ |
| project_memory.write/delete | ✅ | ✅ | ⚠️ con flag | ❌ | ❌ |
| user.invite / user.role.update | ✅ | ⚠️ en su proyecto | ❌ | ❌ | ❌ |
| pmo_dashboard.read | ✅ | ❌ | ❌ | ❌ | ❌ |
| audit_logs.read | ✅ | ✅ su proyecto | ⚠️ propios | ❌ | ❌ |
| audit_logs.update/delete | ❌ (nadie) | ❌ | ❌ | ❌ | ❌ |

---

## 7. Logging de auditoría (estado)

Existe `audit_logs` + helper `logAudit()` y se usa ampliamente. **Carencias:**
- No captura `ip` / `user_agent` / ubicación, `actor_role`, `permission_required/granted`, `before/after`, ni `source` (UI/API/AI).
- **No es append-only** (R3): editable/borrable por miembros.
- No registra **intentos no autorizados** (los `return { error }` no se loguean).
- No hay pantalla de consulta para PM/PMO (pedido pendiente del usuario).

---

## 8. Plan de hardening (orden seguro, por fases)

**Fase 0 — P0 RLS (parar la hemorragia, migraciones):**
- R1: `organization_members` — solo PMO tier puede cambiar `org_role`/`role`; nadie puede auto-promoverse (trigger que impida cambiar tu propia fila de rol).
- R2: `project_team_members` — bloquear que un usuario edite su propia fila de permisos/flags; cambios de flags solo manager tier.
- R3: `audit_logs` — eliminar `po_update`/`po_delete`; append-only real (solo service_role inserta).
- R4/R6: `organizations` y `projects` UPDATE restringidos a PMO/PM; columnas `organization_id`/`created_by` inmutables (trigger).

**Fase 1 — capa de autorización en server actions:**
- Centralizar `assertProjectAccess(projectId)` y `assertProjectManager(projectId)` (lanzan/retornan error).
- Aplicar a las ~39 actions sin guard, empezando por gobernanza (A1), luego A2/A4.

**Fase 2 — autorización a nivel de campo:** campos sensibles (owner, organization_id, project_id, approval status, budget baseline, role) no editables por roles inferiores; triggers de inmutabilidad + `updated_by`.

**Fase 3 — auditoría enriquecida:** IP/user-agent/ubicación, actor_role, before/after, source; log de intentos no autorizados; pantalla PM/PMO de consulta (cubre el pedido previo del usuario).

**Fase 4 — RLS rol-aware:** endurecer políticas `po_*` de tablas sensibles para discriminar por rol (defensa en profundidad real, no solo app-layer).

**Fase 5 — tests de regresión de seguridad:** Developer no puede acciones PMO; PM solo su proyecto; Viewer/Client no mutan; escalada por payload bloqueada; RLS bloquea API directa.

---

## 9. Criterios de aceptación
Ver prompt original (puntos 1–18). El sistema está endurecido cuando: el incidente es imposible (✅ tareas), toda mutación sensible exige autorización server-side, RLS impide escalada vía API directa (R1–R3 cerrados), el frontend es solo UX, los intentos no autorizados se loguean, y existen tests que lo prueban — sin romper flujos legítimos PMO/PM ni módulos (Memory, Living Graph, Capacity, Scribe, etc.).
