// src/components/layout/header.tsx
"use client";
import { useAuthStore } from "@/store/auth";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LocaleSwitcher } from "./locale-switcher";
import { CompanySwitcher } from "./company-switcher";
import { SIDEBAR_DRAWER_ID, useSidebar } from "./sidebar-context";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, UserRound } from "lucide-react";
import { useAppRouter } from "@/hooks/use-router";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";

const ICON_BUTTON =
  "foco-etiqueta flex size-11 shrink-0 items-center justify-center rounded-etiqueta text-muted-foreground transition-colors duration-[120ms] hover:bg-card hover:text-foreground";

function getInitials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

export function Header() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const { user, logout, role } = useAuthStore();
  // Con varias empresas el selector ocupa el lugar de la marca en celular.
  const multiCompany = role !== "super_admin" && (user?.companies?.length ?? 0) > 1;
  const { open, mobileOpen, toggle } = useSidebar();
  const router = useAppRouter();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-2 sm:px-4">
      {/* Celular: abre el drawer del menú */}
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

      {/* Marca en celular, donde el riel no se ve */}
      <span className={cn("flex min-w-0 items-center gap-2 md:hidden", multiCompany && "hidden")}>
        <Logo className="size-7" />
        <span className="font-display text-base font-extrabold uppercase tracking-[0.01em] text-foreground">
          {tCommon("brandName")}
        </span>
      </span>

      <CompanySwitcher className="md:ml-1" />

      <div className="ml-auto flex items-center gap-1 sm:gap-3">
        <LocaleSwitcher />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "foco-etiqueta flex min-h-11 items-center gap-2.5 rounded-etiqueta px-1.5 transition-colors duration-[120ms] hover:bg-card sm:px-2",
              )}
            >
              <Avatar>
                <AvatarFallback className="bg-foreground font-display text-sm font-semibold text-background">
                  {getInitials(user?.first_name, user?.last_name)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-48 text-left sm:block">
                <span className="block truncate text-sm font-semibold leading-tight text-foreground">
                  {user?.first_name} {user?.last_name}
                </span>
                <span className="block truncate text-xs leading-tight text-muted-foreground">
                  {user?.email}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="gap-2" onClick={() => router.push("/perfil")}>
              <UserRound size={16} strokeWidth={1.75} aria-hidden />
              {t("profile")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={logout} className="gap-2">
              <LogOut size={16} strokeWidth={1.75} aria-hidden />
              {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
