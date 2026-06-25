/**
 * ProjectOps360° — Navigation Constants
 */

import {
  LayoutDashboard,
  FolderKanban,
  Map,
  Columns3,
  BookOpen,
  Bot,
  BarChart3,
  Users,
  Settings,
  CreditCard,
  Briefcase,
  ListChecks,
} from "lucide-react";

/** Coarse navigation audience derived from the enforced org role. */
export type NavGroup = "pmo" | "pm" | "member";

export type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  /** If true, this item is only shown when the user is inside a project context */
  projectScoped?: boolean;
  /** Which audiences see this item. Omitted = everyone. */
  show?: NavGroup[];
  /** Child navigation items (e.g. project sub-pages) */
  children?: NavItem[];
};

/** Map the enforced org role to its navigation audience group. */
export function navGroupForRole(orgRole: string | null | undefined, isPmoLevel: boolean): NavGroup {
  if (isPmoLevel || orgRole === "COMPANY_OWNER" || orgRole === "PMO_ADMIN" || orgRole === "PORTFOLIO_MANAGER") return "pmo";
  if (orgRole === "PROJECT_MANAGER") return "pm";
  return "member";
}

export const sidebarNav: NavItem[] = [
  { title: "commandCenter", href: "/", icon: LayoutDashboard, show: ["pmo"] },
  { title: "pmCenter", href: "/pm", icon: Briefcase, show: ["pm"] },
  { title: "myWork", href: "/my-work", icon: ListChecks, show: ["member"] },
  { title: "projects", href: "/projects", icon: FolderKanban },
  { title: "executionMap", href: "/projects/[projectId]/execution-map", icon: Map, projectScoped: true },
  { title: "workboard", href: "/projects/[projectId]/workboard", icon: Columns3, projectScoped: true },
  { title: "projectMemory", href: "/projects/[projectId]/memory", icon: BookOpen, projectScoped: true },
  // Import Project and BIM live inside the AI Operator hub (see /ai-operator).
  { title: "aiOperator", href: "/ai-operator", icon: Bot, show: ["pmo", "pm"] },
  { title: "reports", href: "/reports", icon: BarChart3, show: ["pmo", "pm"] },
  { title: "team", href: "/team", icon: Users, show: ["pmo", "pm"] },
];

export const bottomNav: NavItem[] = [
  { title: "billing", href: "/organization/billing", icon: CreditCard, show: ["pmo"] },
  { title: "settings", href: "/settings", icon: Settings },
];

/** Filter a nav list down to the items visible to a given audience group. */
export function navForGroup(items: NavItem[], group: NavGroup): NavItem[] {
  return items.filter((i) => !i.show || i.show.includes(group));
}
