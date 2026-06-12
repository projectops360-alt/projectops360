-- ═══════════════════════════════════════════════════════════════════════════════
-- DCL-005: Create baseline labor risk scenarios and Living Graph links
-- 8 baseline risk scenarios linked to activities, crews, milestones, and the
-- Living Graph. All text uses process-centered language (no crew-blaming).
-- This file is idempotent: safe to re-run (uses ON CONFLICT upserts).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Constants ──────────────────────────────────────────────────────────────────
-- organization_id: 4f00f16b-96d8-4fd6-9375-20e2b11564a6
-- project_id:      dc100000-0000-4000-8000-000000000000
-- DCL-005 task id: (resolved by external_key = 'DCL-005')
-- Milestones:     dc100000-0000-4000-8000-000000000101 through ...105

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: Insert 8 Risk Register Documents
-- ═══════════════════════════════════════════════════════════════════════════════
-- Each risk scenario is modeled as a "risk assessment document" in the documents
-- table. These give us 8 distinct source entities for the Living Graph.

INSERT INTO documents (
  id, organization_id, project_id, title_i18n, description_i18n,
  file_url, file_type, version, status
) VALUES

-- Risk 1: Electrical Crew Shortage
('dc100005-0000-4000-8000-000000000001',
 '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 '{"en": "Risk: Electrical Crew Shortage", "es": "Riesgo: Brecha de capacidad eléctrica"}',
 '{"en": "Electrical Crew C (3 HC) departs after W29, leaving only partial capacity from Crew B for switchgear and UPS installation. This labor capacity gap threatens the critical path in weeks 30-31.", "es": "El Equipo Eléctrico C (3 HC) se retira después de W29, dejando solo capacidad parcial del Equipo B para la instalación de switchgear y UPS. Esta brecha de capacidad laboral amenaza la ruta crítica en las semanas 30-31."}',
 NULL, 'risk-register', 1, 'draft'),

-- Risk 2: QA/QC Inspector Over-Allocation
('dc100005-0000-4000-8000-000000000002',
 '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 '{"en": "Risk: QA/QC Inspector Over-Allocation", "es": "Riesgo: Sobreasignación del Inspector de QA/QC"}',
 '{"en": "The QA/QC Inspector is assigned to two concurrent projects, reducing available capacity to 20-24 hours per week. This resource contention risks delaying Electrical Room QA and subsequent L3 pre-functional testing on the critical path.", "es": "El Inspector de QA/QC está asignado a dos proyectos concurrentes, reduciendo la capacidad disponible a 20-24 horas por semana. Esta contención de recursos riesga retrasar la QA del Cuarto Eléctrico y las pruebas pre-funcionales L3 subsecuentes en la ruta crítica."}',
 NULL, 'risk-register', 1, 'draft'),

-- Risk 3: Mechanical Workface Not Ready
('dc100005-0000-4000-8000-000000000003',
 '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 '{"en": "Risk: Mechanical Workface Not Ready", "es": "Riesgo: Frente de trabajo mecánico no preparado"}',
 '{"en": "Mechanical Crew A has partial availability in W31-W32 due to a concurrent project. If the CRAH installation workface is not ready when the crew arrives, idle labor risk and schedule slip occur.", "es": "El Equipo Mecánico A tiene disponibilidad parcial en W31-W32 debido a un proyecto concurrente. Si el frente de trabajo de CRAH no está preparado cuando llega el equipo, se produce riesgo de mano de obra ociosa y deslizamiento de cronograma."}',
 NULL, 'risk-register', 1, 'draft'),

-- Risk 4: UPS OEM Technician Unavailable
('dc100005-0000-4000-8000-000000000004',
 '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 '{"en": "Risk: UPS OEM Technician Unavailable", "es": "Riesgo: Técnico OEM de UPS no disponible"}',
 '{"en": "The UPS OEM Technician has 6-week lead time with W31-W32 availability unconfirmed. If vendor confirmation does not arrive, the L4 UPS Functional Test on the critical path is blocked, delaying L5 Integrated Systems Test and Client Handover.", "es": "El Técnico OEM de UPS tiene un tiempo de entrega de 6 semanas con disponibilidad W31-W32 no confirmada. Si no llega la confirmación del proveedor, la Prueba Funcional L4 de UPS en la ruta crítica queda bloqueada, retrasando la Prueba de Sistemas Integrados L5 y la Entrega al Cliente."}',
 NULL, 'risk-register', 1, 'draft'),

-- Risk 5: Fiber Productivity Variance
('dc100005-0000-4000-8000-000000000005',
 '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 '{"en": "Risk: Fiber Productivity Variance", "es": "Riesgo: Varianza de productividad de fibra"}',
 '{"en": "Fiber Crew A has full availability but actual production rate may differ from planned rate. Monitoring indicates a moderate variance risk that should be tracked but does not currently block any critical path activity.", "es": "El Equipo de Fibra A tiene disponibilidad completa pero la tasa de producción real puede diferir de la planificada. El monitoreo indica un riesgo de varianza moderado que debe rastrearse pero que actualmente no bloquea ninguna actividad de la ruta crítica."}',
 NULL, 'risk-register', 1, 'draft'),

