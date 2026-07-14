-- ============================================================================
-- P2-T3 - Isabella Process Mining Layer knowledge
-- ============================================================================
-- Incremental production seed for the three governed Isabella sources. The
-- canonical manifest also contains these packages for fresh installations.
-- Lexical retrieval works immediately; the existing indexer fills embeddings.
-- ============================================================================

WITH pkg AS (
  INSERT INTO public.knowledge_packages (organization_id, slug, domain, status, default_language)
  VALUES
    (NULL, 'pi-process-mining-layer-truth', 'product_intelligence', 'published', 'en'),
    (NULL, 'pi-process-mining-reading-views', 'product_intelligence', 'published', 'en'),
    (NULL, 'pi-isabella-process-mining-sources', 'product_intelligence', 'published', 'en')
  ON CONFLICT DO NOTHING
  RETURNING id, slug
),
ver AS (
  INSERT INTO public.knowledge_package_versions (package_id, organization_id, version_no, is_current, confidence_tier, source_refs)
  SELECT p.id, NULL, 1, true, t.tier, jsonb_build_array(t.source_ref)
  FROM pkg p
  JOIN (VALUES
    ('pi-process-mining-layer-truth', 'verified', 'isabella-process-mining-layer-training.md -> Deterministic project and event data; CAP-045'),
    ('pi-process-mining-reading-views', 'verified', 'isabella-process-mining-layer-training.md -> Reading the Process Mining Layer; CAP-046'),
    ('pi-isabella-process-mining-sources', 'verified', 'isabella-process-mining-layer-training.md -> Purpose and response policy; Product Constitution section 11')
  ) AS t(slug, tier, source_ref) ON t.slug = p.slug
  RETURNING id, package_id
),
loc AS (
  INSERT INTO public.knowledge_localizations (version_id, package_id, organization_id, language, title, body)
  SELECT v.id, v.package_id, NULL, c.language, c.title, c.body
  FROM ver v
  JOIN pkg p ON p.id = v.package_id
  JOIN (VALUES
    ('pi-process-mining-layer-truth', 'en', 'What is the source of truth for the Process Mining Layer?', 'ProjectOps360 uses canonical task, milestone and dependency owners plus the append-only Project Event Graph. Task events are framed as one case per task; milestone events as one case per milestone. The Living Graph and Milestone Process Flow are read-only projections or derived intelligence, never new owners of business facts. Isabella receives sanitized summaries and safe evidence references, never raw event payloads. Temporal order shows sequence only; causality exists only when an explicit caused_by relationship was recorded.
Source: isabella-process-mining-layer-training.md -> Source contract; CAP-045.
Verify: open Execution Map -> Living Graph -> Full audit and inspect event source, timestamps, object references and explicit relationships.'),
    ('pi-process-mining-layer-truth', 'es', 'Cual es la fuente de verdad de la capa de Process Mining?', 'ProjectOps360 usa los propietarios canonicos de tareas, hitos y dependencias junto con el Project Event Graph append-only. Los eventos de tarea forman un caso por tarea y los de hito un caso por hito. Living Graph y Milestone Process Flow son proyecciones de solo lectura o inteligencia derivada, nunca nuevos propietarios de hechos. Isabella recibe resumenes sanitizados y referencias seguras, nunca payloads crudos. El orden temporal solo muestra secuencia; hay causalidad unicamente cuando se registro una relacion caused_by explicita.
Fuente: isabella-process-mining-layer-training.md -> Contrato de fuentes; CAP-045.
Verifica: abre Execution Map -> Living Graph -> Auditoria y revisa fuente, tiempos, referencias de objeto y relaciones explicitas.'),
    ('pi-process-mining-reading-views', 'en', 'How should I read Task cases, Process and Full audit?', 'Task cases reads one task chronology at a time. Process aggregates observed activities, directly-following connections and variants across cases; coverage controls narrow the map to frequent paths. Full audit reads the canonical event projection. Milestone Flow adds deterministic transitions and derived delay, rework and bottleneck findings. Variants describe observed sequences; Statistical Root Cause reports association, lift, sample and confidence, not confirmed causation; KPI shows not computable when evidence is missing instead of inventing zero.
Source: isabella-process-mining-layer-training.md -> Reading the Process Mining Layer.
Verify: Execution Map -> Living Graph, Milestone Flow, Variants, Root Causes and KPIs.'),
    ('pi-process-mining-reading-views', 'es', 'Como se leen Casos de tarea, Proceso y Auditoria?', 'Casos de tarea lee una cronologia por tarea. Proceso agrega actividades observadas, conexiones directly-following y variantes; la cobertura reduce el mapa a rutas frecuentes. Auditoria lee la proyeccion canonica de eventos. Milestone Flow agrega transiciones deterministas y hallazgos derivados de retraso, retrabajo y cuellos de botella. Variantes describe secuencias observadas; Root Cause estadistico informa asociacion, lift, muestra y confianza, no causalidad confirmada; KPI muestra no calculable cuando falta evidencia en vez de inventar cero.
Fuente: isabella-process-mining-layer-training.md -> Lectura de la capa de Process Mining.
Verifica: Execution Map -> Living Graph, Milestone Flow, Variantes, Root Causes y KPIs.'),
    ('pi-isabella-process-mining-sources', 'en', 'Which three sources does Isabella use for Process Mining?', 'Isabella uses three governed sources: (1) deterministic, RBAC-scoped project and event queries for current facts; (2) vectorized and lexical Product Brain knowledge for product meaning and rules; and (3) deterministic screen/program context for the implemented view the user is seeing. Live project data outranks documentation for current status; Product Brain explains semantics but cannot invent current counts; screen layout explains controls but is never business truth. Isabella labels canonical, derived, statistical and guidance claims separately.
Source: isabella-process-mining-layer-training.md -> Source contract and response policy.
Verify: ask Isabella a current-status question, a how-it-works question and Explain this screen from the Process Mining Layer.'),
    ('pi-isabella-process-mining-sources', 'es', 'Que tres fuentes usa Isabella para Process Mining?', 'Isabella usa tres fuentes gobernadas: (1) queries deterministas y acotados por RBAC a datos y eventos del proyecto para hechos actuales; (2) Product Brain vectorizado y lexical para significado y reglas del producto; y (3) contexto determinista de pantalla/programa para la vista implementada que observa el usuario. Los datos actuales superan a la documentacion para estado; Product Brain explica semantica pero no inventa conteos; el layout explica controles pero nunca es verdad de negocio. Isabella separa afirmaciones canonicas, derivadas, estadisticas y de guia.
Fuente: isabella-process-mining-layer-training.md -> Contrato de fuentes y politica de respuesta.
Verifica: pregunta por estado actual, por como funciona la capa y luego pide Explica esta pantalla desde Process Mining.')
  ) AS c(slug, language, title, body) ON c.slug = p.slug
  RETURNING id, version_id, package_id, organization_id, language, body
)
INSERT INTO public.knowledge_chunks (
  localization_id, version_id, package_id, organization_id, language,
  ordinal, body, content_hash, index_status
)
SELECT
  l.id, l.version_id, l.package_id, l.organization_id, l.language,
  0, l.body, encode(digest(l.body, 'sha256'), 'hex'), 'pending'
FROM loc l;
