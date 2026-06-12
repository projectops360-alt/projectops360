-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed: Construction Activities & Dependencies — DC Labor Risk Intelligence Lab
-- 11 critical-path data center construction activities with labor assignments
-- and predecessor dependencies. Idempotent upserts.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Constants ────────────────────────────────────────────────────────────────

-- Project: Data Center Labor Risk Intelligence Lab
--   dc100000-0000-4000-8000-000000000000
-- Organization:
--   4f00f16b-96d8-4fd6-9375-20e2b11564a6

-- ═══════════════════════════════════════════════════════════════════════════════
-- ACTIVITIES
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.construction_activities
  (id, organization_id, project_id, activity_key, name, label_i18n, description_i18n,
   required_trade_key, required_crew_count, estimated_hours,
   planned_start_date, planned_end_date, location_zone, commissioning_level,
   assigned_resource_keys, status, progress, metadata, order_index)
VALUES

-- ── 1. Switchgear Installation ─────────────────────────────────────────────
--  First electrical activity on the critical path.
--  Risk: Electrical Crew C (3 HC) leaves after W29 — no backup if switchgear slips.
('7c000001-0000-4000-8000-000000000001',
 '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'switchgear-install',
 'Switchgear Installation',
 '{"en": "Switchgear Installation", "es": "Instalación de Switchgear"}',
 '{"en": "Install main distribution switchgear in Electrical Room. Energize bus and verify proper phasing. Foundation and anchor bolts must be set before arrival.", "es": "Instalar switchgear de distribución principal en el Cuarto Eléctrico. Energizar el bus y verificar el faseo correcto. La cimentación y los pernos de anclaje deben estar colocados antes de la llegada."}',
 'electrical', 2, 160.00,
 '2026-07-14', '2026-07-18',
 'Electrical Room', NULL,
 '["electrical-crew-a", "electrical-crew-b", "electrical-crew-c"]',
 'not_started', 0,
 '{"risk_flags": ["crew-shortage-w30"], "notes_i18n": {"en": "Crew C leaves after W29. If activity slips to W30, crew count drops from 13 to 10 HC.", "es": "Crew C se va después de W29. Si la actividad se retrasa a W30, el personal baja de 13 a 10 HC."}}',
 1),

-- ── 2. UPS Installation ─────────────────────────────────────────────────────
--  Depends on Switchgear. Battery strings require extended schedule.
--  Risk: Electrical Crew C already gone (W30+), only Crew A + B available.
('7c000002-0000-4000-8000-000000000002',
 '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'ups-install',
 'UPS Installation',
 '{"en": "UPS Installation", "es": "Instalación de UPS"}',
 '{"en": "Install UPS modules and battery strings in UPS Room. Connect to switchgear bus via feeders. Verify DC bus voltage and alarm thresholds.", "es": "Instalar módulos UPS y cadenas de baterías en el Cuarto de UPS. Conectar al bus de switchgear mediante alimentadores. Verificar voltaje de bus DC y umbrales de alarma."}',
 'electrical', 2, 200.00,
 '2026-07-21', '2026-07-25',
 'UPS Room', NULL,
 '["electrical-crew-a", "electrical-crew-b"]',
 'not_started', 0,
 '{"risk_flags": ["reduced-crew-w30"], "notes_i18n": {"en": "Only Crew A (6 HC) and Crew B (4 HC partial) available in W30. Crew C departed.", "es": "Solo Crew A (6 HC) y Crew B (4 HC parcial) disponibles en W30. Crew C partió."}}',
 2),

-- ── 3. Generator Setup ──────────────────────────────────────────────────────
--  Depends on Switchgear. OEM vendor must confirm availability.
--  Risk: Generator Vendor availability UNCONFIRMED for W30-W33.
('7c000003-0000-4000-8000-000000000003',
 '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'generator-setup',
 'Generator Setup',
 '{"en": "Generator Setup", "es": "Instalación de Generador"}',
 '{"en": "Set up emergency generator on pad, connect fuel lines, install transfer switch, and terminate to switchgear. Commissioning vendor runs load bank test.", "es": "Instalar generador de emergencia en base, conectar líneas de combustible, instalar interruptor de transferencia y terminar en switchgear. El proveedor de comisionamiento ejecuta prueba de banco de carga."}',
 'oem-vendor', 1, 120.00,
 '2026-07-21', '2026-07-25',
 'Generator Yard', NULL,
 '["generator-vendor"]',
 'not_started', 0,
 '{"risk_flags": ["vendor-unconfirmed"], "notes_i18n": {"en": "Generator Vendor has 4-week lead time. W30-W33 availability is tentative only. Unconfirmed as of project start.", "es": "El proveedor del generador tiene 4 semanas de plazo. Disponibilidad W30-W33 es solo tentativa. No confirmada al inicio del proyecto."}}',
 3),