-- Risk 6: BMS Dependency Gap
('dc100005-0000-4000-8000-000000000006',
 '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 '{"en": "Risk: BMS Dependency Gap", "es": "Riesgo: Brecha de dependencia del BMS"}',
 '{"en": "Controls Tech A has partial availability in W30-W31. BMS Point-to-Point Testing requires this specialist, and the dependency on the Controls trade creates a convergence gate risk that may delay the L3 pre-functional testing milestone.", "es": "El Técnico de Controles A tiene disponibilidad parcial en W30-W31. Las Pruebas Punto a Punto del BMS requieren este especialista, y la dependencia del oficio de Controles crea un riesgo de puerta de convergencia que puede retrasar el hito de pruebas pre-funcionales L3."}',
 NULL, 'risk-register', 1, 'draft'),

-- Risk 7: Unresolved RFI
('dc100005-0000-4000-8000-000000000007',
 '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 '{"en": "Risk: Unresolved RFI", "es": "Riesgo: RFI sin resolver"}',
 '{"en": "An RFI regarding switchgear room fire rating has not been answered. This process information gap blocks Switchgear Installation start and downstream Electrical Room QA. The delay propagates along the critical path.", "es": "Un RFI sobre la clasificación de resistencia al fuego del cuarto de switchgear no ha sido respondido. Esta brecha de información de proceso bloquea el inicio de la Instalación de Switchgear y la QA del Cuarto Eléctrico subsecuente. El retraso se propaga a lo largo de la ruta crítica."}',
 NULL, 'risk-register', 1, 'draft'),

-- Risk 8: Missing Submittal
('dc100005-0000-4000-8000-000000000008',
 '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 '{"en": "Risk: Missing Submittal", "es": "Riesgo: Submittal faltante"}',
 '{"en": "The UPS equipment submittal has not been approved. Without submittal approval, UPS Installation cannot proceed, and the L3 Pre-functional Testing gate may be delayed. This is a process prerequisite gap, not a labor issue.", "es": "El submittal del equipo de UPS no ha sido aprobado. Sin la aprobación del submittal, la Instalación de UPS no puede proceder, y la puerta de Pruebas Pre-funcionales L3 puede retrasarse. Esta es una brecha de prerequisito de proceso, no un problema laboral."}',
 NULL, 'risk-register', 1, 'draft')

ON CONFLICT (id) DO UPDATE SET
  title_i18n      = EXCLUDED.title_i18n,
  description_i18n = EXCLUDED.description_i18n,
  file_type       = EXCLUDED.file_type,
  status          = EXCLUDED.status,
  updated_at      = now();


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: Insert 5 Milestone Gate Nodes (process_nodes)
-- ═══════════════════════════════════════════════════════════════════════════════
-- The backfill function skips milestones with status = 'planned', so we create
-- these manually to give risk scenario edges proper target nodes.

INSERT INTO process_nodes (
  organization_id, project_id, node_type, source_entity_type, source_entity_id,
  title, description, metadata, occurred_at
) VALUES

('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'milestone_gate', 'milestones',
 'dc100000-0000-4000-8000-000000000101',
 'M1 — Test Data Foundation',
 'Gate: All seed data, taxonomy, resources, activities, and baseline risk scenarios must be complete before proceeding to M2.',
 '{"project_phase": "DCL", "milestone_order": 1, "dcl_task": "DCL-005"}'::jsonb,
 '2026-07-18T17:00:00Z'),

('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'milestone_gate', 'milestones',
 'dc100000-0000-4000-8000-000000000102',
 'M2 — Labor Capacity & Skills Matrix',
 'Gate: Labor capacity model, gap calculation, matrix UI, and AI explanations must be validated before proceeding to M3.',
 '{"project_phase": "DCL", "milestone_order": 2, "dcl_task": "DCL-005"}'::jsonb,
 '2026-07-23T17:00:00Z'),

('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'milestone_gate', 'milestones',
 'dc100000-0000-4000-8000-000000000103',
 'M3 — Lookahead & Workface Readiness',
 'Gate: 3/6-week lookahead, workface readiness checklist, and crew-not-ready detection must be operational before proceeding to M4.',
 '{"project_phase": "DCL", "milestone_order": 3, "dcl_task": "DCL-005"}'::jsonb,
 '2026-07-29T17:00:00Z'),

('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'milestone_gate', 'milestones',
 'dc100000-0000-4000-8000-000000000104',
 'M4 — Labor Productivity Variance Engine',
 'Gate: Productivity variance calculation, cause classification, dashboard, and AI recommendations must be validated before proceeding to M5.',
 '{"project_phase": "DCL", "milestone_order": 4, "dcl_task": "DCL-005"}'::jsonb,
 '2026-08-03T17:00:00Z'),

