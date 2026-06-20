// ============================================================================
// ProjectOps360° Navigator — bilingual guidance content + route detection
// ============================================================================
// Single source of truth for the in-app Navigator help system. Every label,
// title, description, checklist item and recommendation exists in English and
// Spanish. Consumed by the Navigator drawer via the current locale (next-intl).
//
// ProjectOps360° is an AI-powered project operating system for real-world
// project execution across software, construction, operations, engineering,
// business transformation, infrastructure, industrial and hybrid delivery.
// This content reinforces that positioning — it is a guided execution
// companion, not generic documentation.
// ============================================================================

import type { Locale } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ModuleKey =
  | "start"
  | "commandCenter"
  | "createImport"
  | "charter"
  | "delivery"
  | "teamRoles"
  | "executionMap"
  | "workboard"
  | "rhythm"
  | "commsMemory"
  | "budget"
  | "bim"
  | "laborCapacity"
  | "status"
  | "closeout"
  | "reports"
  | "aiOperator"
  | "settings"
  | "lifecycle";

export type NavigatorLanguage = "en" | "es";

export interface RelatedModule {
  moduleKey: ModuleKey;
}

export interface ModuleGuidance {
  /** Display title of the module. */
  title: string;
  /** Plain-language purpose. */
  purpose: string;
  /** Why it matters. */
  whyItMatters: string;
  /** Ordered first steps. */
  whatToDoFirst: string[];
  /** Completion checklist. */
  checklist: string[];
  /** AI assistance available (optional). */
  aiAssistance?: string;
  /** Common mistakes (optional). */
  commonMistakes?: string[];
  /** Recommended next action copy. */
  nextAction: string;
  /** Modules this one connects to. */
  relatedModules: RelatedModule[];
  /** Index into lifecycleSteps this module belongs to (-1 = not a lifecycle step). */
  lifecycleIndex: number;
}

export interface LifecycleStep {
  /** Stable key, also used for localStorage completion tracking. */
  key: string;
  /** Anchor module used to navigate to this stage. */
  moduleKey: ModuleKey;
  /** Bilingual label. */
  label: string;
  /** Short bilingual hint shown under the label. */
  hint: string;
}

export interface NavigatorContent {
  chrome: NavigatorChrome;
  lifecycle: {
    overviewTitle: string;
    overviewDescription: string;
    steps: LifecycleStep[];
  };
  modules: Record<Exclude<ModuleKey, "lifecycle">, ModuleGuidance>;
}

export interface NavigatorChrome {
  buttonLabel: string;
  openHelp: string;
  drawerTitle: string;
  drawerSubtitle: string;
  whereYouAre: string;
  whatThisModuleDoes: string;
  projectLifecycle: string;
  whatToComplete: string;
  recommendedNextAction: string;
  actions: string;
  continueInModule: string;
  showMeHow: string;
  askAiGuide: string;
  aiGuideComingSoon: string;
  close: string;
  goToModule: string;
  relatedModules: string;
  commonMistakes: string;
  aiAssistance: string;
  whatToDoFirst: string;
  whyItMatters: string;
  progress: (done: number, total: number) => string;
  showMeHowTitle: string;
  markComplete: string;
  markIncomplete: string;
  completed: string;
  current: string;
  upcoming: string;
  notInProject: string;
  lifecycleCurrent: string;
}

// ── Lifecycle steps (12 stages) ────────────────────────────────────────────────
// Same shape for both languages; only the label/hint strings differ.

const LIFECYCLE_INDEX = {
  start: 0,
  createImport: 1,
  charter: 2,
  delivery: 3,
  teamRoles: 4,
  executionMap: 5,
  workboard: 6,
  rhythm: 7,
  commsMemory: 8,
  budget: 9,
  bim: 9,
  laborCapacity: 9,
  status: 10,
  closeout: 11,
  commandCenter: -1,
  reports: -1,
  aiOperator: -1,
  settings: -1,
} as const satisfies Record<Exclude<ModuleKey, "lifecycle">, number>;

// ── English content ─────────────────────────────────────────────────────────────

