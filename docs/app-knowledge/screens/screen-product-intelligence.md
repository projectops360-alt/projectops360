---
slug: screen-product-intelligence
route: /product-intelligence
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/product-intelligence/page.tsx
  - src/components/product-brain/control-center.tsx
  - src/lib/product-brain/loader.ts
  - src/lib/product-brain/access.server.ts
  - src/lib/product-brain-center/registry.ts
---

# EN: Product Intelligence (Product Brain Control Center) screen

Do not confuse this with `/process-intelligence` (screen-process-intelligence). **Product** Intelligence is an internal governance cockpit about *the product's own documentation* — decisions, regressions, UX contracts — and reads no tenant data at all. **Process** Intelligence is a portfolio analytics dashboard over the Project Event Graph. Different audiences, different gates, different data.

Access to `/product-intelligence` is enforced server-side by a strict email allowlist, `isProductBrainAllowedEmail` (TASK 10A). A non-allowlisted user gets `notFound()`, so the route's existence is never revealed and no Product Brain data is loaded or serialized. For allowed users the server calls `getAllProductBrainDocs()` — the curated markdown corpus from `docs/product-brain` — resolving `?doc=` against `DEFAULT_DOC_ID`, and passes the structured `PRODUCT_BRAIN_ITEMS` registry. The client `ProductBrainControlCenter` is tabbed: Dashboard, Decisions, Regressions, UX Contracts, Modules, ADRs/CAPs, Test Map, Guardrails and Documents. It offers full-text search, a module filter, detail panels with GitHub source links, and two server actions, `askIsabellaAboutItemAction` and `exportProductBrainAction`. Nothing here queries Supabase business tables. Related: screen-process-intelligence (the differently-named analytics dashboard), screen-admin-living-graph-observability.
Source: src/app/[locale]/(app)/product-intelligence/page.tsx, src/components/product-brain/control-center.tsx, src/lib/product-brain/access.server.ts.
Verify: with an allowlisted email, open /product-intelligence; any other account gets a 404.

# ES: Pantalla Inteligencia de Producto (Product Brain Control Center)

No la confundas con `/process-intelligence` (screen-process-intelligence). Inteligencia **de Producto** es una cabina de gobernanza interna sobre *la documentación del propio producto* — decisiones, regresiones, contratos UX — y no lee ningún dato de los clientes. Inteligencia **de Procesos** es un tablero analítico de portafolio sobre el Project Event Graph. Audiencias distintas, controles distintos, datos distintos.

El acceso a `/product-intelligence` se aplica en el servidor con una lista blanca estricta de correos, `isProductBrainAllowedEmail` (TASK 10A). Quien no esté en ella recibe `notFound()`, de modo que nunca se revela que la ruta existe y no se carga ni se serializa ningún dato del Product Brain. Para los usuarios permitidos el servidor llama a `getAllProductBrainDocs()` — el corpus markdown curado de `docs/product-brain` — resolviendo `?doc=` contra `DEFAULT_DOC_ID`, y entrega el registro estructurado `PRODUCT_BRAIN_ITEMS`. El cliente `ProductBrainControlCenter` está organizado en pestañas: Panel, Decisiones, Regresiones, Contratos UX, Módulos, ADRs/CAPs, Mapa de tests, Guardrails y Documentos. Ofrece búsqueda de texto completo, filtro por módulo, paneles de detalle con enlaces al código en GitHub y dos server actions, `askIsabellaAboutItemAction` y `exportProductBrainAction`. Nada de esto consulta tablas de negocio en Supabase. Relacionadas: screen-process-intelligence (el tablero analítico de nombre casi idéntico), screen-admin-living-graph-observability.
Fuente: src/app/[locale]/(app)/product-intelligence/page.tsx, src/components/product-brain/control-center.tsx, src/lib/product-brain/access.server.ts.
Verifica: con un correo de la lista blanca, abre /product-intelligence; cualquier otra cuenta recibe un 404.