('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'milestone_gate', 'milestones',
 'dc100000-0000-4000-8000-000000000105',
 'M5 — Commissioning Labor Risk & Living Graph Simulation',
 'Gate: Commissioning specialist tracking, what-if simulation, and Living Graph labor risk visualization must pass end-to-end validation.',
 '{"project_phase": "DCL", "milestone_order": 5, "dcl_task": "DCL-005"}'::jsonb,
 '2026-08-08T17:00:00Z')

ON CONFLICT (project_id, source_entity_type, source_entity_id, node_type) WHERE deleted_at IS NULL DO UPDATE SET
  title      = EXCLUDED.title,
  description = EXCLUDED.description,
  metadata   = EXCLUDED.metadata,
  occurred_at = EXCLUDED.occurred_at,
  updated_at = now();


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 3: Insert 8 Blocker Event Nodes (process_nodes)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Each risk scenario is a blocker_event node with source_entity_type = 'documents',
-- pointing to the risk register document created in Step 1.

INSERT INTO process_nodes (
  organization_id, project_id, node_type, source_entity_type, source_entity_id,
  title, description, metadata, occurred_at
) VALUES

-- Risk 1: Electrical Crew Shortage (high severity)
('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'blocker_event', 'documents',
 'dc100005-0000-4000-8000-000000000001',
 'Labor Capacity Gap: Electrical Crew Shortage',
 'Electrical Crew C departs after W29. Crew B has reduced capacity W30-W31. Switchgear and UPS installation on the critical path are at risk of delay.',
 '{"risk_scenario_key": "electrical-crew-shortage", "risk_category": "labor_shortage", "severity": "high", "affected_activity_keys": ["switchgear-install", "ups-install"], "affected_resource_keys": ["electrical-crew-c", "electrical-crew-b"], "affected_milestone_id": "dc100000-0000-4000-8000-000000000101", "description_i18n": {"en": "Electrical crew capacity gap detected: Crew C departs after W29, Crew B has partial availability W30-W31. Critical path activities switchgear-install and ups-install risk schedule delay.", "es": "Brecha de capacidad eléctrica detectada: el Equipo C se retira después de W29, el Equipo B tiene disponibilidad parcial W30-W31. Las actividades de ruta crítica switchgear-install y ups-install corren riesgo de retraso."}, "mitigation_i18n": {"en": "Secure backup electrical crew or negotiate extended availability for Crew B before W30. Pre-stage materials to minimize idle time during partial availability windows.", "es": "Asegurar equipo eléctrico de respaldo o negociar disponibilidad extendida para el Equipo B antes de W30. Pre-posicionar materiales para minimizar tiempo ocioso durante ventanas de disponibilidad parcial."}, "dcl_task": "DCL-005"}'::jsonb,
 '2026-07-14T09:00:00Z'),

-- Risk 2: QA/QC Inspector Over-Allocation (high severity)
('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'blocker_event', 'documents',
 'dc100005-0000-4000-8000-000000000002',
 'Resource Contention: QA/QC Inspector Over-Allocation',
 'QA/QC Inspector serves two concurrent projects at 50-60% capacity. Electrical Room QA is on the critical path and risks delay from inspector unavailability.',
 '{"risk_scenario_key": "qa-qc-inspector-over-allocation", "risk_category": "resource_contention", "severity": "high", "affected_activity_keys": ["electrical-room-qa"], "affected_resource_keys": ["qa-qc-inspector"], "affected_milestone_id": "dc100000-0000-4000-8000-000000000101", "description_i18n": {"en": "Resource contention detected: QA/QC Inspector is over-allocated across two projects with only 20-24 hours per week available. Electrical Room QA on the critical path risks delay.", "es": "Contención de recursos detectada: el Inspector de QA/QC está sobreasignado en dos proyectos con solo 20-24 horas por semana disponibles. La QA del Cuarto Eléctrico en la ruta crítica corre riesgo de retraso."}, "mitigation_i18n": {"en": "Negotiate priority scheduling for Electrical Room QA with the other project. Consider a second QA/QC resource or schedule the inspection during the inspector full-availability window.", "es": "Negociar programación prioritaria para la QA del Cuarto Eléctrico con el otro proyecto. Considerar un segundo recurso de QA/QC o programar la inspección durante la ventana de disponibilidad completa del inspector."}, "dcl_task": "DCL-005"}'::jsonb,
 '2026-07-14T09:00:00Z'),

