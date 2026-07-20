-- ProjectOps360° plan capability catalog.
-- The catalog is server-read and inherited by plan tier. It is the single
-- source for both the public pricing page and the platform plan console.

CREATE TABLE IF NOT EXISTS public.plan_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_key text UNIQUE NOT NULL,
  minimum_plan_code text NOT NULL
    REFERENCES public.plans(plan_code) ON UPDATE CASCADE ON DELETE RESTRICT,
  label_en text NOT NULL,
  label_es text NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_capabilities_minimum_plan_code_check
    CHECK (minimum_plan_code IN ('personal', 'team', 'business', 'enterprise'))
);

CREATE INDEX IF NOT EXISTS plan_capabilities_tier_order_idx
  ON public.plan_capabilities(minimum_plan_code, sort_order)
  WHERE is_active = true;

ALTER TABLE public.plan_capabilities ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.plan_capabilities FROM anon, authenticated;

INSERT INTO public.plan_capabilities (
  capability_key,
  minimum_plan_code,
  label_en,
  label_es,
  sort_order
)
VALUES
  ('personal_workspace', 'personal', 'Personal workspace', 'Workspace personal', 101),
  ('core_project_planning', 'personal', 'Core project planning', 'Planificación esencial de proyectos', 102),
  ('basic_project_charter', 'personal', 'Basic project charter', 'Charter básico del proyecto', 103),
  ('stakeholder_portal', 'personal', 'Stakeholder portal', 'Portal de stakeholders', 104),
  ('scope_creep_detection', 'personal', 'Scope-creep detection', 'Detección de desviaciones de alcance', 105),
  ('ai_assisted_setup', 'personal', 'AI-assisted project setup', 'Configuración de proyectos asistida por IA', 106),

  ('advanced_gantt', 'team', 'Gantt Advanced', 'Gantt avanzado', 201),
  ('critical_path', 'team', 'Critical Path', 'Ruta crítica', 202),
  ('baselines', 'team', 'Baselines', 'Líneas base', 203),
  ('time_tracking', 'team', 'Time Tracking', 'Seguimiento de tiempo', 204),
  ('workload', 'team', 'Workload', 'Carga de trabajo', 205),
  ('resource_planning', 'team', 'Resource Planning', 'Planificación de recursos', 206),
  ('cost_tracking', 'team', 'Cost Tracking', 'Seguimiento de costos', 207),
  ('dashboards', 'team', 'Dashboards', 'Paneles', 208),
  ('kpi_dashboard', 'team', 'KPI Dashboard', 'Panel de KPI', 209),
  ('automation', 'team', 'Automation', 'Automatización', 210),
  ('api_access', 'team', 'API Access', 'Acceso a API', 211),
  ('project_health', 'team', 'Project Health', 'Salud del proyecto', 212),
  ('living_graph_operational', 'team', 'Living Graph (Operational)', 'Living Graph (operativo)', 213),
  ('basic_predictive_risk', 'team', 'Basic Predictive Risk', 'Riesgo predictivo básico', 214),
  ('isabella_contextual_ai', 'team', 'Isabella Contextual AI', 'IA contextual de Isabella', 215),

  ('living_graph', 'business', 'Living Graph', 'Living Graph', 301),
  ('project_event_graph', 'business', 'Project Event Graph', 'Grafo de eventos del proyecto', 302),
  ('process_discovery', 'business', 'Process Discovery', 'Descubrimiento de procesos', 303),
  ('variant_analysis', 'business', 'Variant Analysis', 'Análisis de variantes', 304),
  ('root_cause_miner', 'business', 'Root Cause Miner', 'Analizador de causa raíz', 305),
  ('conformance_checking', 'business', 'Conformance Checking', 'Verificación de conformidad', 306),
  ('bottleneck_detection', 'business', 'Bottleneck Detection', 'Detección de cuellos de botella', 307),
  ('rework_detection', 'business', 'Rework Detection', 'Detección de retrabajo', 308),
  ('decision_intelligence', 'business', 'Decision Intelligence', 'Inteligencia de decisiones', 309),
  ('organizational_learning', 'business', 'Organizational Learning', 'Aprendizaje organizacional', 310),
  ('pmo_decision_center', 'business', 'PMO Decision Center', 'Centro de decisiones PMO', 311),
  ('program_management', 'business', 'Program Management', 'Gestión de programas', 312),
  ('portfolio_management', 'business', 'Portfolio Management', 'Gestión de portafolios', 313),
  ('scenario_planning', 'business', 'Scenario Planning', 'Planificación de escenarios', 314),
  ('capacity_planning', 'business', 'Capacity Planning', 'Planificación de capacidad', 315),
  ('executive_dashboards', 'business', 'Executive Dashboards', 'Paneles ejecutivos', 316),
  ('ai_recommendations', 'business', 'AI Recommendations', 'Recomendaciones de IA', 317),
  ('predictive_scheduling', 'business', 'Predictive Scheduling', 'Programación predictiva', 318),
  ('predictive_risk', 'business', 'Predictive Risk', 'Riesgo predictivo', 319),
  ('kpi_calculation_engine', 'business', 'KPI Calculation Engine', 'Motor de cálculo de KPI', 320),
  ('isabella_advanced_ai', 'business', 'Isabella Advanced AI', 'IA avanzada de Isabella', 321),

  ('scim', 'enterprise', 'SCIM', 'SCIM', 401),
  ('private_ai', 'enterprise', 'Private AI', 'IA privada', 402),
  ('dedicated_ai_models', 'enterprise', 'Dedicated AI Models', 'Modelos de IA dedicados', 403),
  ('dedicated_infrastructure', 'enterprise', 'Dedicated Infrastructure', 'Infraestructura dedicada', 404),
  ('white_label', 'enterprise', 'White Label', 'Marca blanca', 405),
  ('custom_branding', 'enterprise', 'Custom Branding', 'Personalización de marca', 406),
  ('enterprise_api', 'enterprise', 'Enterprise API', 'API empresarial', 407),
  ('erp_integrations', 'enterprise', 'ERP Integrations', 'Integraciones ERP', 408),
  ('sap_integration', 'enterprise', 'SAP Integration', 'Integración con SAP', 409),
  ('oracle_integration', 'enterprise', 'Oracle Integration', 'Integración con Oracle', 410),
  ('servicenow_integration', 'enterprise', 'ServiceNow Integration', 'Integración con ServiceNow', 411),
  ('azure_ad', 'enterprise', 'Azure AD', 'Azure AD', 412),
  ('disaster_recovery', 'enterprise', 'Disaster Recovery', 'Recuperación ante desastres', 413),
  ('sla', 'enterprise', 'SLA', 'SLA', 414),
  ('premium_support', 'enterprise', 'Premium Support', 'Soporte premium', 415),
  ('customer_success_manager', 'enterprise', 'Customer Success Manager', 'Gerente de éxito del cliente', 416),
  ('data_residency', 'enterprise', 'Data Residency', 'Residencia de datos', 417),
  ('audit_compliance', 'enterprise', 'Audit & Compliance', 'Auditoría y cumplimiento', 418)
ON CONFLICT (capability_key) DO UPDATE
SET
  minimum_plan_code = EXCLUDED.minimum_plan_code,
  label_en = EXCLUDED.label_en,
  label_es = EXCLUDED.label_es,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();

COMMENT ON TABLE public.plan_capabilities IS
  'Canonical localized marketing and entitlement capability catalog inherited by plan tier.';