const en: NavigatorContent = {
  chrome: {
    buttonLabel: "Navigator",
    openHelp: "Open Navigator guided help",
    drawerTitle: "ProjectOps360° Navigator",
    drawerSubtitle: "Your guided execution companion",
    whereYouAre: "Where you are",
    whatThisModuleDoes: "What this module does",
    projectLifecycle: "Project lifecycle",
    whatToComplete: "What you need to complete",
    recommendedNextAction: "Recommended next action",
    actions: "Actions",
    continueInModule: "Continue in this module",
    showMeHow: "Show me how",
    askAiGuide: "Ask AI Guide",
    aiGuideComingSoon: "AI Guide coming soon",
    close: "Close",
    goToModule: "Go to module",
    relatedModules: "Related modules",
    commonMistakes: "Common mistakes",
    aiAssistance: "AI assistance",
    whatToDoFirst: "What to do first",
    whyItMatters: "Why it matters",
    progress: (done, total) => `${done} of ${total} steps completed`,
    showMeHowTitle: "Step-by-step",
    markComplete: "Mark as complete",
    markIncomplete: "Mark as incomplete",
    completed: "Completed",
    current: "Current",
    upcoming: "Upcoming",
    notInProject: "Open a project to see module-specific guidance.",
    lifecycleCurrent: "You are in the overall project lifecycle",
  },
  lifecycle: {
    overviewTitle: "Project lifecycle",
    overviewDescription:
      "ProjectOps360° guides every real-world project — software, construction, operations, engineering, business transformation, infrastructure, industrial and hybrid — through the same controlled lifecycle. Follow the path below.",
    steps: [
      { key: "start", moduleKey: "start", label: "Start", hint: "Sign in and enter the platform" },
      { key: "createImport", moduleKey: "createImport", label: "Create or Import Project", hint: "Begin a new project or import a file" },
      { key: "charter", moduleKey: "charter", label: "Charter & Governance", hint: "Define and approve the foundation" },
      { key: "delivery", moduleKey: "delivery", label: "Delivery Framework", hint: "Choose how the project is executed" },
      { key: "teamRoles", moduleKey: "teamRoles", label: "Team & Roles", hint: "People, accountability and stakeholders" },
      { key: "executionMap", moduleKey: "executionMap", label: "Execution Map", hint: "Milestones, tasks and dependencies" },
      { key: "workboard", moduleKey: "workboard", label: "Workboard", hint: "Execute the work" },
      { key: "rhythm", moduleKey: "rhythm", label: "Rhythm Center", hint: "Meetings, decisions and cadence" },
      { key: "commsMemory", moduleKey: "commsMemory", label: "Communications, Decisions, Documents & Memory", hint: "The project's operational memory" },
      { key: "budgetBimLabor", moduleKey: "budget", label: "Budget, BIM & Labor Capacity", hint: "Cost, drawings and crews" },
      { key: "status", moduleKey: "status", label: "Status Report", hint: "Stakeholder-ready status" },
      { key: "closeout", moduleKey: "closeout", label: "Closeout", hint: "Formally close the project" },
    ],
  },
  modules: {
    start: {
      title: "Getting Started",
      purpose:
        "Access the platform, sign in, create an account, and enter the Command Center.",
      whyItMatters:
        "Every project starts with secure access and the correct workspace.",
      whatToDoFirst: [
        "Sign in with email and password.",
        "Confirm your email if creating a new account.",
        "Enter the Command Center.",
      ],
      checklist: ["Account created", "Email confirmed", "Signed in", "Organization loaded"],
      nextAction: "Create or import your first project.",
      relatedModules: [{ moduleKey: "createImport" }, { moduleKey: "commandCenter" }],
      lifecycleIndex: LIFECYCLE_INDEX.start,
    },
    commandCenter: {
      title: "Command Center",
      purpose:
        "View the overall state of your organization and project portfolio.",
      whyItMatters:
        "This is your executive entry point to understand what needs attention.",
      whatToDoFirst: [
        "Review active projects.",
        "Check project health indicators.",
        "Open the project that needs attention.",
      ],
      checklist: ["Portfolio reviewed", "Critical projects identified", "Next project opened"],
      nextAction: "Open a project or create a new one.",
      relatedModules: [{ moduleKey: "createImport" }, { moduleKey: "charter" }],
      lifecycleIndex: LIFECYCLE_INDEX.commandCenter,
    },
    createImport: {
      title: "Create or Import Project",
      purpose:
        "Start a new project from scratch or import an existing project file with AI assistance.",
      whyItMatters:
        "This is where ProjectOps360° begins transforming project information into structured execution.",
      whatToDoFirst: [
        "Choose whether to create or import.",
        "Select project type.",
        "Add basic project information.",
        "Use AI import for existing files.",
      ],
      checklist: [
        "Project name added",
        "Project type selected",
        "Language selected",
        "File imported if applicable",
        "Project created",
      ],
      aiAssistance:
        "AI can extract tasks, milestones, dependencies, resources, materials, budget and risks from uploaded files.",
      nextAction: "Open the Charter and define the project foundation.",
      relatedModules: [{ moduleKey: "charter" }, { moduleKey: "aiOperator" }],
      lifecycleIndex: LIFECYCLE_INDEX.createImport,
    },
    charter: {
      title: "Charter & Governance",
      purpose:
        "Define why the project exists, what it will deliver, how it will be governed, and who approves it.",
      whyItMatters:
        "The Charter is the foundation for controlled execution. Without it, the project lacks formal alignment.",
      whatToDoFirst: [
        "Complete business case.",
        "Define scope and objectives.",
        "Add deliverables and success criteria.",
        "Define governance rules.",
        "Add roles.",
        "Complete approval matrix.",
        "Capture sign-off.",
      ],
      checklist: [
        "Business case completed",
        "Scope defined",
        "Objectives defined",
        "Deliverables added",
        "Governance rules defined",
        "Roles assigned",
        "Approval matrix completed",
        "Sign-off captured",
        "Charter approved",
      ],
      aiAssistance:
        "AI can generate missing fields, detect gaps, check for scope creep, summarize stakeholders, and suggest governance rules.",
      commonMistakes: [
        "Starting execution before approval.",
        "Leaving decision authority unclear.",
        "Not defining out-of-scope items.",
      ],
      nextAction: "Approve the Charter, then configure the Delivery Framework.",
      relatedModules: [{ moduleKey: "delivery" }, { moduleKey: "teamRoles" }],
      lifecycleIndex: LIFECYCLE_INDEX.charter,
    },
    delivery: {
      title: "Delivery Framework",
      purpose:
        "Choose how the project will be executed: Predictive, Agile, Scrum, Kanban, Hybrid, XP, Lean or custom if supported.",
      whyItMatters:
        "Real projects often require different execution models by phase.",
      whatToDoFirst: [
        "Run the diagnostic wizard.",
        "Review the recommended framework.",
        "Adjust the method if needed.",
        "Save the configuration.",
        "Activate execution.",
      ],
      checklist: [
        "Diagnostic completed",
        "Recommended framework reviewed",
        "Delivery method selected",
        "WIP or workflow rules configured",
        "Meeting rhythm suggested",
        "Execution activated",
      ],
      aiAssistance:
        "AI can recommend a framework, detect scope creep, summarize the delivery model, and suggest adjustments if the project deviates.",
      commonMistakes: [
        "Choosing Agile only because it sounds modern.",
        "Using one method for every phase when the project is naturally hybrid.",
      ],
      nextAction: "Add the team, roles, stakeholders and RACI.",
      relatedModules: [{ moduleKey: "teamRoles" }, { moduleKey: "executionMap" }],
      lifecycleIndex: LIFECYCLE_INDEX.delivery,
    },
    teamRoles: {
      title: "Team, Roles & Stakeholders",
      purpose:
        "Define who is involved, what they own, how they participate, and who needs to approve or be informed.",
      whyItMatters: "Project execution fails when accountability is unclear.",
      whatToDoFirst: [
        "Add project members.",
        "Assign project roles.",
        "Define permissions.",
        "Build the RACI matrix.",
        "Register key stakeholders.",
      ],
      checklist: [
        "Project manager assigned",
        "Sponsor identified",
        "Team members added",
        "Roles assigned",
        "RACI completed",
        "Stakeholders mapped",
        "External access configured if needed",
      ],
      aiAssistance:
        "AI can recommend roles and create a draft RACI based on the Charter.",
      commonMistakes: [
        "Adding people without authority levels.",
        "Not identifying approvers early.",
        "Treating stakeholders as an afterthought.",
      ],
      nextAction: "Build the Execution Map.",
      relatedModules: [{ moduleKey: "executionMap" }, { moduleKey: "charter" }],
      lifecycleIndex: LIFECYCLE_INDEX.teamRoles,
    },
    executionMap: {
      title: "Execution Map",
      purpose:
        "Build the project roadmap with milestones, tasks, dependencies, flow, timeline and visual execution structure.",
      whyItMatters: "This is where strategy becomes an executable plan.",
      whatToDoFirst: [
        "Create milestones.",
        "Add tasks.",
        "Define dependencies.",
        "Review timeline.",
        "Use Flow and Living Graph for connected visibility.",
      ],
      checklist: [
        "Milestones created",
        "Tasks created",
        "Dependencies added",
        "Timeline reviewed",
        "Blockers identified",
        "Living Graph reviewed",
      ],
      aiAssistance:
        "AI can help generate milestones, suggest tasks, detect missing dependencies, and explain next steps.",
      commonMistakes: [
        "Creating tasks without dependencies.",
        "Building a plan without acceptance criteria.",
        "Not reviewing blockers before execution.",
      ],
      nextAction: "Move execution to the Workboard.",
      relatedModules: [{ moduleKey: "workboard" }, { moduleKey: "delivery" }],
      lifecycleIndex: LIFECYCLE_INDEX.executionMap,
    },
    workboard: {
      title: "Workboard",
      purpose:
        "Execute work by moving tasks through status columns while respecting dependencies and WIP limits.",
      whyItMatters: "This is where planned work becomes controlled execution.",
      whatToDoFirst: [
        "Filter by milestone or sprint.",
        "Review blocked tasks.",
        "Move tasks through the correct status.",
        "Add required notes when completing or blocking work.",
      ],
      checklist: [
        "Tasks reviewed",
        "Blocked tasks identified",
        "Dependencies respected",
        "Status updates added",
        "Completion notes captured",
      ],
      aiAssistance:
        "AI can help summarize blockers, recommend next actions, and identify tasks that need attention.",
      commonMistakes: [
        "Moving tasks forward without predecessor completion.",
        "Marking work done without notes.",
        "Ignoring blocked tasks.",
      ],
      nextAction: "Set the meeting rhythm in Rhythm Center.",
      relatedModules: [{ moduleKey: "rhythm" }, { moduleKey: "executionMap" }],
      lifecycleIndex: LIFECYCLE_INDEX.workboard,
    },
    rhythm: {
      title: "Rhythm Center",
      purpose:
        "Manage project meetings, cadence, decisions, action items and AI meeting summaries.",
      whyItMatters:
        "Projects move through communication rhythm, not only task updates.",
      whatToDoFirst: [
        "Create the right meeting type.",
        "Confirm attendees.",
        "Capture decisions and action items.",
        "Complete the meeting.",
        "Sync summary to Project Memory.",
      ],
      checklist: [
        "Meeting created",
        "Agenda reviewed",
        "Attendees added",
        "Decisions captured",
        "Action items captured",
        "AI summary generated",
        "Meeting completed",
      ],
      aiAssistance:
        "AI can summarize meetings, extract decisions, identify action items and sync knowledge to Project Memory.",
      commonMistakes: [
        "Holding meetings without capturing decisions.",
        "Not completing meetings in the system.",
        "Forgetting that closing meetings trigger Closeout.",
      ],
      nextAction: "Capture communications, decisions, documents and memory.",
      relatedModules: [{ moduleKey: "commsMemory" }, { moduleKey: "workboard" }],
      lifecycleIndex: LIFECYCLE_INDEX.rhythm,
    },
    commsMemory: {
      title: "Project Communication Memory",
      purpose:
        "Capture and connect emails, meetings, Teams messages, Slack conversations, decisions, documents and knowledge items.",
      whyItMatters:
        "Project knowledge should not be scattered across inboxes, chats and meeting notes.",
      whatToDoFirst: [
        "Register important communications.",
        "Log decisions.",
        "Upload or link documents.",
        "Review Project Memory.",
        "Connect items to tasks, risks, milestones, stakeholders or meetings.",
      ],
      checklist: [
        "Communications registered",
        "Decisions logged",
        "Documents organized",
        "Follow-ups tracked",
        "Memory items classified",
        "Traceability links added",
      ],
      aiAssistance:
        "AI can summarize conversations, detect blockers, extract decisions, identify follow-ups and classify memory items.",
      commonMistakes: [
        "Leaving critical decisions only in chat or email.",
        "Not linking communications to execution items.",
        "Waiting until closeout to organize project memory.",
      ],
      nextAction:
        "Review Budget, BIM or Labor Capacity if applicable, then generate Status Reports.",
      relatedModules: [{ moduleKey: "budget" }, { moduleKey: "status" }],
      lifecycleIndex: LIFECYCLE_INDEX.commsMemory,
    },
    budget: {
      title: "Budget",
      purpose:
        "Review and manage project budget estimates, categories, quantities, unit costs, subtotals and totals.",
      whyItMatters: "Cost visibility is part of controlled execution.",
      whatToDoFirst: [
        "Review budget categories.",
        "Validate quantities.",
        "Validate unit costs.",
        "Confirm totals.",
        "Reconcile before closeout.",
      ],
      checklist: [
        "Categories reviewed",
        "Quantities validated",
        "Unit costs reviewed",
        "Total budget confirmed",
        "Budget reconciled if closing",
      ],
      aiAssistance:
        "AI may help explain budget movement, cost impacts and material-related risks if available.",
      nextAction: "Use Status Report to communicate current project status.",
      relatedModules: [{ moduleKey: "status" }, { moduleKey: "bim" }],
      lifecycleIndex: LIFECYCLE_INDEX.budget,
    },
    bim: {
      title: "Drawing Intelligence / BIM",
      purpose:
        "Upload drawings, process them with AI, extract takeoff, insights, risks, RFIs, versions and cost/schedule impacts.",
      whyItMatters:
        "Construction and engineering projects need drawing intelligence connected to execution.",
      whatToDoFirst: [
        "Upload drawings.",
        "Select processing mode.",
        "Review extracted insights.",
        "Convert insights into RFIs, submittals, inspections, schedule constraints or cost impacts.",
      ],
      checklist: [
        "Drawings uploaded",
        "Processing mode selected",
        "Takeoff reviewed",
        "Risks reviewed",
        "RFIs created if needed",
        "Cost or schedule impacts reviewed",
      ],
      aiAssistance:
        "AI can interpret drawings, extract takeoff, identify risks, suggest RFIs and connect insights to project execution.",
      commonMistakes: [
        "Treating drawings as disconnected files.",
        "Not converting insights into actions.",
      ],
      nextAction: "Review Budget and Execution Map impacts.",
      relatedModules: [{ moduleKey: "budget" }, { moduleKey: "executionMap" }],
      lifecycleIndex: LIFECYCLE_INDEX.bim,
    },
    laborCapacity: {
      title: "Labor Capacity",
      purpose:
        "Plan and monitor labor capacity by trade, week, zone, readiness and workface constraints.",
      whyItMatters:
        "Construction execution depends on having the right crews ready at the right time.",
      whatToDoFirst: [
        "Review capacity matrix.",
        "Check lookahead readiness.",
        "Identify idle crew risks.",
        "Resolve missing prerequisites.",
      ],
      checklist: [
        "Capacity reviewed",
        "Lookahead checked",
        "Gaps identified",
        "Idle crew risk reviewed",
        "Workface blockers addressed",
      ],
      aiAssistance:
        "AI can explain readiness issues, recommend crew actions and identify schedule risks.",
      nextAction: "Use Status Report to communicate capacity risks.",
      relatedModules: [{ moduleKey: "status" }, { moduleKey: "workboard" }],
      lifecycleIndex: LIFECYCLE_INDEX.laborCapacity,
    },
    status: {
      title: "Status Report",
      purpose: "Generate a stakeholder-ready project status report from live project data.",
      whyItMatters: "Leadership needs clear status, not raw task data.",
      whatToDoFirst: [
        "Review progress.",
        "Check blockers.",
        "Review “what to do now”.",
        "Export PDF if needed.",
      ],
      checklist: [
        "Progress reviewed",
        "Blockers reviewed",
        "Next actions reviewed",
        "Report generated",
        "PDF exported if needed",
      ],
      aiAssistance:
        "AI can summarize project status, explain movement and highlight what matters.",
      commonMistakes: [
        "Generating reports with outdated project data.",
        "Reporting only percent complete without explaining risk or blockers.",
      ],
      nextAction: "Continue execution or prepare Closeout if the project is ready.",
      relatedModules: [{ moduleKey: "closeout" }, { moduleKey: "rhythm" }],
      lifecycleIndex: LIFECYCLE_INDEX.status,
    },
    closeout: {
      title: "Closeout",
      purpose: "Formally close the project, validate readiness and generate the Closeout Report.",
      whyItMatters:
        "A project is not complete until its outcomes, decisions, lessons, documents and memory are preserved.",
      whatToDoFirst: [
        "Review closeout readiness.",
        "Resolve blocking criteria.",
        "Schedule and complete the closing meeting in Rhythm Center.",
        "Review the generated Closeout Report.",
        "Export PDF.",
      ],
      checklist: [
        "No open tasks",
        "No blocked tasks",
        "Risks resolved",
        "RFIs answered",
        "Action items closed",
        "Milestones completed",
        "Decisions finalized",
        "Budget reconciled",
        "Closing meeting completed",
        "Closeout Report generated",
      ],
      aiAssistance:
        "AI generates the closeout narrative, lessons learned, open items, next steps and executive summary from accumulated project data.",
      commonMistakes: [
        "Trying to close before resolving blocking criteria.",
        "Not completing the closing meeting.",
        "Not maintaining project memory during execution.",
      ],
      nextAction: "Archive the project and preserve lessons learned for future projects.",
      relatedModules: [{ moduleKey: "rhythm" }, { moduleKey: "status" }],
      lifecycleIndex: LIFECYCLE_INDEX.closeout,
    },
    reports: {
      title: "Reports",
      purpose: "Access organization-level reporting and project insights.",
      whyItMatters: "PMOs and executives need portfolio visibility across projects.",
      whatToDoFirst: [
        "Select report type.",
        "Filter by project or portfolio.",
        "Review insights.",
        "Export if needed.",
      ],
      checklist: [
        "Report selected",
        "Filters applied",
        "Insights reviewed",
        "Export completed if needed",
      ],
      nextAction: "Use reports to support governance and executive communication.",
      relatedModules: [{ moduleKey: "commandCenter" }, { moduleKey: "status" }],
      lifecycleIndex: LIFECYCLE_INDEX.reports,
    },
    aiOperator: {
      title: "AI Operator",
      purpose:
        "Central hub for AI-powered project assistance, import analysis and intelligent project workflows.",
      whyItMatters:
        "AI supports the project manager, but human judgment remains in control.",
      whatToDoFirst: [
        "Choose the AI workflow.",
        "Review AI output.",
        "Accept, edit, reject or convert recommendations into project actions.",
      ],
      checklist: [
        "AI workflow selected",
        "Output reviewed",
        "Human decision made",
        "Action created if applicable",
      ],
      nextAction:
        "Use AI output to strengthen planning, execution, reporting or project memory.",
      relatedModules: [{ moduleKey: "createImport" }, { moduleKey: "charter" }],
      lifecycleIndex: LIFECYCLE_INDEX.aiOperator,
    },
    settings: {
      title: "Settings",
      purpose: "Manage your workspace and organization preferences.",
      whyItMatters: "A correctly configured workspace keeps execution reliable.",
      whatToDoFirst: ["Review organization settings.", "Confirm members and access.", "Adjust preferences."],
      checklist: ["Organization reviewed", "Members confirmed", "Preferences set"],
      nextAction: "Return to the Command Center to continue working.",
      relatedModules: [{ moduleKey: "commandCenter" }, { moduleKey: "teamRoles" }],
      lifecycleIndex: LIFECYCLE_INDEX.settings,
    },
  },
};

