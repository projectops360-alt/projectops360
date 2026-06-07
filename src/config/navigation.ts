/**
 * ProjectOps360° — Navigation Constants
 */

import { LayoutDashboard, FolderKanban, Users, BarChart3, Settings, Globe } from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

export const sidebarNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  { title: "Team", href: "/team", icon: Users },
  { title: "Reports", href: "/reports", icon: BarChart3 },
];

export const bottomNav: NavItem[] = [
  { title: "Language", href: "/locale", icon: Globe },
  { title: "Settings", href: "/settings", icon: Settings },
];