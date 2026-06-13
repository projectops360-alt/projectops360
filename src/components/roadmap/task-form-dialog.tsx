"use client";

import { useActionState } from "react";
import { X, Loader2, Sparkles, ChevronDown, Calendar, ClipboardList, FileText, Users, Package, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import {
  createTaskAction,
  updateTaskAction,
  getTaskFormOptionsAction,
  createPersonResourceAction,
} from "@/app/[locale]/(app)/projects/[projectId]/roadmap/actions";
import type { Milestone, RoadmapTask, TaskStatus, TaskPriority, Locale } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────────────

type TaskFormMode = "create" | "edit";

type FormState =
  | { error: string; success?: undefined }
  | { error?: undefined; success: true }
  | null;

const TASK_STATUS_OPTIONS: TaskStatus[] = [
  "not_started", "prompt_ready", "sent_to_ai", "in_progress",
  "implemented", "tested", "done", "blocked", "deferred",
];
const TASK_PRIORITY_OPTIONS: TaskPriority[] = ["p1", "p2", "p3"];

export interface TaskFormTranslations {
  createTitle: string;
  editTitle: string;
  cancel: string;
  save: string;
  creating: string;
  saving: string;
  errors: Record<string, string>;
  statusLabels: Record<string, string>;
  priorityLabels: Record<string, string>;
  fields: {
    title: string;
    titlePlaceholder: string;
    description: string;
    descriptionPlaceholder: string;
    milestone: string;
    milestonePlaceholder: string;
    noMilestone: string;
    status: string;
    priority: string;
    sprintName: string;
    sprintNamePlaceholder: string;
    estimateHours: string;
    estimateHoursPlaceholder: string;
    acceptanceCriteria: string;
    acceptanceCriteriaPlaceholder: string;
    dependencyNotes: string;
    dependencyNotesPlaceholder: string;
    executionNotes: string;
    executionNotesPlaceholder: string;
    blockerReason: string;
    blockerReasonPlaceholder: string;
    scheduling: string;
    startDate: string;
    endDate: string;
    progress: string;
    progressUnit: string;
    durationDays: string;
    promptSection: string;
    promptBody: string;
    promptBodyPlaceholder: string;
    promptContext: string;
    promptContextPlaceholder: string;
    aiToolTarget: string;
    aiToolTargetPlaceholder: string;
    implementationNotes: string;
    implementationNotesPlaceholder: string;
    testNotes: string;
    testNotesPlaceholder: string;
    sectionDetails?: string;
    sectionTracking?: string;
    sectionPlanning?: string;
    assignee?: string;
    assigneeNone?: string;
    predecessors?: string;
    predecessorsEmpty?: string;
    requiredMaterials?: string;
    materialsEmpty?: string;
    addMaterialPlaceholder?: string;
  };
}

/** Built-in bilingual fallbacks for the planning labels so existing callers
 *  that don't pass these translations keep working. */
const PLANNING_LABELS: Record<Locale, {
  sectionPlanning: string;
  assignee: string;
  assigneeNone: string;
  assigneeUsers: string;
  assigneeResources: string;
  addPerson: string;
  addPersonPlaceholder: string;
  addPersonConfirm: string;
  personTypes: Record<string, string>;
  predecessors: string;
  predecessorsEmpty: string;
  predecessorsNoMatch: string;
  filterByMilestone: string;
  allMilestones: string;
  finishesBefore: string;
  predecessorSearch: string;
  selectedCount: (n: number) => string;
  noMilestone: string;
  requiredMaterials: string;
  materialsEmpty: string;
  addMaterialPlaceholder: string;
}> = {
  en: {
    sectionPlanning: "Assignment & prerequisites",
    assignee: "Assigned to",
    assigneeNone: "Unassigned",
    assigneeUsers: "Workspace users",
    assigneeResources: "Project people & crews",
    addPerson: "+ Add new person…",
    addPersonPlaceholder: "Name (e.g. Electrician Crew A, María López)",
    addPersonConfirm: "Add",
    personTypes: { person: "Person", crew: "Crew", team: "Team", role: "Role", vendor: "Vendor", subcontractor: "Subcontractor" },
    predecessors: "Predecessor tasks",
    predecessorsEmpty: "No other tasks in this project yet.",
    predecessorsNoMatch: "No tasks match the current filters.",
    filterByMilestone: "Filter by milestone",
    allMilestones: "All milestones",
    finishesBefore: "Finishes on or before",
    predecessorSearch: "Search tasks…",
    selectedCount: (n) => `${n} selected`,
    noMilestone: "No milestone",
    requiredMaterials: "Required materials",
    materialsEmpty: "No materials registered for this project.",
    addMaterialPlaceholder: "Add a material and press Enter…",
  },
  es: {
    sectionPlanning: "Asignación y prerrequisitos",
    assignee: "Asignado a",
    assigneeNone: "Sin asignar",
    assigneeUsers: "Usuarios del workspace",
    assigneeResources: "Personas y cuadrillas del proyecto",
    addPerson: "+ Agregar persona…",
    addPersonPlaceholder: "Nombre (ej. Cuadrilla Eléctrica A, María López)",
    addPersonConfirm: "Agregar",
    personTypes: { person: "Persona", crew: "Cuadrilla", team: "Equipo", role: "Rol", vendor: "Proveedor", subcontractor: "Subcontratista" },
    predecessors: "Tareas predecesoras",
    predecessorsEmpty: "Aún no hay otras tareas en este proyecto.",
    predecessorsNoMatch: "Ninguna tarea coincide con los filtros.",
    filterByMilestone: "Filtrar por milestone",
    allMilestones: "Todos los milestones",
    finishesBefore: "Termina en o antes de",
    predecessorSearch: "Buscar tareas…",
    selectedCount: (n) => `${n} seleccionada(s)`,
    noMilestone: "Sin milestone",
    requiredMaterials: "Materiales requeridos",
    materialsEmpty: "No hay materiales registrados en este proyecto.",
    addMaterialPlaceholder: "Agrega un material y presiona Enter…",
  },
};

interface TaskFormOptions {
  people: { id: string; name: string }[];
  resources: { id: string; name: string; resource_type: string }[];
  tasks: { id: string; title: string; milestone_id: string | null; start_date: string | null; end_date: string | null; order_index: number }[];
  materials: { id: string; name: string; status: string; required_by_task_id: string | null }[];
  dependencies: { predecessor_id: string; successor_id: string; dependency_type: string }[];
}

const ADD_PERSON_VALUE = "__add_person__";

interface TaskFormDialogProps {
  mode: TaskFormMode;
  projectId: string;
  locale: Locale;
  milestones: Milestone[];
  preselectedMilestoneId?: string;
  task?: RoadmapTask;
  onClose: () => void;
  onSaved: () => void;
  translations: TaskFormTranslations;
}

// ── Collapsible section ─────────────────────────────────────────────────────────

function FormSection({
  icon,
  label,
  open,
  onToggle,
  children,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
      >
        {icon}
        {label}
        {badge != null && badge > 0 && (
          <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-100 px-1.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
            {badge}
          </span>
        )}
        <ChevronDown className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-border px-3 pb-4 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Shared input class ──────────────────────────────────────────────────────────

const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";
const textareaClass = `${inputClass} resize-none`;

// ── Component ──────────────────────────────────────────────────────────────────

export function TaskFormDialog({
  mode,
  projectId,
  locale,
  milestones,
  preselectedMilestoneId,
  task,
  onClose,
  onSaved,
  translations: t,
}: TaskFormDialogProps) {
  const isEdit = mode === "edit";
  const planningLabels = PLANNING_LABELS[locale] ?? PLANNING_LABELS.en;
  const tp = {
    sectionPlanning: t.fields.sectionPlanning ?? planningLabels.sectionPlanning,
    assignee: t.fields.assignee ?? planningLabels.assignee,
    assigneeNone: t.fields.assigneeNone ?? planningLabels.assigneeNone,
    assigneeUsers: planningLabels.assigneeUsers,
    assigneeResources: planningLabels.assigneeResources,
    addPerson: planningLabels.addPerson,
    addPersonPlaceholder: planningLabels.addPersonPlaceholder,
    addPersonConfirm: planningLabels.addPersonConfirm,
    personTypes: planningLabels.personTypes,
    predecessors: t.fields.predecessors ?? planningLabels.predecessors,
    predecessorsEmpty: t.fields.predecessorsEmpty ?? planningLabels.predecessorsEmpty,
    predecessorsNoMatch: planningLabels.predecessorsNoMatch,
    filterByMilestone: planningLabels.filterByMilestone,
    allMilestones: planningLabels.allMilestones,
    finishesBefore: planningLabels.finishesBefore,
    predecessorSearch: planningLabels.predecessorSearch,
    selectedCount: planningLabels.selectedCount,
    noMilestone: planningLabels.noMilestone,
    requiredMaterials: t.fields.requiredMaterials ?? planningLabels.requiredMaterials,
    materialsEmpty: t.fields.materialsEmpty ?? planningLabels.materialsEmpty,
    addMaterialPlaceholder: t.fields.addMaterialPlaceholder ?? planningLabels.addMaterialPlaceholder,
  };

  // People / tasks / materials for the planning section, loaded on open
  const [options, setOptions] = useState<TaskFormOptions | null>(null);
  const [newMaterials, setNewMaterials] = useState<string[]>([]);
  // Predecessors are controlled so the selection survives filtering (hidden
  // checkboxes would otherwise unmount and drop their values). Seeded from
  // existing dependencies in the options-loading effect below.
  const [selectedPredecessors, setSelectedPredecessors] = useState<Set<string>>(new Set());
  const [materialDraft, setMaterialDraft] = useState("");

  // Assignee: 'user:<id>' | 'resource:<id>' | '' — controlled so the
  // quick-add flow can select the freshly created resource.
  const [assigneeValue, setAssigneeValue] = useState<string>(
    isEdit && task?.assigned_to
      ? `user:${task.assigned_to}`
      : isEdit && task?.assigned_resource_id
        ? `resource:${task.assigned_resource_id}`
        : "",
  );
  const [addingPerson, setAddingPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonType, setNewPersonType] = useState("person");
  const [creatingPerson, setCreatingPerson] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTaskFormOptionsAction({ projectId }).then((res) => {
      if (cancelled || res.error) return;
      setOptions({
        people: res.people ?? [],
        resources: res.resources ?? [],
        tasks: res.tasks ?? [],
        materials: res.materials ?? [],
        dependencies: res.dependencies ?? [],
      });
      // Seed the predecessor selection from existing dependencies (edit mode).
      // Done here in the async callback rather than a separate effect.
      if (isEdit && task) {
        setSelectedPredecessors(
          new Set(
            (res.dependencies ?? [])
              .filter((d) => d.successor_id === task.id && d.dependency_type === "finish_to_start")
              .map((d) => d.predecessor_id),
          ),
        );
      }
    });
    return () => { cancelled = true; };
  }, [projectId, isEdit, task]);

  async function handleAddPerson() {
    const name = newPersonName.trim();
    if (!name || creatingPerson) return;
    setCreatingPerson(true);
    try {
      const res = await createPersonResourceAction({
        projectId,
        name,
        resourceType: newPersonType,
      });
      const resourceId = res.resourceId;
      if (resourceId) {
        setOptions((prev) =>
          prev
            ? {
                ...prev,
                resources: prev.resources.some((r) => r.id === resourceId)
                  ? prev.resources
                  : [...prev.resources, { id: resourceId, name, resource_type: newPersonType }].sort((a, b) => a.name.localeCompare(b.name)),
              }
            : prev,
        );
        setAssigneeValue(`resource:${resourceId}`);
        setAddingPerson(false);
        setNewPersonName("");
      }
    } finally {
      setCreatingPerson(false);
    }
  }

  const preselectedMaterials = new Set(
    isEdit && task && options
      ? options.materials.filter((m) => m.required_by_task_id === task.id).map((m) => m.id)
      : [],
  );

  function togglePredecessor(id: string) {
    setSelectedPredecessors((prev) =>
      prev.has(id)
        ? new Set([...prev].filter((x) => x !== id))
        : new Set([...prev, id]),
    );
  }

  // Predecessor filters
  const [predMilestoneFilter, setPredMilestoneFilter] = useState<string>("");
  const [predFinishBefore, setPredFinishBefore] = useState<string>("");
  const [predSearch, setPredSearch] = useState<string>("");

  function addMaterialDraft() {
    const name = materialDraft.trim();
    if (!name) return;
    if (!newMaterials.includes(name)) setNewMaterials([...newMaterials, name]);
    setMaterialDraft("");
  }

  async function handleSubmit(_prevState: FormState, formData: FormData): Promise<FormState> {
    const title = (formData.get("title") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();
    const milestoneId = (formData.get("milestone_id") as string) || "";
    const status = (formData.get("status") as string) || "not_started";
    const priority = (formData.get("priority") as string) || "p2";
    const sprintName = (formData.get("sprint_name") as string)?.trim();
    const estimateHours = formData.get("estimate_hours") as string;
    const acceptanceCriteria = (formData.get("acceptance_criteria") as string)?.trim();
    const dependencyNotes = (formData.get("dependency_notes") as string)?.trim();
    const promptBody = (formData.get("prompt_body") as string)?.trim();
    const promptContext = (formData.get("prompt_context") as string)?.trim();
    const aiToolTarget = (formData.get("ai_tool_target") as string)?.trim();
    const implementationNotes = (formData.get("implementation_notes") as string)?.trim();
    const testNotes = (formData.get("test_notes") as string)?.trim();
    const executionNotes = (formData.get("execution_notes") as string)?.trim();
    const blockerReason = (formData.get("blocker_reason") as string)?.trim();
    const startDate = (formData.get("start_date") as string) || "";
    const endDate = (formData.get("end_date") as string) || "";
    const progress = parseInt(formData.get("progress") as string) || 0;
    const assigneeRaw = (formData.get("assigned_to") as string) || "";
    const assignedTo = assigneeRaw.startsWith("user:") ? assigneeRaw.slice(5) : null;
    const assignedResourceId = assigneeRaw.startsWith("resource:") ? assigneeRaw.slice(9) : null;
    const predecessorIds = [...selectedPredecessors];
    const materialIds = formData.getAll("material_ids").map(String);

    if (!title) {
      return { error: t.errors.titleRequired || "Title is required" };
    }

    const parsedEstimate = estimateHours ? parseFloat(estimateHours) : null;

    if (isEdit && task) {
      const result = await updateTaskAction({
        taskId: task.id,
        title,
        description,
        milestone_id: milestoneId || null,
        status,
        priority,
        sprint_name: sprintName,
        estimate_hours: parsedEstimate,
        dependency_notes: dependencyNotes,
        acceptance_criteria: acceptanceCriteria,
        start_date: startDate,
        end_date: endDate,
        progress,
        prompt_body: promptBody,
        prompt_context: promptContext,
        ai_tool_target: aiToolTarget,
        implementation_notes: implementationNotes,
        test_notes: testNotes,
        execution_notes: executionNotes,
        blocker_reason: blockerReason,
        assigned_to: assignedTo,
        assigned_resource_id: assignedResourceId,
        predecessor_ids: predecessorIds,
        material_ids: materialIds,
        new_materials: newMaterials,
        projectId,
      });
      if (result.error) {
        return { error: t.errors[result.error] || t.errors.unexpected || "Error" };
      }
    } else {
      const result = await createTaskAction({
        title,
        description,
        milestone_id: milestoneId || undefined,
        status,
        priority,
        sprint_name: sprintName,
        estimate_hours: parsedEstimate,
        dependency_notes: dependencyNotes,
        acceptance_criteria: acceptanceCriteria,
        start_date: startDate,
        end_date: endDate,
        progress,
        prompt_body: promptBody,
        prompt_context: promptContext,
        ai_tool_target: aiToolTarget,
        implementation_notes: implementationNotes,
        test_notes: testNotes,
        execution_notes: executionNotes,
        blocker_reason: blockerReason,
        assigned_to: assignedTo,
        assigned_resource_id: assignedResourceId,
        predecessor_ids: predecessorIds,
        material_ids: materialIds,
        new_materials: newMaterials,
        order_index: 0,
        projectId,
      });
      if (result.error) {
        return { error: t.errors[result.error] || t.errors.unexpected || "Error" };
      }
    }

    onSaved();
    onClose();
    return { success: true };
  }

  const [state, formAction, isPending] = useActionState(handleSubmit, null);
  const [progressValue, setProgressValue] = useState(isEdit ? (task?.progress ?? 0) : 0);
  const [statusValue, setStatusValue] = useState<string>(isEdit ? (task?.status ?? "not_started") : "not_started");

  // Auto-expand sections in edit mode when they have data
  const hasDetailsData = isEdit && !!(task?.sprint_name || task?.estimate_hours || task?.acceptance_criteria || task?.dependency_notes);
  const hasTrackingData = isEdit && !!(task?.execution_notes || task?.blocker_reason || task?.start_date || task?.end_date || (task?.progress && task.progress > 0));
  const hasPromptData = isEdit && !!((task as RoadmapTask | undefined)?.prompt_body || (task as RoadmapTask | undefined)?.implementation_notes || (task as RoadmapTask | undefined)?.test_notes);

  const [showDetails, setShowDetails] = useState(hasDetailsData);
  const [showTracking, setShowTracking] = useState(hasTrackingData);
  const [showPrompt, setShowPrompt] = useState(hasPromptData);
  const [showPlanning, setShowPlanning] = useState(true);

  // Count filled fields per section for badges
  const detailsBadge = isEdit
    ? [task?.sprint_name, task?.estimate_hours, task?.acceptance_criteria, task?.dependency_notes].filter(Boolean).length
    : 0;
  const trackingBadge = isEdit
    ? [task?.execution_notes, task?.blocker_reason, task?.start_date || task?.end_date, task?.progress && task.progress > 0 ? true : null].filter(Boolean).length
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? t.editTitle : t.createTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {state?.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
                {state.error}
              </div>
            )}

            {/* ── Essential fields (always visible) ── */}

            {/* Title */}
            <div className="space-y-1.5">
              <label htmlFor="task-title" className="block text-sm font-medium text-foreground">
                {t.fields.title} <span className="text-red-500">*</span>
              </label>
              <input
                id="task-title"
                name="title"
                type="text"
                required
                maxLength={200}
                autoFocus
                defaultValue={isEdit ? task?.title : ""}
                className={inputClass}
                placeholder={t.fields.titlePlaceholder}
                disabled={isPending}
              />
            </div>

            {/* Description (compact) */}
            <div className="space-y-1.5">
              <label htmlFor="task-description" className="block text-sm font-medium text-foreground">
                {t.fields.description}
              </label>
              <textarea
                id="task-description"
                name="description"
                rows={2}
                maxLength={2000}
                defaultValue={isEdit ? task?.description ?? "" : ""}
                className={textareaClass}
                placeholder={t.fields.descriptionPlaceholder}
                disabled={isPending}
              />
            </div>

            {/* Milestone + Status + Priority (3-col) */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="task-milestone" className="block text-xs font-medium text-muted-foreground">
                  {t.fields.milestone}
                </label>
                <select
                  id="task-milestone"
                  name="milestone_id"
                  defaultValue={isEdit ? task?.milestone_id ?? "" : preselectedMilestoneId ?? ""}
                  className={inputClass}
                  disabled={isPending}
                >
                  <option value="">{t.fields.noMilestone}</option>
                  {milestones.map((m) => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="task-status" className="block text-xs font-medium text-muted-foreground">
                  {t.fields.status}
                </label>
                <select
                  id="task-status"
                  name="status"
                  value={statusValue}
                  onChange={(e) => setStatusValue(e.target.value)}
                  className={inputClass}
                  disabled={isPending}
                >
                  {TASK_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{t.statusLabels[s]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="task-priority" className="block text-xs font-medium text-muted-foreground">
                  {t.fields.priority}
                </label>
                <select
                  id="task-priority"
                  name="priority"
                  defaultValue={isEdit ? task?.priority : "p2"}
                  className={inputClass}
                  disabled={isPending}
                >
                  {TASK_PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>{t.priorityLabels[p]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Blocker reason — only when status is blocked */}
            {statusValue === "blocked" && (
              <div className="space-y-1.5 rounded-lg border border-red-200 bg-red-50/50 p-3 dark:border-red-800/50 dark:bg-red-950/30">
                <label htmlFor="task-blocker-reason" className="block text-sm font-medium text-red-700 dark:text-red-400">
                  {t.fields.blockerReason}
                </label>
                <textarea
                  id="task-blocker-reason"
                  name="blocker_reason"
                  rows={2}
                  maxLength={2000}
                  defaultValue={isEdit ? task?.blocker_reason ?? "" : ""}
                  className={`${textareaClass} border-red-200 dark:border-red-800/50`}
                  placeholder={t.fields.blockerReasonPlaceholder}
                  disabled={isPending}
                />
              </div>
            )}
            {statusValue !== "blocked" && (
              <input type="hidden" name="blocker_reason" value={isEdit ? task?.blocker_reason ?? "" : ""} />
            )}

            {/* ── Collapsible: Assignment & prerequisites ── */}
            <FormSection
              icon={<Users className="h-4 w-4 text-brand-500" />}
              label={tp.sectionPlanning}
              open={showPlanning}
              onToggle={() => setShowPlanning(!showPlanning)}
              badge={
                (assigneeValue ? 1 : 0) +
                selectedPredecessors.size +
                (isEdit ? preselectedMaterials.size : 0) +
                newMaterials.length
              }
            >
              {options === null ? (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Assigned to */}
                  <div className="space-y-1.5">
                    <label htmlFor="task-assignee" className="block text-xs font-medium text-muted-foreground">
                      {tp.assignee}
                    </label>
                    <select
                      id="task-assignee"
                      name="assigned_to"
                      value={assigneeValue}
                      onChange={(e) => {
                        if (e.target.value === ADD_PERSON_VALUE) {
                          setAddingPerson(true);
                        } else {
                          setAssigneeValue(e.target.value);
                        }
                      }}
                      className={inputClass}
                      disabled={isPending}
                    >
                      <option value="">{tp.assigneeNone}</option>
                      {options.people.length > 0 && (
                        <optgroup label={tp.assigneeUsers}>
                          {options.people.map((p) => (
                            <option key={p.id} value={`user:${p.id}`}>{p.name}</option>
                          ))}
                        </optgroup>
                      )}
                      {options.resources.length > 0 && (
                        <optgroup label={tp.assigneeResources}>
                          {options.resources.map((r) => (
                            <option key={r.id} value={`resource:${r.id}`}>
                              {r.name} ({tp.personTypes[r.resource_type] ?? r.resource_type})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <option value={ADD_PERSON_VALUE}>{tp.addPerson}</option>
                    </select>

                    {/* Inline quick-add person/crew */}
                    {addingPerson && (
                      <div className="space-y-2 rounded-lg border border-brand-200 bg-brand-50/50 p-2.5 dark:border-brand-800/50 dark:bg-brand-950/20">
                        <input
                          type="text"
                          value={newPersonName}
                          onChange={(e) => setNewPersonName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddPerson();
                            }
                          }}
                          maxLength={200}
                          autoFocus
                          className={inputClass}
                          placeholder={tp.addPersonPlaceholder}
                          disabled={creatingPerson}
                        />
                        <div className="flex items-center gap-2">
                          <select
                            value={newPersonType}
                            onChange={(e) => setNewPersonType(e.target.value)}
                            className={inputClass}
                            disabled={creatingPerson}
                          >
                            {Object.entries(tp.personTypes).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={handleAddPerson}
                            disabled={creatingPerson || !newPersonName.trim()}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {creatingPerson ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            {tp.addPersonConfirm}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setAddingPerson(false); setNewPersonName(""); }}
                            disabled={creatingPerson}
                            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Predecessor tasks (with milestone + finish-date filters) */}
                  {(() => {
                    const candidates = options.tasks.filter((tk) => tk.id !== task?.id);
                    if (candidates.length === 0) {
                      return (
                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-muted-foreground">{tp.predecessors}</label>
                          <p className="text-xs text-muted-foreground">{tp.predecessorsEmpty}</p>
                        </div>
                      );
                    }
                    const milestoneName = (id: string | null) =>
                      id ? milestones.find((m) => m.id === id)?.title ?? tp.noMilestone : tp.noMilestone;
                    const search = predSearch.trim().toLowerCase();
                    const filtered = candidates
                      .filter((tk) => {
                        if (predMilestoneFilter && (tk.milestone_id ?? "__none__") !== predMilestoneFilter) return false;
                        if (predFinishBefore) {
                          // keep tasks that finish on/before the date; tasks with no
                          // finish date stay visible so they're never hidden silently
                          if (tk.end_date && tk.end_date > predFinishBefore) return false;
                        }
                        if (search && !tk.title.toLowerCase().includes(search)) return false;
                        return true;
                      })
                      .sort((a, b) => {
                        // chronological: by finish date, then by board order
                        const da = a.end_date ?? "";
                        const db = b.end_date ?? "";
                        if (da && db && da !== db) return da < db ? -1 : 1;
                        if (da && !db) return -1;
                        if (!da && db) return 1;
                        return a.order_index - b.order_index;
                      });
                    // Milestones that actually have candidate tasks
                    const usedMilestoneIds = new Set(candidates.map((tk) => tk.milestone_id));
                    return (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-medium text-muted-foreground">{tp.predecessors}</label>
                          {selectedPredecessors.size > 0 && (
                            <span className="text-xs text-brand-600 dark:text-brand-400">
                              {tp.selectedCount(selectedPredecessors.size)}
                            </span>
                          )}
                        </div>

                        {/* Filters */}
                        <div className="flex flex-wrap gap-2">
                          <select
                            value={predMilestoneFilter}
                            onChange={(e) => setPredMilestoneFilter(e.target.value)}
                            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-brand-500 focus:outline-none"
                            disabled={isPending}
                            aria-label={tp.filterByMilestone}
                          >
                            <option value="">{tp.allMilestones}</option>
                            {milestones
                              .filter((m) => usedMilestoneIds.has(m.id))
                              .map((m) => (
                                <option key={m.id} value={m.id}>{m.title}</option>
                              ))}
                            {usedMilestoneIds.has(null) && <option value="__none__">{tp.noMilestone}</option>}
                          </select>
                          <input
                            type="date"
                            value={predFinishBefore}
                            onChange={(e) => setPredFinishBefore(e.target.value)}
                            className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-brand-500 focus:outline-none"
                            disabled={isPending}
                            title={tp.finishesBefore}
                            aria-label={tp.finishesBefore}
                          />
                        </div>
                        <input
                          type="text"
                          value={predSearch}
                          onChange={(e) => setPredSearch(e.target.value)}
                          placeholder={tp.predecessorSearch}
                          className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-brand-500 focus:outline-none"
                          disabled={isPending}
                        />

                        {/* List */}
                        <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-lg border border-border p-2">
                          {filtered.length === 0 ? (
                            <p className="px-1 py-2 text-xs text-muted-foreground">{tp.predecessorsNoMatch}</p>
                          ) : (
                            filtered.map((tk) => (
                              <label key={tk.id} className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-sm text-foreground hover:bg-muted/50">
                                <input
                                  type="checkbox"
                                  checked={selectedPredecessors.has(tk.id)}
                                  onChange={() => togglePredecessor(tk.id)}
                                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-brand-600"
                                  disabled={isPending}
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate">{tk.title}</span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {milestoneName(tk.milestone_id)}
                                    {tk.end_date ? ` · ${tk.end_date}` : ""}
                                  </span>
                                </span>
                              </label>
                            ))
                          )}
                        </div>
                        {/* Hidden inputs keep selections that are currently filtered out */}
                        {[...selectedPredecessors]
                          .filter((id) => !filtered.some((tk) => tk.id === id))
                          .map((id) => (
                            <input key={id} type="hidden" name="predecessor_ids" value={id} />
                          ))}
                      </div>
                    );
                  })()}

                  {/* Required materials */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-muted-foreground">
                      <Package className="mr-1 inline h-3 w-3" />
                      {tp.requiredMaterials}
                    </label>
                    {options.materials.length === 0 && newMaterials.length === 0 && (
                      <p className="text-xs text-muted-foreground">{tp.materialsEmpty}</p>
                    )}
                    {options.materials.length > 0 && (
                      <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                        {options.materials.map((m) => (
                          <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm text-foreground hover:bg-muted/50">
                            <input
                              type="checkbox"
                              name="material_ids"
                              value={m.id}
                              defaultChecked={preselectedMaterials.has(m.id)}
                              className="h-4 w-4 rounded border-border accent-brand-600"
                              disabled={isPending}
                            />
                            <span className="truncate">{m.name}</span>
                            <span className="ml-auto shrink-0 text-xs text-muted-foreground">{m.status.replace(/_/g, " ")}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {/* Quick-add new materials */}
                    {newMaterials.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {newMaterials.map((name) => (
                          <span key={name} className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                            {name}
                            <button
                              type="button"
                              onClick={() => setNewMaterials(newMaterials.filter((n) => n !== name))}
                              className="hover:text-brand-900 dark:hover:text-brand-200"
                              disabled={isPending}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={materialDraft}
                        onChange={(e) => setMaterialDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addMaterialDraft();
                          }
                        }}
                        maxLength={200}
                        className={inputClass}
                        placeholder={tp.addMaterialPlaceholder}
                        disabled={isPending}
                      />
                      <button
                        type="button"
                        onClick={addMaterialDraft}
                        disabled={isPending || !materialDraft.trim()}
                        className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </FormSection>

            {/* ── Collapsible: Details ── */}
            <FormSection
              icon={<ClipboardList className="h-4 w-4 text-blue-500" />}
              label={t.fields.sectionDetails ?? "Details"}
              open={showDetails}
              onToggle={() => setShowDetails(!showDetails)}
              badge={detailsBadge}
            >
              {/* Sprint + Estimated hours (side by side) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="task-sprint" className="block text-xs font-medium text-muted-foreground">
                    {t.fields.sprintName}
                  </label>
                  <input
                    id="task-sprint"
                    name="sprint_name"
                    type="text"
                    maxLength={100}
                    defaultValue={isEdit ? task?.sprint_name ?? "" : ""}
                    className={inputClass}
                    placeholder={t.fields.sprintNamePlaceholder}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="task-estimate" className="block text-xs font-medium text-muted-foreground">
                    {t.fields.estimateHours}
                  </label>
                  <input
                    id="task-estimate"
                    name="estimate_hours"
                    type="number"
                    step="0.5"
                    min="0"
                    max="9999.99"
                    defaultValue={isEdit ? task?.estimate_hours ?? "" : ""}
                    className={inputClass}
                    placeholder={t.fields.estimateHoursPlaceholder}
                    disabled={isPending}
                  />
                </div>
              </div>

              {/* Acceptance criteria */}
              <div className="space-y-1.5">
                <label htmlFor="task-acceptance" className="block text-xs font-medium text-muted-foreground">
                  {t.fields.acceptanceCriteria}
                </label>
                <textarea
                  id="task-acceptance"
                  name="acceptance_criteria"
                  rows={2}
                  maxLength={2000}
                  defaultValue={isEdit ? task?.acceptance_criteria ?? "" : ""}
                  className={textareaClass}
                  placeholder={t.fields.acceptanceCriteriaPlaceholder}
                  disabled={isPending}
                />
              </div>

              {/* Dependency notes */}
              <div className="space-y-1.5">
                <label htmlFor="task-dependencies" className="block text-xs font-medium text-muted-foreground">
                  {t.fields.dependencyNotes}
                </label>
                <textarea
                  id="task-dependencies"
                  name="dependency_notes"
                  rows={2}
                  maxLength={2000}
                  defaultValue={isEdit ? task?.dependency_notes ?? "" : ""}
                  className={textareaClass}
                  placeholder={t.fields.dependencyNotesPlaceholder}
                  disabled={isPending}
                />
              </div>
            </FormSection>

            {/* ── Collapsible: Tracking & Notes ── */}
            <FormSection
              icon={<FileText className="h-4 w-4 text-emerald-500" />}
              label={t.fields.sectionTracking ?? "Tracking & Notes"}
              open={showTracking}
              onToggle={() => setShowTracking(!showTracking)}
              badge={trackingBadge}
            >
              {/* Scheduling: Start + End date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="task-start-date" className="block text-xs font-medium text-muted-foreground">
                    <Calendar className="mr-1 inline h-3 w-3" />
                    {t.fields.startDate}
                  </label>
                  <input
                    id="task-start-date"
                    name="start_date"
                    type="date"
                    defaultValue={isEdit ? task?.start_date ?? "" : ""}
                    className={inputClass}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="task-end-date" className="block text-xs font-medium text-muted-foreground">
                    <Calendar className="mr-1 inline h-3 w-3" />
                    {t.fields.endDate}
                  </label>
                  <input
                    id="task-end-date"
                    name="end_date"
                    type="date"
                    defaultValue={isEdit ? task?.end_date ?? "" : ""}
                    className={inputClass}
                    disabled={isPending}
                  />
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-1.5">
                <label htmlFor="task-progress" className="block text-xs font-medium text-muted-foreground">
                  {t.fields.progress}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="task-progress"
                    name="progress"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={progressValue}
                    onChange={(e) => setProgressValue(Number(e.target.value))}
                    className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-brand-600"
                    disabled={isPending}
                  />
                  <span className="w-12 text-right text-sm font-medium text-muted-foreground">
                    {progressValue}%
                  </span>
                </div>
              </div>

              {/* Execution notes */}
              <div className="space-y-1.5">
                <label htmlFor="task-execution-notes" className="block text-xs font-medium text-muted-foreground">
                  {t.fields.executionNotes}
                </label>
                <textarea
                  id="task-execution-notes"
                  name="execution_notes"
                  rows={2}
                  maxLength={5000}
                  defaultValue={isEdit ? task?.execution_notes ?? "" : ""}
                  className={textareaClass}
                  placeholder={t.fields.executionNotesPlaceholder}
                  disabled={isPending}
                />
              </div>
            </FormSection>

            {/* ── Collapsible: AI Prompt ── */}
            <FormSection
              icon={<Sparkles className="h-4 w-4 text-purple-500" />}
              label={t.fields.promptSection}
              open={showPrompt}
              onToggle={() => setShowPrompt(!showPrompt)}
            >
              {/* Prompt body */}
              <div className="space-y-1.5">
                <label htmlFor="task-prompt-body" className="block text-xs font-medium text-muted-foreground">
                  {t.fields.promptBody}
                </label>
                <textarea
                  id="task-prompt-body"
                  name="prompt_body"
                  rows={4}
                  maxLength={10000}
                  defaultValue={isEdit ? (task as RoadmapTask | undefined)?.prompt_body ?? "" : ""}
                  className={`${textareaClass} font-mono`}
                  placeholder={t.fields.promptBodyPlaceholder}
                  disabled={isPending}
                />
              </div>

              {/* Prompt context + AI tool (side by side) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="task-prompt-context" className="block text-xs font-medium text-muted-foreground">
                    {t.fields.promptContext}
                  </label>
                  <input
                    id="task-prompt-context"
                    name="prompt_context"
                    type="text"
                    maxLength={2000}
                    defaultValue={isEdit ? (task as RoadmapTask | undefined)?.prompt_context ?? "" : ""}
                    className={inputClass}
                    placeholder={t.fields.promptContextPlaceholder}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="task-ai-tool" className="block text-xs font-medium text-muted-foreground">
                    {t.fields.aiToolTarget}
                  </label>
                  <select
                    id="task-ai-tool"
                    name="ai_tool_target"
                    defaultValue={isEdit ? (task as RoadmapTask | undefined)?.ai_tool_target ?? "" : ""}
                    className={inputClass}
                    disabled={isPending}
                  >
                    <option value="">—</option>
                    <option value="claude">Claude</option>
                    <option value="codex">Codex</option>
                    <option value="cursor">Cursor</option>
                    <option value="copilot">GitHub Copilot</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Implementation + Test notes (side by side) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="task-implementation-notes" className="block text-xs font-medium text-muted-foreground">
                    {t.fields.implementationNotes}
                  </label>
                  <textarea
                    id="task-implementation-notes"
                    name="implementation_notes"
                    rows={2}
                    maxLength={5000}
                    defaultValue={isEdit ? (task as RoadmapTask | undefined)?.implementation_notes ?? "" : ""}
                    className={textareaClass}
                    placeholder={t.fields.implementationNotesPlaceholder}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="task-test-notes" className="block text-xs font-medium text-muted-foreground">
                    {t.fields.testNotes}
                  </label>
                  <textarea
                    id="task-test-notes"
                    name="test_notes"
                    rows={2}
                    maxLength={5000}
                    defaultValue={isEdit ? (task as RoadmapTask | undefined)?.test_notes ?? "" : ""}
                    className={textareaClass}
                    placeholder={t.fields.testNotesPlaceholder}
                    disabled={isPending}
                  />
                </div>
              </div>
            </FormSection>
          </div>

          {/* Actions — fixed footer */}
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? (isEdit ? t.saving : t.creating) : t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
