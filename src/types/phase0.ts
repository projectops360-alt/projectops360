export type TaskStatus = "pending" | "in_progress" | "done" | "blocked";

export type TaskPriority = "P1" | "P2" | "P3";

export type Phase0Task = {
  /** WBS identifier, e.g. "0.1" */
  id: string;
  /** Category group */
  category: string;
  /** Short title */
  title: string;
  /** What this step accomplishes */
  goal: string;
  /** Current default status */
  defaultStatus: TaskStatus;
  /** Priority level */
  priority: TaskPriority;
  /** Time estimate in hours */
  estimateHours: number;
  /** Sprint assignment */
  sprint: string;
  /** IDs of tasks that must be done first */
  dependencies: string[];
  /** Measurable completion criteria */
  acceptanceCriteria: string[];
  /** Copyable prompt for AI-assisted execution */
  prompt: string;
  /** Deliverable name */
  deliverable: string;
  /** Whether this needs manual QA/verification */
  needsVerification: boolean;
};

export type Phase0Progress = {
  /** User overrides for task statuses */
  taskStatuses: Record<string, TaskStatus>;
  /** User notes per task */
  taskNotes: Record<string, string>;
  /** ISO timestamp of last save */
  lastSaved: string;
};