import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import type { I18nField } from "@/types/database";

export interface OrgData {
  id: string;
  name: I18nField;
  slug: string;
  role: string;
}

export interface UserData {
  displayName: string | null;
  email: string;
  avatarUrl?: string | null;
}

export interface AppShellProps {
  children: React.ReactNode;
  user?: UserData;
  org?: OrgData;
}

export function AppShell({ children, user, org }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-64">
        <Header user={user} org={org} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}