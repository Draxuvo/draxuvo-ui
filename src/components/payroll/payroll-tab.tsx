// src/components/payroll/payroll-tab.tsx
// Pestaña «Nómina» de Personal (spec 037): lista de corridas o el detalle de una (`?run=<id>`).
"use client";
import { Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ModuleLocked, useModuleGate } from "@/components/subscription/module-locked";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { money, STATUS_TONE } from "@/lib/payroll";
import { formatDay } from "@/lib/reports/format";
import { payrollService } from "@/services/payroll";
import { PAYROLL_RUN_STATUSES, type PayrollRunStatus } from "@/types";
import { NewRunDialog } from "./new-run-dialog";
import { RunDetail } from "./run-detail";

const PAGE_SIZE = 10;
const DEFAULTS = { status: "", year: "" };
const ALLOWED = { status: PAYROLL_RUN_STATUSES };
// "tab" y "run" son de la página Personal: limpiar los filtros no debe cambiar de pestaña.
const PRESERVE = ["tab"] as const;
const SELECT =
  "h-8 rounded-etiqueta border border-input bg-card px-2 text-sm foco-etiqueta hover:border-foreground/40";

export function PayrollTab() {
  return (
    <Suspense>
      <PayrollContent />
    </Suspense>
  );
}

function PayrollContent() {
  const t = useTranslations("payroll");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const runParam = Number(searchParams.get("run"));
  const openRunId = Number.isInteger(runParam) && runParam > 0 ? runParam : null;

  const { filters, page, setFilter, setPage } = useUrlFilters(DEFAULTS, { allowed: ALLOWED, preserve: PRESERVE });
  const [newOpen, setNewOpen] = useState(false);

  const gate = useModuleGate("employees");
  const { data, isLoading, isError, isFetching, refetch, error } = useQuery({
    queryKey: ["payroll-runs", filters, page],
    enabled: gate.enabled && openRunId === null,
    queryFn: () =>
      payrollService.list({
        page,
        page_size: PAGE_SIZE,
        status: (filters.status || undefined) as PayrollRunStatus | undefined,
        year: filters.year ? Number(filters.year) : undefined,
      }),
  });

  const openRun = (id: number | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("run", String(id));
    else params.delete("run");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (gate.isLocked(error)) return <ModuleLocked module="employees" />;
  if (openRunId !== null) return <RunDetail runId={openRunId} onBack={() => openRun(null)} />;

  const runs = data?.results ?? [];
  const thisYear = new Date().getFullYear();
  const years = [thisYear, thisYear - 1, thisYear - 2];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-xl text-sm text-muted-foreground">{t("subtitle")}</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} aria-label={t("retry")}>
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          </Button>
          <Button className="gap-2" onClick={() => setNewOpen(true)}>
            <Plus size={15} /> {t("newRun")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t("filters.status")}
          <select className={SELECT} value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="">{t("filters.all")}</option>
            {PAYROLL_RUN_STATUSES.map((s) => (
              <option key={s} value={s}>{t(`status.${s}`)}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t("filters.year")}
          <select className={SELECT} value={filters.year} onChange={(e) => setFilter("year", e.target.value)}>
            <option value="">{t("filters.all")}</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">{t("loadError")}</p>
          <Button variant="outline" onClick={() => refetch()}>{t("retry")}</Button>
        </div>
      ) : !isLoading && runs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="font-medium">{t("empty")}</p>
          <p className="text-sm text-muted-foreground">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-etiqueta border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("list.period")}</TableHead>
                <TableHead>{t("list.type")}</TableHead>
                <TableHead>{t("list.status")}</TableHead>
                <TableHead className="text-right">{t("list.paid")}</TableHead>
                <TableHead className="text-right">{t("list.total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id} className="cursor-pointer" onClick={() => openRun(run.id)}>
                  <TableCell>
                    <button type="button" className="font-medium underline-offset-4 hover:underline foco-etiqueta" onClick={(e) => { e.stopPropagation(); openRun(run.id); }}>
                      {formatDay(run.starts_on, locale)} – {formatDay(run.ends_on, locale)}
                    </button>
                  </TableCell>
                  <TableCell>{t(`periodType.${run.period_type}`)}</TableCell>
                  <TableCell><Badge variant={STATUS_TONE[run.status]}>{t(`status.${run.status}`)}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{t("list.paidOf", { paid: run.paid_count, count: run.payments_count })}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{money(run.total_cents, locale)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data?.info && data.info.pages_total > 1 && <Pagination info={data.info} onPageChange={setPage} />}

      <NewRunDialog open={newOpen} onOpenChange={setNewOpen} onCreated={(run) => openRun(run.id)} />
    </div>
  );
}