-- ── 4. CRAH Installation ─────────────────────────────────────────────────────
--  Parallel with electrical. Spans W29-W30.
('7c000004-0000-4000-8000-000000000004',
 '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'crah-install',
 'CRAH Installation',
 '{"en": "CRAH Installation", "es": "Instalación de CRAH"}',
 '{"en": "Install Computer Room Air Handling units in Data Hall. Set condensate drains, connect chilled water supply, and verify airflow distribution. Required before BMS sensor wiring.", "es": "Instalar unidades CRAH en el Data Hall. Configurar drenes de condensado, conectar suministro de agua helada y verificar distribución de flujo de aire. Requerido antes del cableado de sensores BMS."}',
 'mechanical-hvac', 1, 160.00,
 '2026-07-14', '2026-07-25',
 'Data Hall', NULL,
 '["mechanical-crew-a"]',
 'not_started', 0,
 '{"risk_flags": [], "notes_i18n": {"en": "10-day span. Mechanical Crew A has partial availability in W31-W32 which does not affect this window.", "es": "Periodo de 10 días. Mechanical Crew A tiene disponibilidad parcial en W31-W32 lo cual no afecta esta ventana."}}',
 4),

-- ── 5. BMS Point-to-Point Testing ────────────────────────────────────────────
--  Depends on CRAH. Controls Tech A has partial availability W30-W31.
('7c000005-0000-4000-8000-000000000005',
 '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'bms-point-to-point',
 'BMS Point-to-Point Testing',
 '{"en": "BMS Point-to-Point Testing", "es": "Prueba Punto a Punto de BMS"}',
 '{"en": "Verify every BMS sensor and actuator point against the points list. Check analog ranges, alarm setpoints, and DDC controller responses. Must complete before L3 commissioning.", "es": "Verificar cada punto de sensor y actuador del BMS contra la lista de puntos. Verificar rangos analógicos, setpoints de alarma y respuestas del controlador DDC. Debe completarse antes del comisionamiento L3."}',
 'controls-bms', 1, 80.00,
 '2026-07-28', '2026-08-01',
 'All Zones', 'L3',
 '["controls-tech-a"]',
 'not_started', 0,
 '{"risk_flags": ["specialist-partial-availability"], "notes_i18n": {"en": "Controls Tech A has partial availability W30-W31 (50% capacity). This 5-day task may stretch if specialist is pulled to another project.", "es": "Controls Tech A tiene disponibilidad parcial W30-W31 (50% capacidad). Esta tarea de 5 días puede extenderse si el especialista es asignado a otro proyecto."}}',
 5),

-- ── 6. Fiber Pathway Installation ───────────────────────────────────────────
--  Parallel with electrical and mechanical. No hard predecessor.
('7c000006-0000-4000-8000-000000000006',
 '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'fiber-pathway',
 'Fiber Pathway Installation',
 '{"en": "Fiber Pathway Installation", "es": "Instalación de Ruta de Fibra"}',
 '{"en": "Install fiber optic cable pathways, trays, and J-hooks in Data Hall corridors. Pull single-mode and multi-mode fiber to IDF/MDF locations. Terminate and test with OTDR.", "es": "Instalar rutas de cable de fibra óptica, charolas y soportes J en los pasillos del Data Hall. Tirar fibra monomodo y multimodo a ubicaciones IDF/MDF. Terminar y probar con OTDR."}',
 'low-voltage-fiber', 1, 120.00,
 '2026-07-14', '2026-07-25',
 'Data Hall Corridors', NULL,
 '["fiber-crew-a"]',
 'not_started', 0,
 '{"risk_flags": [], "notes_i18n": {"en": "No constraints on Fiber Crew A. Clean execution window W29-W30.", "es": "Sin restricciones en Fiber Crew A. Ventana de ejecución limpia W29-W30."}}',
 6),

