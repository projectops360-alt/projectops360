"use client";

import { Bell, Menu } from "lucide-react";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { GlobalSearch } from "@/components/layout/global-search";
import { useMobileNav } from "@/components/layout/mobile-nav-context";
import { ProjectOpsNavigatorButton } from "@/components/navigator/ProjectOpsNavigatorButton";
import type { OrgData, UserData } from "@/components/layout/app-shell";
import type { Locale } from "@/types/database";
import { getI18nValue } from "@/types/database";
import { HEADER_PADDING_CLASS } from "@/lib/layout/responsive";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";

interface HeaderProps {
  user?: UserData;
  org?: OrgData;
}

export function Header({ user, org }: HeaderProps) {
  const locale = useLocale() as Locale;
  const tNav = useTranslations("nav");
  const { openMobileNav } = useMobileNav();
  const orgName = org ? getI18nValue(org.name, locale, org.slug) : null;

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-16 min-w-0 items-center justify-between gap-2 border-b border-border bg-background/80 backdrop-blur-md",
        HEADER_PADDING_CLASS,
      )}
    >
      {/* ── Left: menu trigger + org name ── */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        {/* Hamburger — opens the nav drawer. Hidden once the sidebar docks. */}
        <button
          type="button"
          onClick={openMobileNav}
          aria-label={tNav("openMenu")}
          className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {orgName && (
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            {orgName}
          </span>
        )}
        {/* ── Global PMO search ── */}
        <GlobalSearch />
      </div>

      {/* ── Right actions ── */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-4">
        {/* ── Quick light/dark toggle ── */}
        <ThemeToggle />

        {/* Secondary on a phone: the guided-help launcher is one tap away from
            the drawer, so it yields its space to the primary actions. */}
        <span className="hidden sm:inline-flex">
          <ProjectOpsNavigatorButton />
        </span>

        <button
          type="button"
          className="relative hidden rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:block"
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
