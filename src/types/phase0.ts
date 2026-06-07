export type TaskStatus = "pending" | "in_progress" | "done" | "blocked";

export type Phase0Task = {
  /** Unique WBS identifier, e.g. "0.1", "0.2.1" */
  id: string;
  /** i18n key for the task title, e.g. "tasks.0_1.title" */
  titleKey: string;
  /** i18n key for the task goal */
  goalKey: string;
  /** Default status before user overrides */
  defaultStatus: TaskStatus;
  /** Time estimate, e.g. "30 min" */
  estimate: string;
  /** IDs of tasks that must be completed first */
  dependencies: string[];
  /** i18n keys for acceptance criteria, e.g. ["tasks.0_1.criteria.0"] */
  criteriaKeys: string[];
  /** i18n key for the AI prompt */
  promptKey: string;
};

export type Phase0Progress = {
  /** User overrides for task statuses */
  taskStatuses: Record<string, TaskStatus>;
  /** User notes per task */
  taskNotes: Record<string, string>;
  /** ISO timestamp of last save */
  lastSaved: string;
};