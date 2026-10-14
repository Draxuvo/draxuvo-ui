// src/components/admin-users/columns.tsx
"use client";
import { type ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AdminUser } from "@/types";

interface UserActions {
  onEdit: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
  onToggleActive: (user: AdminUser) => void;
}

export function getAdminUserColumns(
  t: (key: string) => string,
  tc: (key: string) => string,
  actions: UserActions,
): ColumnDef<AdminUser, unknown>[] {
  return [
    {
      id: "full_name",
      header: t("name"),
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground">
            {row.original.first_name} {row.original.last_name}
          </p>
          <p className="text-xs text-muted-foreground">{row.original.email}</p>
        </div>
      ),
    },
    {
      accessorKey: "role",
      header: t("role"),
      cell: ({ row }) => (
        <Badge variant="outline">{t(`roles.${row.original.role}`)}</Badge>
      ),
    },
    {
      id: "company",
      header: t("company"),
      cell: ({ row }) => {
        const companies = row.original.companies;
        if (!companies || companies.length === 0) {
          return <span className="text-muted-foreground italic text-sm">{t("noCompany")}</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {companies.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {c.name}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "active",
      header: t("status"),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={row.original.active}
            onCheckedChange={() => actions.onToggleActive(row.original)}
          />
          <span className={`text-xs ${row.original.active ? "text-foreground" : "text-muted-foreground"}`}>
            {row.original.active ? t("active") : t("inactive")}
          </span>
        </div>
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
                  onClick={() => actions.onEdit(row.original)}
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
                  onClick={() => actions.onDelete(row.original)}
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
