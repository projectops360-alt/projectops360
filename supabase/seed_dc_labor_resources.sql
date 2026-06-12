-- ═══════════════════════════════════════════════════════════════════════════════
-- Data Center Labor Risk Intelligence Lab — Labor Resources Seed
-- DCL-003: Seed crews, specialists, and availability constraints
-- This file is idempotent: safe to re-run (uses ON CONFLICT upserts on resource_key)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Constants ──────────────────────────────────────────────────────────────────
-- organization_id: 4f00f16b-96d8-4fd6-9375-20e2b11564a6
-- project_id:      dc100000-0000-4000-8000-000000000000

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Electrical Crew A — full availability, no constraints
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO labor_resources (
  organization_id, project_id, resource_key, name, trade_key, label_i18n,
  resource_type, skill_level, headcount, capacity_hours_per_week,
  availability, constraints, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'electrical-crew-a',
  'Electrical Crew A',
  'electrical',
  '{"en": "Electrical Crew A", "es": "Cuadrilla Eléctrica A"}',
  'crew', 'journeyman', 6, 240,
  '[
    {"week":"2026-W29","start":"2026-07-14","end":"2026-07-18","available_hours":240,"status":"available"},
    {"week":"2026-W30","start":"2026-07-21","end":"2026-07-25","available_hours":240,"status":"available"},
    {"week":"2026-W31","start":"2026-07-28","end":"2026-08-01","available_hours":240,"status":"available"},
    {"week":"2026-W32","start":"2026-08-04","end":"2026-08-08","available_hours":240,"status":"available"},
    {"week":"2026-W33","start":"2026-08-11","end":"2026-08-15","available_hours":240,"status":"available"},
    {"week":"2026-W34","start":"2026-08-18","end":"2026-08-22","available_hours":240,"status":"available"}
  ]'::jsonb,
  '{"type":"none","description_i18n":{"en":"Full availability for the project duration.","es":"Disponibilidad completa durante el proyecto."},"confirmed":true}'::jsonb,
  1
)
ON CONFLICT (organization_id, project_id, resource_key) WHERE deleted_at IS NULL DO UPDATE SET
  name=EXCLUDED.name, trade_key=EXCLUDED.trade_key, label_i18n=EXCLUDED.label_i18n,
  resource_type=EXCLUDED.resource_type, skill_level=EXCLUDED.skill_level,
  headcount=EXCLUDED.headcount, capacity_hours_per_week=EXCLUDED.capacity_hours_per_week,
  availability=EXCLUDED.availability, constraints=EXCLUDED.constraints,
  updated_at=now();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Electrical Crew B — partial availability W30-W31
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO labor_resources (
  organization_id, project_id, resource_key, name, trade_key, label_i18n,
  resource_type, skill_level, headcount, capacity_hours_per_week,
  availability, constraints, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'electrical-crew-b',
  'Electrical Crew B',
  'electrical',
  '{"en": "Electrical Crew B", "es": "Cuadrilla Eléctrica B"}',
  'crew', 'journeyman', 4, 160,
  '[
    {"week":"2026-W29","start":"2026-07-14","end":"2026-07-18","available_hours":160,"status":"available"},
    {"week":"2026-W30","start":"2026-07-21","end":"2026-07-25","available_hours":96,"status":"partial"},
    {"week":"2026-W31","start":"2026-07-28","end":"2026-08-01","available_hours":80,"status":"partial"},
    {"week":"2026-W32","start":"2026-08-04","end":"2026-08-08","available_hours":160,"status":"available"},
    {"week":"2026-W33","start":"2026-08-11","end":"2026-08-15","available_hours":160,"status":"available"},
    {"week":"2026-W34","start":"2026-08-18","end":"2026-08-22","available_hours":160,"status":"available"}
  ]'::jsonb,
  '{"type":"partial_availability","description_i18n":{"en":"Crew B is shared with another project during W30-W31, reducing available hours by 40-50%.","es":"La Cuadrilla B se comparte con otro proyecto durante W30-W31, reduciendo las horas disponibles en 40-50%."},"concurrent_projects":2,"confirmed":true}'::jsonb,
  2
)
ON CONFLICT (organization_id, project_id, resource_key) WHERE deleted_at IS NULL DO UPDATE SET
  name=EXCLUDED.name, trade_key=EXCLUDED.trade_key, label_i18n=EXCLUDED.label_i18n,
  resource_type=EXCLUDED.resource_type, skill_level=EXCLUDED.skill_level,
  headcount=EXCLUDED.headcount, capacity_hours_per_week=EXCLUDED.capacity_hours_per_week,
  availability=EXCLUDED.availability, constraints=EXCLUDED.constraints,
  updated_at=now();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Electrical Crew C — SHORTAGE: only W29, then off-project
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO labor_resources (
  organization_id, project_id, resource_key, name, trade_key, label_i18n,
  resource_type, skill_level, headcount, capacity_hours_per_week,
  availability, constraints, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'electrical-crew-c',
  'Electrical Crew C',
  'electrical',
  '{"en": "Electrical Crew C", "es": "Cuadrilla Eléctrica C"}',
  'crew', 'senior', 3, 120,
  '[
    {"week":"2026-W29","start":"2026-07-14","end":"2026-07-18","available_hours":120,"status":"available"},
    {"week":"2026-W30","start":"2026-07-21","end":"2026-07-25","available_hours":0,"status":"unavailable"},
    {"week":"2026-W31","start":"2026-07-28","end":"2026-08-01","available_hours":0,"status":"unavailable"},
    {"week":"2026-W32","start":"2026-08-04","end":"2026-08-08","available_hours":0,"status":"unavailable"},
    {"week":"2026-W33","start":"2026-08-11","end":"2026-08-15","available_hours":0,"status":"unavailable"},
    {"week":"2026-W34","start":"2026-08-18","end":"2026-08-22","available_hours":0,"status":"unavailable"}
  ]'::jsonb,
  '{"type":"shortage","description_i18n":{"en":"Senior crew reassigned to another project after W29. Creates an electrical labor gap of 120 hrs/week from W30 onward. Combined with Crew B partial availability, the electrical trade is under-staffed for critical switchgear and UPS installation work.","es":"Cuadrilla senior reasignada a otro proyecto después de W29. Crea una brecha laboral eléctrica de 120 hrs/semana desde W30. Combinada con la disponibilidad parcial de la Cuadrilla B, el oficio eléctrico está sub-dotado para el trabajo crítico de switchgear e instalación de UPS."},"concurrent_projects":1,"confirmed":true}'::jsonb,
  3
)
ON CONFLICT (organization_id, project_id, resource_key) WHERE deleted_at IS NULL DO UPDATE SET
  name=EXCLUDED.name, trade_key=EXCLUDED.trade_key, label_i18n=EXCLUDED.label_i18n,
  resource_type=EXCLUDED.resource_type, skill_level=EXCLUDED.skill_level,
  headcount=EXCLUDED.headcount, capacity_hours_per_week=EXCLUDED.capacity_hours_per_week,
  availability=EXCLUDED.availability, constraints=EXCLUDED.constraints,
  updated_at=now();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Mechanical Crew A — partial availability W31-W32
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO labor_resources (
  organization_id, project_id, resource_key, name, trade_key, label_i18n,
  resource_type, skill_level, headcount, capacity_hours_per_week,
  availability, constraints, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'mechanical-crew-a',
  'Mechanical Crew A',
  'mechanical-hvac',
  '{"en": "Mechanical Crew A", "es": "Cuadrilla Mecánica A"}',
  'crew', 'journeyman', 5, 200,
  '[
    {"week":"2026-W29","start":"2026-07-14","end":"2026-07-18","available_hours":200,"status":"available"},
    {"week":"2026-W30","start":"2026-07-21","end":"2026-07-25","available_hours":200,"status":"available"},
    {"week":"2026-W31","start":"2026-07-28","end":"2026-08-01","available_hours":120,"status":"partial"},
    {"week":"2026-W32","start":"2026-08-04","end":"2026-08-08","available_hours":100,"status":"partial"},
    {"week":"2026-W33","start":"2026-08-11","end":"2026-08-15","available_hours":200,"status":"available"},
    {"week":"2026-W34","start":"2026-08-18","end":"2026-08-22","available_hours":200,"status":"available"}
  ]'::jsonb,
  '{"type":"partial_availability","description_i18n":{"en":"Mechanical Crew A has reduced capacity during W31-W32 due to overlap with another data center project finishing punch list work. This delays CRAH installation and chiller piping completion.","es":"La Cuadrilla Mecánica A tiene capacidad reducida durante W31-W32 por superposición con otro proyecto de centro de datos terminando trabajo de punch list. Esto retrasa la instalación de CRAH y la terminación de tubería de chiller."},"concurrent_projects":2,"confirmed":true}'::jsonb,
  4
)
ON CONFLICT (organization_id, project_id, resource_key) WHERE deleted_at IS NULL DO UPDATE SET
  name=EXCLUDED.name, trade_key=EXCLUDED.trade_key, label_i18n=EXCLUDED.label_i18n,
  resource_type=EXCLUDED.resource_type, skill_level=EXCLUDED.skill_level,
  headcount=EXCLUDED.headcount, capacity_hours_per_week=EXCLUDED.capacity_hours_per_week,
  availability=EXCLUDED.availability, constraints=EXCLUDED.constraints,
  updated_at=now();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. Controls Tech A — partial availability W30-W31
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO labor_resources (
  organization_id, project_id, resource_key, name, trade_key, label_i18n,
  resource_type, skill_level, headcount, capacity_hours_per_week,
  availability, constraints, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'controls-tech-a',
  'Controls Tech A',
  'controls-bms',
  '{"en": "Controls Tech A", "es": "Técnico de Controles A"}',
  'specialist', 'senior', 1, 40,
  '[
    {"week":"2026-W29","start":"2026-07-14","end":"2026-07-18","available_hours":40,"status":"available"},
    {"week":"2026-W30","start":"2026-07-21","end":"2026-07-25","available_hours":24,"status":"partial"},
    {"week":"2026-W31","start":"2026-07-28","end":"2026-08-01","available_hours":20,"status":"partial"},
    {"week":"2026-W32","start":"2026-08-04","end":"2026-08-08","available_hours":40,"status":"available"},
    {"week":"2026-W33","start":"2026-08-11","end":"2026-08-15","available_hours":40,"status":"available"},
    {"week":"2026-W34","start":"2026-08-18","end":"2026-08-22","available_hours":40,"status":"available"}
  ]'::jsonb,
  '{"type":"partial_availability","description_i18n":{"en":"Controls Tech A is finishing DDC programming on another site during W30-W31, limiting BMS commissioning start. Point-to-point checkout may be delayed.","es":"El Técnico de Controles A está terminando programación DDC en otro sitio durante W30-W31, limitando el inicio de la puesta en servicio del BMS. La verificación punto a punto puede retrasarse."},"concurrent_projects":2,"confirmed":true}'::jsonb,
  5
)
ON CONFLICT (organization_id, project_id, resource_key) WHERE deleted_at IS NULL DO UPDATE SET
  name=EXCLUDED.name, trade_key=EXCLUDED.trade_key, label_i18n=EXCLUDED.label_i18n,
  resource_type=EXCLUDED.resource_type, skill_level=EXCLUDED.skill_level,
  headcount=EXCLUDED.headcount, capacity_hours_per_week=EXCLUDED.capacity_hours_per_week,
  availability=EXCLUDED.availability, constraints=EXCLUDED.constraints,
  updated_at=now();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. Fiber Crew A — full availability, no constraints
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO labor_resources (
  organization_id, project_id, resource_key, name, trade_key, label_i18n,
  resource_type, skill_level, headcount, capacity_hours_per_week,
  availability, constraints, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'fiber-crew-a',
  'Fiber Crew A',
  'low-voltage-fiber',
  '{"en": "Fiber Crew A", "es": "Cuadrilla de Fibra A"}',
  'crew', 'journeyman', 4, 160,
  '[
    {"week":"2026-W29","start":"2026-07-14","end":"2026-07-18","available_hours":160,"status":"available"},
    {"week":"2026-W30","start":"2026-07-21","end":"2026-07-25","available_hours":160,"status":"available"},
    {"week":"2026-W31","start":"2026-07-28","end":"2026-08-01","available_hours":160,"status":"available"},
    {"week":"2026-W32","start":"2026-08-04","end":"2026-08-08","available_hours":160,"status":"available"},
    {"week":"2026-W33","start":"2026-08-11","end":"2026-08-15","available_hours":160,"status":"available"},
    {"week":"2026-W34","start":"2026-08-18","end":"2026-08-22","available_hours":160,"status":"available"}
  ]'::jsonb,
  '{"type":"none","description_i18n":{"en":"Full availability for the project duration.","es":"Disponibilidad completa durante el proyecto."},"confirmed":true}'::jsonb,
  6
)
ON CONFLICT (organization_id, project_id, resource_key) WHERE deleted_at IS NULL DO UPDATE SET
  name=EXCLUDED.name, trade_key=EXCLUDED.trade_key, label_i18n=EXCLUDED.label_i18n,
  resource_type=EXCLUDED.resource_type, skill_level=EXCLUDED.skill_level,
  headcount=EXCLUDED.headcount, capacity_hours_per_week=EXCLUDED.capacity_hours_per_week,
  availability=EXCLUDED.availability, constraints=EXCLUDED.constraints,
  updated_at=now();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. QA/QC Inspector — OVER-ALLOCATED (2 concurrent projects)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO labor_resources (
  organization_id, project_id, resource_key, name, trade_key, label_i18n,
  resource_type, skill_level, headcount, capacity_hours_per_week,
  availability, constraints, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'qa-qc-inspector',
  'QA/QC Inspector',
  'qa-qc',
  '{"en": "QA/QC Inspector", "es": "Inspector QA/QC"}',
  'inspector', 'senior', 1, 40,
  '[
    {"week":"2026-W29","start":"2026-07-14","end":"2026-07-18","available_hours":20,"status":"partial"},
    {"week":"2026-W30","start":"2026-07-21","end":"2026-07-25","available_hours":24,"status":"partial"},
    {"week":"2026-W31","start":"2026-07-28","end":"2026-08-01","available_hours":20,"status":"partial"},
    {"week":"2026-W32","start":"2026-08-04","end":"2026-08-08","available_hours":24,"status":"partial"},
    {"week":"2026-W33","start":"2026-08-11","end":"2026-08-15","available_hours":20,"status":"partial"},
    {"week":"2026-W34","start":"2026-08-18","end":"2026-08-22","available_hours":24,"status":"partial"}
  ]'::jsonb,
  '{"type":"over-allocated","description_i18n":{"en":"QA/QC Inspector is serving 2 concurrent projects. Only 50-60% of capacity is available for this project. Creates a quality gate bottleneck: L3 pre-functional testing sign-offs may be delayed, blocking commissioning start for electrical and mechanical systems.","es":"El Inspector QA/QC está sirviendo 2 proyectos concurrentes. Solo 50-60% de su capacidad está disponible para este proyecto. Crea un cuello de botella en la puerta de calidad: las aprobaciones de pruebas pre-funcionales L3 pueden retrasarse, bloqueando el inicio de la puesta en servicio de sistemas eléctricos y mecánicos."},"concurrent_projects":2,"confirmed":true}'::jsonb,
  7
)
ON CONFLICT (organization_id, project_id, resource_key) WHERE deleted_at IS NULL DO UPDATE SET
  name=EXCLUDED.name, trade_key=EXCLUDED.trade_key, label_i18n=EXCLUDED.label_i18n,
  resource_type=EXCLUDED.resource_type, skill_level=EXCLUDED.skill_level,
  headcount=EXCLUDED.headcount, capacity_hours_per_week=EXCLUDED.capacity_hours_per_week,
  availability=EXCLUDED.availability, constraints=EXCLUDED.constraints,
  updated_at=now();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. Commissioning Agent — OVER-ALLOCATED (2 concurrent projects, W29-W33)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO labor_resources (
  organization_id, project_id, resource_key, name, trade_key, label_i18n,
  resource_type, skill_level, headcount, capacity_hours_per_week,
  availability, constraints, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'commissioning-agent',
  'Commissioning Agent',
  'commissioning',
  '{"en": "Commissioning Agent", "es": "Agente de Puesta en Servicio"}',
  'specialist', 'master', 1, 40,
  '[
    {"week":"2026-W29","start":"2026-07-14","end":"2026-07-18","available_hours":16,"status":"partial"},
    {"week":"2026-W30","start":"2026-07-21","end":"2026-07-25","available_hours":20,"status":"partial"},
    {"week":"2026-W31","start":"2026-07-28","end":"2026-08-01","available_hours":16,"status":"partial"},
    {"week":"2026-W32","start":"2026-08-04","end":"2026-08-08","available_hours":20,"status":"partial"},
    {"week":"2026-W33","start":"2026-08-11","end":"2026-08-15","available_hours":16,"status":"partial"},
    {"week":"2026-W34","start":"2026-08-18","end":"2026-08-22","available_hours":40,"status":"available"}
  ]'::jsonb,
  '{"type":"over-allocated","description_i18n":{"en":"Commissioning Agent is the single most critical resource and is over-allocated across 2 projects during W29-W33. Only 40-50% capacity available. This creates a single-point-of-failure risk: if the other project has urgent commissioning needs, test windows for L3/L4/L5 may be missed. Full availability only in W34 after the other project completes.","es":"El Agente de Puesta en Servicio es el recurso más crítico y está sobreasignado en 2 proyectos durante W29-W33. Solo 40-50% de capacidad disponible. Esto crea un riesgo de punto único de falla: si el otro proyecto tiene necesidades urgentes de puesta en servicio, las ventanas de prueba L3/L4/L5 pueden perderse. Disponibilidad completa solo en W34 después de que el otro proyecto termine."},"concurrent_projects":2,"confirmed":true}'::jsonb,
  8
)
ON CONFLICT (organization_id, project_id, resource_key) WHERE deleted_at IS NULL DO UPDATE SET
  name=EXCLUDED.name, trade_key=EXCLUDED.trade_key, label_i18n=EXCLUDED.label_i18n,
  resource_type=EXCLUDED.resource_type, skill_level=EXCLUDED.skill_level,
  headcount=EXCLUDED.headcount, capacity_hours_per_week=EXCLUDED.capacity_hours_per_week,
  availability=EXCLUDED.availability, constraints=EXCLUDED.constraints,
  updated_at=now();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. UPS OEM Technician — VENDOR UNCONFIRMED (lead 6wk, W31-W32 unconfirmed)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO labor_resources (
  organization_id, project_id, resource_key, name, trade_key, label_i18n,
  resource_type, skill_level, headcount, capacity_hours_per_week,
  availability, constraints, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'ups-oem-tech',
  'UPS OEM Technician',
  'oem-vendor',
  '{"en": "UPS OEM Technician", "es": "Técnico OEM de UPS"}',
  'vendor', 'senior', 1, 40,
  '[
    {"week":"2026-W29","start":"2026-07-14","end":"2026-07-18","available_hours":0,"status":"unavailable"},
    {"week":"2026-W30","start":"2026-07-21","end":"2026-07-25","available_hours":0,"status":"unavailable"},
    {"week":"2026-W31","start":"2026-07-28","end":"2026-08-01","available_hours":0,"status":"unavailable"},
    {"week":"2026-W32","start":"2026-08-04","end":"2026-08-08","available_hours":0,"status":"unavailable"},
    {"week":"2026-W33","start":"2026-08-11","end":"2026-08-15","available_hours":40,"status":"available"},
    {"week":"2026-W34","start":"2026-08-18","end":"2026-08-22","available_hours":40,"status":"available"}
  ]'::jsonb,
  '{"type":"vendor_unconfirmed","description_i18n":{"en":"UPS OEM Technician availability is NOT confirmed. Vendor quoted 6-week lead time but the W31-W32 window remains unconfirmed. If the technician cannot commit, the entire UPS start-up and L4 load bank test sequence is blocked. This is a critical-path vendor dependency with unconfirmed scheduling.","es":"La disponibilidad del Técnico OEM de UPS NO está confirmada. El proveedor cotizó 6 semanas de anticipación pero la ventana W31-W32 permanece sin confirmar. Si el técnico no puede comprometerse, toda la secuencia de arranque de UPS y prueba de banco de carga L4 queda bloqueada. Esta es una dependencia de proveedor de camino crítico con programación sin confirmar."},"lead_time_weeks":6,"concurrent_projects":1,"confirmed":false}'::jsonb,
  9
)
ON CONFLICT (organization_id, project_id, resource_key) WHERE deleted_at IS NULL DO UPDATE SET
  name=EXCLUDED.name, trade_key=EXCLUDED.trade_key, label_i18n=EXCLUDED.label_i18n,
  resource_type=EXCLUDED.resource_type, skill_level=EXCLUDED.skill_level,
  headcount=EXCLUDED.headcount, capacity_hours_per_week=EXCLUDED.capacity_hours_per_week,
  availability=EXCLUDED.availability, constraints=EXCLUDED.constraints,
  updated_at=now();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. Generator Vendor — VENDOR UNCONFIRMED (lead 4wk, W32-W33 tentative)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO labor_resources (
  organization_id, project_id, resource_key, name, trade_key, label_i18n,
  resource_type, skill_level, headcount, capacity_hours_per_week,
  availability, constraints, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'generator-vendor',
  'Generator Vendor',
  'oem-vendor',
  '{"en": "Generator Vendor", "es": "Proveedor de Generador"}',
  'vendor', 'senior', 1, 40,
  '[
    {"week":"2026-W29","start":"2026-07-14","end":"2026-07-18","available_hours":0,"status":"unavailable"},
    {"week":"2026-W30","start":"2026-07-21","end":"2026-07-25","available_hours":0,"status":"unavailable"},
    {"week":"2026-W31","start":"2026-07-28","end":"2026-08-01","available_hours":0,"status":"unavailable"},
    {"week":"2026-W32","start":"2026-08-04","end":"2026-08-08","available_hours":40,"status":"available"},
    {"week":"2026-W33","start":"2026-08-11","end":"2026-08-15","available_hours":40,"status":"available"},
    {"week":"2026-W34","start":"2026-08-18","end":"2026-08-22","available_hours":0,"status":"unavailable"}
  ]'::jsonb,
  '{"type":"vendor_unconfirmed","description_i18n":{"en":"Generator Vendor availability is tentative. W32-W33 window is scheduled but not yet confirmed by the manufacturer. 4-week lead time quoted. If the vendor cancels or reschedules, generator start-up and load bank testing are delayed, which blocks ATS transfer testing and downstream L5 integrated systems testing.","es":"La disponibilidad del Proveedor de Generador es tentativa. La ventana W32-W33 está programada pero aún no confirmada por el fabricante. Cotizó 4 semanas de anticipación. Si el proveedor cancela o reprograma, el arranque del generador y la prueba de banco de carga se retrasan, lo que bloquea la prueba de transferencia ATS y las pruebas integradas L5 posteriores."},"lead_time_weeks":4,"concurrent_projects":1,"confirmed":false}'::jsonb,
  10
)
ON CONFLICT (organization_id, project_id, resource_key) WHERE deleted_at IS NULL DO UPDATE SET
  name=EXCLUDED.name, trade_key=EXCLUDED.trade_key, label_i18n=EXCLUDED.label_i18n,
  resource_type=EXCLUDED.resource_type, skill_level=EXCLUDED.skill_level,
  headcount=EXCLUDED.headcount, capacity_hours_per_week=EXCLUDED.capacity_hours_per_week,
  availability=EXCLUDED.availability, constraints=EXCLUDED.constraints,
  updated_at=now();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 11. Owner Witness — PARTIAL AVAILABILITY (W32-W34 only)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO labor_resources (
  organization_id, project_id, resource_key, name, trade_key, label_i18n,
  resource_type, skill_level, headcount, capacity_hours_per_week,
  availability, constraints, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'owner-witness',
  'Owner Witness',
  'owner-witness',
  '{"en": "Owner Witness", "es": "Testigo del Propietario"}',
  'witness', 'senior', 1, 40,
  '[
    {"week":"2026-W29","start":"2026-07-14","end":"2026-07-18","available_hours":0,"status":"unavailable"},
    {"week":"2026-W30","start":"2026-07-21","end":"2026-07-25","available_hours":0,"status":"unavailable"},
    {"week":"2026-W31","start":"2026-07-28","end":"2026-08-01","available_hours":0,"status":"unavailable"},
    {"week":"2026-W32","start":"2026-08-04","end":"2026-08-08","available_hours":40,"status":"available"},
    {"week":"2026-W33","start":"2026-08-11","end":"2026-08-15","available_hours":40,"status":"available"},
    {"week":"2026-W34","start":"2026-08-18","end":"2026-08-22","available_hours":40,"status":"available"}
  ]'::jsonb,
  '{"type":"partial_availability","description_i18n":{"en":"Owner Witness is only available W32-W34. This is an organizational bottleneck: L4 functional tests requiring owner signature cannot be witnessed before W32. L5 integrated systems tests can proceed with owner witnessing starting W32. Early L3/L4 test results will be provisional until owner sign-off.","es":"El Testigo del Propietario solo está disponible W32-W34. Este es un cuello de botella organizacional: las pruebas funcionales L4 que requieren firma del propietario no pueden ser presenciadas antes de W32. Las pruebas de sistemas integrados L5 pueden proceder con presencia del propietario desde W32. Los resultados de pruebas L3/L4 tempranas serán provisionales hasta la firma del propietario."},"concurrent_projects":1,"confirmed":true}'::jsonb,
  11
)
ON CONFLICT (organization_id, project_id, resource_key) WHERE deleted_at IS NULL DO UPDATE SET
  name=EXCLUDED.name, trade_key=EXCLUDED.trade_key, label_i18n=EXCLUDED.label_i18n,
  resource_type=EXCLUDED.resource_type, skill_level=EXCLUDED.skill_level,
  headcount=EXCLUDED.headcount, capacity_hours_per_week=EXCLUDED.capacity_hours_per_week,
  availability=EXCLUDED.availability, constraints=EXCLUDED.constraints,
  updated_at=now();

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (uncomment to verify)
-- ═══════════════════════════════════════════════════════════════════════════════
-- SELECT count(*) as resource_count FROM labor_resources
-- WHERE project_id = 'dc100000-0000-4000-8000-000000000000' AND deleted_at IS NULL;
-- Expected: 11

-- SELECT resource_key, name, trade_key, resource_type, skill_level,
--        constraints->>'type' as constraint_type,
--        constraints->>'confirmed' as confirmed
-- FROM labor_resources
-- WHERE project_id = 'dc100000-0000-4000-8000-000000000000' AND deleted_at IS NULL
-- ORDER BY order_index;

-- -- Week-by-week capacity by trade
-- SELECT lr.trade_key,
--        jsonb_path_query(lr.availability, '$[*] ? (@.week == "2026-W30")') as w30,
--        jsonb_path_query(lr.availability, '$[*] ? (@.week == "2026-W31")') as w31
-- FROM labor_resources lr
-- WHERE lr.project_id = 'dc100000-0000-4000-8000-000000000000' AND lr.deleted_at IS NULL
-- ORDER BY lr.trade_key;