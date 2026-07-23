#!/usr/bin/env node
// ============================================================================
// ProjectOps360° — Official project import template generator
// ============================================================================
// Generates the downloadable templates offered in the /import wizard:
//   public/templates/ProjectOps360_Project_Import_Template.xlsx
//   public/templates/ProjectOps360_Project_Import_Template.json
// The sheet names and headers match exactly what the heuristic extractor in
// src/lib/import-intelligence/extract.ts recognizes (charter key/value sheet,
// combined Milestones & Tasks, Task Prompts, Risk Register, Data Dependencies,
// Acceptance Criteria, Governance & Gates, Materials, Budget, Resources).
// Re-run after changing the extractor: node scripts/generate-import-template.mjs
// ============================================================================

import * as fs from "node:fs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

// The ESM build of SheetJS needs the fs module injected before writeFile.
XLSX.set_fs(fs);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "templates");
mkdirSync(OUT_DIR, { recursive: true });

const wb = XLSX.utils.book_new();
const sheet = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);

// ── Read Me (ignored by the extractor) ──────────────────────────────────────
sheet("Read Me", [
  ["ProjectOps360° — Project Import Template / Plantilla de importación de proyectos"],
  [],
  ["EN", "Fill the sheets you need and delete the rest. Sheet names and column headers are how ProjectOps360° recognizes your data — keep them. Every sheet is optional except Milestones & Tasks."],
  ["ES", "Llena las hojas que necesites y elimina el resto. Los nombres de hoja y los encabezados de columna son la forma en que ProjectOps360° reconoce tus datos — consérvalos. Todas las hojas son opcionales excepto Milestones & Tasks."],
  [],
  ["EN", "Dashboard: the single title cell becomes the project name."],
  ["ES", "Dashboard: la celda de título única se convierte en el nombre del proyecto."],
  ["EN", "Project Charter: Field/Definition pairs fill the Charter Center (goal, scope, assumptions, constraints, governance…)."],
  ["ES", "Project Charter: pares Campo/Definición que rellenan el Charter Center (meta, alcance, supuestos, restricciones, gobernanza…)."],
  ["EN", "Milestones & Tasks: one row per task. Milestone + Milestone Name create the milestones in order of appearance."],
  ["ES", "Milestones & Tasks: una fila por tarea. Milestone + Milestone Name crean los hitos en orden de aparición."],
  ["EN", "Task Prompts: optional AI execution prompt per Task ID (stored internally, used by Isabella)."],
  ["ES", "Task Prompts: prompt de ejecución con IA opcional por Task ID (se guarda internamente, lo usa Isabella)."],
  ["EN", "Risk Register: probability/impact accept High/Medium/Low or a 1-5 scale; Rating may be Critical/High/Medium/Low."],
  ["ES", "Risk Register: probabilidad/impacto aceptan Alta/Media/Baja o escala 1-5; Rating puede ser Crítico/Alto/Medio/Bajo."],
  ["EN", "Data Dependencies, Acceptance Criteria and Governance & Gates land in the Charter Center (dependencies, acceptance criteria, governance model, change control)."],
  ["ES", "Data Dependencies, Acceptance Criteria y Governance & Gates aterrizan en el Charter Center (dependencias, criterios de aceptación, modelo de gobernanza, control de cambios)."],
]);

// ── Dashboard → project name ────────────────────────────────────────────────
sheet("Dashboard", [
  ["My Project Name — Replace this title / Reemplaza este título"],
  ["Only the title above is read from this sheet. / De esta hoja solo se lee el título de arriba."],
]);

// ── Project Charter (key/value) ─────────────────────────────────────────────
sheet("Project Charter", [
  ["Project Charter"],
  ["Field", "Definition"],
  ["Purpose", "Why does this project exist? / ¿Por qué existe este proyecto?"],
  ["Business Problem", "What problem does it solve? / ¿Qué problema resuelve?"],
  ["Objectives", "Specific and measurable objectives, one per line. / Objetivos específicos y medibles, uno por línea."],
  ["In Scope", "What is included. / Qué está incluido."],
  ["Out of Scope", "What is explicitly excluded. / Qué queda explícitamente fuera."],
  ["Key Assumptions", "What you assume to be true. / Lo que asumes como cierto."],
  ["Primary Constraints", "Time, budget, people, technology limits. / Límites de tiempo, presupuesto, personas, tecnología."],
  ["Major Deliverables", "The main deliverables. / Los entregables principales."],
  ["Success Metrics", "How success is measured. / Cómo se mide el éxito."],
  ["Definition of Done", "When is the project complete? / ¿Cuándo está completo el proyecto?"],
  ["Governance", "How decisions are made and escalated. / Cómo se decide y escala."],
  ["Reporting Cadence", "Weekly status, monthly steering… / Estado semanal, comité mensual…"],
]);