-- Risk 3: Mechanical Workface Not Ready (medium severity)
('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'blocker_event', 'documents',
 'dc100005-0000-4000-8000-000000000003',
 'Workface Readiness Risk: Mechanical Crew Arrival Before Workface Ready',
 'Mechanical Crew A has partial availability W31-W32. If the CRAH installation workface is not ready, the crew faces idle labor risk and schedule slip.',
 '{"risk_scenario_key": "mechanical-workface-not-ready", "risk_category": "workface_readiness", "severity": "medium", "affected_activity_keys": ["crah-install"], "affected_resource_keys": ["mechanical-crew-a"], "affected_milestone_id": "dc100000-0000-4000-8000-000000000101", "description_i18n": {"en": "Workface readiness risk detected: Mechanical Crew A arrives with partial availability W31-W32 but the CRAH installation workface may not be prepared. Idle labor risk and schedule slip are possible.", "es": "Riesgo de preparación de frente de trabajo detectado: el Equipo Mecánico A llega con disponibilidad parcial W31-W32 pero el frente de trabajo de CRAH puede no estar preparado. Riesgo de mano de obra ociosa y deslizamiento de cronograma."}, "mitigation_i18n": {"en": "Verify CRAH equipment delivery, submittal approval, and area release before W31. Prepare a workface readiness checklist for the CRAH zone.", "es": "Verificar entrega de equipo CRAH, aprobación de submittal y liberación de área antes de W31. Preparar una lista de verificación de preparación del frente de trabajo para la zona de CRAH."}, "dcl_task": "DCL-005"}'::jsonb,
 '2026-07-14T09:00:00Z'),

-- Risk 4: UPS OEM Technician Unavailable (critical severity)
('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'blocker_event', 'documents',
 'dc100005-0000-4000-8000-000000000004',
 'Vendor Availability Risk: UPS OEM Technician Unconfirmed',
 'UPS OEM Technician has 6-week lead time with W31-W32 availability unconfirmed. L4 UPS Functional Test on the critical path is blocked. Downstream impact: L5 test and Client Handover delayed.',
 '{"risk_scenario_key": "ups-oem-technician-unavailable", "risk_category": "vendor_unavailability", "severity": "critical", "affected_activity_keys": ["l4-ups-functional"], "affected_resource_keys": ["ups-oem-tech"], "affected_milestone_id": "dc100000-0000-4000-8000-000000000105", "description_i18n": {"en": "Vendor availability risk detected: UPS OEM Technician has unconfirmed availability (6-week lead time). L4 UPS Functional Test on the critical path is blocked. L5 Integrated Systems Test and Client Handover face downstream delay.", "es": "Riesgo de disponibilidad de proveedor detectado: el Técnico OEM de UPS tiene disponibilidad no confirmada (tiempo de entrega de 6 semanas). La Prueba Funcional L4 de UPS en la ruta crítica está bloqueada. La Prueba de Sistemas Integrados L5 y la Entrega al Cliente enfrentan retraso descendente."}, "mitigation_i18n": {"en": "Escalate vendor confirmation immediately. Identify alternate OEM-certified technician. If unavailable by W33, resequence L3/L4 testing and compress the L4/L5 window.", "es": "Escalar la confirmación del proveedor inmediatamente. Identificar técnico alternativo certificado por OEM. Si no está disponible para W33, resecuenciar las pruebas L3/L4 y comprimir la ventana L4/L5."}, "dcl_task": "DCL-005"}'::jsonb,
 '2026-07-14T09:00:00Z'),

-- Risk 5: Fiber Productivity Variance (low severity)
('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'blocker_event', 'documents',
 'dc100005-0000-4000-8000-000000000005',
 'Productivity Variance Risk: Fiber Pathway Installation',
 'Fiber Crew A has full availability but actual production rate may deviate from planned rate. Moderate variance risk tracked for early detection; does not currently block the critical path.',
 '{"risk_scenario_key": "fiber-productivity-variance", "risk_category": "productivity_variance", "severity": "low", "affected_activity_keys": ["fiber-pathway"], "affected_resource_keys": ["fiber-crew-a"], "affected_milestone_id": "dc100000-0000-4000-8000-000000000101", "description_i18n": {"en": "Productivity variance risk detected: Fiber pathway actual production rate may deviate from planned rate. This is an informational risk for early detection and does not currently block the critical path.", "es": "Riesgo de varianza de productividad detectado: la tasa de producción real de la vía de fibra puede desviarse de la tasa planificada. Este es un riesgo informativo para detección temprana y actualmente no bloquea la ruta crítica."}, "mitigation_i18n": {"en": "Monitor daily production rate against plan. If variance exceeds 15%, investigate process causes such as drawing clarity, material staging, or rework frequency.", "es": "Monitorear la tasa de producción diaria contra el plan. Si la varianza excede el 15%, investigar causas de proceso como claridad de dibujos, preparación de materiales o frecuencia de retrabajo."}, "dcl_task": "DCL-005"}'::jsonb,
 '2026-07-14T09:00:00Z'),

