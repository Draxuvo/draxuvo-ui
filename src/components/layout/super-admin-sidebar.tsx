// src/components/layout/super-admin-sidebar.tsx
"use client";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  BarChart2,
  Briefcase,
  Building2,
  CreditCard,
  FileBarChart2,
  Users,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SIDEBAR_DRAWER_ID, useSidebar } from "./sidebar-context";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { NavList, type NavItem } from "./sidebar";
import { companyViewTargets, useAuthStore } from "@/store/auth";

export function SuperAdminSidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { open, mobileOpen, setMobileOpen } = useSidebar();
  const user = useAuthStore((s) => s.user);
  const enterCompanyView = useAuthStore((s) => s.enterCompanyView);
  // Mi empresa (spec 029): solo si es administrador o dueño de alguna.
  const canEnterCompany = companyViewTargets(user).length > 0;

  const NAV: NavItem[] = [
    { href: `/${locale}/estadisticas`, label: t("dashboard"), icon: BarChart2 },
    { href: `/${locale}/empresas`, label: t("companies"), icon: Building2 },
    { href: `/${locale}/usuarios`, label: t("users"), icon: Users },
    { href: `/${locale}/suscripciones`, label: t("subscriptions"), icon: CreditCard },
    { href: `/${locale}/reportes`, label: t("reports"), icon: FileBarChart2 },
    ...(canEnterCompany
      ? [{ href: `/${locale}/inicio`, label: t("myCompany"), icon: Briefcase, onSelect: enterCompanyView }]
      : []),
  ];

  const brand = (expanded: boolean) => (
    <div className="flex min-w-0 items-center gap-2.5">
      <Logo />
      {expanded && (
        <div className="min-w-0 leading-tight">
          <p className="font-display text-base font-extrabold uppercase tracking-[0.01em] text-foreground">
            {tCommon("brandName")}
          </p>
          <p className="truncate text-xs text-muted-foreground">{t("superAdminRole")}</p>
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

      {/* Drawer en celular (debajo de md) */}
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
              className={cn(
                "foco-etiqueta flex size-11 shrink-0 items-center justify-center rounded-etiqueta text-muted-foreground transition-colors duration-[120ms] hover:bg-card hover:text-foreground",
              )}
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
