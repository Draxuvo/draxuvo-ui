// src/components/companies/columns.tsx
"use client";
import { type ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2, ExternalLink } from "lucide-react";
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
  t: (key: string) => string,
  tc: (key: string) => string,
  actions: CompanyActions,
): ColumnDef<CompanyRow, unknown>[] {
  return [
    {
      id: "name",
      header: t("name"),
      cell: ({ row }) => (
        <span className="font-medium text-zinc-800">
          {row.original.company.name}
        </span>
      ),
    },
    {
      id: "plan",
      header: t("plan"),
      cell: ({ row }) => {
        const plan = row.original.subscription?.plan;
        if (!plan) return <span className="text-zinc-400">—</span>;
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
            <span className="text-xs text-zinc-400 animate-pulse">
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
            className: "bg-green-100 text-green-800 border-green-200",
          },
          expiring_soon: {
            label: t("subExpiringSoon"),
            className: "bg-amber-100 text-amber-800 border-amber-200",
          },
          trial: {
            label: t("subTrial"),
            className: "bg-blue-100 text-blue-800 border-blue-200",
          },
          expired: {
            label: t("subExpired"),
            className: "bg-red-100 text-red-800 border-red-200",
          },
          cancelled: {
            label: t("subCancelled"),
            className: "bg-zinc-100 text-zinc-600 border-zinc-200",
          },
          none: {
            label: t("subNone"),
            className: "bg-red-100 text-red-800 border-red-200",
          },
        };

        const { label, className } = BADGE_CONFIG[status];

        return (
          <div className="flex items-center gap-2">
            <Badge className={cn("text-xs", className)}>{label}</Badge>
            {isExpiredOrNone && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-zinc-500 hover:text-zinc-900 gap-1"
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
      id: "users_count",
      header: t("users"),
      cell: ({ row }) => (
        <span className="text-zinc-500">
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
                  className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-800"
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
                  className="h-8 w-8 p-0 text-zinc-400 hover:text-red-600"
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