-- Risk 6: BMS Dependency Gap (high severity)
('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'blocker_event', 'documents',
 'dc100005-0000-4000-8000-000000000006',
 'Dependency Gap: BMS Controls Specialist Partial Availability',
 'Controls Tech A has partial availability W30-W31. BMS Point-to-Point Testing depends on this specialist, creating a convergence gate risk for L3 pre-functional testing.',
 '{"risk_scenario_key": "bms-dependency-gap", "risk_category": "specialist_dependency", "severity": "high", "affected_activity_keys": ["bms-point-to-point"], "affected_resource_keys": ["controls-tech-a"], "affected_milestone_id": "dc100000-0000-4000-8000-000000000101", "description_i18n": {"en": "Specialist dependency gap detected: Controls Tech A has partial availability W30-W31. BMS Point-to-Point Testing depends on this specialist, creating a convergence gate risk that may delay L3 pre-functional testing.", "es": "Brecha de dependencia de especialista detectada: el Técnico de Controles A tiene disponibilidad parcial W30-W31. Las Pruebas Punto a Punto del BMS dependen de este especialista, creando un riesgo de puerta de convergencia que puede retrasar las pruebas pre-funcionales L3."}, "mitigation_i18n": {"en": "Schedule BMS testing during Controls Tech full-availability window (W32+). If early testing is required, negotiate dedicated time with the concurrent project for W30-W31.", "es": "Programar las pruebas del BMS durante la ventana de disponibilidad completa del Técnico de Controles (W32+). Si se requieren pruebas tempranas, negociar tiempo dedicado con el proyecto concurrente para W30-W31."}, "dcl_task": "DCL-005"}'::jsonb,
 '2026-07-14T09:00:00Z'),

-- Risk 7: Unresolved RFI (medium severity)
('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'blocker_event', 'documents',
 'dc100005-0000-4000-8000-000000000007',
 'Process Information Gap: Unresolved RFI on Switchgear Fire Rating',
 'An RFI regarding switchgear room fire rating classification has not been answered. This process information gap blocks switchgear installation start and downstream Electrical Room QA on the critical path.',
 '{"risk_scenario_key": "unresolved-rfi", "risk_category": "process_information_gap", "severity": "medium", "affected_activity_keys": ["switchgear-install", "electrical-room-qa"], "affected_resource_keys": [], "affected_milestone_id": "dc100000-0000-4000-8000-000000000101", "description_i18n": {"en": "Process information gap detected: RFI on switchgear room fire rating is unresolved. Switchgear installation and downstream Electrical Room QA on the critical path are blocked until the RFI is answered.", "es": "Brecha de información de proceso detectada: RFI sobre clasificación de resistencia al fuego del cuarto de switchgear sin resolver. La instalación de switchgear y la QA del Cuarto Eléctrico subsecuente en la ruta crítica están bloqueadas hasta que se responda el RFI."}, "mitigation_i18n": {"en": "Escalate RFI to the design team and fire protection engineer. Request expedited response with a 48-hour turnaround. Prepare an alternative scope that can proceed without the fire rating determination.", "es": "Escalar el RFI al equipo de diseño e ingeniero de protección contra incendios. Solicitar respuesta acelerada con retorno en 48 horas. Preparar un alcance alternativo que pueda proceder sin la determinación de clasificación de fuego."}, "dcl_task": "DCL-005"}'::jsonb,
 '2026-07-14T09:00:00Z'),

-- Risk 8: Missing Submittal (medium severity)
('4f00f16b-96d8-4fd6-9375-20e2b11564a6',
 'dc100000-0000-4000-8000-000000000000',
 'blocker_event', 'documents',
 'dc100005-0000-4000-8000-000000000008',
 'Process Prerequisite Gap: UPS Equipment Submittal Not Approved',
 'UPS equipment submittal has not been approved. Without submittal approval, UPS installation cannot proceed and L3 pre-functional testing gate may be delayed. This is a process prerequisite gap.',
 '{"risk_scenario_key": "missing-submittal", "risk_category": "process_prerequisite_gap", "severity": "medium", "affected_activity_keys": ["ups-install", "l3-pre-functional"], "affected_resource_keys": [], "affected_milestone_id": "dc100000-0000-4000-8000-000000000101", "description_i18n": {"en": "Process prerequisite gap detected: UPS equipment submittal is not approved. UPS installation cannot proceed and the L3 pre-functional testing gate risks delay. This is a process gap, not a labor issue.", "es": "Brecha de prerequisito de proceso detectada: el submittal del equipo de UPS no está aprobado. La instalación de UPS no puede proceder y la puerta de pruebas pre-funcionales L3 corre riesgo de retraso. Esta es una brecha de proceso, no un problema laboral."}, "mitigation_i18n": {"en": "Expedite submittal review with the design team and owner. Set a 5-day turnaround deadline. If approval is delayed past W28, resequence UPS installation to later in the schedule.", "es": "Acelerar la revisión del submittal con el equipo de diseño y el propietario. Establecer un plazo de retorno de 5 días. Si la aprobación se retrasa más allá de W28, resecuenciar la instalación de UPS a más tarde en el cronograma."}, "dcl_task": "DCL-005"}'::jsonb,
 '2026-07-14T09:00:00Z')

