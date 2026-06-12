-- ═══════════════════════════════════════════════════════════════════════════════
-- Data Center Labor Risk Intelligence Lab — Trade & Skill Taxonomy Seed
-- DCL-002: Define data center trade and skill taxonomy
-- This file is idempotent: safe to re-run (uses ON CONFLICT upserts on trade_key)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Constants ──────────────────────────────────────────────────────────────────
-- organization_id: 4f00f16b-96d8-4fd6-9375-20e2b11564a6
-- project_id:      dc100000-0000-4000-8000-000000000000

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: Top-level Trades (trade_type = 'trade')
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Electrical
INSERT INTO trade_taxonomy (
  organization_id, project_id, trade_key, label_i18n, trade_type, parent_key,
  metadata, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'electrical',
  '{"en": "Electrical", "es": "Eléctrico"}',
  'trade', NULL,
  '{
    "skills": [
      {"key": "high-voltage-termination", "label_i18n": {"en": "High Voltage Terminations", "es": "Terminaciones de Alta Tensión"}, "level": "journeyman"},
      {"key": "switchgear-install", "label_i18n": {"en": "Switchgear Installation", "es": "Instalación de Tableros de Distribución"}, "level": "senior"},
      {"key": "cable-pulling", "label_i18n": {"en": "Large Cable Pulling", "es": "Tiro de Cables Grandes"}, "level": "journeyman"},
      {"key": "grounding", "label_i18n": {"en": "Grounding & Bonding Systems", "es": "Sistemas de Puesta a Tierra y Equipotencialización"}, "level": "senior"},
      {"key": "panel-build", "label_i18n": {"en": "Panel Build & Wire", "es": "Construcción y Cableado de Paneles"}, "level": "journeyman"}
    ],
    "certifications": [
      {"key": "nfpa-70e", "label_i18n": {"en": "NFPA 70E Arc Flash Safety", "es": "NFPA 70E Seguridad contra Arco Eléctrico"}, "required": true},
      {"key": "osha-30", "label_i18n": {"en": "OSHA 30-Hour Construction", "es": "OSHA 30 Horas Construcción"}, "required": true},
      {"key": "state-license", "label_i18n": {"en": "State Electrical License", "es": "Licencia Estatal de Electricista"}, "required": true}
    ],
    "work_packages": [
      "Switchgear Installation", "UPS Electrical Connection", "Generator Electrical Connection",
      "Cable Tray & Conduit", "Panel Boards & Transformers", "Grounding Grid",
      "Receptacle & Device Installation", "Lighting Systems"
    ],
    "commissioning_relevance": {
      "level": "high",
      "description_i18n": {
        "en": "Electrical trade is critical for L3 pre-functional testing (energization sequence, megger testing, relay calibration), L4 functional testing (load bank, UPS transfer, generator load), and L5 integrated systems testing. Electrical failure blocks all downstream commissioning.",
        "es": "El oficio eléctrico es crítico para pruebas pre-funcionales L3 (secuencia de energización, prueba de megómetro, calibración de relés), pruebas funcionales L4 (banco de carga, transferencia UPS, carga de generador) y pruebas integradas L5. Una falla eléctrica bloquea toda la puesta en servicio posterior."
      },
      "test_phases": ["L3", "L4", "L5"]
    }
  }'::jsonb,
  1
)
ON CONFLICT (organization_id, project_id, trade_key) WHERE deleted_at IS NULL DO UPDATE SET
  label_i18n = EXCLUDED.label_i18n,
  metadata   = EXCLUDED.metadata,
  updated_at = now();

-- 2. Mechanical / HVAC
INSERT INTO trade_taxonomy (
  organization_id, project_id, trade_key, label_i18n, trade_type, parent_key,
  metadata, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'mechanical-hvac',
  '{"en": "Mechanical / HVAC", "es": "Mecánico / HVAC"}',
  'trade', NULL,
  '{
    "skills": [
      {"key": "chiller-install", "label_i18n": {"en": "Chiller Installation & Piping", "es": "Instalación y Tubería de Chillers"}, "level": "senior"},
      {"key": "crah-install", "label_i18n": {"en": "CRAH / CRAH Unit Installation", "es": "Instalación de Unidades CRAH"}, "level": "journeyman"},
      {"key": "ductwork", "label_i18n": {"en": "Ductwork Fabrication & Install", "es": "Fabricación e Instalación de Ductos"}, "level": "journeyman"},
      {"key": "hydronic-piping", "label_i18n": {"en": "Hydronic Piping & Valves", "es": "Tubería Hidrónica y Válvulas"}, "level": "senior"},
      {"key": "refrigerant", "label_i18n": {"en": "Refrigerant Charging & Recovery", "es": "Carga y Recuperación de Refrigerante"}, "level": "senior"}
    ],
    "certifications": [
      {"key": "epa-608", "label_i18n": {"en": "EPA 608 Refrigerant Handling", "es": "EPA 608 Manejo de Refrigerante"}, "required": true},
      {"key": "osha-30-hvac", "label_i18n": {"en": "OSHA 30-Hour Construction", "es": "OSHA 30 Horas Construcción"}, "required": true},
      {"key": "ua-card", "label_i18n": {"en": "UA Journeyman Card", "es": "Carnet de Oficial UA"}, "required": false}
    ],
    "work_packages": [
      "Chiller Installation", "CRAH Unit Installation", "Cooling Tower",
      "Condensate Drain Piping", "Refrigerant Piping", "Ductwork Supply & Return",
      "Hydronic Pump Installation", "HVAC Controls Rough-In"
    ],
    "commissioning_relevance": {
      "level": "high",
      "description_i18n": {
        "en": "Mechanical/HVAC trade is critical for L3 pre-functional testing (chiller start-up, CRAH airflow verification, piping pressure test), L4 functional testing (capacity verification, redundancy failover), and L5 integrated systems testing (thermal response under IT load). Cooling failure directly impacts data center availability.",
        "es": "El oficio Mecánico/HVAC es crítico para pruebas pre-funcionales L3 (arranque de chiller, verificación de flujo de aire CRAH, prueba de presión de tubería), pruebas funcionales L4 (verificación de capacidad, failover de redundancia) y pruebas integradas L5 (respuesta térmica bajo carga IT). Una falla de refrigeración impacta directamente la disponibilidad del centro de datos."
      },
      "test_phases": ["L3", "L4", "L5"]
    }
  }'::jsonb,
  2
)
ON CONFLICT (organization_id, project_id, trade_key) WHERE deleted_at IS NULL DO UPDATE SET
  label_i18n = EXCLUDED.label_i18n,
  metadata   = EXCLUDED.metadata,
  updated_at = now();

