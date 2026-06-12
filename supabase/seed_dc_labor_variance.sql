-- ============================================================================
-- Seed: Labor Variance Data — DC Construction Activities
-- ============================================================================
-- Updates existing construction activities with actual labor tracking data.
-- Includes at least one activity with major variance for testing.
-- Idempotent UPDATEs (activities already exist from seed_dc_construction_activities.sql).
-- Uses jsonb_set to add delay_reason_i18n to metadata, preserving existing keys.
-- ============================================================================

-- ── 1. Switchgear Installation ────────────────────────────────────────────────
--    COMPLETED with minor variance.
--    Estimated: 160h, Actual: 168h (+5%), 2 rework cycles (torque mark issues)
UPDATE public.construction_activities
SET actual_hours = 168.00,
    planned_production_rate = 4.00,
    actual_production_rate = 3.81,
    crew_size = 13,
    rework_count = 2,
    status = 'completed',
    progress = 100,
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{delay_reason_i18n}',
      '{"en": "Torque mark verification failed twice; rework required on bus connections.", "es": "Verificación de marcas de torque falló dos veces; retrabajo requerido en conexiones de bus."}'::jsonb
    ),
    updated_at = now()
WHERE activity_key = 'switchgear-install'
  AND project_id = 'dc100000-0000-4000-8000-000000000000';

-- ── 2. UPS Installation ──────────────────────────────────────────────────────
--    MAJOR VARIANCE (the test case).
--    Estimated: 200h, Actual: 352h (+76% overrun).
--    Production rate collapsed from 3.50 to 1.99 (43% productivity loss).
--    3 rework cycles. Crew C departed mid-activity.
UPDATE public.construction_activities
SET actual_hours = 352.00,
    planned_production_rate = 3.50,
    actual_production_rate = 1.99,
    crew_size = 10,
    rework_count = 3,
    status = 'completed',
    progress = 100,
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{delay_reason_i18n}',
      '{"en": "Battery string failure during commissioning; UPS vendor required 3 return visits. Crew C departed mid-activity forcing 2-crew schedule on 3-crew plan.", "es": "Fallo en cadena de baterías durante comisionamiento; proveedor de UPS requirió 3 visitas de retorno. Crew C partió a mitad de la actividad forzando programación de 2 cuadrillas en plan de 3."}'::jsonb
    ),
    updated_at = now()
WHERE activity_key = 'ups-install'
  AND project_id = 'dc100000-0000-4000-8000-000000000000';

-- ── 3. CRAH Installation ─────────────────────────────────────────────────────
--    COMPLETED on schedule, minor underrun.
--    Estimated: 160h, Actual: 144h (-10%), production rate exceeded plan.
--    No rework. Clean execution.
UPDATE public.construction_activities
SET actual_hours = 144.00,
    planned_production_rate = 6.00,
    actual_production_rate = 6.67,
    crew_size = 8,
    rework_count = 0,
    status = 'completed',
    progress = 100,
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{delay_reason_i18n}',
      '{"en": "", "es": ""}'::jsonb
    ),
    updated_at = now()
WHERE activity_key = 'crah-install'
  AND project_id = 'dc100000-0000-4000-8000-000000000000';

-- ── 4. BMS Point-to-Point ────────────────────────────────────────────────────
--    IN PROGRESS, partial tracking.
--    Estimated: 80h, Actual so far: 48h (60% through), slight overrun rate.
--    Controls Tech A at 50% capacity — reduced pace.
UPDATE public.construction_activities
SET actual_hours = 48.00,
    planned_production_rate = 12.00,
    actual_production_rate = 10.00,
    crew_size = 1,
    rework_count = 0,
    status = 'in_progress',
    progress = 60,
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{delay_reason_i18n}',
      '{"en": "Controls Tech A at 50% capacity — point verification proceeding at reduced pace.", "es": "Controls Tech A al 50% de capacidad — verificación de puntos procediendo a ritmo reducido."}'::jsonb
    ),
    updated_at = now()
WHERE activity_key = 'bms-point-to-point'
  AND project_id = 'dc100000-0000-4000-8000-000000000000';

-- ── 5. Fiber Pathway ─────────────────────────────────────────────────────────
--    COMPLETED, near-perfect execution.
--    Estimated: 120h, Actual: 124h (+3.3%), no rework.
UPDATE public.construction_activities
SET actual_hours = 124.00,
    planned_production_rate = 5.00,
    actual_production_rate = 4.84,
    crew_size = 4,
    rework_count = 0,
    status = 'completed',
    progress = 100,
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{delay_reason_i18n}',
      '{"en": "", "es": ""}'::jsonb
    ),
    updated_at = now()
WHERE activity_key = 'fiber-pathway'
  AND project_id = 'dc100000-0000-4000-8000-000000000000';

-- ── Remaining activities: not_started / blocked / deferred ────────────────────
--    No actual tracking data yet. Default values (NULL actual_hours, 0 rework_count)
--    are already set by the migration defaults. No UPDATEs needed for:
--    - generator-setup (vendor unconfirmed)
--    - electrical-room-qa (over-allocated inspector)
--    - l3-pre-functional (multiple prerequisites incomplete)
--    - l4-ups-functional (vendor unconfirmed)
--    - l5-integrated-test (commissioning SPOF)
--    - client-handover (owner witness availability)