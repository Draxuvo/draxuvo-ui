// src/components/login-attempts/access-log.tsx — pantalla «Accesos» (spec 073): resumen, filtros en la URL y la lista
// paginada de intentos de inicio de sesión. Solo super admin.
"use client";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { useLoginAttempts } from "@/hooks/use-login-attempts";
import { filtersFromParams, updateParams } from "@/lib/login-attempts";
import { AccessFilters, type FilterChange } from "./access-filters";
import { AccessSummary } from "./access-summary";
import { AccessTable } from "./access-table";

export function AccessLog() {
  const t = useTranslations("accessLog");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(query)), [query]);
  const { data, isLoading, isError, refetch } = useLoginAttempts(filters);

  function navigate(changes: FilterChange | { page: number }) {
    const qs = updateParams(new URLSearchParams(query), changes);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="space-y-4">
      <AccessSummary onFilter={navigate} />
      <AccessFilters filters={filters} onChange={navigate} />

      {isLoading && <Skeleton className="h-64 w-full" aria-busy="true" />}

      {isError && (
        <div role="alert" className="rounded-etiqueta border border-border bg-card p-6 text-center">
          <p className="text-sm font-medium text-foreground">{t("error")}</p>
          <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => refetch()}>
            {t("retry")}
          </Button>
        </div>
      )}

      {data && data.results.length === 0 && (
        <div className="rounded-etiqueta border border-border bg-card p-6 text-center">
          <p className="text-sm font-medium text-foreground">{t("empty.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("empty.body")}</p>
        </div>
      )}

      {data && data.results.length > 0 && (
        <>
          <AccessTable attempts={data.results} />
          <Pagination info={data.info} onPageChange={(page) => navigate({ page })} />
        </>
      )}
    </div>
  );
}