-- 3. Controls / BMS
INSERT INTO trade_taxonomy (
  organization_id, project_id, trade_key, label_i18n, trade_type, parent_key,
  metadata, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'controls-bms',
  '{"en": "Controls / BMS", "es": "Controles / BMS"}',
  'trade', NULL,
  '{
    "skills": [
      {"key": "ddc-programming", "label_i18n": {"en": "DDC Controller Programming", "es": "Programación de Controladores DDC"}, "level": "senior"},
      {"key": "point-to-point", "label_i18n": {"en": "Point-to-Point Checkout", "es": "Verificación Punto a Punto"}, "level": "journeyman"},
      {"key": "graphics-setup", "label_i18n": {"en": "BMS Graphics & Dashboards", "es": "Gráficos y Dashboards del BMS"}, "level": "senior"},
      {"key": "sensor-calibration", "label_i18n": {"en": "Sensor Calibration & Commissioning", "es": "Calibración y Puesta en Servicio de Sensores"}, "level": "journeyman"},
      {"key": "network-integration", "label_i18n": {"en": "BACnet / Network Integration", "es": "Integración BACnet / Red"}, "level": "master"}
    ],
    "certifications": [
      {"key": "bacnet-cert", "label_i18n": {"en": "BACnet Certification", "es": "Certificación BACnet"}, "required": false},
      {"key": "niagara-cert", "label_i18n": {"en": "Niagara Tridium Certification", "es": "Certificación Niagara Tridium"}, "required": false},
      {"key": "osha-10-controls", "label_i18n": {"en": "OSHA 10-Hour Construction", "es": "OSHA 10 Horas Construcción"}, "required": true}
    ],
    "work_packages": [
      "BMS Panel Installation", "DDC Controller Wiring", "Sensor & Actuator Installation",
      "Point-to-Point Verification", "BMS Graphics Build", "BACnet Network Integration",
      "Alarm & Trend Configuration", "Sequence of Operations Verification"
    ],
    "commissioning_relevance": {
      "level": "high",
      "description_i18n": {
        "en": "Controls/BMS is essential for L3 pre-functional testing (point-to-point checkout, controller programming verification) and L4 functional testing (SOO verification, alarm response, trend data validation). BMS issues cause delayed or incomplete commissioning of mechanical and electrical systems.",
        "es": "Controles/BMS es esencial para pruebas pre-funcionales L3 (verificación punto a punto, verificación de programación de controladores) y pruebas funcionales L4 (verificación SOO, respuesta de alarmas, validación de datos de tendencia). Problemas del BMS causan retraso o puesta en servicio incompleta de sistemas mecánicos y eléctricos."
      },
      "test_phases": ["L3", "L4"]
    }
  }'::jsonb,
  3
)
ON CONFLICT (organization_id, project_id, trade_key) WHERE deleted_at IS NULL DO UPDATE SET
  label_i18n = EXCLUDED.label_i18n,
  metadata   = EXCLUDED.metadata,
  updated_at = now();

-- 4. Low Voltage / Fiber
INSERT INTO trade_taxonomy (
  organization_id, project_id, trade_key, label_i18n, trade_type, parent_key,
  metadata, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'low-voltage-fiber',
  '{"en": "Low Voltage / Fiber", "es": "Bajo Voltaje / Fibra"}',
  'trade', NULL,
  '{
    "skills": [
      {"key": "fiber-splicing", "label_i18n": {"en": "Fiber Optic Splicing & Termination", "es": "Empalme y Terminación de Fibra Óptica"}, "level": "senior"},
      {"key": "cat6-termination", "label_i18n": {"en": "Cat6/Cat6A Termination & Testing", "es": "Terminación y Prueba de Cat6/Cat6A"}, "level": "journeyman"},
      {"key": "cable-pathway", "label_i18n": {"en": "Cable Pathway & Tray Installation", "es": "Instalación de Bandejas y Rutas de Cable"}, "level": "journeyman"},
      {"key": "otdr-testing", "label_i18n": {"en": "OTDR Testing & Certification", "es": "Prueba y Certificación OTDR"}, "level": "senior"},
      {"key": "network-racking", "label_i18n": {"en": "Network Rack & Patch Panel Build", "es": "Construcción de Rack de Red y Patch Panel"}, "level": "journeyman"}
    ],
    "certifications": [
      {"key": "foa-cfot", "label_i18n": {"en": "FOA CFOT Fiber Optic Technician", "es": "FOA CFOT Técnico en Fibra Óptica"}, "required": false},
      {"key": "bicsi-rcdd", "label_i18n": {"en": "BICSI RCDD", "es": "BICSI RCDD"}, "required": false},
      {"key": "osha-10-lv", "label_i18n": {"en": "OSHA 10-Hour Construction", "es": "OSHA 10 Horas Construcción"}, "required": true}
    ],
    "work_packages": [
      "Fiber Backbone Installation", "Cat6A Horizontal Cabling", "Cable Tray & J-Hook",
      "MDF/IDF Rack Build", "Patch Panel Termination", "OTDR & Fluke Testing",
      "Fiber Pathway Redundancy", "Cable Management & Labeling"
    ],
    "commissioning_relevance": {
      "level": "medium",
      "description_i18n": {
        "en": "Low Voltage/Fiber trade supports L3 pre-functional testing (cable certification, connectivity verification, pathway inspection). Network connectivity is a prerequisite for BMS commissioning and monitoring systems. Fiber issues cause downstream delays in controls integration.",
        "es": "El oficio de Bajo Voltaje/Fibra soporta pruebas pre-funcionales L3 (certificación de cables, verificación de conectividad, inspección de rutas). La conectividad de red es un prerequisito para la puesta en servicio del BMS y sistemas de monitoreo. Problemas de fibra causan retrasos posteriores en la integración de controles."
      },
      "test_phases": ["L3"]
    }
  }'::jsonb,
  4
)
ON CONFLICT (organization_id, project_id, trade_key) WHERE deleted_at IS NULL DO UPDATE SET
  label_i18n = EXCLUDED.label_i18n,
  metadata   = EXCLUDED.metadata,
  updated_at = now();