// ── Spanish content ─────────────────────────────────────────────────────────────

const es: NavigatorContent = {
  chrome: {
    buttonLabel: "Navegador",
    openHelp: "Abrir ayuda guiada del Navegador",
    drawerTitle: "ProjectOps360° Navegador",
    drawerSubtitle: "Tu compañero de ejecución guiado",
    whereYouAre: "Dónde estás",
    whatThisModuleDoes: "Qué hace este módulo",
    projectLifecycle: "Ciclo de vida del proyecto",
    whatToComplete: "Qué necesitas completar",
    recommendedNextAction: "Acción recomendada",
    actions: "Acciones",
    continueInModule: "Continuar en este módulo",
    showMeHow: "Muéstrame cómo",
    askAiGuide: "Preguntar a la guía IA",
    aiGuideComingSoon: "Guía IA próximamente",
    close: "Cerrar",
    goToModule: "Ir al módulo",
    relatedModules: "Módulos relacionados",
    commonMistakes: "Errores comunes",
    aiAssistance: "Asistencia de IA",
    whatToDoFirst: "Qué hacer primero",
    whyItMatters: "Por qué importa",
    progress: (done, total) => `${done} de ${total} pasos completados`,
    showMeHowTitle: "Paso a paso",
    markComplete: "Marcar como completado",
    markIncomplete: "Marcar como no completado",
    completed: "Completado",
    current: "Actual",
    upcoming: "Pendiente",
    notInProject: "Abre un proyecto para ver la guía específica del módulo.",
    lifecycleCurrent: "Estás en el ciclo de vida general del proyecto",
  },
  lifecycle: {
    overviewTitle: "Ciclo de vida del proyecto",
    overviewDescription:
      "ProjectOps360° guía cada proyecto del mundo real —software, construcción, operaciones, ingeniería, transformación de negocio, infraestructura, industrial e híbrido— a través del mismo ciclo de vida controlado. Sigue la ruta a continuación.",
    steps: [
      { key: "start", moduleKey: "start", label: "Inicio", hint: "Inicia sesión y entra a la plataforma" },
      { key: "createImport", moduleKey: "createImport", label: "Crear o importar proyecto", hint: "Inicia un proyecto o importa un archivo" },
      { key: "charter", moduleKey: "charter", label: "Charter & Governance", hint: "Define y aprueba la fundación" },
      { key: "delivery", moduleKey: "delivery", label: "Delivery Framework", hint: "Elige cómo se ejecuta el proyecto" },
      { key: "teamRoles", moduleKey: "teamRoles", label: "Equipo y roles", hint: "Personas, responsabilidad y stakeholders" },
      { key: "executionMap", moduleKey: "executionMap", label: "Mapa de ejecución", hint: "Hitos, tareas y dependencias" },
      { key: "workboard", moduleKey: "workboard", label: "Tablero de trabajo", hint: "Ejecuta el trabajo" },
      { key: "rhythm", moduleKey: "rhythm", label: "Centro de ritmo", hint: "Reuniones, decisiones y cadencia" },
      { key: "commsMemory", moduleKey: "commsMemory", label: "Comunicaciones, decisiones, documentos y memoria", hint: "La memoria operativa del proyecto" },
      { key: "budgetBimLabor", moduleKey: "budget", label: "Presupuesto, BIM y capacidad laboral", hint: "Costo, planos y cuadrillas" },
      { key: "status", moduleKey: "status", label: "Reporte de estado", hint: "Estado listo para stakeholders" },
      { key: "closeout", moduleKey: "closeout", label: "Cierre", hint: "Cierra formalmente el proyecto" },
    ],
  },
  modules: {
    start: {
      title: "Primeros pasos",
      purpose: "Accede a la plataforma, inicia sesión, crea una cuenta y entra al Centro de Mando.",
      whyItMatters: "Todo proyecto comienza con acceso seguro y el espacio de trabajo correcto.",
      whatToDoFirst: [
        "Inicia sesión con email y contraseña.",
        "Confirma tu email si estás creando una cuenta nueva.",
        "Entra al Centro de Mando.",
      ],
      checklist: ["Cuenta creada", "Email confirmado", "Sesión iniciada", "Organización cargada"],
      nextAction: "Crea o importa tu primer proyecto.",
      relatedModules: [{ moduleKey: "createImport" }, { moduleKey: "commandCenter" }],
      lifecycleIndex: LIFECYCLE_INDEX.start,
    },
    commandCenter: {
      title: "Centro de Mando",
      purpose: "Visualiza el estado general de tu organización y portafolio de proyectos.",
      whyItMatters: "Es el punto de entrada ejecutivo para entender qué necesita atención.",
      whatToDoFirst: [
        "Revisa proyectos activos.",
        "Verifica indicadores de salud.",
        "Abre el proyecto que necesita atención.",
      ],
      checklist: ["Portafolio revisado", "Proyectos críticos identificados", "Proyecto abierto"],
      nextAction: "Abre un proyecto o crea uno nuevo.",
      relatedModules: [{ moduleKey: "createImport" }, { moduleKey: "charter" }],
      lifecycleIndex: LIFECYCLE_INDEX.commandCenter,
    },
    createImport: {
      title: "Crear o importar proyecto",
      purpose: "Inicia un proyecto desde cero o importa un archivo existente con asistencia de IA.",
      whyItMatters:
        "Aquí ProjectOps360° comienza a convertir información del proyecto en ejecución estructurada.",
      whatToDoFirst: [
        "Decide si vas a crear o importar.",
        "Selecciona el tipo de proyecto.",
        "Agrega la información básica.",
        "Usa importación con IA si ya tienes archivos.",
      ],
      checklist: [
        "Nombre del proyecto agregado",
        "Tipo de proyecto seleccionado",
        "Idioma seleccionado",
        "Archivo importado si aplica",
        "Proyecto creado",
      ],
      aiAssistance:
        "La IA puede extraer tareas, hitos, dependencias, recursos, materiales, presupuesto y riesgos desde archivos cargados.",
      nextAction: "Abre el Charter y define la fundación del proyecto.",
      relatedModules: [{ moduleKey: "charter" }, { moduleKey: "aiOperator" }],
      lifecycleIndex: LIFECYCLE_INDEX.createImport,
    },
    charter: {
      title: "Charter & Governance",
      purpose:
        "Define por qué existe el proyecto, qué entregará, cómo se gobernará y quién lo aprueba.",
      whyItMatters:
        "El Charter es la fundación para una ejecución controlada. Sin él, el proyecto no tiene alineación formal.",
      whatToDoFirst: [
        "Completa el caso de negocio.",
        "Define alcance y objetivos.",
        "Agrega entregables y criterios de éxito.",
        "Define reglas de gobernanza.",
        "Agrega roles.",
        "Completa la matriz de aprobación.",
        "Captura firmas.",
      ],
      checklist: [
        "Caso de negocio completado",
        "Alcance definido",
        "Objetivos definidos",
        "Entregables agregados",
        "Gobernanza definida",
        "Roles asignados",
        "Matriz de aprobación completa",
        "Firmas capturadas",
        "Charter aprobado",
      ],
      aiAssistance:
        "La IA puede generar campos faltantes, detectar vacíos, revisar scope creep, resumir stakeholders y sugerir reglas de gobernanza.",
      commonMistakes: [
        "Iniciar ejecución antes de aprobar.",
        "Dejar autoridad de decisión poco clara.",
        "No definir lo que está fuera de alcance.",
      ],
      nextAction: "Aprueba el Charter y luego configura el Delivery Framework.",
      relatedModules: [{ moduleKey: "delivery" }, { moduleKey: "teamRoles" }],
      lifecycleIndex: LIFECYCLE_INDEX.charter,
    },
    delivery: {
      title: "Delivery Framework",
      purpose:
        "Define cómo se ejecutará el proyecto: Predictivo, Ágil, Scrum, Kanban, Híbrido, XP, Lean o custom si está soportado.",
      whyItMatters: "Los proyectos reales suelen necesitar modelos diferentes según la fase.",
      whatToDoFirst: [
        "Ejecuta el asistente de diagnóstico.",
        "Revisa el framework recomendado.",
        "Ajusta el método si hace falta.",
        "Guarda la configuración.",
        "Activa la ejecución.",
      ],
      checklist: [
        "Diagnóstico completado",
        "Framework recomendado revisado",
        "Método de entrega seleccionado",
        "Reglas de flujo o WIP configuradas",
        "Ritmo de reuniones sugerido",
        "Ejecución activada",
      ],
      aiAssistance:
        "La IA puede recomendar el framework, detectar scope creep, resumir el modelo de entrega y sugerir ajustes si el proyecto se desvía.",
      commonMistakes: [
        "Elegir Agile solo porque suena moderno.",
        "Usar un solo método para todas las fases cuando el proyecto es naturalmente híbrido.",
      ],
      nextAction: "Agrega equipo, roles, stakeholders y RACI.",
      relatedModules: [{ moduleKey: "teamRoles" }, { moduleKey: "executionMap" }],
      lifecycleIndex: LIFECYCLE_INDEX.delivery,
    },
    teamRoles: {
      title: "Equipo, roles y stakeholders",
      purpose:
        "Define quién participa, qué responsabilidad tiene, cómo interviene y quién debe aprobar o ser informado.",
      whyItMatters: "La ejecución falla cuando la responsabilidad no está clara.",
      whatToDoFirst: [
        "Agrega miembros del proyecto.",
        "Asigna roles.",
        "Define permisos.",
        "Construye la matriz RACI.",
        "Registra stakeholders clave.",
      ],
      checklist: [
        "Project Manager asignado",
        "Sponsor identificado",
        "Miembros agregados",
        "Roles asignados",
        "RACI completado",
        "Stakeholders mapeados",
        "Acceso externo configurado si aplica",
      ],
      aiAssistance: "La IA puede recomendar roles y crear un borrador RACI basado en el Charter.",
      commonMistakes: [
        "Agregar personas sin niveles de autoridad.",
        "No identificar aprobadores desde el inicio.",
        "Tratar stakeholders como algo secundario.",
      ],
      nextAction: "Construye el Execution Map.",
      relatedModules: [{ moduleKey: "executionMap" }, { moduleKey: "charter" }],
      lifecycleIndex: LIFECYCLE_INDEX.teamRoles,
    },
    executionMap: {
      title: "Mapa de ejecución",
      purpose:
        "Construye el roadmap del proyecto con hitos, tareas, dependencias, flujo, timeline y estructura visual de ejecución.",
      whyItMatters: "Aquí la estrategia se convierte en un plan ejecutable.",
      whatToDoFirst: [
        "Crea hitos.",
        "Agrega tareas.",
        "Define dependencias.",
        "Revisa el timeline.",
        "Usa Flow y Living Graph para visibilidad conectada.",
      ],
      checklist: [
        "Hitos creados",
        "Tareas creadas",
        "Dependencias agregadas",
        "Timeline revisado",
        "Bloqueos identificados",
        "Living Graph revisado",
      ],
      aiAssistance:
        "La IA puede ayudar a generar hitos, sugerir tareas, detectar dependencias faltantes y explicar próximos pasos.",
      commonMistakes: [
        "Crear tareas sin dependencias.",
        "Crear un plan sin criterios de aceptación.",
        "No revisar bloqueos antes de ejecutar.",
      ],
      nextAction: "Ejecuta el trabajo en el Workboard.",
      relatedModules: [{ moduleKey: "workboard" }, { moduleKey: "delivery" }],
      lifecycleIndex: LIFECYCLE_INDEX.executionMap,
    },
    workboard: {
      title: "Tablero de trabajo",
      purpose:
        "Ejecuta el trabajo moviendo tareas por columnas de estado, respetando dependencias y límites WIP.",
      whyItMatters: "Aquí el trabajo planificado se convierte en ejecución controlada.",
      whatToDoFirst: [
        "Filtra por hito o sprint.",
        "Revisa tareas bloqueadas.",
        "Mueve tareas al estado correcto.",
        "Agrega notas obligatorias al completar o bloquear trabajo.",
      ],
      checklist: [
        "Tareas revisadas",
        "Bloqueos identificados",
        "Dependencias respetadas",
        "Estados actualizados",
        "Notas de cierre capturadas",
      ],
      aiAssistance:
        "La IA puede resumir bloqueos, recomendar próximos pasos e identificar tareas que necesitan atención.",
      commonMistakes: [
        "Avanzar tareas sin completar predecesoras.",
        "Marcar trabajo como completado sin notas.",
        "Ignorar tareas bloqueadas.",
      ],
      nextAction: "Configura la cadencia de reuniones en Rhythm Center.",
      relatedModules: [{ moduleKey: "rhythm" }, { moduleKey: "executionMap" }],
      lifecycleIndex: LIFECYCLE_INDEX.workboard,
    },
    rhythm: {
      title: "Centro de ritmo",
      purpose: "Gestiona reuniones, cadencia, decisiones, action items y resúmenes de IA.",
      whyItMatters: "Los proyectos avanzan por ritmo de comunicación, no solo por actualización de tareas.",
      whatToDoFirst: [
        "Crea el tipo correcto de reunión.",
        "Confirma asistentes.",
        "Captura decisiones y action items.",
        "Completa la reunión.",
        "Sincroniza el resumen con Memoria del Proyecto.",
      ],
      checklist: [
        "Reunión creada",
        "Agenda revisada",
        "Asistentes agregados",
        "Decisiones capturadas",
        "Action items capturados",
        "Resumen IA generado",
        "Reunión completada",
      ],
      aiAssistance:
        "La IA puede resumir reuniones, extraer decisiones, identificar action items y sincronizar conocimiento con Memoria del Proyecto.",
      commonMistakes: [
        "Hacer reuniones sin capturar decisiones.",
        "No completar reuniones en el sistema.",
        "Olvidar que las reuniones de cierre disparan Closeout.",
      ],
      nextAction: "Captura comunicaciones, decisiones, documentos y memoria.",
      relatedModules: [{ moduleKey: "commsMemory" }, { moduleKey: "workboard" }],
      lifecycleIndex: LIFECYCLE_INDEX.rhythm,
    },
    commsMemory: {
      title: "Memoria de comunicaciones del proyecto",
      purpose:
        "Captura y conecta emails, reuniones, mensajes de Teams, conversaciones de Slack, decisiones, documentos e ítems de conocimiento.",
      whyItMatters:
        "El conocimiento del proyecto no debe quedar disperso entre correos, chats y notas de reunión.",
      whatToDoFirst: [
        "Registra comunicaciones importantes.",
        "Documenta decisiones.",
        "Sube o vincula documentos.",
        "Revisa Memoria del Proyecto.",
        "Conecta ítems con tareas, riesgos, hitos, stakeholders o reuniones.",
      ],
      checklist: [
        "Comunicaciones registradas",
        "Decisiones documentadas",
        "Documentos organizados",
        "Seguimientos controlados",
        "Ítems de memoria clasificados",
        "Links de trazabilidad agregados",
      ],
      aiAssistance:
        "La IA puede resumir conversaciones, detectar bloqueos, extraer decisiones, identificar seguimientos y clasificar ítems de memoria.",
      commonMistakes: [
        "Dejar decisiones críticas solo en chat o email.",
        "No conectar comunicaciones con elementos de ejecución.",
        "Esperar hasta el cierre para organizar la memoria del proyecto.",
      ],
      nextAction: "Revisa Budget, BIM o Labor Capacity si aplica, luego genera Status Reports.",
      relatedModules: [{ moduleKey: "budget" }, { moduleKey: "status" }],
      lifecycleIndex: LIFECYCLE_INDEX.commsMemory,
    },
    budget: {
      title: "Presupuesto",
      purpose:
        "Revisa y gestiona estimaciones de presupuesto, categorías, cantidades, costos unitarios, subtotales y totales.",
      whyItMatters: "La visibilidad de costo es parte de una ejecución controlada.",
      whatToDoFirst: [
        "Revisa categorías.",
        "Valida cantidades.",
        "Valida costos unitarios.",
        "Confirma totales.",
        "Reconcilia antes del cierre.",
      ],
      checklist: [
        "Categorías revisadas",
        "Cantidades validadas",
        "Costos unitarios revisados",
        "Presupuesto total confirmado",
        "Presupuesto reconciliado si está cerrando",
      ],
      aiAssistance:
        "La IA puede ayudar a explicar movimientos de presupuesto, impactos de costo y riesgos relacionados con materiales si está disponible.",
      nextAction: "Usa Status Report para comunicar el estado actual del proyecto.",
      relatedModules: [{ moduleKey: "status" }, { moduleKey: "bim" }],
      lifecycleIndex: LIFECYCLE_INDEX.budget,
    },
    bim: {
      title: "Drawing Intelligence / BIM",
      purpose:
        "Sube planos, procésalos con IA y extrae takeoff, insights, riesgos, RFIs, versiones e impactos en costo o cronograma.",
      whyItMatters:
        "Proyectos de construcción e ingeniería necesitan inteligencia de planos conectada a la ejecución.",
      whatToDoFirst: [
        "Sube planos.",
        "Selecciona modo de procesamiento.",
        "Revisa insights extraídos.",
        "Convierte insights en RFIs, submittals, inspecciones, constraints de cronograma o impactos de costo.",
      ],
      checklist: [
        "Planos cargados",
        "Modo de procesamiento seleccionado",
        "Takeoff revisado",
        "Riesgos revisados",
        "RFIs creados si aplica",
        "Impactos de costo o cronograma revisados",
      ],
      aiAssistance:
        "La IA puede interpretar planos, extraer takeoff, identificar riesgos, sugerir RFIs y conectar insights con la ejecución.",
      commonMistakes: [
        "Tratar planos como archivos desconectados.",
        "No convertir insights en acciones.",
      ],
      nextAction: "Revisa impactos en Budget y Execution Map.",
      relatedModules: [{ moduleKey: "budget" }, { moduleKey: "executionMap" }],
      lifecycleIndex: LIFECYCLE_INDEX.bim,
    },
    laborCapacity: {
      title: "Capacidad laboral",
      purpose:
        "Planifica y monitorea capacidad por trade, semana, zona, readiness y restricciones de workface.",
      whyItMatters:
        "La ejecución en construcción depende de tener las cuadrillas correctas listas en el momento correcto.",
      whatToDoFirst: [
        "Revisa la matriz de capacidad.",
        "Verifica lookahead readiness.",
        "Identifica riesgo de cuadrillas ociosas.",
        "Resuelve prerrequisitos faltantes.",
      ],
      checklist: [
        "Capacidad revisada",
        "Lookahead verificado",
        "Gaps identificados",
        "Riesgo de idle revisado",
        "Bloqueos de workface atendidos",
      ],
      aiAssistance:
        "La IA puede explicar problemas de readiness, recomendar acciones de cuadrillas e identificar riesgos de cronograma.",
      nextAction: "Usa Status Report para comunicar riesgos de capacidad.",
      relatedModules: [{ moduleKey: "status" }, { moduleKey: "workboard" }],
      lifecycleIndex: LIFECYCLE_INDEX.laborCapacity,
    },
    status: {
      title: "Reporte de estado",
      purpose: "Genera un reporte de estado listo para stakeholders desde los datos vivos del proyecto.",
      whyItMatters: "Liderazgo necesita estado claro, no datos crudos de tareas.",
      whatToDoFirst: [
        "Revisa progreso.",
        "Verifica bloqueos.",
        "Revisa “qué hacer ahora”.",
        "Exporta PDF si hace falta.",
      ],
      checklist: [
        "Progreso revisado",
        "Bloqueos revisados",
        "Próximas acciones revisadas",
        "Reporte generado",
        "PDF exportado si aplica",
      ],
      aiAssistance: "La IA puede resumir estado, explicar movimiento y destacar lo importante.",
      commonMistakes: [
        "Generar reportes con datos desactualizados.",
        "Reportar solo porcentaje completado sin explicar riesgos o bloqueos.",
      ],
      nextAction: "Continúa ejecución o prepara Closeout si el proyecto está listo.",
      relatedModules: [{ moduleKey: "closeout" }, { moduleKey: "rhythm" }],
      lifecycleIndex: LIFECYCLE_INDEX.status,
    },
    closeout: {
      title: "Cierre del proyecto",
      purpose: "Cierra formalmente el proyecto, valida readiness y genera el Reporte de Cierre.",
      whyItMatters:
        "Un proyecto no está completo hasta que sus resultados, decisiones, lecciones, documentos y memoria quedan preservados.",
      whatToDoFirst: [
        "Revisa readiness de cierre.",
        "Resuelve criterios bloqueantes.",
        "Programa y completa la reunión de cierre en Rhythm Center.",
        "Revisa el Reporte de Cierre generado.",
        "Exporta PDF.",
      ],
      checklist: [
        "Sin tareas abiertas",
        "Sin tareas bloqueadas",
        "Riesgos resueltos",
        "RFIs respondidos",
        "Action items cerrados",
        "Hitos completados",
        "Decisiones finalizadas",
        "Presupuesto reconciliado",
        "Reunión de cierre completada",
        "Reporte de Cierre generado",
      ],
      aiAssistance:
        "La IA genera narrativa de cierre, lecciones aprendidas, asuntos abiertos, próximos pasos y resumen ejecutivo desde los datos acumulados.",
      commonMistakes: [
        "Intentar cerrar antes de resolver criterios bloqueantes.",
        "No completar la reunión de cierre.",
        "No mantener la memoria del proyecto durante la ejecución.",
      ],
      nextAction: "Archiva el proyecto y conserva lecciones aprendidas para futuros proyectos.",
      relatedModules: [{ moduleKey: "rhythm" }, { moduleKey: "status" }],
      lifecycleIndex: LIFECYCLE_INDEX.closeout,
    },
    reports: {
      title: "Reportes",
      purpose: "Accede a reportes organizacionales e insights de proyectos.",
      whyItMatters: "PMOs y ejecutivos necesitan visibilidad de portafolio.",
      whatToDoFirst: [
        "Selecciona tipo de reporte.",
        "Filtra por proyecto o portafolio.",
        "Revisa insights.",
        "Exporta si hace falta.",
      ],
      checklist: [
        "Reporte seleccionado",
        "Filtros aplicados",
        "Insights revisados",
        "Exportación completada si aplica",
      ],
      nextAction: "Usa reportes para apoyar gobernanza y comunicación ejecutiva.",
      relatedModules: [{ moduleKey: "commandCenter" }, { moduleKey: "status" }],
      lifecycleIndex: LIFECYCLE_INDEX.reports,
    },
    aiOperator: {
      title: "AI Operator",
      purpose:
        "Hub central de asistencia con IA, análisis de importación y flujos inteligentes del proyecto.",
      whyItMatters: "La IA apoya al Project Manager, pero el criterio humano mantiene el control.",
      whatToDoFirst: [
        "Selecciona el flujo de IA.",
        "Revisa el resultado.",
        "Acepta, edita, rechaza o convierte recomendaciones en acciones.",
      ],
      checklist: [
        "Flujo de IA seleccionado",
        "Resultado revisado",
        "Decisión humana tomada",
        "Acción creada si aplica",
      ],
      nextAction: "Usa la salida de IA para fortalecer planificación, ejecución, reportes o memoria del proyecto.",
      relatedModules: [{ moduleKey: "createImport" }, { moduleKey: "charter" }],
      lifecycleIndex: LIFECYCLE_INDEX.aiOperator,
    },
    settings: {
      title: "Configuración",
      purpose: "Gestiona tu espacio de trabajo y preferencias de la organización.",
      whyItMatters: "Un espacio de trabajo bien configurado mantiene la ejecución confiable.",
      whatToDoFirst: [
        "Revisa la configuración de la organización.",
        "Confirma miembros y acceso.",
        "Ajusta preferencias.",
      ],
      checklist: ["Organización revisada", "Miembros confirmados", "Preferencias establecidas"],
      nextAction: "Vuelve al Centro de Mando para continuar trabajando.",
      relatedModules: [{ moduleKey: "commandCenter" }, { moduleKey: "teamRoles" }],
      lifecycleIndex: LIFECYCLE_INDEX.settings,
    },
  },
};

