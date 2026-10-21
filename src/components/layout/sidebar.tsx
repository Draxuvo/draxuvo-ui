"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Package,
  ClipboardList,
  Receipt,
  Home,
  BarChart2,
  FileBarChart2,
  CreditCard,
  CalendarCheck,
  UsersRound,
  UtensilsCrossed,
  ConciergeBell,
  Building2,
  Landmark,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useScreenMode } from "@/components/take-order/use-screen-mode";
import { getSubscription } from "@/services/subscription";
import type { ModuleKey } from "@/types";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SIDEBAR_DRAWER_ID, useSidebar } from "./sidebar-context";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const ANALYTICS_ROLES = new Set(["admin", "owner", "manager"]);
const ATTENDANCE_ROLES = new Set(["admin", "owner", "manager"]);
const REPORTS_ROLES = new Set(["admin", "owner"]);
const RESTAURANT_ROLES = new Set(["admin", "owner", "manager"]);
const SUBSCRIPTION_ROLES = new Set(["admin", "owner"]);
const TEAM_ROLES = new Set(["admin", "owner"]);

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Lista de navegación del panel; también la usa el menú del personal (EmployeeSidebar). */
export function NavList({
  items,
  pathname,
  expanded,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  expanded: boolean;
  onNavigate?: () => void;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={expanded ? undefined : label}
              className={cn(
                "group foco-etiqueta flex min-h-11 items-center gap-3 rounded-etiqueta border text-sm transition-colors duration-[120ms] ease-etiqueta",
                expanded ? "px-2" : "justify-center px-0",
                active
                  ? "border-border bg-card font-semibold text-foreground shadow-etiqueta"
                  : "border-transparent font-medium text-muted-foreground hover:border-border hover:bg-card hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-etiqueta transition-colors duration-[120ms]",
                  active && "bg-primary text-primary-foreground",
                )}
              >
                <Icon size={20} strokeWidth={1.75} aria-hidden />
              </span>
              <span className={cn("truncate", !expanded && "sr-only")}>
                {label}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tSub = useTranslations("subscription");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { user, selectedCompanyId, role } = useAuthStore();
  const { open, mobileOpen, setMobileOpen } = useSidebar();

  const takeOrder = useScreenMode();
  const showAnalytics = !!role && ANALYTICS_ROLES.has(role);
  const showAttendance = !!role && ATTENDANCE_ROLES.has(role);
  const showReports = !!role && REPORTS_ROLES.has(role);
  const showRestaurant = !!role && RESTAURANT_ROLES.has(role);
  const showSubscription = !!role && SUBSCRIPTION_ROLES.has(role);
  const showTeam = !!role && TEAM_ROLES.has(role);

  const { data: subscription } = useQuery({
    queryKey: ["subscription", selectedCompanyId],
    queryFn: getSubscription,
    retry: false,
    enabled: !!user && role !== "super_admin" && !!selectedCompanyId,
  });

  // Mientras carga (o si falla) se muestra el menú por rol, sin filtrar módulos.
  const activeModules = subscription?.active_modules;
  const hasModule = (module: ModuleKey) =>
    !activeModules || activeModules.includes(module);
  // "Mis empresas" solo cuando el plan confirma `multi_company` (no mientras carga).
  const showMyCompanies =
    role === "owner" && !!activeModules?.includes("multi_company");

  const NAV: NavItem[] = [
    { href: `/${locale}/inicio`, label: t("home"), icon: Home },
    ...(showAnalytics
      ? [{ href: `/${locale}/dashboard`, label: t("dashboard"), icon: BarChart2 }]
      : []),
    ...(hasModule("employees")
      ? [{ href: `/${locale}/empleados`, label: t("employees"), icon: Users }]
      : []),
    ...(showAttendance && hasModule("attendance")
      ? [
          {
            href: `/${locale}/asistencia`,
            label: t("attendance"),
            icon: CalendarCheck,
          },
        ]
      : []),
    ...(hasModule("inventory")
      ? [{ href: `/${locale}/inventario`, label: t("inventory"), icon: Package }]
      : []),
    ...(hasModule("work_orders")
      ? [{ href: `/${locale}/ordenes`, label: t("orders"), icon: ClipboardList }]
      : []),
    // Tomar pedido (spec 018): con restaurante en el plan, o con la empresa en modo pedido.
    ...(takeOrder.ready && takeOrder.mode !== "none"
      ? [{ href: `/${locale}/pedido`, label: t("takeOrder"), icon: ConciergeBell }]
      : []),
    ...(hasModule("tickets")
      ? [{ href: `/${locale}/tickets`, label: t("tickets"), icon: Receipt }]
      : []),
    ...(showRestaurant && hasModule("restaurant")
      ? [{ href: `/${locale}/restaurante`, label: t("restaurant"), icon: UtensilsCrossed }]
      : []),
    ...(showReports && hasModule("reports")
      ? [
          {
            href: `/${locale}/reportes`,
            label: t("reports"),
            icon: FileBarChart2,
          },
        ]
      : []),
    ...(showTeam
      ? [{ href: `/${locale}/equipo`, label: t("team"), icon: UsersRound }]
      : []),
    // Terminales de cobro (spec 015): las administran admin y dueño, igual que el equipo.
    ...(showTeam
      ? [{ href: `/${locale}/terminales`, label: t("terminals"), icon: Landmark }]
      : []),
    ...(showMyCompanies
      ? [{ href: `/${locale}/mis-empresas`, label: t("myCompanies"), icon: Building2 }]
      : []),
    ...(showSubscription
      ? [
          {
            href: `/${locale}/suscripcion`,
            label: tSub("nav"),
            icon: CreditCard,
          },
        ]
      : []),
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
            {tCommon("brandName")}
          </p>
          {companyName && (
            <p className="truncate text-xs text-muted-foreground">
              {companyName}
            </p>
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