-- 5. Fire Protection
INSERT INTO trade_taxonomy (
  organization_id, project_id, trade_key, label_i18n, trade_type, parent_key,
  metadata, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'fire-protection',
  '{"en": "Fire Protection", "es": "Protección contra Incendios"}',
  'trade', NULL,
  '{
    "skills": [
      {"key": "sprinkler-install", "label_i18n": {"en": "Sprinkler System Installation", "es": "Instalación de Sistema de Rociadores"}, "level": "journeyman"},
      {"key": "clean-agent", "label_i18n": {"en": "Clean Agent System (FM-200 / Novec)", "es": "Sistema de Agente Limpio (FM-200 / Novec)"}, "level": "senior"},
      {"key": "vesda", "label_i18n": {"en": "VESDA / Aspiration Detection", "es": "Detección por Aspiración VESDA"}, "level": "senior"},
      {"key": "fire-alarm", "label_i18n": {"en": "Fire Alarm & Notification", "es": "Alarma y Notificación de Incendio"}, "level": "journeyman"},
      {"key": "pre-action", "label_i18n": {"en": "Pre-Action / Double-Interlock Systems", "es": "Sistemas Pre-Action / Double-Interlock"}, "level": "senior"}
    ],
    "certifications": [
      {"key": "nicet-fire", "label_i18n": {"en": "NICET Fire Alarm Level II+", "es": "NICET Alarma de Incendio Nivel II+"}, "required": true},
      {"key": "fm-approved", "label_i18n": {"en": "FM Approved Installer", "es": "Instalador Aprobado por FM"}, "required": false},
      {"key": "osha-30-fire", "label_i18n": {"en": "OSHA 30-Hour Construction", "es": "OSHA 30 Horas Construcción"}, "required": true}
    ],
    "work_packages": [
      "Wet Pipe Sprinkler System", "Pre-Action Sprinkler System", "FM-200 / Novec Clean Agent",
      "VESDA Detection System", "Fire Alarm Panel & Devices", "Stairwell Pressurization",
      "Fire Pump & Standpipe", "Firestopping & Penetration Sealing"
    ],
    "commissioning_relevance": {
      "level": "medium",
      "description_i18n": {
        "en": "Fire Protection trade supports L3 pre-functional testing (hydrostatic test, flow test, alarm device verification) and L4 functional testing (clean agent discharge test, VESDA calibration, alarm chain verification). Fire system acceptance is a regulatory gate for Certificate of Occupancy.",
        "es": "El oficio de Protección contra Incendios soporta pruebas pre-funcionales L3 (prueba hidrostática, prueba de flujo, verificación de dispositivos de alarma) y pruebas funcionales L4 (prueba de descarga de agente limpio, calibración VESDA, verificación de cadena de alarma). La aceptación del sistema contra incendios es un requisito regulatorio para el Certificado de Ocupación."
      },
      "test_phases": ["L3", "L4"]
    }
  }'::jsonb,
  5
)
ON CONFLICT (organization_id, project_id, trade_key) WHERE deleted_at IS NULL DO UPDATE SET
  label_i18n = EXCLUDED.label_i18n,
  metadata   = EXCLUDED.metadata,
  updated_at = now();

-- 6. QA / QC
INSERT INTO trade_taxonomy (
  organization_id, project_id, trade_key, label_i18n, trade_type, parent_key,
  metadata, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'qa-qc',
  '{"en": "QA / QC", "es": "QA / QC"}',
  'trade', NULL,
  '{
    "skills": [
      {"key": "electrical-inspection", "label_i18n": {"en": "Electrical Room Inspection", "es": "Inspección de Cuarto Eléctrico"}, "level": "senior"},
      {"key": "mechanical-inspection", "label_i18n": {"en": "Mechanical / HVAC Inspection", "es": "Inspección Mecánica / HVAC"}, "level": "senior"},
      {"key": "concrete-verification", "label_i18n": {"en": "Concrete & Structural Verification", "es": "Verificación de Concreto y Estructura"}, "level": "journeyman"},
      {"key": "punch-list", "label_i18n": {"en": "Punch List Management", "es": "Gestión de Punch List"}, "level": "journeyman"},
      {"key": "doc-review", "label_i18n": {"en": "Submittal & RFI Review", "es": "Revisión de Submittals y RFI"}, "level": "senior"}
    ],
    "certifications": [
      {"key": "cqa", "label_i18n": {"en": "Certified Quality Auditor (CQA)", "es": "Auditor de Calidad Certificado (CQA)"}, "required": false},
      {"key": "aci-inspector", "label_i18n": {"en": "ACI Special Inspector", "es": "Inspector Especial ACI"}, "required": false},
      {"key": "icc-cert", "label_i18n": {"en": "ICC Special Inspector", "es": "Inspector Especial ICC"}, "required": false}
    ],
    "work_packages": [
      "Electrical Room QA Inspection", "Mechanical Room QA Inspection",
      "Structural Steel Inspection", "Firestopping Inspection",
      "Punch List Walkdown", "Submittal & RFI Review",
      "Concrete Slab Verification", "Final Clean & Touch-Up Inspection"
    ],
    "commissioning_relevance": {
      "level": "high",
      "description_i18n": {
        "en": "QA/QC is essential across all commissioning phases. L3 pre-functional testing requires QA sign-off on installation compliance. L4 functional testing requires QC verification of test results. L5 integrated systems testing requires final punch list closure and QA acceptance before client handover. QA/QC resource constraints create commissioning gate delays.",
        "es": "QA/QC es esencial en todas las fases de puesta en servicio. Las pruebas pre-funcionales L3 requieren aprobación de QA sobre cumplimiento de instalación. Las pruebas funcionales L4 requieren verificación de QC de resultados de pruebas. Las pruebas integradas L5 requieren cierre de punch list final y aceptación de QA antes de la entrega al cliente. Las restricciones de recursos de QA/QC crean retrasos en las puertas de puesta en servicio."
      },
      "test_phases": ["L3", "L4", "L5"]
    }
  }'::jsonb,
  6
)
ON CONFLICT (organization_id, project_id, trade_key) WHERE deleted_at IS NULL DO UPDATE SET
  label_i18n = EXCLUDED.label_i18n,
  metadata   = EXCLUDED.metadata,
  updated_at = now();

