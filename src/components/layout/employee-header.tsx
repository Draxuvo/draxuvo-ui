// src/components/layout/employee-header.tsx
"use client";
import { useTranslations } from "next-intl";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { AttendanceButton } from "@/components/attendance/attendance-button";
import { useLogoutFlow } from "@/components/attendance/logout-dialog";
import { Logo } from "@/components/brand/logo";
import { CompanySwitcher } from "./company-switcher";
import { LocaleSwitcher } from "./locale-switcher";
import { SIDEBAR_DRAWER_ID, useSidebar } from "./sidebar-context";
import { cn } from "@/lib/utils";

const ICON_BUTTON =
  "foco-etiqueta flex size-11 shrink-0 items-center justify-center rounded-etiqueta text-muted-foreground transition-colors duration-[120ms] hover:bg-card hover:text-foreground";

export function EmployeeHeader() {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const { user } = useAuthStore();
  const { requestLogout, dialog: logoutDialog } = useLogoutFlow();
  const multiCompany = (user?.companies?.length ?? 0) > 1;
  const { open, mobileOpen, toggle } = useSidebar();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-2 sm:px-4">
      {/* Celular: abre el cajón del menú */}
      <button
        type="button"
        onClick={toggle}
        aria-controls={SIDEBAR_DRAWER_ID}
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
        className={cn(ICON_BUTTON, "md:hidden")}
      >
        <Menu size={20} strokeWidth={1.75} aria-hidden />
      </button>

      {/* Escritorio: contrae o expande el riel */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? t("collapseMenu") : t("expandMenu")}
        className={cn(ICON_BUTTON, "hidden md:flex")}
      >
        {open ? (
          <PanelLeftClose size={20} strokeWidth={1.75} aria-hidden />
        ) : (
          <PanelLeftOpen size={20} strokeWidth={1.75} aria-hidden />
        )}
      </button>

      {/* Marca en celular, donde el riel no se ve; con varias empresas manda el selector. */}
      <span className={cn("flex min-w-0 items-center gap-2 md:hidden", multiCompany && "hidden")}>
        <Logo className="size-7" />
        <span className="font-display text-base font-extrabold uppercase tracking-[0.01em] text-foreground">
          {tc("brandName")}
        </span>
      </span>

      <CompanySwitcher className="min-w-0 md:ml-1" />

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
        <span className="hidden max-w-48 truncate text-sm font-semibold text-foreground lg:block">
          {user?.first_name} {user?.last_name}
        </span>
        <AttendanceButton />
        <LocaleSwitcher />
        <button
          type="button"
          onClick={requestLogout}
          aria-label={t("logout")}
          className={cn(ICON_BUTTON, "sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:font-medium")}
        >
          <LogOut size={18} strokeWidth={1.75} aria-hidden />
          <span className="hidden sm:inline">{t("logout")}</span>
        </button>
      </div>
      {logoutDialog}
    </header>
  );
}