-- ── 7. Electrical Room QA ───────────────────────────────────────────────────
--  Depends on Switchgear + UPS. QA/QC Inspector is OVER-ALLOCATED.
('7c000007-0000-4000-8000-000000000007',
 '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'electrical-room-qa',
 'Electrical Room QA',
 '{"en": "Electrical Room QA", "es": "QC del Cuarto Eléctrico"}',
 '{"en": "Quality inspection of Electrical Room and UPS Room installations. Verify torque marks, labeling, clearances, grounding, and NEC compliance. Must pass before L3 commissioning can begin.", "es": "Inspección de calidad de las instalaciones del Cuarto Eléctrico y Cuarto de UPS. Verificar marcas de torque, etiquetado, separaciones, puesta a tierra y cumplimiento NEC. Debe aprobarse antes de que comience el comisionamiento L3."}',
 'qa-qc', 1, 40.00,
 '2026-07-28', '2026-07-30',
 'Electrical Room', 'L3',
 '["qa-qc-inspector"]',
 'not_started', 0,
 '{"risk_flags": ["inspector-over-allocated"], "notes_i18n": {"en": "QA/QC Inspector is over-allocated across 2 concurrent projects. Real capacity is 50-60%. 3-day task may take 5 days.", "es": "El Inspector de QC está sobreasignado en 2 proyectos concurrentes. Capacidad real es 50-60%. Tarea de 3 días puede tomar 5 días."}}',
 7),

-- ── 8. L3 Pre-functional Testing ────────────────────────────────────────────
--  GATE: Converges from BMS, Electrical QA, and Fiber.
('7c000008-0000-4000-8000-000000000008',
 '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'l3-pre-functional',
 'L3 Pre-functional Testing',
 '{"en": "L3 Pre-functional Testing", "es": "Prueba Pre-funcional L3"}',
 '{"en": "Level 3 pre-functional commissioning: verify individual component operation, controller logic, alarm responses, and sensor calibration across all systems. Requires BMS, Electrical QA, and Fiber pathways complete.", "es": "Comisionamiento pre-funcional Nivel 3: verificar operación individual de componentes, lógica de controladores, respuestas de alarmas y calibración de sensores en todos los sistemas. Requiere BMS, QC Eléctrico y rutas de Fibra completos."}',
 'commissioning', 1, 80.00,
 '2026-07-31', '2026-08-04',
 'All Zones', 'L3',
 '["commissioning-agent"]',
 'not_started', 0,
 '{"risk_flags": ["commissioning-spof", "convergence-gate"], "notes_i18n": {"en": "Commissioning Agent is single point of failure — over-allocated across 2 projects. This is a convergence gate: BMS, Electrical QA, AND Fiber must all complete before this can start.", "es": "El Agente de Comisionamiento es punto único de falla — sobreasignado en 2 proyectos. Esta es una puerta de convergencia: BMS, QC Eléctrico Y Fibra deben completarse antes de que esto pueda iniciar."}}',
 8),

-- ── 9. L4 UPS Functional Test ───────────────────────────────────────────────
--  Depends on L3. Requires UPS OEM Technician.
('7c000009-0000-4000-8000-000000000009',
 '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'l4-ups-functional',
 'L4 UPS Functional Test',
 '{"en": "L4 UPS Functional Test", "es": "Prueba Funcional L4 de UPS"}',
 '{"en": "Level 4 functional commissioning: full load bank test on UPS system, battery discharge test, static bypass transfer, and generator pick-up verification. Requires UPS OEM Technician on-site.", "es": "Comisionamiento funcional Nivel 4: prueba de banco de carga completa en sistema UPS, prueba de descarga de baterías, transferencia de bypass estático y verificación de toma del generador. Requiere Técnico OEM de UPS en sitio."}',
 'oem-vendor', 1, 60.00,
 '2026-08-04', '2026-08-06',
 'UPS Room', 'L4',
 '["ups-oem-tech"]',
 'not_started', 0,
 '{"risk_flags": ["vendor-unconfirmed"], "notes_i18n": {"en": "UPS OEM Technician availability for W32 is UNCONFIRMED. 6-week lead time. If vendor cannot confirm, L4 and all downstream activities (L5, Handover) are blocked.", "es": "Disponibilidad del Técnico OEM de UPS para W32 NO CONFIRMADA. 6 semanas de plazo. Si el proveedor no confirma, L4 y todas las actividades posteriores (L5, Entrega) quedan bloqueadas."}}',
 9),