-- 7. Commissioning
INSERT INTO trade_taxonomy (
  organization_id, project_id, trade_key, label_i18n, trade_type, parent_key,
  metadata, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'commissioning',
  '{"en": "Commissioning", "es": "Puesta en Servicio"}',
  'trade', NULL,
  '{
    "skills": [
      {"key": "l3-prefunctional", "label_i18n": {"en": "L3 Pre-Functional Testing", "es": "Pruebas Pre-Funcionales L3"}, "level": "senior"},
      {"key": "l4-functional", "label_i18n": {"en": "L4 Functional Performance Testing", "es": "Pruebas de Desempeño Funcional L4"}, "level": "master"},
      {"key": "l5-integrated", "label_i18n": {"en": "L5 Integrated Systems Testing", "es": "Pruebas de Sistemas Integrados L5"}, "level": "master"},
      {"key": "cx-doc", "label_i18n": {"en": "Commissioning Documentation & Reports", "es": "Documentación e Informes de Puesta en Servicio"}, "level": "senior"},
      {"key": "cx-management", "label_i18n": {"en": "Commissioning Schedule & Coordination", "es": "Programa y Coordinación de Puesta en Servicio"}, "level": "master"}
    ],
    "certifications": [
      {"key": "bcxa-cxap", "label_i18n": {"en": "BCxA Commissioning Authority Provider", "es": "BCxA Proveedor de Autoridad de Puesta en Servicio"}, "required": true},
      {"key": "ashrae-cx", "label_i18n": {"en": "ASHRAE Commissioning Process", "es": "ASHRAE Proceso de Puesta en Servicio"}, "required": false},
      {"key": "leed-cx", "label_i18n": {"en": "LEED Enhanced Commissioning", "es": "Puesta en Servicio Mejorada LEED"}, "required": false}
    ],
    "work_packages": [
      "L3 Pre-Functional Testing", "L4 Functional Performance Testing",
      "L5 Integrated Systems Testing", "Commissioning Coordination & Scheduling",
      "Commissioning Documentation", "Issue Resolution & Retest Management",
      "Client Handover & Training", "Final Commissioning Report"
    ],
    "commissioning_relevance": {
      "level": "critical",
      "description_i18n": {
        "en": "The Commissioning trade IS the commissioning process. Every L3, L4, and L5 test requires a qualified commissioning agent to plan, execute, witness, and document. Commissioning specialist shortages directly delay test windows, extend project schedule, and can block Certificate of Occupancy. This is the single most constrained resource in data center construction.",
        "es": "El oficio de Puesta en Servicio ES el proceso de puesta en servicio. Cada prueba L3, L4 y L5 requiere un agente de puesta en servicio calificado para planificar, ejecutar, presenciar y documentar. La escasez de especialistas de puesta en servicio retrasa directamente las ventanas de prueba, extiende el cronograma del proyecto y puede bloquear el Certificado de Ocupación. Este es el recurso más restringido en la construcción de centros de datos."
      },
      "test_phases": ["L3", "L4", "L5"]
    }
  }'::jsonb,
  7
)
ON CONFLICT (organization_id, project_id, trade_key) WHERE deleted_at IS NULL DO UPDATE SET
  label_i18n = EXCLUDED.label_i18n,
  metadata   = EXCLUDED.metadata,
  updated_at = now();

