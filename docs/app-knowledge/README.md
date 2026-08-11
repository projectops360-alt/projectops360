# App Screens Knowledge — Isabella conoce la app por dentro

Corpus de **fichas funcionales por pantalla** para el Knowledge OS de Isabella.
Cada ficha en `screens/` documenta una pantalla real de la app (66 en total),
generada leyendo su código fuente (`page.tsx` + componentes + server actions):
qué hace, cómo se llega, botones y flujos, tablas Supabase que lee/escribe y
pantallas relacionadas. Bilingüe EN/ES (una localización por idioma, UX-012).

## Estado actual (2026-08-10)

- ✅ **Cargado en Supabase prod** (`ocopmlnkvidvmxgiwvxw`): 80 paquetes en el
  dominio `app_screens`. Las 61 fichas previas se regeneraron o se dieron por
  vigentes y se añadieron 5 nuevas (`screen-execution-map-kpis`,
  `screen-admin-console`, `screen-process-intelligence`,
  `screen-execution-map-variants`, `screen-execution-map-root-causes`).
- La edge function temporal `kb-loader-temp` usada para la carga original quedó
  neutralizada (responde 410); puedes borrarla del dashboard.

### Indexar embeddings

Sembrar escribe el TEXTO: la búsqueda léxica funciona de inmediato. La búsqueda
SEMÁNTICA solo se activa cuando cada chunk tiene su embedding.

- **A (recomendado):** Consola de administración → pestaña Resumen → tarjeta
  «Conocimiento de Isabella» → **Indexar ahora**. Corre en el servidor, contra el
  entorno donde está desplegada la app, bajo el gate owner/admin de la acción.
- **B (local, con cuidado):** `node scripts/index-living-guide.mjs` lee
  `.env.local`, que apunta a **Staging**. Ejecutarlo tal cual indexa Staging, no
  producción. Usa la opción A salvo que sepas exactamente a qué base apuntas.

## Integración al repo

Copia esta carpeta a `docs/app-knowledge/` del repo y commitea. El generador
asume esa ubicación (rutas de `sources:` relativas a la raíz del repo).

## Mantenimiento — mantener a Isabella sincronizada con el código

Cada ficha declara en su frontmatter los archivos fuente que describe
(`sources:`) y `source-hashes.json` guarda su hash al momento de generarla.

```bash
# 1. ¿Alguna pantalla cambió desde la última generación? (exit 1 si hay obsoletas)
node docs/app-knowledge/scripts/generate-app-screens-seed.mjs --check

# 2. Regenera las fichas obsoletas (ver prompt abajo), luego:
node docs/app-knowledge/scripts/generate-app-screens-seed.mjs --out seed.sql
# aplica seed.sql a Supabase (solo los paquetes con contenido cambiado crean
# una versión nueva; el resto no se toca — idempotente y version-aware)
#
# El corpus completo son ~260 KB en UNA sola sentencia VALUES, más de lo que
# algunos clientes aceptan de una vez. Para aplicarlo por lotes sin partir la
# sentencia a mano (y corromperla), genera subconjuntos:
node docs/app-knowledge/scripts/generate-app-screens-seed.mjs   --only screen-a,screen-b --out lote1.sql

# 3. Registra los nuevos hashes — SOLO cuando ya regeneraste TODAS las fichas
#    que --check marcó. Ejecutarlo antes bendice como vigentes fichas que nadie
#    releyó: Isabella seguiría citando la pantalla anterior y el sistema diría
#    que está al día.
node docs/app-knowledge/scripts/generate-app-screens-seed.mjs --update-hashes
```

Sugerencia CI: agrega el paso `--check` al pipeline para que un PR que cambie
una pantalla falle si su ficha no fue actualizada.

### Prompt para regenerar una ficha (Claude/agente de código)

> Regenera la ficha `docs/app-knowledge/screens/<slug>.md` de ProjectOps360.
> Lee los archivos listados en su frontmatter `sources:` (y los componentes
> nuevos que importe el page.tsx). Mantén EXACTAMENTE el formato: frontmatter
> (slug, route, domain: app_screens, tier: learned_pattern, sources) + sección
> `# EN: …` + sección `# ES: …`, cuerpos de 150-250 palabras en prosa que
> cubran propósito, navegación, acciones/botones, datos leídos/escritos y
> pantallas relacionadas, terminando con líneas `Source:`/`Verify:` (EN) y
> `Fuente:`/`Verifica:` (ES). Describe solo lo que confirmes en el código.

## Gobernanza

Los paquetes se cargan con `confidence_tier: learned_pattern` (auto-generable
según la gobernanza del Knowledge OS, ADD §4.1). Tras revisión humana puedes
promover un paquete creando una versión nueva con tier superior. El retrieval
de Isabella no filtra por dominio, así que estas fichas ya participan en la
búsqueda híbrida junto a `people_permissions` y `product_intelligence`.

## Archivos

- `screens/*.md` — 66 fichas (fuente de verdad, editable/regenerable)
- `scripts/generate-app-screens-seed.mjs` — genera SQL + control de obsolescencia
- `source-hashes.json` — hashes de los archivos fuente por ficha
- `app-screens-seed.sql` — seed completo generado (referencia; ya aplicado en prod)

Notas de honestidad detectadas al generar (documentadas en las fichas): `/roadmap`
y `/rythm*` son redirects (REG-011); `ai-operator` es solo lanzador; `phase0` usa
localStorage; `product-intelligence` y `admin/*` están tras allowlist de correos;
la pestaña Variance de labor-capacity enlaza a una ruta sin página.
