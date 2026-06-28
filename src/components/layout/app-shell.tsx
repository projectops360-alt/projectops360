import { AppFrame } from "@/components/layout/app-frame";
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
  /** Server-computed: may the current user see the Product Brain Control Center? */
  canViewProductBrain?: boolean;
}

export function AppShell({ children, user, org, canViewProductBrain = false }: AppShellProps) {
  return (
    <AppFrame header={<Header user={user} org={org} />} role={org?.role} canViewProductBrain={canViewProductBrain}>
      {children}
    </AppFrame>
  );
}