// ============================================================================
// ProjectOps360° — Admin Console DTOs (platform-wide, read-only aggregates)
// ============================================================================
// Server components / server actions compute these from the Supabase admin
// (service-role) client — cross-org aggregates that RLS would otherwise scope
// to the caller's org. They are ONLY produced after the platform-admin gate
// (access.server.ts) has passed. Nothing here is mock data.
// ============================================================================

import type { TaskStatus } from "@/types/database";

/** Top-of-page KPI summary. */
export interface AdminMetrics {
  totalCompanies: number;
  totalUsers: number;
  totalProjects: number;
  totalTasks: number;
  /** Active rows in admin_authorized_users (excludes the temporary fallback). */
  activeAdminUsers: number;
}

/** One company (organization) with rolled-up counts. */
export interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  userCount: number;
  projectCount: number;
  taskCount: number;
  createdAt: string | null;
}

/** A user belonging to a company, expandable under a CompanyRow. */
export interface CompanyUserRow {
  organizationId: string;
  userId: string;
  displayName: string | null;
  email: string | null;
  role: string | null;
  projectCount: number;
  assignedTaskCount: number;
  createdAt: string | null;
}

/** A project owned by a user (projects.created_by). */
export interface UserProjectRow {
  userId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  organizationId: string;
  organizationName: string;
  projectId: string;
  projectTitle: string;
  projectStatus: string | null;
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
  blockedTasks: number;
  updatedAt: string | null;
}

/** Per-project task-status aggregate (drives the Project Tasks overview). */
export interface ProjectTaskAggregate {
  projectId: string;
  projectTitle: string;
  organizationId: string;
  organizationName: string;
  ownerId: string | null;
  ownerName: string | null;
  totalTasks: number;
  /** Everything that is not done/deferred. */
  openTasks: number;
  completedTasks: number;
  blockedTasks: number;
  updatedAt: string | null;
}

/** A single task in the drill-down list (paginated, server-side filtered). */
export interface AdminTaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string | null;
  milestoneTitle: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  endDate: string | null;
  updatedAt: string | null;
}

/** Paginated drill-down result. */
export interface AdminTaskPage {
  rows: AdminTaskRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** Authorized admin row shown in the "Admin Access" section. */
export interface AuthorizedAdminRow {
  email: string;
  role: string | null;
  isActive: boolean;
  grantedAt: string | null;
}

/** Filters accepted by the task drill-down server action. */
export interface AdminTaskFilters {
  search?: string;
  status?: TaskStatus | "all";
  page?: number;
}