ON CONFLICT (project_id, source_entity_type, source_entity_id, node_type) WHERE deleted_at IS NULL DO UPDATE SET
  title      = EXCLUDED.title,
  description = EXCLUDED.description,
  metadata   = EXCLUDED.metadata,
  occurred_at = EXCLUDED.occurred_at,
  updated_at = now();


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 4: Insert Process Edges (risk → milestone/risk connections)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Edges connect blocker_event nodes to milestone_gate nodes and to other
-- blocker_event nodes (cascade risks). Uses SELECT subqueries to resolve node
-- IDs at runtime. ON CONFLICT DO NOTHING for idempotency.

-- 1. Electrical crew shortage → DELAYS M1
INSERT INTO process_edges (organization_id, project_id, from_node_id, to_node_id, edge_type, weight, metadata)
SELECT
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  risk_node.id, milestone_node.id, 'delayed', 1.0,
  '{"auto_linked": false, "risk_scenario_key": "electrical-crew-shortage", "dcl_task": "DCL-005"}'::jsonb
FROM process_nodes risk_node
JOIN process_nodes milestone_node
  ON milestone_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND milestone_node.node_type = 'milestone_gate'
  AND milestone_node.source_entity_type = 'milestones'
  AND milestone_node.source_entity_id = 'dc100000-0000-4000-8000-000000000101'
  AND milestone_node.deleted_at IS NULL
WHERE risk_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND risk_node.node_type = 'blocker_event'
  AND risk_node.source_entity_id = 'dc100005-0000-4000-8000-000000000001'
  AND risk_node.deleted_at IS NULL
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- 2. Electrical crew shortage → BLOCKS M2
INSERT INTO process_edges (organization_id, project_id, from_node_id, to_node_id, edge_type, weight, metadata)
SELECT
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  risk_node.id, milestone_node.id, 'blocked', 0.8,
  '{"auto_linked": false, "risk_scenario_key": "electrical-crew-shortage", "dcl_task": "DCL-005"}'::jsonb
FROM process_nodes risk_node
JOIN process_nodes milestone_node
  ON milestone_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND milestone_node.node_type = 'milestone_gate'
  AND milestone_node.source_entity_type = 'milestones'
  AND milestone_node.source_entity_id = 'dc100000-0000-4000-8000-000000000102'
  AND milestone_node.deleted_at IS NULL
WHERE risk_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND risk_node.node_type = 'blocker_event'
  AND risk_node.source_entity_id = 'dc100005-0000-4000-8000-000000000001'
  AND risk_node.deleted_at IS NULL
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- 3. QA/QC over-allocation → DELAYS M1
INSERT INTO process_edges (organization_id, project_id, from_node_id, to_node_id, edge_type, weight, metadata)
SELECT
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  risk_node.id, milestone_node.id, 'delayed', 1.0,
  '{"auto_linked": false, "risk_scenario_key": "qa-qc-inspector-over-allocation", "dcl_task": "DCL-005"}'::jsonb
FROM process_nodes risk_node
JOIN process_nodes milestone_node
  ON milestone_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND milestone_node.node_type = 'milestone_gate'
  AND milestone_node.source_entity_type = 'milestones'
  AND milestone_node.source_entity_id = 'dc100000-0000-4000-8000-000000000101'
  AND milestone_node.deleted_at IS NULL
WHERE risk_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND risk_node.node_type = 'blocker_event'
  AND risk_node.source_entity_id = 'dc100005-0000-4000-8000-000000000002'
  AND risk_node.deleted_at IS NULL
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- 4. Mechanical workface not ready → DELAYS M1
INSERT INTO process_edges (organization_id, project_id, from_node_id, to_node_id, edge_type, weight, metadata)
SELECT
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  risk_node.id, milestone_node.id, 'delayed', 0.7,
  '{"auto_linked": false, "risk_scenario_key": "mechanical-workface-not-ready", "dcl_task": "DCL-005"}'::jsonb
FROM process_nodes risk_node
JOIN process_nodes milestone_node
  ON milestone_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND milestone_node.node_type = 'milestone_gate'
  AND milestone_node.source_entity_type = 'milestones'
  AND milestone_node.source_entity_id = 'dc100000-0000-4000-8000-000000000101'
  AND milestone_node.deleted_at IS NULL
