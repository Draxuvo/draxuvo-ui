"use client";
import { createContext, useCallback, useContext, useState } from "react";

/** Same breakpoint as Tailwind `md` and `useIsMobile`. */
const MOBILE_QUERY = "(max-width: 767px)";

/** id of the off-canvas drawer, for `aria-controls` on the header toggle. */
export const SIDEBAR_DRAWER_ID = "app-sidebar-drawer";

interface SidebarContextValue {
  /** Desktop rail expanded (md and up). */
  open: boolean;
  /** Mobile drawer open (below md). */
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  /**
   * Header toggle: below md it opens/closes the drawer, from md up it
   * expands/collapses the rail.
   */
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggle = useCallback(() => {
    if (window.matchMedia(MOBILE_QUERY).matches) setMobileOpen((v) => !v);
    else setOpen((v) => !v);
  }, []);

  return (
    <SidebarContext value={{ open, mobileOpen, setMobileOpen, toggle }}>
      {children}
    </SidebarContext>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside SidebarProvider");
  return ctx;
}
