-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed: Readiness Checklist Data — DC Labor Risk Intelligence Lab
-- Updates existing construction activities with workface readiness checklists.
-- Each activity gets 9 readiness criteria with realistic DC construction states.
-- Idempotent UPDATEs (no INSERT needed — activities already exist).
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Switchgear Installation — mostly not ready, missing key prerequisites
UPDATE public.construction_activities
SET readiness_checklist = '[
  {"item_key": "rfi_answered",          "label_i18n": {"en": "RFI Answered",            "es": "RFI Respondida"},           "required": true,  "completed": false, "completed_at": null, "notes": "Fire rating RFI pending response"},
  {"item_key": "submittal_approved",    "label_i18n": {"en": "Submittal Approved",       "es": "Submittal Aprobado"},       "required": true,  "completed": true,  "completed_at": "2026-06-20T14:00:00Z", "notes": ""},
  {"item_key": "drawing_current",       "label_i18n": {"en": "Drawing Current",          "es": "Plano Vigente"},            "required": true,  "completed": true,  "completed_at": "2026-06-15T10:00:00Z", "notes": ""},
  {"item_key": "material_onsite",       "label_i18n": {"en": "Material Onsite",           "es": "Material en Sitio"},        "required": true,  "completed": false, "completed_at": null, "notes": "Switchgear delivery scheduled Jul 10"},
  {"item_key": "area_released",         "label_i18n": {"en": "Area Released",             "es": "Área Liberada"},             "required": true,  "completed": true,  "completed_at": "2026-07-01T09:00:00Z", "notes": ""},
  {"item_key": "permit_ready",          "label_i18n": {"en": "Safety/Permit Ready",      "es": "Seguridad/Permiso Listo"},   "required": true,  "completed": true,  "completed_at": "2026-07-10T08:00:00Z", "notes": ""},
  {"item_key": "predecessor_complete",  "label_i18n": {"en": "Predecessor Complete",      "es": "Predecesor Completo"},       "required": true,  "completed": true,  "completed_at": null, "notes": "No predecessors — start of critical path"},
  {"item_key": "qa_prerequisite",       "label_i18n": {"en": "QA Prerequisite Complete", "es": "Requisito QA Completo"},     "required": false, "completed": false, "completed_at": null, "notes": ""},
  {"item_key": "crew_assigned",         "label_i18n": {"en": "Crew Assigned",             "es": "Cuadrilla Asignada"},        "required": true,  "completed": true,  "completed_at": "2026-07-01T09:00:00Z", "notes": "3 crews assigned"}
]'::jsonb
WHERE activity_key = 'switchgear-install' AND project_id = 'dc100000-0000-4000-8000-000000000000';

-- 2. UPS Installation — depends on switchgear, vendor not confirmed
UPDATE public.construction_activities
SET readiness_checklist = '[
  {"item_key": "rfi_answered",          "label_i18n": {"en": "RFI Answered",            "es": "RFI Respondida"},           "required": true,  "completed": false, "completed_at": null, "notes": "UPS spec RFI pending"},
  {"item_key": "submittal_approved",    "label_i18n": {"en": "Submittal Approved",       "es": "Submittal Aprobado"},       "required": true,  "completed": false, "completed_at": null, "notes": "UPS equipment submittal under review"},
  {"item_key": "drawing_current",       "label_i18n": {"en": "Drawing Current",          "es": "Plano Vigente"},            "required": true,  "completed": true,  "completed_at": "2026-06-18T10:00:00Z", "notes": ""},
  {"item_key": "material_onsite",       "label_i18n": {"en": "Material Onsite",           "es": "Material en Sitio"},        "required": true,  "completed": false, "completed_at": null, "notes": "UPS modules not yet delivered"},
  {"item_key": "area_released",         "label_i18n": {"en": "Area Released",             "es": "Área Liberada"},             "required": true,  "completed": false, "completed_at": null, "notes": "UPS Room pending electrical rough-in"},
  {"item_key": "permit_ready",          "label_i18n": {"en": "Safety/Permit Ready",      "es": "Seguridad/Permiso Listo"},   "required": true,  "completed": true,  "completed_at": "2026-07-10T08:00:00Z", "notes": ""},
  {"item_key": "predecessor_complete",  "label_i18n": {"en": "Predecessor Complete",      "es": "Predecesor Completo"},       "required": true,  "completed": false, "completed_at": null, "notes": "Depends on Switchgear Installation"},
  {"item_key": "qa_prerequisite",       "label_i18n": {"en": "QA Prerequisite Complete", "es": "Requisito QA Completo"},     "required": false, "completed": false, "completed_at": null, "notes": ""},
  {"item_key": "crew_assigned",         "label_i18n": {"en": "Crew Assigned",             "es": "Cuadrilla Asignada"},        "required": true,  "completed": true,  "completed_at": "2026-07-01T09:00:00Z", "notes": "Crew A and Crew B assigned"}
]'::jsonb
WHERE activity_key = 'ups-install' AND project_id = 'dc100000-0000-4000-8000-000000000000';

