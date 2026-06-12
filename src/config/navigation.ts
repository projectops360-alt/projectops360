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
  DraftingCompass,
  BarChart3,
  Users,
  Settings,
  UploadCloud,
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

export const sidebarNav: NavItem[] = [
  { title: "commandCenter", href: "/", icon: LayoutDashboard },
  { title: "projects", href: "/projects", icon: FolderKanban },
  { title: "importProject", href: "/import", icon: UploadCloud },
  { title: "executionMap", href: "/projects/[projectId]/execution-map", icon: Map, projectScoped: true },
  { title: "workboard", href: "/projects/[projectId]/workboard", icon: Columns3, projectScoped: true },
  { title: "projectMemory", href: "/projects/[projectId]/memory", icon: BookOpen, projectScoped: true },
  { title: "aiOperator", href: "/ai-operator", icon: Bot },
  { title: "drawingIntelligence", href: "/drawing-intelligence", icon: DraftingCompass },
  { title: "reports", href: "/reports", icon: BarChart3 },
  { title: "team", href: "/team", icon: Users },
];

export const bottomNav: NavItem[] = [
  { title: "settings", href: "/settings", icon: Settings },
];