// ── Milestones & Tasks (combined; milestones derive from these rows) ────────
sheet("Milestones & Tasks", [
  ["Task ID", "Milestone", "Milestone Name", "Task", "Objective", "Discipline", "Estimate", "Dependencies", "Acceptance Criterion", "Status", "Priority", "Owner"],
  ["T1.1", "M1", "Foundation / Fundación", "Define scope / Definir alcance", "Freeze the project scope. / Congelar el alcance del proyecto.", "Product", "2 días", "—", "Scope approved. / Alcance aprobado.", "Not Started", "High", "Ana Torres"],
  ["T1.2", "M1", "Foundation / Fundación", "Set up the environment / Preparar el entorno", "Working environment for the team. / Entorno funcional para el equipo.", "Engineering", "1.5 días", "T1.1", "Environment verified. / Entorno verificado.", "Not Started", "Medium", "Luis Pérez"],
  ["T2.1", "M2", "Build / Construcción", "Build the first deliverable / Construir el primer entregable", "First increment of value. / Primer incremento de valor.", "Engineering", "1 semana", "T1.2", "Deliverable demoed. / Entregable demostrado.", "Not Started", "High", "Ana Torres"],
]);

// ── Task Prompts (optional AI execution prompt per task) ────────────────────
sheet("Task Prompts", [
  ["Task ID", "Task", "Milestone", "Prompt Ready to Copy"],
  ["T1.1", "Define scope / Definir alcance", "M1", "TASK T1.1 — Describe here the exact instructions an AI assistant should follow to execute this task. / Describe aquí las instrucciones exactas que un asistente de IA debe seguir para ejecutar esta tarea."],
]);

// ── Risk Register ───────────────────────────────────────────────────────────
sheet("Risk Register", [
  ["Risk ID", "Risk", "Description", "Probability (1-5)", "Impact (1-5)", "Rating", "Mitigation / Contingency", "Owner", "Status"],
  ["R01", "Scope creep", "New features alter the approved plan. / Nuevas features alteran el plan aprobado.", 4, 5, "Critical", "Freeze scope; changes go through change control. / Congelar alcance; los cambios pasan por control de cambios.", "Product Owner", "Open"],
  ["R02", "Key person unavailable / Persona clave no disponible", "A critical role becomes unavailable. / Un rol crítico deja de estar disponible.", 2, 4, "High", "Document knowledge; define a backup. / Documentar conocimiento; definir respaldo.", "PM", "Open"],
]);

// ── Data Dependencies → charter "Dependencies" ──────────────────────────────
sheet("Data Dependencies", [
  ["ID", "Data / Service", "Required Fields or Capability", "Blocking Milestone", "Criticality", "Current Status", "Owner", "Validation Rule"],
  ["D01", "Customer database / Base de datos de clientes", "IDs, contact data / IDs, datos de contacto", "M2", "High", "Available / Disponible", "Data Team", "Completeness ≥95%."],
]);

// ── Acceptance Criteria → charter "Acceptance criteria" ─────────────────────
sheet("Acceptance Criteria", [
  ["ID", "Acceptance Criterion", "Milestone", "Severity"],
  ["AC01", "The deliverable passes review without critical defects. / El entregable pasa revisión sin defectos críticos.", "M2", "Mandatory / Obligatorio"],
]);

// ── Governance & Gates → charter governance + change control ────────────────
sheet("Governance & Gates", [
  ["Governance, Stage Gates & Change Control"],
  ["Gate", "Name", "Milestone", "Approver", "Exit Evidence"],
  ["G0", "Scope Gate", "M1", "Sponsor", "Scope and objectives approved. / Alcance y objetivos aprobados."],
  ["G1", "Delivery Gate", "M2", "Sponsor + PM", "First deliverable accepted. / Primer entregable aceptado."],
  ["Change Control Rules"],
  ["CR-01", "No new features mid-task; new ideas are logged for later evaluation. / No se agregan features a mitad de tarea; las ideas nuevas se registran para evaluación posterior."],
]);

