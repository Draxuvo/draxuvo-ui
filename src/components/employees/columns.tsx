// src/components/employees/columns.tsx
"use client";
import { type ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Employee } from "@/types";

interface EmployeeActions {
  /** Muestra la columna de acceso (solo administrador y dueño, spec 036). */
  showAccess?: boolean;
  accessLabel?: (employee: Employee) => string;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onToggleStatus: (employee: Employee) => void;
}

export function getEmployeeColumns(
  t: (key: string) => string,
  tc: (key: string) => string,
  actions: EmployeeActions,
): ColumnDef<Employee, unknown>[] {
  return [
    {
      accessorKey: "name",
      header: t("name"),
      cell: ({ row }) => (
        <span className="font-medium text-foreground">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "email",
      header: t("email"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.email ?? "—"}</span>
      ),
    },
    {
      accessorKey: "phone",
      header: t("phone"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.phone ?? "—"}</span>
      ),
    },
    {
      accessorKey: "position",
      header: t("position"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.position ?? "—"}</span>
      ),
    },
    ...(actions.showAccess
      ? [
          {
            id: "access",
            header: t("access.column"),
            cell: ({ row }: { row: { original: Employee } }) => (
              <span className={row.original.access ? "text-foreground" : "text-muted-foreground"}>
                {actions.accessLabel?.(row.original)}
              </span>
            ),
          } as ColumnDef<Employee, unknown>,
        ]
      : []),
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={row.original.status === "active"}
            onCheckedChange={() => actions.onToggleStatus(row.original)}
          />
          <span
            className={`text-xs ${row.original.status === "active" ? "text-foreground" : "text-muted-foreground"}`}
          >
            {row.original.status === "active" ? t("active") : t("inactive")}
          </span>
        </div>
      ),
    },
    {
      id: "actions",
      header: () => <span className="flex justify-end">{t("actions")}</span>,
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
