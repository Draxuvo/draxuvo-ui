// src/components/layout/employee-sidebar.tsx
"use client";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { ClipboardList, Receipt, User, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/logo";
import { useAuthStore } from "@/store/auth";
import { NavList, type NavItem } from "./sidebar";
import { SIDEBAR_DRAWER_ID, useSidebar } from "./sidebar-context";
import { cn } from "@/lib/utils";

export function EmployeeSidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tw = useTranslations("workOrders");
  const tt = useTranslations("tickets");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { user, selectedCompanyId } = useAuthStore();
  const { open, mobileOpen, setMobileOpen } = useSidebar();

  const NAV: NavItem[] = [
    { href: `/${locale}/mis-ordenes`, label: tw("myOrders"), icon: ClipboardList },
    { href: `/${locale}/mis-tickets`, label: tt("myTickets"), icon: Receipt },
    { href: `/${locale}/mi-perfil`, label: t("profile"), icon: User },
  ];

  const companyName =
    user?.companies?.find((c) => c.id === selectedCompanyId)?.name ??
    user?.companies?.[0]?.name ??
    "";

  const brand = (expanded: boolean) => (
    <div className="flex min-w-0 items-center gap-2.5">
      <Logo />
      {expanded && (
        <div className="min-w-0 leading-tight">
          <p className="font-display text-base font-extrabold uppercase tracking-[0.01em] text-foreground">
            {tc("brandName")}
          </p>
          {companyName && (
            <p className="truncate text-xs text-muted-foreground">{companyName}</p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Riel de escritorio (md en adelante) */}
      <aside
        className={cn(
          "sticky top-0 hidden h-svh shrink-0 flex-col self-start border-r border-border bg-background text-foreground md:flex motion-safe:transition-[width] motion-safe:duration-200",
          open ? "w-60" : "w-16",
        )}
      >
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b border-border",
            open ? "px-4" : "justify-center",
          )}
        >
          {brand(open)}
        </div>
        <nav
          aria-label={t("mainNav")}
          className={cn("flex-1 overflow-y-auto py-4", open ? "px-3" : "px-2")}
        >
          <NavList items={NAV} pathname={pathname} expanded={open} />
        </nav>
      </aside>

      {/* Cajón en celular (debajo de md) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          id={SIDEBAR_DRAWER_ID}
          side="left"
          showCloseButton={false}
          aria-describedby={undefined}
          className="w-72 max-w-[85vw] gap-0 border-border bg-background p-0 text-foreground md:hidden"
        >
          <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
          <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border pl-4 pr-2">
            {brand(true)}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label={t("closeMenu")}
              className="foco-etiqueta flex size-11 shrink-0 items-center justify-center rounded-etiqueta text-muted-foreground transition-colors duration-[120ms] hover:bg-card hover:text-foreground"
            >
              <X size={20} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
          <nav aria-label={t("mainNav")} className="flex-1 overflow-y-auto p-3">
            <NavList
              items={NAV}
              pathname={pathname}
              expanded
              onNavigate={() => setMobileOpen(false)}
            />
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