-- 3. Generator Setup — vendor unconfirmed
UPDATE public.construction_activities
SET readiness_checklist = '[
  {"item_key": "rfi_answered",          "label_i18n": {"en": "RFI Answered",            "es": "RFI Respondida"},           "required": true,  "completed": false, "completed_at": null, "notes": "Generator pad spec RFI open"},
  {"item_key": "submittal_approved",    "label_i18n": {"en": "Submittal Approved",       "es": "Submittal Aprobado"},       "required": true,  "completed": false, "completed_at": null, "notes": "Generator submittal not yet submitted"},
  {"item_key": "drawing_current",       "label_i18n": {"en": "Drawing Current",          "es": "Plano Vigente"},            "required": true,  "completed": true,  "completed_at": "2026-06-10T10:00:00Z", "notes": ""},
  {"item_key": "material_onsite",       "label_i18n": {"en": "Material Onsite",           "es": "Material en Sitio"},        "required": true,  "completed": false, "completed_at": null, "notes": "Generator unit not yet on site"},
  {"item_key": "area_released",         "label_i18n": {"en": "Area Released",             "es": "Área Liberada"},             "required": true,  "completed": true,  "completed_at": "2026-07-01T09:00:00Z", "notes": "Generator pad ready"},
  {"item_key": "permit_ready",          "label_i18n": {"en": "Safety/Permit Ready",      "es": "Seguridad/Permiso Listo"},   "required": true,  "completed": true,  "completed_at": "2026-07-05T08:00:00Z", "notes": ""},
  {"item_key": "predecessor_complete",  "label_i18n": {"en": "Predecessor Complete",      "es": "Predecesor Completo"},       "required": true,  "completed": false, "completed_at": null, "notes": "Depends on Switchgear Installation"},
  {"item_key": "qa_prerequisite",       "label_i18n": {"en": "QA Prerequisite Complete", "es": "Requisito QA Completo"},     "required": false, "completed": false, "completed_at": null, "notes": ""},
  {"item_key": "crew_assigned",         "label_i18n": {"en": "Crew Assigned",             "es": "Cuadrilla Asignada"},        "required": true,  "completed": false, "completed_at": null, "notes": "Generator Vendor UNCONFIRMED for W30-W33"}
]'::jsonb
WHERE activity_key = 'generator-setup' AND project_id = 'dc100000-0000-4000-8000-000000000000';

