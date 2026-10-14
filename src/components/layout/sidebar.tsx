// src/components/layout/sidebar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Package,
  Building2,
  ClipboardList,
  Receipt,
  Home,
  BarChart2,
  FileBarChart2,
  CreditCard,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { getSubscription } from "@/services/subscription";
import type { ModuleKey } from "@/types";
import { useSidebar } from "./sidebar-context";
import { cn } from "@/lib/utils";

const ANALYTICS_ROLES = new Set(["admin", "owner", "manager"]);
const REPORTS_ROLES = new Set(["admin", "owner"]);
const SUBSCRIPTION_ROLES = new Set(["admin", "owner"]);

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tSub = useTranslations("subscription");
  const locale = useLocale();
  const { user, selectedCompanyId } = useAuthStore();
  const { open } = useSidebar();

  const showAnalytics = !!user && ANALYTICS_ROLES.has(user.role);
  const showReports = !!user && REPORTS_ROLES.has(user.role);
  const showSubscription = !!user && SUBSCRIPTION_ROLES.has(user.role);

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

  const NAV = [
    {
      href: `/${locale}/inicio`,
      label: t("home"),
      icon: Home,
    },
    ...(showAnalytics
      ? [
          {
            href: `/${locale}/dashboard`,
            label: t("dashboard"),
            icon: BarChart2,
          },
        ]
      : []),
    ...(hasModule("employees")
      ? [{ href: `/${locale}/empleados`, label: t("employees"), icon: Users }]
      : []),
    ...(hasModule("inventory")
      ? [{ href: `/${locale}/inventario`, label: t("inventory"), icon: Package }]
      : []),
    ...(hasModule("work_orders")
      ? [
          {
            href: `/${locale}/ordenes`,
            label: t("orders"),
            icon: ClipboardList,
          },
        ]
      : []),
    ...(hasModule("tickets")
      ? [
          {
            href: `/${locale}/tickets`,
            label: t("tickets"),
            icon: Receipt,
          },
        ]
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

  return (
    <aside
      className={cn(
        "min-h-screen border-r border-zinc-200 bg-white flex flex-col shrink-0 transition-all duration-200",
        open ? "w-56" : "w-14",
      )}
    >
      <div
        className={cn(
          "h-14 border-b border-zinc-100 flex items-center shrink-0",
          open ? "px-5" : "justify-center",
        )}
      >
        <Building2 size={18} className="text-zinc-500 shrink-0" />
        {open && (
          <span className="ml-2 font-medium text-sm text-zinc-800 truncate">
            {user?.companies?.[0]?.name ?? ""}
          </span>
        )}
      </div>

      <nav className={cn("flex-1 py-4 space-y-0.5", open ? "px-3" : "px-2")}>
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            title={!open ? label : undefined}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
              !open && "justify-center px-2",
              pathname === href
                ? "bg-zinc-100 text-zinc-900 font-medium"
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800",
            )}
          >
            <Icon size={16} className="shrink-0" />
            {open && label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
