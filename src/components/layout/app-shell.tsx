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
}

export function AppShell({ children, user, org }: AppShellProps) {
  return (
    <AppFrame header={<Header user={user} org={org} />} role={org?.role}>
      {children}
    </AppFrame>
  );
}