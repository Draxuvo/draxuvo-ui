// src/app/[locale]/(dashboard)/empleados/page.tsx
"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { EmployeeForm } from "@/components/employees/employee-form";
import { EmployeeDeleteDialog } from "@/components/employees/employee-delete-dialog";
import { getEmployeeColumns } from "@/components/employees/columns";
import { employeesService } from "@/services/employees";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { cn } from "@/lib/utils";
import { EMPLOYEE_STATUSES, type Employee, type EmployeeStatus } from "@/types";
import { ModuleLocked, useModuleLocked } from "@/components/subscription/module-locked";

const PAGE_SIZE = 10;
const DEFAULTS = { status: "", search: "" };
const ALLOWED = { status: EMPLOYEE_STATUSES };

const CHIP =
  "inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors duration-[120ms] ease-etiqueta outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const CHIP_ON = "border-foreground bg-foreground text-background";
const CHIP_OFF = "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground";

export default function EmpleadosPage() {
  return (
    <Suspense>
      <EmpleadosContent />
    </Suspense>
  );
}

function EmpleadosContent() {
  const t = useTranslations("employees");
  const tc = useTranslations("common");
  const tf = useTranslations("common.filters");
  const { filters, page, setFilter, setPage, reset, isFiltered } = useUrlFilters(DEFAULTS, {
    allowed: ALLOWED,
  });

  // Caja de búsqueda: borrador local que escribe `search` en la URL con debounce de 400 ms
  // y se resincroniza cuando la URL cambia desde fuera (por ejemplo "Limpiar filtros").
  const [draft, setDraft] = useState(filters.search);
  const [synced, setSynced] = useState(filters.search);
  if (synced !== filters.search) {
    setSynced(filters.search);
    if (draft.trim() !== filters.search) setDraft(filters.search);
  }
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);
  function handleSearch(value: string) {
    setDraft(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setFilter("search", value), 400);
  }

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

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["employees", filters, page],
    queryFn: () =>
      employeesService.list({
        page,
        page_size: PAGE_SIZE,
        status: (filters.status || undefined) as EmployeeStatus | undefined,
        search: filters.search || undefined,
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
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const locked = useModuleLocked("employees", error);
  if (locked) return <ModuleLocked module="employees" />;

  const statusOptions = [
    { value: "", label: t("filters.all") },
    { value: "active", label: t("filters.active") },
    { value: "inactive", label: t("filters.inactive") },
  ];
  const applied = [
    filters.status && `${t("filters.status")}: ${t(`filters.${filters.status as EmployeeStatus}`)}`,
    filters.search && `"${filters.search}"`,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
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
        <div className="relative w-full sm:max-w-sm">
          <Search size={14} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="bg-card pl-8"
            type="search"
            aria-label={tc("search")}
            placeholder={t("searchPlaceholder")}
            value={draft}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
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

      {isFiltered && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] bg-card px-3 py-2 text-sm shadow-etiqueta"
        >
          <span className="rounded-full bg-ceja px-2 py-0.5 font-medium text-foreground">
            {tf("applied", { filters: applied.join(" · ") })}
          </span>
          <button
            type="button"
            onClick={reset}
            className="rounded-[6px] px-1 font-medium text-foreground underline decoration-border underline-offset-4 outline-none transition-colors duration-[120ms] hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-foreground"
          >
            {tf("clear")}
          </button>
        </div>
      )}

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