-- 8. OEM Vendor
INSERT INTO trade_taxonomy (
  organization_id, project_id, trade_key, label_i18n, trade_type, parent_key,
  metadata, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'oem-vendor',
  '{"en": "OEM Vendor", "es": "Proveedor OEM"}',
  'trade', NULL,
  '{
    "skills": [
      {"key": "ups-service", "label_i18n": {"en": "UPS Field Service", "es": "Servicio en Campo de UPS"}, "level": "senior"},
      {"key": "generator-service", "label_i18n": {"en": "Generator Field Service", "es": "Servicio en Campo de Generador"}, "level": "senior"},
      {"key": "chiller-service", "label_i18n": {"en": "Chiller OEM Service", "es": "Servicio OEM de Chiller"}, "level": "senior"},
      {"key": "pdu-service", "label_i18n": {"en": "PDU / RPP Field Service", "es": "Servicio en Campo de PDU / RPP"}, "level": "journeyman"},
      {"key": "sts-service", "label_i18n": {"en": "STS / ATS Field Service", "es": "Servicio en Campo de STS / ATS"}, "level": "senior"}
    ],
    "certifications": [
      {"key": "mfr-ups-cert", "label_i18n": {"en": "Manufacturer UPS Certification", "es": "Certificación de Fabricante de UPS"}, "required": true},
      {"key": "mfr-gen-cert", "label_i18n": {"en": "Manufacturer Generator Certification", "es": "Certificación de Fabricante de Generador"}, "required": true},
      {"key": "mfr-chiller-cert", "label_i18n": {"en": "Manufacturer Chiller Certification", "es": "Certificación de Fabricante de Chiller"}, "required": false}
    ],
    "work_packages": [
      "UPS Start-Up & Commissioning", "Generator Start-Up & Load Bank",
      "Chiller Start-Up & Commissioning", "PDU / RPP Configuration",
      "STS / ATS Transfer Testing", "Fire Pump OEM Start-Up",
      "BMS OEM Software Load", "Equipment Warranty Activation"
    ],
    "commissioning_relevance": {
      "level": "critical",
      "description_i18n": {
        "en": "OEM Vendor availability is a critical-path dependency for L4 functional testing and L5 integrated systems testing. Equipment manufacturers require their own certified technicians to perform start-up, load bank testing, and warranty activation. OEM technicians are often booked weeks in advance and serve multiple projects. Unavailability blocks entire commissioning sequences.",
        "es": "La disponibilidad del Proveedor OEM es una dependencia de camino crítico para pruebas funcionales L4 y pruebas integradas L5. Los fabricantes de equipos requieren sus propios técnicos certificados para realizar arranque, prueba de banco de carga y activación de garantía. Los técnicos OEM a menudo están reservados con semanas de anticipación y sirven múltiples proyectos. La indisponibilidad bloquea secuencias completas de puesta en servicio."
      },
      "test_phases": ["L4", "L5"]
    }
  }'::jsonb,
  8
)
ON CONFLICT (organization_id, project_id, trade_key) WHERE deleted_at IS NULL DO UPDATE SET
  label_i18n = EXCLUDED.label_i18n,
  metadata   = EXCLUDED.metadata,
  updated_at = now();

-- 9. Owner Witness
INSERT INTO trade_taxonomy (
  organization_id, project_id, trade_key, label_i18n, trade_type, parent_key,
  metadata, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'owner-witness',
  '{"en": "Owner Witness", "es": "Testigo del Propietario"}',
  'trade', NULL,
  '{
    "skills": [
      {"key": "test-witness", "label_i18n": {"en": "Test Observation & Witnessing", "es": "Observación y Presencia en Pruebas"}, "level": "senior"},
      {"key": "acceptance-review", "label_i18n": {"en": "Acceptance Criteria Review", "es": "Revisión de Criterios de Aceptación"}, "level": "senior"},
      {"key": "doc-approval", "label_i18n": {"en": "Document & Report Approval", "es": "Aprobación de Documentos e Informes"}, "level": "senior"},
      {"key": "training-receipt", "label_i18n": {"en": "Training Receipt & Sign-Off", "es": "Recepción y Firma de Capacitación"}, "level": "journeyman"},
      {"key": "handover-acceptance", "label_i18n": {"en": "Facility Handover Acceptance", "es": "Aceptación de Entrega de Instalación"}, "level": "master"}
    ],
    "certifications": [
      {"key": "owner-rep", "label_i18n": {"en": "Owner Designated Representative", "es": "Representante Designado del Propietario"}, "required": true},
      {"key": "data-center-ops", "label_i18n": {"en": "Data Center Operations Certification", "es": "Certificación de Operaciones de Centro de Datos"}, "required": false}
    ],
    "work_packages": [
      "L4 Test Witnessing", "L5 Integrated Test Witnessing",
      "Commissioning Report Review & Approval", "Training Session Attendance",
      "Punch List Walkthrough", "Facility Handover Acceptance",
      "O&M Manual Review", "Final Acceptance Letter"
    ],
    "commissioning_relevance": {
      "level": "high",
      "description_i18n": {
        "en": "Owner Witness participation is required for L4 functional testing and L5 integrated systems testing. Many commissioning tests cannot be officially recorded without owner representative signature. Owner unavailability delays test completion, retest scheduling, and final acceptance. This is often an organizational bottleneck rather than a skills gap.",
        "es": "La participación del Testigo del Propietario es requerida para pruebas funcionales L4 y pruebas de sistemas integrados L5. Muchas pruebas de puesta en servicio no pueden registrarse oficialmente sin la firma del representante del propietario. La indisponibilidad del propietario retrasa la finalización de pruebas, la programación de retests y la aceptación final. Esto es a menudo un cuello de botella organizacional más que una brecha de habilidades."
      },
      "test_phases": ["L4", "L5"]
    }
  }'::jsonb,
  9
)
ON CONFLICT (organization_id, project_id, trade_key) WHERE deleted_at IS NULL DO UPDATE SET
  label_i18n = EXCLUDED.label_i18n,
  metadata   = EXCLUDED.metadata,
  updated_at = now();

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: Specialist Roles (trade_type = 'specialist_role')
-- These map to the crew-level resources from DCL-003
-- ═══════════════════════════════════════════════════════════════════════════════

