import { isPlanCode, type PlanCode } from "@/lib/billing/config";

export { isPlanCode };

export type PlanLimitKey =
  | "max_active_projects"
  | "max_billable_users"
  | "max_company_teams"
  | "max_external_contacts"
  | "max_stakeholder_viewers"
  | "max_ai_credits_per_month"
  | "max_memory_storage_mb"
  | "max_documents_indexed";

export type PlanFeatureKey =
  | "advanced_governance_enabled"
  | "approval_matrix_enabled"
  | "stakeholder_portal_enabled"
  | "portfolio_view_enabled"
  | "scope_creep_detection_enabled"
  | "project_memory_enabled"
  | "integrations_enabled"
  | "audit_logs_enabled"
  | "sso_enabled"
  | "custom_roles_enabled";

interface LocalizedText {
  en: string;
  es: string;
}

export interface CommercialPlanDefinition {
  code: PlanCode;
  name: string;
  description: string;
  subtitle: LocalizedText;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  limits: Record<PlanLimitKey, number | null>;
  features: Record<PlanFeatureKey, boolean>;
}

export const PLAN_COMMERCIAL_CATALOG: Record<PlanCode, CommercialPlanDefinition> = {
  personal: {
    code: "personal",
    name: "Personal",
    description: "Perfect for freelancers, students and individual project managers.",
    subtitle: { en: "Organize your work.", es: "Organiza tu trabajo." },
    monthlyPrice: 9,
    yearlyPrice: 96,
    limits: {
      max_active_projects: 5,
      max_billable_users: 1,
      max_company_teams: 0,
      max_external_contacts: 5,
      max_stakeholder_viewers: 5,
      max_ai_credits_per_month: 25,
      max_memory_storage_mb: 500,
      max_documents_indexed: 100,
    },
    features: {
      advanced_governance_enabled: false,
      approval_matrix_enabled: false,
      stakeholder_portal_enabled: true,
      portfolio_view_enabled: false,
      scope_creep_detection_enabled: true,
      project_memory_enabled: false,
      integrations_enabled: false,
      audit_logs_enabled: false,
      sso_enabled: false,
      custom_roles_enabled: false,
    },
  },
  team: {
    code: "team",
    name: "Team",
    description: "Ideal for growing teams and small companies managing multiple projects.",
    subtitle: { en: "Control project execution.", es: "Controla la ejecución de proyectos." },
    monthlyPrice: 16,
    yearlyPrice: 192,
    limits: {
      max_active_projects: null,
      max_billable_users: 10,
      max_company_teams: 5,
      max_external_contacts: 25,
      max_stakeholder_viewers: 25,
      max_ai_credits_per_month: 300,
      max_memory_storage_mb: 5_120,
      max_documents_indexed: 500,
    },
    features: {
      advanced_governance_enabled: true,
      approval_matrix_enabled: true,
      stakeholder_portal_enabled: true,
      portfolio_view_enabled: false,
      scope_creep_detection_enabled: true,
      project_memory_enabled: true,
      integrations_enabled: true,
      audit_logs_enabled: true,
      sso_enabled: false,
      custom_roles_enabled: true,
    },
  },
  business: {
    code: "business",
    name: "Business / PMO",
    description:
      "Designed for companies, PMOs, consulting firms and organizations managing multiple teams and strategic portfolios.",
    subtitle: {
      en: "Understand how your projects really execute.",
      es: "Comprende cómo se ejecutan realmente tus proyectos.",
    },
    monthlyPrice: 29,
    yearlyPrice: 348,
    limits: {
      max_active_projects: null,
      max_billable_users: 50,
      max_company_teams: 25,
      max_external_contacts: 250,
      max_stakeholder_viewers: 250,
      max_ai_credits_per_month: 5_000,
      max_memory_storage_mb: 51_200,
      max_documents_indexed: 5_000,
    },
    features: {
      advanced_governance_enabled: true,
      approval_matrix_enabled: true,
      stakeholder_portal_enabled: true,
      portfolio_view_enabled: true,
      scope_creep_detection_enabled: true,
      project_memory_enabled: true,
      integrations_enabled: true,
      audit_logs_enabled: true,
      sso_enabled: false,
      custom_roles_enabled: true,
    },
  },
  enterprise: {
    code: "enterprise",
    name: "Enterprise",
    description:
      "Built for enterprise organizations requiring governance, security, compliance and unlimited scalability.",
    subtitle: { en: "Optimize your entire organization.", es: "Optimiza toda tu organización." },
    monthlyPrice: null,
    yearlyPrice: null,
    limits: {
      max_active_projects: null,
      max_billable_users: null,
      max_company_teams: null,
      max_external_contacts: null,
      max_stakeholder_viewers: null,
      max_ai_credits_per_month: null,
      max_memory_storage_mb: null,
      max_documents_indexed: null,
    },
    features: {
      advanced_governance_enabled: true,
      approval_matrix_enabled: true,
      stakeholder_portal_enabled: true,
      portfolio_view_enabled: true,
      scope_creep_detection_enabled: true,
      project_memory_enabled: true,
      integrations_enabled: true,
      audit_logs_enabled: true,
      sso_enabled: true,
      custom_roles_enabled: true,
    },
  },
};

