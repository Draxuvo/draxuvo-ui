// src/components/people/employees-tab.tsx
// Pestaña "Empleados" de Personal (spec 029): antes era la página /empleados.
"use client";
import { Suspense, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { EmployeeForm } from "@/components/employees/employee-form";
import { EmployeeDeleteDialog } from "@/components/employees/employee-delete-dialog";
import { getEmployeeColumns } from "@/components/employees/columns";
import { employeesService } from "@/services/employees";
import { useAuthStore } from "@/store/auth";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { cn } from "@/lib/utils";
import { EMPLOYEE_STATUSES, type Employee, type EmployeeStatus } from "@/types";
import { ModuleLocked, useModuleGate } from "@/components/subscription/module-locked";
import { FilterNotice } from "@/components/filters/filter-notice";
import { SearchInput } from "@/components/filters/search-input";

const PAGE_SIZE = 10;
const DEFAULTS = { status: "", search: "", access: "" };
const ALLOWED = { status: EMPLOYEE_STATUSES, access: ["with", "without"] as const };
const ACCESS_ROLES = new Set(["admin", "owner"]);
// "tab" es de la página Personal: limpiar los filtros no debe cambiar de pestaña.
const PRESERVE = ["tab"] as const;

const CHIP =
  "inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors duration-[120ms] ease-etiqueta foco-etiqueta";
const CHIP_ON = "border-foreground bg-foreground text-background";
const CHIP_OFF = "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground";

export function EmployeesTab() {
  return (
    <Suspense>
      <EmpleadosContent />
    </Suspense>
  );
}

function EmpleadosContent() {
  const t = useTranslations("employees");
  const tRoles = useTranslations("adminUsers.roles");
  const role = useAuthStore((s) => s.role);
  const showAccess = !!role && ACCESS_ROLES.has(role);
  const tc = useTranslations("common");
  const tf = useTranslations("common.filters");
  const { filters, page, setFilter, setPage, reset, isFiltered } = useUrlFilters(DEFAULTS, {
    allowed: ALLOWED,
    preserve: PRESERVE,
  });

  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);

  const toggleStatusMutation = useMutation({
    mutationFn: (emp: Employee) => employeesService.toggleStatus(emp.id, emp.status),
    onSuccess: (updated) => {
      toast.success(updated.status === "active" ? t("activateSuccess") : t("deactivateSuccess"));
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: () => toast.error(t("toggleError")),
  });

  // Puerta del módulo antes de consultar: fuera del plan no hay request ni toast.
  const gate = useModuleGate("employees");
  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["employees", filters, page],
    enabled: gate.enabled,
    queryFn: () =>
      employeesService.list({
        page,
        page_size: PAGE_SIZE,
        status: (filters.status || undefined) as EmployeeStatus | undefined,
        search: filters.search || undefined,
        access: showAccess ? ((filters.access || undefined) as "with" | "without" | undefined) : undefined,
      }),
  });

  const employees: Employee[] = data?.results ?? [];

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  const columns = useMemo(
    () =>
      getEmployeeColumns(t, tc, {
        onEdit: (emp) => { setEditing(emp); setFormOpen(true); },
        onDelete: (emp) => setDeleting(emp),
        onToggleStatus: (emp) => toggleStatusMutation.mutate(emp),
        showAccess,
        accessLabel: (emp) => (emp.access ? tRoles(emp.access.role) : t("access.none")),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showAccess],
  );

  if (gate.isLocked(error)) return <ModuleLocked module="employees" />;

  const statusOptions = [
    { value: "", label: t("filters.all") },
    { value: "active", label: t("filters.active") },
    { value: "inactive", label: t("filters.inactive") },
  ];
  const applied = [
    filters.status && `${t("filters.status")}: ${t(`filters.${filters.status as EmployeeStatus}`)}`,
    filters.access && `${t("access.column")}: ${t(`access.filter.${filters.access as "with" | "without"}`)}`,
    filters.search && `"${filters.search}"`,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {isFiltered
              ? tf("results", { count: data?.info?.total ?? 0 })
              : t("subtitle", { count: data?.info?.total ?? 0 })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label={tc("refresh")}
          >
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus size={15} />
            {t("new")}
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={filters.search}
          onSearch={(value) => setFilter("search", value)}
          placeholder={t("searchPlaceholder")}
        />
        <div role="group" aria-label={t("filters.status")} className="flex flex-wrap gap-2">
          {statusOptions.map((o) => (
            <button
              key={o.value || "all"}
              type="button"
              aria-pressed={filters.status === o.value}
              onClick={() => setFilter("status", o.value || null)}
              className={cn(CHIP, filters.status === o.value ? CHIP_ON : CHIP_OFF)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {showAccess && (
        <div role="group" aria-label={t("access.column")} className="flex flex-wrap gap-2">
          {[
            { value: "", label: t("access.filter.all") },
            { value: "with", label: t("access.filter.with") },
            { value: "without", label: t("access.filter.without") },
          ].map((o) => (
            <button
              key={o.value || "all"}
              type="button"
              aria-pressed={filters.access === o.value}
              onClick={() => setFilter("access", o.value || null)}
              className={cn(CHIP, filters.access === o.value ? CHIP_ON : CHIP_OFF)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {isFiltered && <FilterNotice applied={applied} onClear={reset} />}

      {/* Table */}
      <DataTable
        columns={columns}
        data={employees}
        pageSize={PAGE_SIZE}
        isLoading={isLoading}
        loadingMessage={tc("loading")}
        emptyMessage={isFiltered ? tf("noResults") : t("empty")}
      />

      {/* Pagination */}
      {data?.info && data.info.total > 0 && (
        <Pagination info={data.info} onPageChange={setPage} />
      )}

      {/* Form Sheet */}
      <EmployeeForm
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={editing}
      />

      {/* Delete Dialog */}
      <EmployeeDeleteDialog
        employee={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </div>
  );
}
