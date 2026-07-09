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
  Brain,
  ShieldCheck,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  /** If true, this item is only shown when the user is inside a project context */
  projectScoped?: boolean;
  /** Child navigation items (e.g. project sub-pages) */
  children?: NavItem[];
};

/**
 * Which server-computed access flag gates an internal nav item. Sidebar shows
 * the item only when the matching flag is true. Hiding is UX-only — every
 * gated route + its server actions enforce access server-side.
 */
export type InternalGate = "productBrain" | "adminConsole";

export const sidebarNav: NavItem[] = [
  { title: "commandCenter", href: "/", icon: LayoutDashboard },
  { title: "projects", href: "/projects", icon: FolderKanban },
  { title: "executionMap", href: "/projects/[projectId]/execution-map", icon: Map, projectScoped: true },
  { title: "workboard", href: "/projects/[projectId]/workboard", icon: Columns3, projectScoped: true },
  { title: "projectMemory", href: "/projects/[projectId]/memory", icon: BookOpen, projectScoped: true },
  // Import Project and BIM live inside the AI Operator hub (see /ai-operator).
  { title: "aiOperator", href: "/ai-operator", icon: Bot },
  { title: "reports", href: "/reports", icon: BarChart3 },
  { title: "team", href: "/team", icon: Users },
];

export const bottomNav: NavItem[] = [
  { title: "billing", href: "/organization/billing", icon: CreditCard },
  { title: "settings", href: "/settings", icon: Settings },
];

/**
 * Internal, access-gated navigation. Each item carries a `gate` naming the
 * server-computed flag that controls its visibility (Sidebar). The route
 * itself also enforces access server-side; hiding here is UX only. The
 * allowlists / flags never reach the client.
 */
export const internalNav: (NavItem & { gate: InternalGate })[] = [
  { title: "productIntelligence", href: "/product-intelligence", icon: Brain, gate: "productBrain" },
  { title: "adminConsole", href: "/admin", icon: ShieldCheck, gate: "adminConsole" },
];