// ── Exported content map ────────────────────────────────────────────────────────

export const navigatorContent: Record<NavigatorLanguage, NavigatorContent> = { en, es };

// ── Route → module mapping ──────────────────────────────────────────────────────
// Pathname is expected to be locale-less (as returned by next-intl's usePathname).
// Project routes follow the real pattern: /projects/{uuid}/{module}.

const PROJECT_ID_RE = /\/projects\/([0-9a-f-]{36})(\/.*)?$/;

export function getCurrentNavigatorModule(pathname: string): ModuleKey {
  const path = (pathname || "/").replace(/\/+$/, "") || "/";

  // ── Auth ──
  if (path === "/login" || path.startsWith("/login") || path === "/signup" || path.startsWith("/signup")) {
    return "start";
  }

  // ── Global routes ──
  if (path === "/" || path === "") return "commandCenter";
  if (path === "/projects") return "createImport";
  if (path === "/import" || path.startsWith("/import")) return "createImport";
  if (path === "/ai-operator" || path.startsWith("/ai-operator")) return "aiOperator";
  if (path === "/reports" || path.startsWith("/reports")) return "reports";
  if (path === "/team" || path.startsWith("/team")) return "teamRoles";
  if (path === "/settings" || path.startsWith("/settings")) return "settings";
  if (path.startsWith("/organization/billing")) return "settings";

  // ── Project-scoped routes ──
  const projMatch = path.match(PROJECT_ID_RE);
  if (projMatch) {
    const rest = projMatch[2] ?? "";
    if (rest === "" || rest === "/") return "commandCenter"; // project dashboard
    if (rest.startsWith("/charter")) return "charter";
    if (rest.startsWith("/delivery")) return "delivery";
    if (rest.startsWith("/team")) return "teamRoles";
    if (rest.startsWith("/stakeholders")) return "teamRoles";
    if (rest.startsWith("/execution-map")) return "executionMap"; // covers /living-graph
    if (rest.startsWith("/workboard")) return "workboard";
    if (rest.startsWith("/rhythm") || rest.startsWith("/meetings")) return "rhythm";
    if (rest.startsWith("/communications")) return "commsMemory";
    if (rest.startsWith("/decisions")) return "commsMemory";
    if (rest.startsWith("/documents")) return "commsMemory";
    if (rest.startsWith("/memory")) return "commsMemory";
    if (rest.startsWith("/budget")) return "budget";
    if (rest.startsWith("/drawing-intelligence")) return "bim";
    if (rest.startsWith("/labor-capacity")) return "laborCapacity";
    if (rest.startsWith("/status")) return "status";
    if (rest.startsWith("/closeout")) return "closeout";
    if (rest.startsWith("/settings")) return "settings";
    // audit / search / links / unknown sub-routes → lifecycle overview
    return "lifecycle";
  }

  return "lifecycle";
}