-- ── 10. L5 Integrated Systems Test ──────────────────────────────────────────
--  Depends on L4. Full integrated systems commissioning.
('7c00000a-0000-4000-8000-00000000000a',
 '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'l5-integrated-test',
 'L5 Integrated Systems Test',
 '{"en": "L5 Integrated Systems Test", "es": "Prueba de Sistemas Integrados L5"}',
 '{"en": "Level 5 integrated systems commissioning: full facility failover test including utility loss, generator pick-up, UPS carry-through, and cooling restart. Verify all systems operate as an integrated whole under emergency conditions.", "es": "Comisionamiento de sistemas integrados Nivel 5: prueba de conmutación completa de la instalación incluyendo pérdida de utilidad, toma del generador, soporte del UPS y reinicio de enfriamiento. Verificar que todos los sistemas operen como un todo integrado bajo condiciones de emergencia."}',
 'commissioning', 1, 80.00,
 '2026-08-06', '2026-08-07',
 'All Zones', 'L5',
 '["commissioning-agent"]',
 'not_started', 0,
 '{"risk_flags": ["commissioning-spof"], "notes_i18n": {"en": "Commissioning Agent is the same SPOF from L3. If L4 slips due to UPS vendor, this compresses into a single-day window.", "es": "El Agente de Comisionamiento es el mismo punto único de falla de L3. Si L4 se retrasa por el proveedor de UPS, esto se comprime a una ventana de un solo día."}}',
 10),

-- ── 11. Client Handover ─────────────────────────────────────────────────────
--  Depends on L5. Owner Witness must be present for final sign-off.
('7c00000b-0000-4000-8000-00000000000b',
 '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'client-handover',
 'Client Handover',
 '{"en": "Client Handover", "es": "Entrega al Cliente"}',
 '{"en": "Final client handover walk-through and sign-off. Owner Witness inspects all systems, reviews commissioning reports, and signs acceptance certificate. Requires L5 completion and Owner Witness presence.", "es": "Recorrido final de entrega al cliente y aprobación. El Representante del Propietario inspecciona todos los sistemas, revisa informes de comisionamiento y firma el certificado de aceptación. Requiere completar L5 y presencia del Representante del Propietario."}',
 'owner-witness', 1, 40.00,
 '2026-08-07', '2026-08-08',
 'All Zones', 'L6',
 '["owner-witness"]',
 'not_started', 0,
 '{"risk_flags": ["witness-late-arrival"], "notes_i18n": {"en": "Owner Witness only available starting W32 (Aug 4). If L5 completes in W32, handover can proceed. If L5 slips past W32, witness availability is NOT the bottleneck — but if it slips past W34, witness departs.", "es": "El Representante del Propietario solo está disponible a partir de W32 (4 Ago). Si L5 completa en W32, la entrega puede proceder. Si L5 se retrasa más allá de W32, la disponibilidad del representante NO es el cuello de botella — pero si se retrasa más de W34, el representante se va."}}',
 11)

ON CONFLICT (organization_id, project_id, activity_key) WHERE deleted_at IS NULL DO UPDATE SET
  name                   = EXCLUDED.name,
  label_i18n             = EXCLUDED.label_i18n,
  description_i18n       = EXCLUDED.description_i18n,
  required_trade_key     = EXCLUDED.required_trade_key,
  required_crew_count    = EXCLUDED.required_crew_count,
  estimated_hours        = EXCLUDED.estimated_hours,
  planned_start_date     = EXCLUDED.planned_start_date,
  planned_end_date       = EXCLUDED.planned_end_date,
  location_zone          = EXCLUDED.location_zone,
  commissioning_level    = EXCLUDED.commissioning_level,
  assigned_resource_keys = EXCLUDED.assigned_resource_keys,
  status                 = EXCLUDED.status,
  progress               = EXCLUDED.progress,
  metadata               = EXCLUDED.metadata,
  order_index            = EXCLUDED.order_index,
  updated_at             = now();