-- 10. UPS OEM Technician
INSERT INTO trade_taxonomy (
  organization_id, project_id, trade_key, label_i18n, trade_type, parent_key,
  metadata, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'ups-oem-tech',
  '{"en": "UPS OEM Technician", "es": "Técnico OEM de UPS"}',
  'specialist_role', 'oem-vendor',
  '{
    "skills": [
      {"key": "ups-startup", "label_i18n": {"en": "UPS Start-Up & Commissioning", "es": "Arranque y Puesta en Servicio de UPS"}, "level": "senior"},
      {"key": "battery-test", "label_i18n": {"en": "Battery Capacity & Discharge Testing", "es": "Prueba de Capacidad y Descarga de Baterías"}, "level": "senior"},
      {"key": "load-bank", "label_i18n": {"en": "Load Bank Testing", "es": "Prueba de Banco de Carga"}, "level": "senior"}
    ],
    "certifications": [
      {"key": "mfr-ups-specific", "label_i18n": {"en": "Manufacturer-Specific UPS Certification", "es": "Certificación Específica de Fabricante de UPS"}, "required": true}
    ],
    "work_packages": ["UPS Start-Up", "Battery Commissioning", "Load Bank Test", "Warranty Activation"],
    "commissioning_relevance": {
      "level": "critical",
      "description_i18n": {
        "en": "UPS OEM Technician is a single-point-of-failure for L4 functional testing. Only manufacturer-certified technicians can start up the UPS and validate warranty. Often booked 4-8 weeks in advance. Unavailability blocks the entire electrical commissioning sequence downstream.",
        "es": "El Técnico OEM de UPS es un punto único de falla para pruebas funcionales L4. Solo técnicos certificados por el fabricante pueden arrancar el UPS y validar la garantía. Frecuentemente reservado con 4-8 semanas de anticipación. La indisponibilidad bloquea toda la secuencia de puesta en servicio eléctrica posterior."
      },
      "test_phases": ["L4", "L5"]
    },
    "availability_constraint": "vendor-scheduled",
    "typical_lead_time_weeks": 6
  }'::jsonb,
  10
)
ON CONFLICT (organization_id, project_id, trade_key) WHERE deleted_at IS NULL DO UPDATE SET
  label_i18n = EXCLUDED.label_i18n,
  metadata   = EXCLUDED.metadata,
  updated_at = now();

-- 11. Generator Vendor
INSERT INTO trade_taxonomy (
  organization_id, project_id, trade_key, label_i18n, trade_type, parent_key,
  metadata, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'generator-vendor',
  '{"en": "Generator Vendor Technician", "es": "Técnico de Proveedor de Generador"}',
  'specialist_role', 'oem-vendor',
  '{
    "skills": [
      {"key": "gen-startup", "label_i18n": {"en": "Generator Start-Up & Commissioning", "es": "Arranque y Puesta en Servicio de Generador"}, "level": "senior"},
      {"key": "gen-load-bank", "label_i18n": {"en": "Generator Load Bank Testing", "es": "Prueba de Banco de Carga de Generador"}, "level": "senior"},
      {"key": "ats-testing", "label_i18n": {"en": "ATS / Transfer Switch Testing", "es": "Prueba de ATS / Interruptor de Transferencia"}, "level": "senior"}
    ],
    "certifications": [
      {"key": "mfr-gen-specific", "label_i18n": {"en": "Manufacturer-Specific Generator Certification", "es": "Certificación Específica de Fabricante de Generador"}, "required": true}
    ],
    "work_packages": ["Generator Start-Up", "Load Bank Test", "ATS Transfer Test", "Warranty Activation"],
    "commissioning_relevance": {
      "level": "critical",
      "description_i18n": {
        "en": "Generator Vendor Technician is required for L4 functional testing. Generator start-up and load bank testing require manufacturer-certified personnel. Limited availability is a common scheduling constraint.",
        "es": "El Técnico de Proveedor de Generador es requerido para pruebas funcionales L4. El arranque del generador y la prueba de banco de carga requieren personal certificado por el fabricante. La disponibilidad limitada es una restricción común de programación."
      },
      "test_phases": ["L4", "L5"]
    },
    "availability_constraint": "vendor-scheduled",
    "typical_lead_time_weeks": 4
  }'::jsonb,
  11
)
ON CONFLICT (organization_id, project_id, trade_key) WHERE deleted_at IS NULL DO UPDATE SET
  label_i18n = EXCLUDED.label_i18n,
  metadata   = EXCLUDED.metadata,
  updated_at = now();

-- 12. Commissioning Agent
INSERT INTO trade_taxonomy (
  organization_id, project_id, trade_key, label_i18n, trade_type, parent_key,
  metadata, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'commissioning-agent',
  '{"en": "Commissioning Agent", "es": "Agente de Puesta en Servicio"}',
  'specialist_role', 'commissioning',
  '{
    "skills": [
      {"key": "cx-planning", "label_i18n": {"en": "Commissioning Plan Development", "es": "Desarrollo de Plan de Puesta en Servicio"}, "level": "master"},
      {"key": "cx-execution", "label_i18n": {"en": "Test Execution & Witnessing", "es": "Ejecución y Presencia en Pruebas"}, "level": "master"},
      {"key": "cx-reporting", "label_i18n": {"en": "Commissioning Reporting & Closeout", "es": "Informes y Cierre de Puesta en Servicio"}, "level": "senior"}
    ],
    "certifications": [
      {"key": "bcxa-cxap-agent", "label_i18n": {"en": "BCxA CxA Provider", "es": "BCxA Proveedor CxA"}, "required": true}
    ],
    "work_packages": ["Commissioning Plan", "L3 Test Oversight", "L4 Test Execution", "L5 Test Coordination", "Final Cx Report"],
    "commissioning_relevance": {
      "level": "critical",
      "description_i18n": {
        "en": "The Commissioning Agent is the single most critical resource for data center project delivery. They plan, execute, and document every L3/L4/L5 test. A single agent often covers the entire project. Over-allocation across concurrent projects is the primary risk.",
        "es": "El Agente de Puesta en Servicio es el recurso más crítico para la entrega de proyectos de centros de datos. Planifica, ejecuta y documenta cada prueba L3/L4/L5. Un solo agente a menudo cubre todo el proyecto. La sobreasignación entre proyectos concurrentes es el riesgo principal."
      },
      "test_phases": ["L3", "L4", "L5"]
    },
    "availability_constraint": "single-resource",
    "typical_lead_time_weeks": 2
  }'::jsonb,
  12
)
ON CONFLICT (organization_id, project_id, trade_key) WHERE deleted_at IS NULL DO UPDATE SET
  label_i18n = EXCLUDED.label_i18n,
  metadata   = EXCLUDED.metadata,
  updated_at = now();