// ── Content lookup ──────────────────────────────────────────────────────────────

export function getNavigatorContent(language: NavigatorLanguage, moduleKey: ModuleKey): {
  content: NavigatorContent;
  guidance: ModuleGuidance | null;
} {
  const content = navigatorContent[language] ?? navigatorContent.en;
  return { content, guidance: getModuleGuidance(language, moduleKey) };
}

/** Safe accessor for a single module's guidance (returns null for the overview key). */
export function getModuleGuidance(
  language: NavigatorLanguage,
  moduleKey: ModuleKey,
): ModuleGuidance | null {
  if (moduleKey === "lifecycle") return null;
  const modules = (navigatorContent[language] ?? navigatorContent.en).modules;
  return modules[moduleKey] ?? null;
}

/** Safe accessor for a single module's title. */
export function getModuleTitle(language: NavigatorLanguage, moduleKey: ModuleKey): string | null {
  return getModuleGuidance(language, moduleKey)?.title ?? null;
}

// ── Lifecycle state ──────────────────────────────────────────────────────────────

export type LifecycleStepState = "completed" | "current" | "upcoming";

export interface LifecycleStepView {
  step: LifecycleStep;
  state: LifecycleStepState;
}

export function getLifecycleState(
  language: NavigatorLanguage,
  currentModuleKey: ModuleKey,
  completedStepKeys: string[],
): { views: LifecycleStepView[]; currentIndex: number } {
  const content = navigatorContent[language] ?? navigatorContent.en;
  const steps = content.lifecycle.steps;
  const completed = new Set(completedStepKeys);

  // Resolve current lifecycle index from the active module.
  let currentIndex = -1;
  if (currentModuleKey !== "lifecycle") {
    const guidance = content.modules[currentModuleKey as Exclude<ModuleKey, "lifecycle">];
    if (guidance) currentIndex = guidance.lifecycleIndex;
  }

  const views: LifecycleStepView[] = steps.map((step, index) => {
    let state: LifecycleStepState = "upcoming";
    if (completed.has(step.key)) state = "completed";
    if (index === currentIndex) state = "current";
    return { step, state };
  });

  return { views, currentIndex };
}

