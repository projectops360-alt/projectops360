"use client";

import { Bell } from "lucide-react";
import { UserMenu } from "@/components/layout/user-menu";
import { GlobalSearch } from "@/components/layout/global-search";
import { ProjectOpsNavigatorButton } from "@/components/navigator/ProjectOpsNavigatorButton";
import type { OrgData, UserData } from "@/components/layout/app-shell";
import type { Locale } from "@/types/database";
import { getI18nValue } from "@/types/database";
import { useLocale } from "next-intl";

interface HeaderProps {
  user?: UserData;
  org?: OrgData;
}

export function Header({ user, org }: HeaderProps) {
  const locale = useLocale() as Locale;
  const orgName = org ? getI18nValue(org.name, locale, org.slug) : null;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
      {/* ── Left: Org name ── */}
      <div className="flex items-center gap-4">
        {orgName && (
          <span className="text-sm font-medium text-foreground">
            {orgName}
          </span>
        )}
        {/* ── Global PMO search ── */}
        <GlobalSearch />
      </div>

      {/* ── Right actions ── */}
      <div className="flex items-center gap-4">
        {/* ── Navigator guided help ── */}
        <ProjectOpsNavigatorButton />

        <button
          type="button"
          className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-500" />
        </button>

        {/* ── User menu or placeholder ── */}
        {user ? (
          <UserMenu
            displayName={user.displayName}
            email={user.email}
            orgName={orgName}
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
            PO
          </div>
        )}
      </div>
    </header>
  );
}