"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { sidebarNav, bottomNav, type NavItem } from "@/config/navigation";
import { Logo } from "@/components/shared/logo";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { Settings, Globe } from "lucide-react";

function NavButton({ item, active }: { item: NavItem; active: boolean }) {
  const t = useTranslations("nav");
  const titleKey = item.title.toLowerCase() as Parameters<typeof t>[0];
  const displayTitle = t(titleKey);

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-active/10 text-sidebar-active"
          : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
      )}
    >
      <item.icon className="h-5 w-5 shrink-0" />
      <span>{displayTitle}</span>
      {item.badge && (
        <span className="ml-auto rounded-full bg-sidebar-active px-2 py-0.5 text-xs text-white">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-sidebar-bg text-sidebar-text">
      {/* ── Logo ── */}
      <div className="flex h-16 items-center gap-3 border-b border-white/5 px-6">
        <Logo />
      </div>

      {/* ── Main nav ── */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {sidebarNav.map((item) => (
          <NavButton
            key={item.href}
            item={item}
            active={pathname.startsWith(item.href)}
          />
        ))}
      </nav>

      {/* ── Bottom nav ── */}
      <div className="border-t border-white/5 px-3 py-4 space-y-3">
        {/* ── Language switcher ── */}
        <div className="px-3">
          <LanguageSwitcher />
        </div>

        <div className="space-y-1">
          <NavButton
            item={{ title: "Language", href: "/locale", icon: Globe }}
            active={pathname === "/locale"}
          />
          <NavButton
            item={{ title: "Settings", href: "/settings", icon: Settings }}
            active={pathname === "/settings"}
          />
        </div>
      </div>
    </aside>
  );
}