WHERE risk_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND risk_node.node_type = 'blocker_event'
  AND risk_node.source_entity_id = 'dc100005-0000-4000-8000-000000000003'
  AND risk_node.deleted_at IS NULL
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- 5. UPS OEM unavailable → BLOCKS M5
INSERT INTO process_edges (organization_id, project_id, from_node_id, to_node_id, edge_type, weight, metadata)
SELECT
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  risk_node.id, milestone_node.id, 'blocked', 1.0,
  '{"auto_linked": false, "risk_scenario_key": "ups-oem-technician-unavailable", "dcl_task": "DCL-005"}'::jsonb
FROM process_nodes risk_node
JOIN process_nodes milestone_node
  ON milestone_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND milestone_node.node_type = 'milestone_gate'
  AND milestone_node.source_entity_type = 'milestones'
  AND milestone_node.source_entity_id = 'dc100000-0000-4000-8000-000000000105'
  AND milestone_node.deleted_at IS NULL
WHERE risk_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND risk_node.node_type = 'blocker_event'
  AND risk_node.source_entity_id = 'dc100005-0000-4000-8000-000000000004'
  AND risk_node.deleted_at IS NULL
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- 6. Fiber productivity variance → INFORMS M1
INSERT INTO process_edges (organization_id, project_id, from_node_id, to_node_id, edge_type, weight, metadata)
SELECT
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  risk_node.id, milestone_node.id, 'informed', 0.5,
  '{"auto_linked": false, "risk_scenario_key": "fiber-productivity-variance", "dcl_task": "DCL-005"}'::jsonb
FROM process_nodes risk_node
JOIN process_nodes milestone_node
  ON milestone_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND milestone_node.node_type = 'milestone_gate'
  AND milestone_node.source_entity_type = 'milestones'
  AND milestone_node.source_entity_id = 'dc100000-0000-4000-8000-000000000101'
  AND milestone_node.deleted_at IS NULL
WHERE risk_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND risk_node.node_type = 'blocker_event'
  AND risk_node.source_entity_id = 'dc100005-0000-4000-8000-000000000005'
  AND risk_node.deleted_at IS NULL
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- 7. BMS dependency gap → DELAYS M1
INSERT INTO process_edges (organization_id, project_id, from_node_id, to_node_id, edge_type, weight, metadata)
SELECT
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  risk_node.id, milestone_node.id, 'delayed', 1.0,
  '{"auto_linked": false, "risk_scenario_key": "bms-dependency-gap", "dcl_task": "DCL-005"}'::jsonb
FROM process_nodes risk_node
JOIN process_nodes milestone_node
  ON milestone_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND milestone_node.node_type = 'milestone_gate'
  AND milestone_node.source_entity_type = 'milestones'
  AND milestone_node.source_entity_id = 'dc100000-0000-4000-8000-000000000101'
  AND milestone_node.deleted_at IS NULL
WHERE risk_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND risk_node.node_type = 'blocker_event'
  AND risk_node.source_entity_id = 'dc100005-0000-4000-8000-000000000006'
  AND risk_node.deleted_at IS NULL
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- 8. BMS dependency gap → CAUSES electrical crew shortage (cascade risk)
INSERT INTO process_edges (organization_id, project_id, from_node_id, to_node_id, edge_type, weight, metadata)
SELECT
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  bms_node.id, elec_node.id, 'caused', 0.6,
  '{"auto_linked": false, "risk_scenario_key": "bms-dependency-gap", "cascade": true, "dcl_task": "DCL-005"}'::jsonb
FROM process_nodes bms_node
JOIN process_nodes elec_node
  ON elec_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND elec_node.node_type = 'blocker_event'
  AND elec_node.source_entity_id = 'dc100005-0000-4000-8000-000000000001'
  AND elec_node.deleted_at IS NULL
WHERE bms_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND bms_node.node_type = 'blocker_event'
  AND bms_node.source_entity_id = 'dc100005-0000-4000-8000-000000000006'
  AND bms_node.deleted_at IS NULL
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- 9. Unresolved RFI → BLOCKS M1
INSERT INTO process_edges (organization_id, project_id, from_node_id, to_node_id, edge_type, weight, metadata)
SELECT
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  risk_node.id, milestone_node.id, 'blocked', 0.8,
  '{"auto_linked": false, "risk_scenario_key": "unresolved-rfi", "dcl_task": "DCL-005"}'::jsonb
FROM process_nodes risk_node
JOIN process_nodes milestone_node
  ON milestone_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND milestone_node.node_type = 'milestone_gate'
  AND milestone_node.source_entity_type = 'milestones'
  AND milestone_node.source_entity_id = 'dc100000-0000-4000-8000-000000000101'
  AND milestone_node.deleted_at IS NULL
WHERE risk_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND risk_node.node_type = 'blocker_event'
  AND risk_node.source_entity_id = 'dc100005-0000-4000-8000-000000000007'
  AND risk_node.deleted_at IS NULL
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- 10. Missing submittal → BLOCKS M1
INSERT INTO process_edges (organization_id, project_id, from_node_id, to_node_id, edge_type, weight, metadata)
SELECT
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  risk_node.id, milestone_node.id, 'blocked', 0.8,
  '{"auto_linked": false, "risk_scenario_key": "missing-submittal", "dcl_task": "DCL-005"}'::jsonb