-- 4. CRAH Installation — mostly ready, clean execution window
UPDATE public.construction_activities
SET readiness_checklist = '[
  {"item_key": "rfi_answered",          "label_i18n": {"en": "RFI Answered",            "es": "RFI Respondida"},           "required": true,  "completed": true,  "completed_at": "2026-06-25T10:00:00Z", "notes": ""},
  {"item_key": "submittal_approved",    "label_i18n": {"en": "Submittal Approved",       "es": "Submittal Aprobado"},       "required": true,  "completed": true,  "completed_at": "2026-06-20T14:00:00Z", "notes": ""},
  {"item_key": "drawing_current",       "label_i18n": {"en": "Drawing Current",          "es": "Plano Vigente"},            "required": true,  "completed": true,  "completed_at": "2026-06-15T10:00:00Z", "notes": ""},
  {"item_key": "material_onsite",       "label_i18n": {"en": "Material Onsite",           "es": "Material en Sitio"},        "required": true,  "completed": true,  "completed_at": "2026-07-10T08:00:00Z", "notes": "CRAH units delivered"},
  {"item_key": "area_released",         "label_i18n": {"en": "Area Released",             "es": "Área Liberada"},             "required": true,  "completed": true,  "completed_at": "2026-07-01T09:00:00Z", "notes": "Data Hall cleared"},
  {"item_key": "permit_ready",          "label_i18n": {"en": "Safety/Permit Ready",      "es": "Seguridad/Permiso Listo"},   "required": true,  "completed": true,  "completed_at": "2026-07-10T08:00:00Z", "notes": ""},
  {"item_key": "predecessor_complete",  "label_i18n": {"en": "Predecessor Complete",      "es": "Predecesor Completo"},       "required": true,  "completed": true,  "completed_at": null, "notes": "No hard predecessor"},
  {"item_key": "qa_prerequisite",       "label_i18n": {"en": "QA Prerequisite Complete", "es": "Requisito QA Completo"},     "required": false, "completed": false, "completed_at": null, "notes": ""},
  {"item_key": "crew_assigned",         "label_i18n": {"en": "Crew Assigned",             "es": "Cuadrilla Asignada"},        "required": true,  "completed": true,  "completed_at": "2026-07-01T09:00:00Z", "notes": "Mechanical Crew A assigned"}
]'::jsonb
WHERE activity_key = 'crah-install' AND project_id = 'dc100000-0000-4000-8000-000000000000';

-- 5. BMS Point-to-Point Testing — specialist partially available
UPDATE public.construction_activities
SET readiness_checklist = '[
  {"item_key": "rfi_answered",          "label_i18n": {"en": "RFI Answered",            "es": "RFI Respondida"},           "required": true,  "completed": true,  "completed_at": "2026-07-01T10:00:00Z", "notes": ""},
  {"item_key": "submittal_approved",    "label_i18n": {"en": "Submittal Approved",       "es": "Submittal Aprobado"},       "required": true,  "completed": true,  "completed_at": "2026-06-28T14:00:00Z", "notes": ""},
  {"item_key": "drawing_current",       "label_i18n": {"en": "Drawing Current",          "es": "Plano Vigente"},            "required": true,  "completed": true,  "completed_at": "2026-07-01T10:00:00Z", "notes": ""},
  {"item_key": "material_onsite",       "label_i18n": {"en": "Material Onsite",           "es": "Material en Sitio"},        "required": true,  "completed": true,  "completed_at": "2026-07-20T08:00:00Z", "notes": "BMS controllers and sensors on site"},
  {"item_key": "area_released",         "label_i18n": {"en": "Area Released",             "es": "Área Liberada"},             "required": true,  "completed": false, "completed_at": null, "notes": "Depends on CRAH completion"},
  {"item_key": "permit_ready",          "label_i18n": {"en": "Safety/Permit Ready",      "es": "Seguridad/Permiso Listo"},   "required": true,  "completed": true,  "completed_at": "2026-07-20T08:00:00Z", "notes": ""},
  {"item_key": "predecessor_complete",  "label_i18n": {"en": "Predecessor Complete",      "es": "Predecesor Completo"},       "required": true,  "completed": false, "completed_at": null, "notes": "Depends on CRAH Installation"},
  {"item_key": "qa_prerequisite",       "label_i18n": {"en": "QA Prerequisite Complete", "es": "Requisito QA Completo"},     "required": true,  "completed": false, "completed_at": null, "notes": "BMS commissioning prerequisite not met"},
  {"item_key": "crew_assigned",         "label_i18n": {"en": "Crew Assigned",             "es": "Cuadrilla Asignada"},        "required": true,  "completed": true,  "completed_at": "2026-07-01T09:00:00Z", "notes": "Controls Tech A assigned (partial availability)"}
]'::jsonb
WHERE activity_key = 'bms-point-to-point' AND project_id = 'dc100000-0000-4000-8000-000000000000';

