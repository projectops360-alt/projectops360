# Greenfield V2 — release a producción

**Estado: preparado, no ejecutado.** Producción no fue modificada.

## Qué reemplaza

El bundle de 11 miembros que iba a llevar todo el programa 3C4 a producción queda
`SUPERSEDED_BY_GREENFIELD_V2`. Ocho miembros se aplicaron; los tres últimos se
atascaron en una dependencia circular —`20260889` comenta una función que solo
crea `20260890`, y `20260890` sincroniza bajo un release que solo registra
`20260889`— más dos aserciones que llevaban los conteos de filas de Stage.

No se rescata. El paquete Greenfield son dos migraciones sin release key, sin
manifiesto de transición, sin registry sync y sin depender de nada diferido.

**Los 17 proyectos de producción siguen siendo legacy.** No se migran, ni se
completan sus owners, ni se usan como gate.

## El paquete

| | Archivo | SHA-256 |
|---|---|---|
| A | `20260901000000_greenfield_v2_project_creation.sql` | `d76540c1ce6c0779e4fbf53440d552df70c2469d7ac74dea64ed572bbfd12714` |
| B | `20260902000000_greenfield_v2_projects_insert_lockdown.sql` | `70a6451ba5e876dfdf4f99303f8e767f7b3525965e7a0eebc4d47ffe00d82f86` |

A crea la tabla de contratos, la función canónica `create_project_v2`, la
constraint diferida de owner único y los selectores; y retira
`create_governed_project_v2`, que quedaba bloqueada tras un gate de certificación
que nadie puede satisfacer hoy. Ambas corren desde cero (producción) y sobre lo
existente (Stage).

B cambia **solo** la policy de INSERT de `projects` a `WITH CHECK (false)`.

## Orden obligatorio

**A → aplicación → smoke → B → prueba negativa.**

El orden no es preferencia. La aplicación desplegada hoy en producción crea
proyectos con `.from("projects").insert(...)`. Aplicar B antes de desplegar la
aplicación nueva **rompe la creación de proyectos en producción**.

### Paso A — expansión
Aplicar Migración A. Retrocompatible: la policy de INSERT sigue permitiendo el
camino viejo, así que la aplicación desplegada sigue funcionando.

### Paso B — aplicación
Desplegar la app que usa exclusivamente `create_project_v2`. Sin fallback.

### Paso C — smoke
Crear un proyecto desde la interfaz. Verificar `project=1, contract=1,
active_owner=1, same_org=true, same_unit=true`.

### Paso D — lockdown
Aplicar Migración B inmediatamente después del smoke.

### Paso E — prueba negativa
Confirmar que un INSERT directo autenticado es rechazado y que la creación por
el comando sigue funcionando.

## Bloqueante antes del smoke

`efrain.pradas@gmail.com` **no puede crear** en My Organization. Su membresía de
unidad en PMO General es `project_manager`, que concede `project.assign`,
`project.read`, `project.update` y `report.read` — pero **no `project.create`**.
Solo `pmo_director` y `pmo_manager` lo conceden.

| Usuario | Organización | Rol de unidad | Veredicto |
|---|---|---|---|
| `pmo@xxx-demo.io` | Ascendia | `pmo_manager` + `project_manager` | `READY_TO_CREATE` |
| `efrain.pradas@gmail.com` | My Organization | `project_manager` | `MISSING_PROJECT_CREATE` |

El smoke del paso C debe hacerse con `pmo@xxx-demo.io`, o cambiar antes el rol de
unidad de Efraín a `pmo_manager`. Eso es una decisión suya sobre su propia
organización, no un paso técnico del release.

## Ledger

Nada de `supabase db push` ni `--linked`: producción tiene deriva conocida —ocho
migraciones aplicadas sin fila en el ledger—. Las dos Greenfield se aplican por
el canal controlado, con SHA-256, dry-run, receipt MCP, postcondiciones y mapping
local↔receipt.

## Rollback, por capas

**Migración B** — restaurar la policy anterior:
`WITH CHECK (public.is_org_member(organization_id))`. Reabre el INSERT directo,
que es lo que había antes; no pierde datos.

**Aplicación** — volver al despliegue anterior. Requiere haber revertido B
primero, porque el código viejo inserta directamente.

**Migración A** — solo retirable si **no existe ningún contrato V2 real**.
Comprobar `SELECT count(*) FROM project_governance_contracts` antes de tocar nada.
Si ya hay un proyecto V2, el rollback **preserva proyecto, contrato y owner** y se
limita a volver a la aplicación compatible. No se borran datos para simplificar
el rollback: un proyecto creado por un usuario es suyo, no un artefacto del
release.

## No parity deliberada

Stage tiene seis claves foráneas sobre la tabla de contratos; el trío con sufijo
`_fk` usa el orden de columnas invertido del par sin sufijo. Producción recibirá
**tres**, no seis. Son semánticamente equivalentes; la redundancia de Stage es
histórica y no se reproduce.
