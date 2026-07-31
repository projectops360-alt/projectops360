# Pendientes — 2026-07-29

Levantado durante el despliegue del registro de horas (PR #225) y la auditoría del
guion de video SAP. Cada punto lleva la evidencia en el código para que no haya que
volver a buscarla.

**Ya cerrado y en producción:** registro de horas en tareas, consolidación al
Dashboard PM, entradas de cuadrilla, REG-041, REG-042. No aparece aquí.

---

## 1. Bloqueante para vender SAP

### 1.1 Framework SAP Activate — no existe

`grep -rin "sap.activate|sap_activate"` en todo el repo (código, SQL, docs, i18n)
da **cero resultados**. El guion de video afirma que existe.

Esperando el paquete de proyecto SAP **ya certificado por SAP** que traerá Efraín.
El video **no se publica** hasta que la feature exista (decisión tomada).

Cuando llegue, mapear contra lo que ya hay en vez de crear un módulo nuevo:

| Pieza | Estado hoy | Trabajo |
|---|---|---|
| Plantilla de 6 fases (Discover→Run) | `src/lib/execution/templates.ts` ya soporta fases + tareas + recursos + dependencias; solo hay 3 plantillas | **barato** — una entrada al catálogo |
| Método de entrega `sap_activate` | `delivery_method` tiene CHECK con 6 valores (`predictive/agile/scrum/kanban/hybrid/xp`) | **barato** — una migración |
| **Workstreams** | no existe la estructura | **trabajo real** — tabla + relación con entregables |
| **Gates que bloquean** | ver 1.2 | **trabajo real y delicado** |

Qué pedir en el paquete certificado, para no adivinar:

1. Entregables por fase con sus nombres oficiales.
2. **Criterios de salida de cada gate, explícitos.** Esto decide el tamaño del
   trabajo: si una fase *no puede* avanzar sin aprobaciones hay que construir
   enforcement; si basta con evidenciar, lo existente casi alcanza.
3. Matriz workstreams × fases (¿un entregable pertenece a uno, a varios, o los
   workstreams son solo agrupación visual?).
4. Roles/aprobadores por gate, para conectarlos con la matriz de aprobación del
   Charter que ya existe.

### 1.2 Los gates registran pero no bloquean

`computeCloseoutReadiness` (`src/lib/rhythm/closeout.ts:244-314`) calcula el
checklist y marca cada ítem como `blocking`, pero **nada impide avanzar**. El
único gate real es el rol: `canRunCloseout={org.role !== "viewer"}`
(`closeout/page.tsx:80`). Un proyecto se cierra con `readiness.ready === false`.

No es un bug: nunca se construyó el enforcement. Pero el guion promete
*"una fase no se considera completa porque llegó su fecha, sino cuando existe
evidencia"*, y eso hoy no se cumple.

---

## 2. Deuda técnica encontrada

### 2.1 El AC de EVM no está conectado al registro de horas

El panel de Isabella muestra `CPI = EV / AC → cpi=0.7712` con **`actual_cost=0`**.
Con costo real 0, CPI no puede ser 0.77.

El AC se lee de `financial_measurement_snapshots`, **no** de
`subtask_time_entries`, que es donde ahora viven las horas reales. Los comentarios
del propio código lo llaman *"the future EVM engine"*
(`src/lib/time-tracking/effort.ts:6`, `service.ts:204`).

Cerrar ese cable es lo que haría que EVM refleje el esfuerzo realmente registrado.

### 2.2 Historial de migraciones desalineado en los dos entornos

| | último registrado | realidad |
|---|---|---|
| **Prod** | `20260869000000` | la tabla de `20260870000000` **existe** sin estar registrada |
| **Stage** | `20260859000000` | esquema muy por delante; 13 migraciones sin registrar |

Consecuencia: **`supabase db push` no es fiable**. Aplicar vía MCP
`apply_migration` o Studio, y revisar antes qué hay realmente en el esquema.

### 2.3 Colisión de numeración REG entre ramas largas

`fix/responsive-system` y `feat/task-time-tracking` reclamaron **REG-040** a la
vez, porque master iba en REG-037 y ninguna rama veía el número de la otra. Se
resolvió renumerando a REG-041, pero el patrón se repetirá.

Antes de asignar un REG, revisar **todas** las ramas, no solo master.

### 2.4 Un test verde estaba fijando un bug

`panels-and-kpi-feedback.test.ts` asertaba `toContain("useState(() =>")` con el
comentario *"Lazy initialiser, so the panels never flash open"* — defendiendo el
mecanismo que causaba REG-042. Cualquier arreglo correcto lo hacía fallar.

Vale barrer otros tests que asertan implementación en vez de comportamiento.

---

## 3. Afirmaciones del guion que no se sostienen

Auditadas contra el código. Si el video se ajusta en vez de construirse, estos son
los puntos a corregir.

| Escena | Afirmación | Realidad |
|---|---|---|
| 3 | Framework SAP Activate, 6 fases | no existe (ver 1.1) |
| 4 | Plantilla SAP + 9 workstreams | no existe |
| 4 | Gates verifican y bloquean | registran, no bloquean (ver 1.2) |
| 5 | Dimensión de **calidad** | no existe en el motor de salud |
| 5 | Vista distinta de **PM** y de **equipo funcional** | el PM ve el mismo Command Center que el ejecutivo |
| 5 | EVM (CPI/SPI/EAC/VAC) | real, pero solo en `pmo-process-intelligence` y `pmo-simulation`, **no** en el dashboard del PM |
| 6 | El **"por qué"** causal del Living Graph | **prohibido por contrato**: CAP-045 §F.2 — *"NEVER infer causality from temporal proximity"*; `living-graph.ts:232` mantiene un campo cuyo comentario dice *"proves we never infer causality"* |
| 6 | Isabella explica/detecta patrones/recomienda | detrás de `ISABELLA_PROCESS_INTELLIGENCE_ENABLED`, **OFF por defecto** |

La de la Escena 6 es la más delicada: vender inferencia causal contradice una
decisión deliberada y documentada del producto.

---

## 4. Límites conocidos de lo que ya se desplegó

No son bugs; son decisiones registradas que pueden volver como petición.

1. **Utilización por persona en cuadrillas es aproximada.** En un registro de
   cuadrilla, `user_id` es quien responde por el turno, no 20 personas distintas.
   Totales y costos son exactos. Ruta de mejora en CAP-051 §11.
2. **Multi-día son varios registros.** `crew_size` cubre solo la dimensión de
   personas, a propósito: la granularidad diaria sostiene burn rate, utilización
   diaria y timesheets. Añadir un campo de "días" degrada esas tres métricas.
3. **El reporte de Task Execution usa el estimado propio de la tarea**, no el
   consolidado, porque es una tabla plana donde las subtareas tienen sus propias
   filas y consolidar el padre contaría doble dentro del mismo export. Dos tests
   lo defienden.

---

## 5. Limpieza

- [ ] Borrar la rama `backup/task-time-tracking-pre-rebase` (respaldo del rebase,
      ya innecesario).
- [ ] Borrar la rama remota `feat/task-time-tracking` (ya mergeada en PR #225).
- [ ] **Calidad de datos en Valle Norte:** la tarea *"Tramitación de licencia
      ambiental"* tiene 320h estimadas pero sus subtareas suman 12h, así que el
      estimado consolidado es 12h y el consumo aparece en ~92%. Es la regla
      anti-doble-conteo funcionando; hay que estimar bien las subtareas o el plan
      de esa tarea se lee mucho menor de lo real.
- [ ] Las env vars locales `PMO_LIVING_GRAPH_ENABLED` y `SINGLE_DASHBOARD_MODE`
      quedaron en `.env.local` para igualar producción. Es local y no versionado.

### Nota de infraestructura

El proyecto de Vercel vive bajo el team **`project-ops360-s-projects`**, no
`efrain-pradas-projects`. Consultar la API con el team equivocado devuelve 403.