-- 6. Fiber Pathway Installation — clean, ready to go
UPDATE public.construction_activities
SET readiness_checklist = '[
  {"item_key": "rfi_answered",          "label_i18n": {"en": "RFI Answered",            "es": "RFI Respondida"},           "required": true,  "completed": true,  "completed_at": "2026-06-20T10:00:00Z", "notes": ""},
  {"item_key": "submittal_approved",    "label_i18n": {"en": "Submittal Approved",       "es": "Submittal Aprobado"},       "required": true,  "completed": true,  "completed_at": "2026-06-18T14:00:00Z", "notes": ""},
  {"item_key": "drawing_current",       "label_i18n": {"en": "Drawing Current",          "es": "Plano Vigente"},            "required": true,  "completed": true,  "completed_at": "2026-06-15T10:00:00Z", "notes": ""},
  {"item_key": "material_onsite",       "label_i18n": {"en": "Material Onsite",           "es": "Material en Sitio"},        "required": true,  "completed": true,  "completed_at": "2026-07-10T08:00:00Z", "notes": "Fiber cable and pathway materials delivered"},
  {"item_key": "area_released",         "label_i18n": {"en": "Area Released",             "es": "Área Liberada"},             "required": true,  "completed": true,  "completed_at": "2026-07-01T09:00:00Z", "notes": "Corridors cleared"},
  {"item_key": "permit_ready",          "label_i18n": {"en": "Safety/Permit Ready",      "es": "Seguridad/Permiso Listo"},   "required": true,  "completed": true,  "completed_at": "2026-07-08T08:00:00Z", "notes": ""},
  {"item_key": "predecessor_complete",  "label_i18n": {"en": "Predecessor Complete",      "es": "Predecesor Completo"},       "required": true,  "completed": true,  "completed_at": null, "notes": "No hard predecessor"},
  {"item_key": "qa_prerequisite",       "label_i18n": {"en": "QA Prerequisite Complete", "es": "Requisito QA Completo"},     "required": false, "completed": false, "completed_at": null, "notes": ""},
  {"item_key": "crew_assigned",         "label_i18n": {"en": "Crew Assigned",             "es": "Cuadrilla Asignada"},        "required": true,  "completed": true,  "completed_at": "2026-07-01T09:00:00Z", "notes": "Fiber Crew A assigned"}
]'::jsonb
WHERE activity_key = 'fiber-pathway' AND project_id = 'dc100000-0000-4000-8000-000000000000';