-- 13. QA/QC Inspector
INSERT INTO trade_taxonomy (
  organization_id, project_id, trade_key, label_i18n, trade_type, parent_key,
  metadata, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'qa-qc-inspector',
  '{"en": "QA/QC Inspector", "es": "Inspector QA/QC"}',
  'specialist_role', 'qa-qc',
  '{
    "skills": [
      {"key": "electrical-qa", "label_i18n": {"en": "Electrical Installation QA", "es": "QA de Instalación Eléctrica"}, "level": "senior"},
      {"key": "mechanical-qa", "label_i18n": {"en": "Mechanical Installation QA", "es": "QA de Instalación Mecánica"}, "level": "senior"},
      {"key": "punch-list-mgmt", "label_i18n": {"en": "Punch List Management", "es": "Gestión de Punch List"}, "level": "journeyman"}
    ],
    "certifications": [
      {"key": "cqa-inspector", "label_i18n": {"en": "Certified Quality Auditor", "es": "Auditor de Calidad Certificado"}, "required": false}
    ],
    "work_packages": ["Electrical Room QA", "Mechanical Room QA", "Punch List Walkdown", "Submittal Review"],
    "commissioning_relevance": {
      "level": "high",
      "description_i18n": {
        "en": "QA/QC Inspector provides the quality gate before commissioning. Their sign-off is required to advance from installation to pre-functional testing. Over-allocation delays the start of L3 testing.",
        "es": "El Inspector QA/QC proporciona la puerta de calidad antes de la puesta en servicio. Su aprobación es requerida para avanzar de la instalación a las pruebas pre-funcionales. La sobreasignación retrasa el inicio de las pruebas L3."
      },
      "test_phases": ["L3", "L4", "L5"]
    },
    "availability_constraint": "over-allocated",
    "typical_lead_time_weeks": 1
  }'::jsonb,
  13
)
ON CONFLICT (organization_id, project_id, trade_key) WHERE deleted_at IS NULL DO UPDATE SET
  label_i18n = EXCLUDED.label_i18n,
  metadata   = EXCLUDED.metadata,
  updated_at = now();

-- 14. Controls Technician
INSERT INTO trade_taxonomy (
  organization_id, project_id, trade_key, label_i18n, trade_type, parent_key,
  metadata, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'controls-tech',
  '{"en": "Controls Technician", "es": "Técnico de Controles"}',
  'specialist_role', 'controls-bms',
  '{
    "skills": [
      {"key": "ddc-prog", "label_i18n": {"en": "DDC Programming & Checkout", "es": "Programación y Verificación DDC"}, "level": "senior"},
      {"key": "bms-graphics", "label_i18n": {"en": "BMS Graphics Configuration", "es": "Configuración de Gráficos del BMS"}, "level": "senior"},
      {"key": "bacnet-int", "label_i18n": {"en": "BACnet Integration", "es": "Integración BACnet"}, "level": "master"}
    ],
    "certifications": [
      {"key": "bacnet-ct", "label_i18n": {"en": "BACnet Certified Technician", "es": "Técnico Certificado BACnet"}, "required": false}
    ],
    "work_packages": ["BMS Panel Build", "Point-to-Point Checkout", "DDC Programming", "BACnet Integration"],
    "commissioning_relevance": {
      "level": "high",
      "description_i18n": {
        "en": "Controls Technician is needed for L3 and L4 commissioning of BMS and HVAC controls. The BMS cannot be commissioned without controls programming completion. This is a sequential dependency.",
        "es": "El Técnico de Controles es necesario para la puesta en servicio L3 y L4 del BMS y controles HVAC. El BMS no puede ponerse en servicio sin completar la programación de controles. Esta es una dependencia secuencial."
      },
      "test_phases": ["L3", "L4"]
    },
    "availability_constraint": "partial",
    "typical_lead_time_weeks": 2
  }'::jsonb,
  14
)
ON CONFLICT (organization_id, project_id, trade_key) WHERE deleted_at IS NULL DO UPDATE SET
  label_i18n = EXCLUDED.label_i18n,
  metadata   = EXCLUDED.metadata,
  updated_at = now();

-- 15. Fiber Crew Lead
INSERT INTO trade_taxonomy (
  organization_id, project_id, trade_key, label_i18n, trade_type, parent_key,
  metadata, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'fiber-crew-lead',
  '{"en": "Fiber Crew Lead", "es": "Líder de Cuadrilla de Fibra"}',
  'specialist_role', 'low-voltage-fiber',
  '{
    "skills": [
      {"key": "fiber-splice", "label_i18n": {"en": "Fiber Splicing & Termination", "es": "Empalme y Terminación de Fibra"}, "level": "senior"},
      {"key": "otdr", "label_i18n": {"en": "OTDR Testing & Certification", "es": "Prueba y Certificación OTDR"}, "level": "senior"},
      {"key": "cat6-term", "label_i18n": {"en": "Cat6A Termination", "es": "Terminación Cat6A"}, "level": "journeyman"}
    ],
    "certifications": [
      {"key": "foa-cfot-lead", "label_i18n": {"en": "FOA CFOT Fiber Optic Technician", "es": "FOA CFOT Técnico en Fibra Óptica"}, "required": false}
    ],
    "work_packages": ["Fiber Backbone Install", "OTDR Testing", "Cat6A Horizontal Cabling", "Cable Certification"],
    "commissioning_relevance": {
      "level": "medium",
      "description_i18n": {
        "en": "Fiber Crew Lead manages the low voltage cabling and fiber installation. Network connectivity is a prerequisite for BMS commissioning and monitoring. Fiber delays cascade into controls commissioning delays.",
        "es": "El Líder de Cuadrilla de Fibra gestiona la instalación de cableado de bajo voltaje y fibra. La conectividad de red es un prerequisito para la puesta en servicio del BMS y monitoreo. Los retrasos de fibra se propagan a retrasos en la puesta en servicio de controles."
      },
      "test_phases": ["L3"]
    },
    "availability_constraint": "partial",
    "typical_lead_time_weeks": 1
  }'::jsonb,
  15
)
ON CONFLICT (organization_id, project_id, trade_key) WHERE deleted_at IS NULL DO UPDATE SET
  label_i18n = EXCLUDED.label_i18n,
  metadata   = EXCLUDED.metadata,
  updated_at = now();

