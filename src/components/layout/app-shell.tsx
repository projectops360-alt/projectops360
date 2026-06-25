import { AppFrame } from "@/components/layout/app-frame";
import type { I18nField } from "@/types/database";

export interface OrgData {
  id: string;
  name: I18nField;
  slug: string;
  role: string;
  /** Enforced org role (COMPANY_OWNER … VIEWER) — drives role-based navigation. */
  orgRole?: string;
  /** TRUE when the role is PMO/portfolio-level. */
  isPmoLevel?: boolean;
  /** All orgs the user belongs to (for the org switcher). */
  organizations?: { id: string; name: I18nField; slug: string }[];
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
    <AppFrame user={user} org={org}>
      {children}
    </AppFrame>
  );
}