-- 7. Electrical Room QA — inspector over-allocated
UPDATE public.construction_activities
SET readiness_checklist = '[
  {"item_key": "rfi_answered",          "label_i18n": {"en": "RFI Answered",            "es": "RFI Respondida"},           "required": true,  "completed": true,  "completed_at": "2026-07-01T10:00:00Z", "notes": ""},
  {"item_key": "submittal_approved",    "label_i18n": {"en": "Submittal Approved",       "es": "Submittal Aprobado"},       "required": true,  "completed": true,  "completed_at": "2026-06-25T14:00:00Z", "notes": ""},
  {"item_key": "drawing_current",       "label_i18n": {"en": "Drawing Current",          "es": "Plano Vigente"},            "required": true,  "completed": true,  "completed_at": "2026-07-01T10:00:00Z", "notes": "As-built drawings pending final verification"},
  {"item_key": "material_onsite",       "label_i18n": {"en": "Material Onsite",           "es": "Material en Sitio"},        "required": true,  "completed": true,  "completed_at": "2026-07-20T08:00:00Z", "notes": "Testing equipment available"},
  {"item_key": "area_released",         "label_i18n": {"en": "Area Released",             "es": "Área Liberada"},             "required": true,  "completed": false, "completed_at": null, "notes": "Electrical Room not yet cleared for QA"},
  {"item_key": "permit_ready",          "label_i18n": {"en": "Safety/Permit Ready",      "es": "Seguridad/Permiso Listo"},   "required": true,  "completed": true,  "completed_at": "2026-07-20T08:00:00Z", "notes": ""},
  {"item_key": "predecessor_complete",  "label_i18n": {"en": "Predecessor Complete",      "es": "Predecesor Completo"},       "required": true,  "completed": false, "completed_at": null, "notes": "Depends on Switchgear + UPS completion"},
  {"item_key": "qa_prerequisite",       "label_i18n": {"en": "QA Prerequisite Complete", "es": "Requisito QA Completo"},     "required": true,  "completed": false, "completed_at": null, "notes": "Previous QA holdovers not cleared"},
  {"item_key": "crew_assigned",         "label_i18n": {"en": "Crew Assigned",             "es": "Cuadrilla Asignada"},        "required": true,  "completed": true,  "completed_at": "2026-07-01T09:00:00Z", "notes": "QA/QC Inspector assigned (over-allocated)"}
]'::jsonb
WHERE activity_key = 'electrical-room-qa' AND project_id = 'dc100000-0000-4000-8000-000000000000';

-- 8. L3 Pre-functional — convergence gate, multiple prerequisites incomplete
UPDATE public.construction_activities
SET readiness_checklist = '[
  {"item_key": "rfi_answered",          "label_i18n": {"en": "RFI Answered",            "es": "RFI Respondida"},           "required": true,  "completed": false, "completed_at": null, "notes": "Commissioning RFI pending"},
  {"item_key": "submittal_approved",    "label_i18n": {"en": "Submittal Approved",       "es": "Submittal Aprobado"},       "required": true,  "completed": false, "completed_at": null, "notes": "Commissioning plan under review"},
  {"item_key": "drawing_current",       "label_i18n": {"en": "Drawing Current",          "es": "Plano Vigente"},            "required": true,  "completed": true,  "completed_at": "2026-07-15T10:00:00Z", "notes": ""},
  {"item_key": "material_onsite",       "label_i18n": {"en": "Material Onsite",           "es": "Material en Sitio"},        "required": true,  "completed": true,  "completed_at": "2026-07-25T08:00:00Z", "notes": "Commissioning test equipment staged"},
  {"item_key": "area_released",         "label_i18n": {"en": "Area Released",             "es": "Área Liberada"},             "required": true,  "completed": false, "completed_at": null, "notes": "All zones not yet cleared"},
  {"item_key": "permit_ready",          "label_i18n": {"en": "Safety/Permit Ready",      "es": "Seguridad/Permiso Listo"},   "required": true,  "completed": false, "completed_at": null, "notes": "Commissioning permit not yet issued"},
  {"item_key": "predecessor_complete",  "label_i18n": {"en": "Predecessor Complete",      "es": "Predecesor Completo"},       "required": true,  "completed": false, "completed_at": null, "notes": "Depends on BMS P2P, Electrical QA, and Fiber"},
  {"item_key": "qa_prerequisite",       "label_i18n": {"en": "QA Prerequisite Complete", "es": "Requisito QA Completo"},     "required": true,  "completed": false, "completed_at": null, "notes": "Electrical QA must pass first"},
  {"item_key": "crew_assigned",         "label_i18n": {"en": "Crew Assigned",             "es": "Cuadrilla Asignada"},        "required": true,  "completed": true,  "completed_at": "2026-07-01T09:00:00Z", "notes": "Commissioning Agent assigned (over-allocated)"}
]'::jsonb
WHERE activity_key = 'l3-pre-functional' AND project_id = 'dc100000-0000-4000-8000-000000000000';

