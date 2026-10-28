// src/components/alerts/alert-bell.tsx — campana del encabezado con el conteo de alertas activas (spec 045, FR-007).
"use client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { useAlerts, useCanSeeAlerts } from "@/hooks/use-alerts";
import { cn } from "@/lib/utils";

/** Solo dueño y administrador (y el super admin dentro de una empresa) la ven; el resto no monta nada. */
export function AlertBell({ className }: { className?: string }) {
  const allowed = useCanSeeAlerts();
  if (!allowed) return null;
  return <BellLink className={className} />;
}

function BellLink({ className }: { className?: string }) {
  const t = useTranslations("alerts.bell");
  const locale = useLocale();
  const { data } = useAlerts();
  const count = data?.count ?? 0;

  return (
    <Link
      href={`/${locale}/alertas`}
      aria-label={count > 0 ? t("labelCount", { count }) : t("label")}
      className={cn(
        "foco-etiqueta relative flex size-11 shrink-0 items-center justify-center rounded-etiqueta text-muted-foreground transition-colors duration-[120ms] hover:bg-card hover:text-foreground",
        className,
      )}
    >
      <Bell size={20} strokeWidth={1.75} aria-hidden="true" />
      {count > 0 && (
        <span
          data-testid="alert-count"
          className="absolute right-1 top-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold leading-5 text-primary-foreground"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