// ── Materials ───────────────────────────────────────────────────────────────
sheet("Materials", [
  ["Material", "Quantity", "Unit", "Unit Cost", "Supplier", "Required For Task"],
  ["Concrete / Concreto", 20, "m3", 150, "Acme Supplies", "T2.1"],
]);

// ── Budget ──────────────────────────────────────────────────────────────────
sheet("Budget", [
  ["Item", "Category", "Estimated Cost"],
  ["Engineering labor / Mano de obra de ingeniería", "labor", 25000],
  ["Licenses / Licencias", "software", 3000],
]);

// ── Resources ───────────────────────────────────────────────────────────────
sheet("Resources", [
  ["Name", "Role", "Unit Cost"],
  ["Ana Torres", "Product Manager", 60],
  ["Luis Pérez", "Engineer / Ingeniero", 55],
]);

const xlsxPath = join(OUT_DIR, "ProjectOps360_Project_Import_Template.xlsx");
XLSX.writeFile(wb, xlsxPath);
console.log("wrote", xlsxPath);

// ── JSON template (canonical structured import) ─────────────────────────────
const jsonTemplate = {
  project: {
    name: "My Project Name — Replace this title / Reemplaza este título",
    description: "Short project description. / Descripción corta del proyecto.",
    start_date: "2026-08-01",
    target_finish_date: "2026-10-30",
  },
  charter: {
    purpose: "Why does this project exist? / ¿Por qué existe este proyecto?",
    business_problem: "What problem does it solve? / ¿Qué problema resuelve?",
    objectives: "Specific and measurable objectives. / Objetivos específicos y medibles.",
    in_scope: "What is included. / Qué está incluido.",
    out_of_scope: "What is explicitly excluded. / Qué queda explícitamente fuera.",
    key_assumptions: "What you assume to be true. / Lo que asumes como cierto.",
    primary_constraints: "Time, budget, people limits. / Límites de tiempo, presupuesto, personas.",
    success_metrics: "How success is measured. / Cómo se mide el éxito.",
    definition_of_done: "When is the project complete? / ¿Cuándo está completo el proyecto?",
    governance: "How decisions are made and escalated. / Cómo se decide y escala.",
  },
  milestones: [
    { name: "Foundation / Fundación", status: "planned" },
    { name: "Build / Construcción", status: "planned" },
  ],
  tasks: [
    {
      "task id": "T1.1",
      task: "Define scope / Definir alcance",
      objective: "Freeze the project scope. / Congelar el alcance del proyecto.",
      milestone: "Foundation / Fundación",
      estimate: "2 días",
      status: "Not Started",
      priority: "High",
      owner: "Ana Torres",
      prompt: "TASK T1.1 — Instructions for an AI assistant. / Instrucciones para un asistente de IA.",
    },
    {
      "task id": "T2.1",
      task: "Build the first deliverable / Construir el primer entregable",
      objective: "First increment of value. / Primer incremento de valor.",
      milestone: "Build / Construcción",
      estimate: "1 semana",
      status: "Not Started",
      priority: "High",
      owner: "Ana Torres",
      predecessors: "T1.1",
    },
  ],
  risks: [
    {
      "risk id": "R01",
      risk: "Scope creep",
      description: "New features alter the approved plan. / Nuevas features alteran el plan aprobado.",
      "probability (1-5)": 4,
      "impact (1-5)": 5,
      rating: "Critical",
      "mitigation / contingency": "Freeze scope; changes go through change control. / Congelar alcance; cambios por control de cambios.",
    },
  ],
  resources: [
    { name: "Ana Torres", role: "Product Manager", "unit cost": 60 },
  ],
  budget: [
    { item: "Engineering labor / Mano de obra de ingeniería", category: "labor", "estimated cost": 25000 },
  ],
  materials: [
    { material: "Concrete / Concreto", quantity: 20, unit: "m3", "unit cost": 150 },
  ],
};
const jsonPath = join(OUT_DIR, "ProjectOps360_Project_Import_Template.json");
writeFileSync(jsonPath, JSON.stringify(jsonTemplate, null, 2) + "\n", "utf8");
console.log("wrote", jsonPath);