-- 9. L4 UPS Functional Test — vendor unconfirmed
UPDATE public.construction_activities
SET readiness_checklist = '[
  {"item_key": "rfi_answered",          "label_i18n": {"en": "RFI Answered",            "es": "RFI Respondida"},           "required": true,  "completed": false, "completed_at": null, "notes": "UPS functional test RFI pending"},
  {"item_key": "submittal_approved",    "label_i18n": {"en": "Submittal Approved",       "es": "Submittal Aprobado"},       "required": true,  "completed": false, "completed_at": null, "notes": "UPS OEM test procedure not yet approved"},
  {"item_key": "drawing_current",       "label_i18n": {"en": "Drawing Current",          "es": "Plano Vigente"},            "required": true,  "completed": true,  "completed_at": "2026-07-15T10:00:00Z", "notes": ""},
  {"item_key": "material_onsite",       "label_i18n": {"en": "Material Onsite",           "es": "Material en Sitio"},        "required": true,  "completed": false, "completed_at": null, "notes": "Load bank equipment not yet on site"},
  {"item_key": "area_released",         "label_i18n": {"en": "Area Released",             "es": "Área Liberada"},             "required": true,  "completed": false, "completed_at": null, "notes": "UPS Room not cleared for L4 testing"},
  {"item_key": "permit_ready",          "label_i18n": {"en": "Safety/Permit Ready",      "es": "Seguridad/Permiso Listo"},   "required": true,  "completed": false, "completed_at": null, "notes": "Energization permit required for L4"},
  {"item_key": "predecessor_complete",  "label_i18n": {"en": "Predecessor Complete",      "es": "Predecesor Completo"},       "required": true,  "completed": false, "completed_at": null, "notes": "Depends on L3 Pre-functional completion"},
  {"item_key": "qa_prerequisite",       "label_i18n": {"en": "QA Prerequisite Complete", "es": "Requisito QA Completo"},     "required": true,  "completed": false, "completed_at": null, "notes": "L3 must pass first"},
  {"item_key": "crew_assigned",         "label_i18n": {"en": "Crew Assigned",             "es": "Cuadrilla Asignada"},        "required": true,  "completed": false, "completed_at": null, "notes": "UPS OEM Technician UNCONFIRMED for W32"}
]'::jsonb
WHERE activity_key = 'l4-ups-functional' AND project_id = 'dc100000-0000-4000-8000-000000000000';

