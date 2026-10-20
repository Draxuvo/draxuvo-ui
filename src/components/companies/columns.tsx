// src/components/companies/columns.tsx
"use client";
import { type ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2, ExternalLink, CheckCircle2, Clock, CircleDot, XCircle, Ban, Blocks } from "lucide-react";
import { differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Company, Subscription } from "@/types";

export type CompanyRow = {
  company: Company;
  subscription: Subscription | null;
  isLoadingSub: boolean;
};

interface CompanyActions {
  onEdit: (company: Company) => void;
  onDelete: (company: Company) => void;
  onViewSubscription: () => void;
  /** Abre los módulos de la empresa (spec 017): solo el super admin los cambia. */
  onModules: (row: CompanyRow) => void;
}

type DisplaySubStatus =
  | "active"
  | "expiring_soon"
  | "trial"
  | "expired"
  | "cancelled"
  | "none";

function getSubStatus(sub: Subscription | null): DisplaySubStatus {
  if (!sub) return "none";
  const isTrial = sub.status === "trialing";
  const raw = sub.current_period_end ?? sub.trial_ends_at;
  const daysLeft = raw ? differenceInDays(new Date(raw), new Date()) : null;
  if (
    sub.status === "expired" ||
    (isTrial && daysLeft !== null && daysLeft <= 0)
  )
    return "expired";
  if (sub.status === "cancelled") return "cancelled";
  if (isTrial) return "trial";
  if (sub.status === "active" && daysLeft !== null && daysLeft <= 7)
    return "expiring_soon";
  if (sub.status === "active") return "active";
  return "none";
}

export function getCompanyColumns(
  t: (key: string, values?: Record<string, string | number>) => string,
  tc: (key: string) => string,
  actions: CompanyActions,
): ColumnDef<CompanyRow, unknown>[] {
  return [
    {
      id: "name",
      header: t("name"),
      cell: ({ row }) => (
        <span className="font-medium text-foreground">
          {row.original.company.name}
        </span>
      ),
    },
    {
      id: "plan",
      header: t("plan"),
      cell: ({ row }) => {
        const plan = row.original.subscription?.plan;
        if (!plan) return <span className="text-muted-foreground">—</span>;
        const variant =
          plan === "enterprise"
            ? "default"
            : plan === "pro"
              ? "secondary"
              : "outline";
        return <Badge variant={variant}>{t(`plans.${plan}`)}</Badge>;
      },
    },
    {
      id: "subscription",
      header: t("subscription"),
      cell: ({ row }) => {
        const { subscription, isLoadingSub } = row.original;
        if (isLoadingSub)
          return (
            <span className="text-xs text-muted-foreground animate-pulse">
              {t("subLoading")}
            </span>
          );

        const status = getSubStatus(subscription);
        const isExpiredOrNone = status === "expired" || status === "none";

        const BADGE_CONFIG: Record<
          DisplaySubStatus,
          { label: string; className: string }
        > = {
          active: {
            label: t("subActive"),
            className: "bg-estado-completada text-estado-completada-foreground border-estado-completada-border",
          },
          expiring_soon: {
            label: t("subExpiringSoon"),
            className: "bg-estado-pendiente text-estado-pendiente-foreground border-estado-pendiente-border",
          },
          trial: {
            label: t("subTrial"),
            className: "bg-estado-progreso text-estado-progreso-foreground border-estado-progreso-border",
          },
          expired: {
            label: t("subExpired"),
            className: "bg-destructive/10 text-destructive border-destructive/30",
          },
          cancelled: {
            label: t("subCancelled"),
            className: "bg-muted text-muted-foreground border-border",
          },
          none: {
            label: t("subNone"),
            className: "bg-destructive/10 text-destructive border-destructive/30",
          },
        };

        const BADGE_ICON = {
          active: CheckCircle2,
          expiring_soon: Clock,
          trial: CircleDot,
          expired: XCircle,
          cancelled: Ban,
          none: XCircle,
        } as const;
        const { label, className } = BADGE_CONFIG[status];
        const BadgeIcon = BADGE_ICON[status];

        return (
          <div className="flex items-center gap-2">
            <Badge className={cn("text-xs gap-1", className)}>
              <BadgeIcon size={11} aria-hidden="true" />
              {label}
            </Badge>
            {isExpiredOrNone && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                onClick={actions.onViewSubscription}
              >
                <ExternalLink size={11} />
                {t("viewSubscription")}
              </Button>
            )}
          </div>
        );
      },
    },
    {
      id: "modules",
      header: t("modules.column"),
      cell: ({ row }) => {
        const { subscription, isLoadingSub } = row.original;
        if (isLoadingSub) return <span className="text-xs text-muted-foreground animate-pulse">{t("subLoading")}</span>;
        if (!subscription) return <span className="text-muted-foreground">—</span>;
        const total = subscription.available_modules.length;
        const active = subscription.active_modules.length;
        return (
          <span className="tabular-nums text-foreground" title={t("modules.summary", { active, total })}>
            {active}/{total}
          </span>
        );
      },
    },
    {
      id: "users_count",
      header: t("users"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.company.users_count ?? 0}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="flex justify-end">{tc("actions")}</span>,
      cell: ({ row }) => (
        <TooltipProvider>
          <div className="flex items-center justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  aria-label={t("modules.open", { name: row.original.company.name })}
                  onClick={() => actions.onModules(row.original)}
                >
                  <Blocks size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("modules.title", { name: row.original.company.name })}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => actions.onEdit(row.original.company)}
                >
                  <Pencil size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{tc("edit")}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => actions.onDelete(row.original.company)}
                >
                  <Trash2 size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{tc("delete")}</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      ),
    },
  ];
}