-- 16. Electrical Crew Lead
INSERT INTO trade_taxonomy (
  organization_id, project_id, trade_key, label_i18n, trade_type, parent_key,
  metadata, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'electrical-crew-lead',
  '{"en": "Electrical Crew Lead", "es": "Líder de Cuadrilla Eléctrica"}',
  'specialist_role', 'electrical',
  '{
    "skills": [
      {"key": "switchgear-install-lead", "label_i18n": {"en": "Switchgear Installation Oversight", "es": "Supervisión de Instalación de Tableros"}, "level": "senior"},
      {"key": "cable-pull-lead", "label_i18n": {"en": "Large Cable Pull Coordination", "es": "Coordinación de Tiro de Cables Grandes"}, "level": "senior"},
      {"key": "grounding-lead", "label_i18n": {"en": "Grounding System Oversight", "es": "Supervisión de Sistema de Puesta a Tierra"}, "level": "senior"}
    ],
    "certifications": [
      {"key": "state-license-lead", "label_i18n": {"en": "State Electrical License", "es": "Licencia Estatal de Electricista"}, "required": true},
      {"key": "nfpa-70e-lead", "label_i18n": {"en": "NFPA 70E Arc Flash Safety", "es": "NFPA 70E Seguridad contra Arco Eléctrico"}, "required": true}
    ],
    "work_packages": ["Switchgear Install", "Cable Pulling", "Grounding Grid", "Panel Terminations", "Electrical QA Support"],
    "commissioning_relevance": {
      "level": "high",
      "description_i18n": {
        "en": "Electrical Crew Lead directs the field installation and supports commissioning by ensuring installations meet test prerequisites. Shortage of electrical leads delays energization and L3 start-up.",
        "es": "El Líder de Cuadrilla Eléctrica dirige la instalación en campo y apoya la puesta en servicio asegurando que las instalaciones cumplan los prerequisitos de prueba. La escasez de líderes eléctricos retrasa la energización y el arranque L3."
      },
      "test_phases": ["L3", "L4"]
    },
    "availability_constraint": "shortage",
    "typical_lead_time_weeks": 3
  }'::jsonb,
  16
)
ON CONFLICT (organization_id, project_id, trade_key) WHERE deleted_at IS NULL DO UPDATE SET
  label_i18n = EXCLUDED.label_i18n,
  metadata   = EXCLUDED.metadata,
  updated_at = now();

-- 17. Mechanical Crew Lead
INSERT INTO trade_taxonomy (
  organization_id, project_id, trade_key, label_i18n, trade_type, parent_key,
  metadata, order_index
) VALUES (
  '4f00f16b-96d8-4fd6-9375-20e2b11564a6',
  'dc100000-0000-4000-8000-000000000000',
  'mechanical-crew-lead',
  '{"en": "Mechanical Crew Lead", "es": "Líder de Cuadrilla Mecánica"}',
  'specialist_role', 'mechanical-hvac',
  '{
    "skills": [
      {"key": "crah-install-lead", "label_i18n": {"en": "CRAH Installation Oversight", "es": "Supervisión de Instalación CRAH"}, "level": "senior"},
      {"key": "piping-lead", "label_i18n": {"en": "Hydronic Piping Coordination", "es": "Coordinación de Tubería Hidrónica"}, "level": "senior"},
      {"key": "duct-lead", "label_i18n": {"en": "Ductwork Installation Oversight", "es": "Supervisión de Instalación de Ductos"}, "level": "senior"}
    ],
    "certifications": [
      {"key": "epa-608-lead", "label_i18n": {"en": "EPA 608 Refrigerant Handling", "es": "EPA 608 Manejo de Refrigerante"}, "required": true}
    ],
    "work_packages": ["CRAH Installation", "Chiller Piping", "Ductwork Install", "Cooling Tower", "HVAC Controls Rough-In"],
    "commissioning_relevance": {
      "level": "high",
      "description_i18n": {
        "en": "Mechanical Crew Lead manages the HVAC and piping installation. Their work must be complete before L3 pre-functional testing can begin. Shortage delays cooling system commissioning.",
        "es": "El Líder de Cuadrilla Mecánica gestiona la instalación de HVAC y tubería. Su trabajo debe completarse antes de que puedan comenzar las pruebas pre-funcionales L3. La escasez retrasa la puesta en servicio del sistema de refrigeración."
      },
      "test_phases": ["L3", "L4"]
    },
    "availability_constraint": "partial",
    "typical_lead_time_weeks": 2
  }'::jsonb,
  17
)
ON CONFLICT (organization_id, project_id, trade_key) WHERE deleted_at IS NULL DO UPDATE SET
  label_i18n = EXCLUDED.label_i18n,
  metadata   = EXCLUDED.metadata,
  updated_at = now();

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (uncomment to verify)
-- ═══════════════════════════════════════════════════════════════════════════════
-- SELECT trade_type, count(*) FROM trade_taxonomy
-- WHERE project_id = 'dc100000-0000-4000-8000-000000000000' AND deleted_at IS NULL
-- GROUP BY trade_type;
-- Expected: trade=9, specialist_role=8

-- SELECT trade_key, label_i18n->>'en' as label, trade_type, parent_key
-- FROM trade_taxonomy
-- WHERE project_id = 'dc100000-0000-4000-8000-000000000000' AND deleted_at IS NULL
-- ORDER BY order_index;
-- Expected: 17 rows