FROM process_nodes risk_node
JOIN process_nodes milestone_node
  ON milestone_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND milestone_node.node_type = 'milestone_gate'
  AND milestone_node.source_entity_type = 'milestones'
  AND milestone_node.source_entity_id = 'dc100000-0000-4000-8000-000000000101'
  AND milestone_node.deleted_at IS NULL
WHERE risk_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND risk_node.node_type = 'blocker_event'
  AND risk_node.source_entity_id = 'dc100005-0000-4000-8000-000000000008'
  AND risk_node.deleted_at IS NULL
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- 11. Missing submittal → DELAYS M2
INSERT INTO process_edges (organization_id, project_id, from_node_id, to_node_id, edge_type, weight, metadata)
SELECT
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  risk_node.id, milestone_node.id, 'delayed', 0.7,
  '{"auto_linked": false, "risk_scenario_key": "missing-submittal", "dcl_task": "DCL-005"}'::jsonb
FROM process_nodes risk_node
JOIN process_nodes milestone_node
  ON milestone_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND milestone_node.node_type = 'milestone_gate'
  AND milestone_node.source_entity_type = 'milestones'
  AND milestone_node.source_entity_id = 'dc100000-0000-4000-8000-000000000102'
  AND milestone_node.deleted_at IS NULL
WHERE risk_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND risk_node.node_type = 'blocker_event'
  AND risk_node.source_entity_id = 'dc100005-0000-4000-8000-000000000008'
  AND risk_node.deleted_at IS NULL
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;

-- 12. UPS OEM unavailable → CAUSES mechanical workface not ready (cascade risk)
INSERT INTO process_edges (organization_id, project_id, from_node_id, to_node_id, edge_type, weight, metadata)
SELECT
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  ups_node.id, mech_node.id, 'caused', 0.5,
  '{"auto_linked": false, "risk_scenario_key": "ups-oem-technician-unavailable", "cascade": true, "dcl_task": "DCL-005"}'::jsonb
FROM process_nodes ups_node
JOIN process_nodes mech_node
  ON mech_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND mech_node.node_type = 'blocker_event'
  AND mech_node.source_entity_id = 'dc100005-0000-4000-8000-000000000003'
  AND mech_node.deleted_at IS NULL
WHERE ups_node.project_id = 'dc100000-0000-4000-8000-000000000000'
  AND ups_node.node_type = 'blocker_event'
  AND ups_node.source_entity_id = 'dc100005-0000-4000-8000-000000000004'
  AND ups_node.deleted_at IS NULL
ON CONFLICT (from_node_id, to_node_id, edge_type) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 5: Update DCL-005 task status
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE roadmap_tasks
SET status        = 'implemented',
    progress     = 100,
    execution_notes = 'DCL-005 implemented: Created 8 baseline risk scenarios (electrical crew shortage, QA/QC over-allocation, mechanical workface not ready, UPS OEM unavailable, fiber productivity variance, BMS dependency gap, unresolved RFI, missing submittal) as risk register documents and blocker_event Living Graph nodes. Created 5 milestone_gate nodes for DCL-M1 through M5. Created 12 process edges linking risks to milestones and cascade risk relationships. All risk descriptions use process-centered language.',
    updated_at   = now()
WHERE project_id  = 'dc100000-0000-4000-8000-000000000000'
  AND external_key = 'DCL-005'
  AND deleted_at IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION (uncomment to verify after running)
-- ═══════════════════════════════════════════════════════════════════════════════
-- SELECT 'risk_documents' AS check_name, count(*) FROM documents WHERE project_id = 'dc100000-0000-4000-8000-000000000000' AND file_type = 'risk-register' AND deleted_at IS NULL;
-- Expected: 8

-- SELECT 'blocker_event_nodes' AS check_name, count(*) FROM process_nodes WHERE project_id = 'dc100000-0000-4000-8000-000000000000' AND node_type = 'blocker_event' AND deleted_at IS NULL;
-- Expected: 8

-- SELECT 'milestone_gate_nodes' AS check_name, count(*) FROM process_nodes WHERE project_id = 'dc100000-0000-4000-8000-000000000000' AND node_type = 'milestone_gate' AND deleted_at IS NULL;
-- Expected: 5

-- SELECT 'risk_edges' AS check_name, count(*) FROM process_edges WHERE project_id = 'dc100000-0000-4000-8000-000000000000' AND metadata->>'dcl_task' = 'DCL-005';
-- Expected: 12

-- SELECT status, progress FROM roadmap_tasks WHERE project_id = 'dc100000-0000-4000-8000-000000000000' AND external_key = 'DCL-005' AND deleted_at IS NULL;
-- Expected: implemented, 100