-- ═══════════════════════════════════════════════════════════════════════════════
-- ACTIVITY DEPENDENCIES
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Dependency Graph:
--
--   Switchgear ──┬──→ UPS Install ──→ Electrical Room QA ──┐
--                └──→ Generator Setup                              │
--                                                                  ├──→ L3 Pre-functional ──→ L4 UPS Func ──→ L5 Integrated ──→ Client Handover
--   CRAH Install ──→ BMS P2P ──────────────────────────────────┤
--                                                                  │
--   Fiber Pathway ──────────────────────────────────────────────┘
--
-- Critical Path: Switchgear → UPS → Electrical Room QA → L3 → L4 → L5 → Handover
-- Near-Critical: CRAH → BMS P2P → L3 (converges at L3 gate)
-- Independent:   Fiber → L3 (converges at L3 gate)
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.activity_dependencies
  (organization_id, project_id, predecessor_id, successor_id, dependency_type, lag_days)
VALUES

-- Switchgear → UPS Installation (critical path)
('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 '7c000001-0000-4000-8000-000000000001',
 '7c000002-0000-4000-8000-000000000002',
 'finish_to_start', 0),

-- Switchgear → Generator Setup (parallel with UPS)
('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 '7c000001-0000-4000-8000-000000000001',
 '7c000003-0000-4000-8000-000000000003',
 'finish_to_start', 0),

-- CRAH → BMS Point-to-Point (near-critical path)
('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 '7c000004-0000-4000-8000-000000000004',
 '7c000005-0000-4000-8000-000000000005',
 'finish_to_start', 0),

-- Switchgear → Electrical Room QA (critical path branch)
('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 '7c000001-0000-4000-8000-000000000001',
 '7c000007-0000-4000-8000-000000000007',
 'finish_to_start', 0),

-- UPS → Electrical Room QA (critical path)
('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 '7c000002-0000-4000-8000-000000000002',
 '7c000007-0000-4000-8000-000000000007',
 'finish_to_start', 0),

-- BMS P2P → L3 Pre-functional (near-critical converges at L3 gate)
('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 '7c000005-0000-4000-8000-000000000005',
 '7c000008-0000-4000-8000-000000000008',
 'finish_to_start', 0),

-- Electrical Room QA → L3 Pre-functional (critical path converges at L3 gate)
('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 '7c000007-0000-4000-8000-000000000007',
 '7c000008-0000-4000-8000-000000000008',
 'finish_to_start', 0),

-- Fiber Pathway → L3 Pre-functional (independent path converges at L3 gate)
('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 '7c000006-0000-4000-8000-000000000006',
 '7c000008-0000-4000-8000-000000000008',
 'finish_to_start', 0),

-- L3 Pre-functional → L4 UPS Functional (critical path)
('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 '7c000008-0000-4000-8000-000000000008',
 '7c000009-0000-4000-8000-000000000009',
 'finish_to_start', 0),

-- L4 UPS Functional → L5 Integrated Systems (critical path)
('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 '7c000009-0000-4000-8000-000000000009',
 '7c00000a-0000-4000-8000-00000000000a',
 'finish_to_start', 0),

-- L5 Integrated Systems → Client Handover (critical path terminus)
('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 '7c00000a-0000-4000-8000-00000000000a',
 '7c00000b-0000-4000-8000-00000000000b',
 'finish_to_start', 0)

ON CONFLICT (predecessor_id, successor_id, dependency_type) DO UPDATE SET
  lag_days = EXCLUDED.lag_days;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (run manually to verify)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- SELECT activity_key, name, required_trade_key, required_crew_count,
--        estimated_hours, planned_start_date, planned_end_date,
--        location_zone, commissioning_level, assigned_resource_keys
-- FROM public.construction_activities
-- WHERE project_id = 'dc100000-0000-4000-8000-000000000000'
--   AND deleted_at IS NULL
-- ORDER BY order_index;
--
-- SELECT
--   p.activity_key AS predecessor,
--   s.activity_key AS successor,
--   d.dependency_type,
--   d.lag_days
-- FROM public.activity_dependencies d
-- JOIN public.construction_activities p ON p.id = d.predecessor_id
-- JOIN public.construction_activities s ON s.id = d.successor_id
-- WHERE d.project_id = 'dc100000-0000-4000-8000-000000000000'
-- ORDER BY p.order_index, s.order_index;
--