// ── Next module to navigate to ───────────────────────────────────────────────────

export function getNextModuleKey(language: NavigatorLanguage, currentModuleKey: ModuleKey): ModuleKey | null {
  const content = navigatorContent[language] ?? navigatorContent.en;
  if (currentModuleKey === "lifecycle") return content.lifecycle.steps[0]?.moduleKey ?? null;
  const guidance = content.modules[currentModuleKey as Exclude<ModuleKey, "lifecycle">];
  if (!guidance) return null;
  const next = content.lifecycle.steps[guidance.lifecycleIndex + 1];
  return next?.moduleKey ?? null;
}

// ── Route resolution for "Go to module" ───────────────────────────────────────────

export function getModuleRoute(moduleKey: ModuleKey, projectId: string | null): string | null {
  const projBase = projectId ? `/projects/${projectId}` : null;
  switch (moduleKey) {
    case "start":
      return null;
    case "commandCenter":
      return projBase ?? "/";
    case "createImport":
      return "/projects";
    case "charter":
      return projBase ? `${projBase}/charter` : null;
    case "delivery":
      return projBase ? `${projBase}/delivery` : null;
    case "teamRoles":
      return projBase ? `${projBase}/team` : "/team";
    case "executionMap":
      return projBase ? `${projBase}/execution-map` : null;
    case "workboard":
      return projBase ? `${projBase}/workboard` : null;
    case "rhythm":
      return projBase ? `${projBase}/rhythm` : null;
    case "commsMemory":
      return projBase ? `${projBase}/communications` : null;
    case "budget":
      return projBase ? `${projBase}/budget` : null;
    case "bim":
      return projBase ? `${projBase}/drawing-intelligence` : null;
    case "laborCapacity":
      return projBase ? `${projBase}/labor-capacity` : null;
    case "status":
      return projBase ? `${projBase}/status` : null;
    case "closeout":
      return projBase ? `${projBase}/closeout` : null;
    case "reports":
      return "/reports";
    case "aiOperator":
      return "/ai-operator";
    case "settings":
      return "/settings";
    default:
      return null;
  }
}

// ── Project ID extraction (shared with sidebar) ──────────────────────────────────

export function extractProjectId(pathname: string): string | null {
  const match = pathname.match(PROJECT_ID_RE);
  return match ? match[1] : null;
}

// ── Locale normalization ──────────────────────────────────────────────────────────

export function toNavigatorLanguage(locale: string | undefined): NavigatorLanguage {
  return locale === "es" ? "es" : "en";
}