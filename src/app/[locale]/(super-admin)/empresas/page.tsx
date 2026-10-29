// src/app/[locale]/(super-admin)/empresas/page.tsx
"use client";
import { useRef, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Plus, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { CompanyForm } from "@/components/companies/company-form";
import { CompanyModulesSheet } from "@/components/companies/company-modules-sheet";
import { CompanyDeleteDialog } from "@/components/companies/company-delete-dialog";
import { getCompanyColumns, type CompanyRow } from "@/components/companies/columns";
import { companiesService } from "@/services/companies";
import { getCompanySubscription } from "@/services/subscription";
import { usePagination } from "@/hooks/use-pagination";
import { useAppRouter } from "@/hooks/use-router";
import type { Company } from "@/types";

const PAGE_SIZE = 10;

export default function EmpresasPage() {
  const t = useTranslations("companies");
  const tc = useTranslations("common");
  const router = useAppRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { page, goTo, reset } = usePagination();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState<Company | null>(null);
  const [modulesFor, setModulesFor] = useState<number | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["companies", page, PAGE_SIZE, debouncedSearch],
    queryFn: () => companiesService.list(page, debouncedSearch, PAGE_SIZE),
  });

  const companies: Company[] = data?.results ?? [];

  const subscriptionQueries = useQueries({
    queries: companies.map((company) => ({
      queryKey: ["company-subscription", company.id],
      queryFn: () => getCompanySubscription(company.id),
      retry: false,
      staleTime: 2 * 60 * 1000,
    })),
  });

  const rows: CompanyRow[] = useMemo(
    () =>
      companies.map((company, i) => ({
        company,
        subscription: subscriptionQueries[i]?.data ?? null,
        isLoadingSub: subscriptionQueries[i]?.isLoading ?? true,
      })),
    // `dataUpdatedAt` cambia con cada respuesta: así el resumen y la hoja de módulos se refrescan al guardar (spec 017).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companies, subscriptionQueries.map((q) => `${q.dataUpdatedAt}:${q.isLoading}`).join(",")],
  );

  function handleSearch(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      reset();
    }, 400);
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  const columns = useMemo(
    () =>
      getCompanyColumns(t, tc, {
        onEdit: (company) => {
          setEditing(company);
          setFormOpen(true);
        },
        onDelete: (company) => setDeleting(company),
        onViewSubscription: () => router.push("/suscripciones"),
        onModules: (row) => setModulesFor(row.company.id),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("subtitle", { count: data?.info?.total ?? 0 })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label={tc("refresh")} onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus size={15} />
            {t("new")}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          className="pl-8"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={rows}
        pageSize={PAGE_SIZE}
        isLoading={isLoading}
        loadingMessage={tc("loading")}
        emptyMessage={t("empty")}
      />

      {/* Pagination */}
      {data?.info && data.info.total > 0 && (
        <Pagination info={data.info} onPageChange={goTo} />
      )}

      {/* Form Sheet */}
      <CompanyForm
        open={formOpen}
        onOpenChange={setFormOpen}
        company={editing}
      />

      {/* Módulos de la empresa (spec 017): solo el super admin los cambia */}
      <CompanyModulesSheet
        company={rows.find((row) => row.company.id === modulesFor)?.company ?? null}
        subscription={rows.find((row) => row.company.id === modulesFor)?.subscription ?? null}
        onOpenChange={(open) => !open && setModulesFor(null)}
      />

      {/* Delete Dialog */}
      <CompanyDeleteDialog
        company={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </div>
  );
}