-- 10. L5 Integrated Systems Test — commissioning SPOF
UPDATE public.construction_activities
SET readiness_checklist = '[
  {"item_key": "rfi_answered",          "label_i18n": {"en": "RFI Answered",            "es": "RFI Respondida"},           "required": true,  "completed": false, "completed_at": null, "notes": "Integrated test procedure RFI pending"},
  {"item_key": "submittal_approved",    "label_i18n": {"en": "Submittal Approved",       "es": "Submittal Aprobado"},       "required": true,  "completed": false, "completed_at": null, "notes": "Integrated test plan under review"},
  {"item_key": "drawing_current",       "label_i18n": {"en": "Drawing Current",          "es": "Plano Vigente"},            "required": true,  "completed": true,  "completed_at": "2026-07-15T10:00:00Z", "notes": ""},
  {"item_key": "material_onsite",       "label_i18n": {"en": "Material Onsite",           "es": "Material en Sitio"},        "required": true,  "completed": false, "completed_at": null, "notes": "Test instrumentation not yet staged"},
  {"item_key": "area_released",         "label_i18n": {"en": "Area Released",             "es": "Área Liberada"},             "required": true,  "completed": false, "completed_at": null, "notes": "All zones required"},
  {"item_key": "permit_ready",          "label_i18n": {"en": "Safety/Permit Ready",      "es": "Seguridad/Permiso Listo"},   "required": true,  "completed": false, "completed_at": null, "notes": "Full facility test permit not issued"},
  {"item_key": "predecessor_complete",  "label_i18n": {"en": "Predecessor Complete",      "es": "Predecesor Completo"},       "required": true,  "completed": false, "completed_at": null, "notes": "Depends on L4 UPS Functional Test"},
  {"item_key": "qa_prerequisite",       "label_i18n": {"en": "QA Prerequisite Complete", "es": "Requisito QA Completo"},     "required": true,  "completed": false, "completed_at": null, "notes": "L4 must pass first"},
  {"item_key": "crew_assigned",         "label_i18n": {"en": "Crew Assigned",             "es": "Cuadrilla Asignada"},        "required": true,  "completed": true,  "completed_at": "2026-07-01T09:00:00Z", "notes": "Commissioning Agent assigned (SPOF)"}
]'::jsonb
WHERE activity_key = 'l5-integrated-test' AND project_id = 'dc100000-0000-4000-8000-000000000000';

-- 11. Client Handover — owner witness availability
UPDATE public.construction_activities
SET readiness_checklist = '[
  {"item_key": "rfi_answered",          "label_i18n": {"en": "RFI Answered",            "es": "RFI Respondida"},           "required": true,  "completed": false, "completed_at": null, "notes": "Handover documentation RFI pending"},
  {"item_key": "submittal_approved",    "label_i18n": {"en": "Submittal Approved",       "es": "Submittal Aprobado"},       "required": true,  "completed": false, "completed_at": null, "notes": "As-built and commissioning reports not finalized"},
  {"item_key": "drawing_current",       "label_i18n": {"en": "Drawing Current",          "es": "Plano Vigente"},            "required": true,  "completed": false, "completed_at": null, "notes": "As-built drawings pending"},
  {"item_key": "material_onsite",       "label_i18n": {"en": "Material Onsite",           "es": "Material en Sitio"},        "required": true,  "completed": true,  "completed_at": "2026-07-25T08:00:00Z", "notes": "All equipment installed"},
  {"item_key": "area_released",         "label_i18n": {"en": "Area Released",             "es": "Área Liberada"},             "required": true,  "completed": false, "completed_at": null, "notes": "Punch list items not yet resolved"},
  {"item_key": "permit_ready",          "label_i18n": {"en": "Safety/Permit Ready",      "es": "Seguridad/Permiso Listo"},   "required": true,  "completed": true,  "completed_at": "2026-07-25T08:00:00Z", "notes": "Final occupancy permit ready"},
  {"item_key": "predecessor_complete",  "label_i18n": {"en": "Predecessor Complete",      "es": "Predecesor Completo"},       "required": true,  "completed": false, "completed_at": null, "notes": "Depends on L5 Integrated Systems Test"},
  {"item_key": "qa_prerequisite",       "label_i18n": {"en": "QA Prerequisite Complete", "es": "Requisito QA Completo"},     "required": true,  "completed": false, "completed_at": null, "notes": "All commissioning tests must pass"},
  {"item_key": "crew_assigned",         "label_i18n": {"en": "Crew Assigned",             "es": "Cuadrilla Asignada"},        "required": true,  "completed": true,  "completed_at": "2026-07-01T09:00:00Z", "notes": "Owner Witness assigned (available W32-W34 only)"}
]'::jsonb
WHERE activity_key = 'client-handover' AND project_id = 'dc100000-0000-4000-8000-000000000000';

-- Update the DCL-012 task status to 'implemented'
UPDATE public.roadmap_tasks
SET status = 'implemented', updated_at = now()
WHERE task_key = 'DCL-012' AND project_id = 'dc100000-0000-4000-8000-000000000000';