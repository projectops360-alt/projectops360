"use client";

import { useState, useRef, useEffect, useId } from "react";
import { useTranslations } from "next-intl";
import { logoutAction } from "@/app/[locale]/(auth)/actions";
import { LogOut } from "lucide-react";

interface UserMenuProps {
  displayName: string | null;
  email: string;
  orgName?: string | null;
}

export function UserMenu({ displayName, email, orgName }: UserMenuProps) {
  const t = useTranslations("auth.userMenu");
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // Close menu on Escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [open]);

  const initials = (displayName || email).slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
      >
        {initials}
      </button>

      {open && (
        <div
          id={menuId}
          className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-lg"
        >
          {/* ── Organization ── */}
          {orgName && (
            <div className="border-b border-border px-3 py-2 mb-1">
              <p className="text-xs text-muted-foreground">{orgName}</p>
            </div>
          )}

          {/* ── User info ── */}
          <div className="border-b border-border px-3 py-2 mb-1">
            <p className="text-sm font-medium text-foreground">
              {displayName || email}
            </p>
            {displayName && (
              <p className="text-xs text-muted-foreground">{email}</p>
            )}
          </div>

          {/* ── Sign out ── */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
              {t("signOut")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}