export type CapabilityTier = Exclude<PlanCode, "personal">;

export interface PlanCapability {
  key: string;
  label: LocalizedText;
}

export interface PlanCapabilityGroup {
  tier: CapabilityTier;
  title: LocalizedText;
  capabilities: PlanCapability[];
}

export const PLAN_CAPABILITY_GROUPS: PlanCapabilityGroup[] = [
  {
    tier: "team",
    title: { en: "Team capabilities", es: "Capacidades Team" },
    capabilities: [
      { key: "advanced_gantt", label: { en: "Gantt Advanced", es: "Gantt avanzado" } },
      { key: "critical_path", label: { en: "Critical Path", es: "Ruta crítica" } },
      { key: "baselines", label: { en: "Baselines", es: "Líneas base" } },
      { key: "time_tracking", label: { en: "Time Tracking", es: "Seguimiento de tiempo" } },
      { key: "workload", label: { en: "Workload", es: "Carga de trabajo" } },
      { key: "resource_planning", label: { en: "Resource Planning", es: "Planificación de recursos" } },
      { key: "cost_tracking", label: { en: "Cost Tracking", es: "Seguimiento de costos" } },
      { key: "dashboards", label: { en: "Dashboards", es: "Paneles" } },
      { key: "kpi_dashboard", label: { en: "KPI Dashboard", es: "Panel de KPI" } },
      { key: "automation", label: { en: "Automation", es: "Automatización" } },
      { key: "api_access", label: { en: "API Access", es: "Acceso a API" } },
      { key: "project_health", label: { en: "Project Health", es: "Salud del proyecto" } },
      {
        key: "living_graph_operational",
        label: { en: "Living Graph (Operational)", es: "Living Graph (operativo)" },
      },
      {
        key: "basic_predictive_risk",
        label: { en: "Basic Predictive Risk", es: "Riesgo predictivo básico" },
      },
      {
        key: "isabella_contextual_ai",
        label: { en: "Isabella Contextual AI", es: "IA contextual de Isabella" },
      },
    ],
  },
  {
    tier: "business",
    title: { en: "Business / PMO intelligence", es: "Inteligencia Business / PMO" },
    capabilities: [
      { key: "living_graph", label: { en: "Living Graph", es: "Living Graph" } },
      {
        key: "project_event_graph",
        label: { en: "Project Event Graph", es: "Grafo de eventos del proyecto" },
      },
      { key: "process_discovery", label: { en: "Process Discovery", es: "Descubrimiento de procesos" } },
      { key: "variant_analysis", label: { en: "Variant Analysis", es: "Análisis de variantes" } },
      { key: "root_cause_miner", label: { en: "Root Cause Miner", es: "Analizador de causa raíz" } },
      {
        key: "conformance_checking",
        label: { en: "Conformance Checking", es: "Verificación de conformidad" },
      },
      {
        key: "bottleneck_detection",
        label: { en: "Bottleneck Detection", es: "Detección de cuellos de botella" },
      },
      { key: "rework_detection", label: { en: "Rework Detection", es: "Detección de retrabajo" } },
      {
        key: "decision_intelligence",
        label: { en: "Decision Intelligence", es: "Inteligencia de decisiones" },
      },
      {
        key: "organizational_learning",
        label: { en: "Organizational Learning", es: "Aprendizaje organizacional" },
      },
      { key: "pmo_decision_center", label: { en: "PMO Decision Center", es: "Centro de decisiones PMO" } },
      { key: "program_management", label: { en: "Program Management", es: "Gestión de programas" } },
      { key: "portfolio_management", label: { en: "Portfolio Management", es: "Gestión de portafolios" } },
      { key: "scenario_planning", label: { en: "Scenario Planning", es: "Planificación de escenarios" } },
      { key: "capacity_planning", label: { en: "Capacity Planning", es: "Planificación de capacidad" } },
      { key: "executive_dashboards", label: { en: "Executive Dashboards", es: "Paneles ejecutivos" } },
      { key: "ai_recommendations", label: { en: "AI Recommendations", es: "Recomendaciones de IA" } },
      {
        key: "predictive_scheduling",
        label: { en: "Predictive Scheduling", es: "Programación predictiva" },
      },
      { key: "predictive_risk", label: { en: "Predictive Risk", es: "Riesgo predictivo" } },
      {
        key: "kpi_calculation_engine",
        label: { en: "KPI Calculation Engine", es: "Motor de cálculo de KPI" },
      },
      { key: "isabella_advanced_ai", label: { en: "Isabella Advanced AI", es: "IA avanzada de Isabella" } },
    ],
  },
  {
    tier: "enterprise",
    title: { en: "Enterprise capabilities", es: "Capacidades Enterprise" },
    capabilities: [
      { key: "scim", label: { en: "SCIM", es: "SCIM" } },
      { key: "private_ai", label: { en: "Private AI", es: "IA privada" } },
      { key: "dedicated_ai_models", label: { en: "Dedicated AI Models", es: "Modelos de IA dedicados" } },
      {
        key: "dedicated_infrastructure",
        label: { en: "Dedicated Infrastructure", es: "Infraestructura dedicada" },
      },
      { key: "white_label", label: { en: "White Label", es: "Marca blanca" } },
      { key: "custom_branding", label: { en: "Custom Branding", es: "Personalización de marca" } },
      { key: "enterprise_api", label: { en: "Enterprise API", es: "API empresarial" } },
      { key: "erp_integrations", label: { en: "ERP Integrations", es: "Integraciones ERP" } },
      { key: "sap_integration", label: { en: "SAP Integration", es: "Integración con SAP" } },
      { key: "oracle_integration", label: { en: "Oracle Integration", es: "Integración con Oracle" } },
      {
        key: "servicenow_integration",
        label: { en: "ServiceNow Integration", es: "Integración con ServiceNow" },
      },
      { key: "azure_ad", label: { en: "Azure AD", es: "Azure AD" } },
      { key: "disaster_recovery", label: { en: "Disaster Recovery", es: "Recuperación ante desastres" } },
      { key: "sla", label: { en: "SLA", es: "SLA" } },
      { key: "premium_support", label: { en: "Premium Support", es: "Soporte premium" } },
      {
        key: "customer_success_manager",
        label: { en: "Customer Success Manager", es: "Gerente de éxito del cliente" },
      },
      { key: "data_residency", label: { en: "Data Residency", es: "Residencia de datos" } },
      { key: "audit_compliance", label: { en: "Audit & Compliance", es: "Auditoría y cumplimiento" } },
    ],
  },
];

const PLAN_TIER: Record<PlanCode, number> = {
  personal: 0,
  team: 1,
  business: 2,
  enterprise: 3,
};

export function getCapabilityGroupsForPlan(planCode: string): PlanCapabilityGroup[] {
  if (!isPlanCode(planCode)) return [];
  return PLAN_CAPABILITY_GROUPS.filter((group) => PLAN_TIER[planCode] >= PLAN_TIER[group.tier]);
}
