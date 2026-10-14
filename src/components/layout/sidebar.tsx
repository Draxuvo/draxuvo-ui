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
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { getSubscription } from "@/services/subscription";
import type { ModuleKey } from "@/types";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SIDEBAR_DRAWER_ID, useSidebar } from "./sidebar-context";
import { cn } from "@/lib/utils";

const ANALYTICS_ROLES = new Set(["admin", "owner", "manager"]);
const ATTENDANCE_ROLES = new Set(["admin", "owner", "manager"]);
const REPORTS_ROLES = new Set(["admin", "owner"]);
const SUBSCRIPTION_ROLES = new Set(["admin", "owner"]);

/** DESIGN.md: the one label shadow ("etiqueta pegada"). */
const LABEL_SHADOW =
  "shadow-[0_1px_0_rgba(20,20,20,.08),0_2px_6px_rgba(20,20,20,.06)]";

const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Price tag with a punched notch on the left and a "D": the panel's brand mark. */
function BrandMark() {
  const notch =
    "radial-gradient(circle at 0 50%, transparent 3px, #000 3.5px)";
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-[6px] bg-primary pl-0.5 font-display text-lg font-extrabold leading-none text-primary-foreground"
      style={{ WebkitMaskImage: notch, maskImage: notch }}
    >
      D
    </span>
  );
}

function NavList({
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
                "group flex min-h-11 items-center gap-3 rounded-[6px] border text-sm transition-colors duration-[120ms]",
                FOCUS_RING,
                expanded ? "px-2" : "justify-center px-0",
                active
                  ? cn(
                      "border-border bg-card font-semibold text-foreground",
                      LABEL_SHADOW,
                    )
                  : "border-transparent font-medium text-muted-foreground hover:border-border hover:bg-card hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-[6px] transition-colors duration-[120ms]",
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
  const { user, selectedCompanyId } = useAuthStore();
  const { open, mobileOpen, setMobileOpen } = useSidebar();

  const role = user?.role;
  const showAnalytics = !!role && ANALYTICS_ROLES.has(role);
  const showAttendance = !!role && ATTENDANCE_ROLES.has(role);
  const showReports = !!role && REPORTS_ROLES.has(role);
  const showSubscription = !!role && SUBSCRIPTION_ROLES.has(role);

  const { data: subscription } = useQuery({
    queryKey: ["subscription", selectedCompanyId],
    queryFn: getSubscription,
    retry: false,
    enabled: !!user && user.role !== "super_admin" && !!selectedCompanyId,
  });

  // Mientras carga (o si falla) se muestra el menú por rol, sin filtrar módulos.
  const activeModules = subscription?.active_modules;
  const hasModule = (module: ModuleKey) =>
    !activeModules || activeModules.includes(module);

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
    ...(hasModule("tickets")
      ? [{ href: `/${locale}/tickets`, label: t("tickets"), icon: Receipt }]
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
      <BrandMark />
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
                "flex size-11 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground transition-colors duration-[120ms] hover:bg-card hover:text-foreground",
                FOCUS_RING,
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
