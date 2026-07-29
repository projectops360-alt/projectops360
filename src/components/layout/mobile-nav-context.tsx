"use client";

import { createContext, useContext } from "react";

export interface MobileNavState {
  /** Is the mobile navigation drawer currently open? */
  open: boolean;
  openMobileNav: () => void;
  closeMobileNav: () => void;
}

/**
 * Lets the global header drive the sidebar drawer without either component
 * owning the state — `AppFrame` owns it, since it also owns the collapse
 * preference and the scroll lock.
 *
 * Defaults are no-ops so the header can render outside the shell (tests,
 * storybook-style previews) without blowing up.
 */
export const MobileNavContext = createContext<MobileNavState>({
  open: false,
  openMobileNav: () => {},
  closeMobileNav: () => {},
});

export function useMobileNav(): MobileNavState {
  return useContext(MobileNavContext);
}
