// src/components/layout/super-admin-sidebar.tsx
"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  BarChart2,
  Building2,
  CreditCard,
  FileBarChart2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SIDEBAR_DRAWER_ID, useSidebar } from "./sidebar-context";
import { cn } from "@/lib/utils";
import logo from "../../../public/logo.svg";

const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
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
                "flex min-h-11 items-center gap-3 rounded-[6px] border text-sm transition-colors duration-[120ms]",
                FOCUS_RING,
                expanded ? "px-2" : "justify-center px-0",
                active
                  ? "border-border bg-card font-semibold text-foreground shadow-etiqueta"
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
              <span className={cn("truncate", !expanded && "sr-only")}>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function SuperAdminSidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { open, mobileOpen, setMobileOpen } = useSidebar();

  const NAV: NavItem[] = [
    { href: `/${locale}/estadisticas`, label: t("dashboard"), icon: BarChart2 },
    { href: `/${locale}/empresas`, label: t("companies"), icon: Building2 },
    { href: `/${locale}/usuarios`, label: t("users"), icon: Users },
    { href: `/${locale}/suscripciones`, label: t("subscriptions"), icon: CreditCard },
    { href: `/${locale}/reportes`, label: t("reports"), icon: FileBarChart2 },
  ];

  const brand = (expanded: boolean) => (
    <div className="flex min-w-0 items-center gap-2.5">
      <Image src={logo} alt="" width={32} height={32} unoptimized className="size-8 shrink-0" />
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
