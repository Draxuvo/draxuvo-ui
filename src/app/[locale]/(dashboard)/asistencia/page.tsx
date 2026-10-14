// src/app/[locale]/(dashboard)/asistencia/page.tsx
// Pantalla nueva de asistencia (R9, contracts/ui-routes.md). Solo lectura: las entradas y
// salidas se siguen registrando desde Personal.
"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { attendancesService } from "@/services/attendances";
import { employeesService } from "@/services/employees";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { cn } from "@/lib/utils";
import { ATTENDANCE_TYPES, type AttendanceType } from "@/types";
import { ModuleLocked, useModuleLocked } from "@/components/subscription/module-locked";

const PAGE_SIZE = 20;
const TIME_ZONE = "America/Mexico_City";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^\d+$/;
const ALLOWED = { type: ATTENDANCE_TYPES };

/** Hoy en America/Mexico_City como `YYYY-MM-DD`, la misma zona que usa la API. */
function todayInMexico() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
}

const CHIP =
  "inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors duration-[120ms] ease-etiqueta outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const CHIP_ON = "border-foreground bg-foreground text-background";
const CHIP_OFF = "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground";
const FIELD =
  "h-9 rounded-[6px] border border-input bg-card px-2.5 text-sm text-foreground tabular-nums outline-none transition-colors duration-[120ms] hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground";

const TYPE_BADGE: Record<AttendanceType, string> = {
  normal: "bg-sello text-etiqueta",
  late: "bg-ceja text-foreground",
  absent: "bg-alerta text-etiqueta",
};

export default function AsistenciaPage() {
  return (
    <Suspense>
      <AsistenciaContent />
    </Suspense>
  );
}

function AsistenciaContent() {
  const t = useTranslations("attendance");
  const tc = useTranslations("common");
  const tf = useTranslations("common.filters");
  const locale = useLocale();

  // Defaults estables: hoy en México para `from` y `to` (no se escriben en la URL).
  const [today] = useState(todayInMexico);
  const [defaults] = useState(() => ({ from: today, to: today, employee_id: "", type: "" }));
  const { filters, page, setFilter, setFilters, setPage, reset, isFiltered } = useUrlFilters(defaults, {
    allowed: ALLOWED,
  });

  // Fecha mal formada = default; invertidas se intercambian (data-model §1).
  const rawFrom = DATE_PATTERN.test(filters.from) ? filters.from : today;
  const rawTo = DATE_PATTERN.test(filters.to) ? filters.to : today;
  const [from, to] = rawFrom <= rawTo ? [rawFrom, rawTo] : [rawTo, rawFrom];
  const employeeId = ID_PATTERN.test(filters.employee_id) ? filters.employee_id : "";
  const type = filters.type as AttendanceType | "";
  const isToday = from === today && to === today;

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["attendances", { from, to, employee_id: employeeId, type }, page],
    queryFn: () =>
      attendancesService.list({
        page,
        page_size: PAGE_SIZE,
        from,
        to,
        employee_id: employeeId ? Number(employeeId) : undefined,
        type: type || undefined,
      }),
  });
  const records = data?.results ?? [];

  const { data: employeeOptions } = useQuery({
    queryKey: ["employees", "options"],
    queryFn: () => employeesService.list({ page: 1, page_size: 100 }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const locked = useModuleLocked("attendance", error);
  if (locked) return <ModuleLocked module="attendance" />;

  const dateFmt = new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
  // `YYYY-MM-DD` a texto legible sin desplazar el día por la zona horaria.
  const labelForDay = (day: string) => dateFmt.format(new Date(`${day}T12:00:00-06:00`));

  const employeeName =
    employeeOptions?.results.find((e) => String(e.id) === employeeId)?.name ?? `#${employeeId}`;
  const applied = [
    !isToday && (from === to ? labelForDay(from) : t("subtitleRange", { from: labelForDay(from), to: labelForDay(to) })),
    employeeId && `${t("employee")}: ${employeeName}`,
    type && `${t("type")}: ${t(`types.${type}`)}`,
  ].filter(Boolean);
  const typeChips: { value: string; label: string }[] = [
    { value: "", label: tf("all") },
    ...ATTENDANCE_TYPES.map((v) => ({ value: v, label: t(`types.${v}`) })),
  ];

  return (
    <div className="space-y-4">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isToday ? t("subtitleToday") : t("subtitleRange", { from: labelForDay(from), to: labelForDay(to) })}
            {" · "}
            <span className="tabular-nums">{t("subtitle", { count: data?.info?.total ?? 0 })}</span>
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label={tc("refresh")}
        >
          <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <fieldset className="flex flex-wrap items-end gap-2">
          <legend className="sr-only">{t("dateRange")}</legend>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t("from")}
            <input
              type="date"
              className={FIELD}
              value={from}
              max={to}
              onChange={(e) => DATE_PATTERN.test(e.target.value) && setFilter("from", e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t("to")}
            <input
              type="date"
              className={FIELD}
              value={to}
              min={from}
              onChange={(e) => DATE_PATTERN.test(e.target.value) && setFilter("to", e.target.value)}
            />
          </label>
          <button
            type="button"
            aria-pressed={isToday}
            onClick={() => setFilters({ from: null, to: null })}
            className={cn(CHIP, "h-9", isToday ? CHIP_ON : CHIP_OFF)}
          >
            {t("today")}
          </button>
        </fieldset>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t("employee")}
          <select
            aria-label={t("filterEmployee")}
            className={cn(FIELD, "min-w-48")}
            value={employeeId}
            onChange={(e) => setFilter("employee_id", e.target.value || null)}
          >
            <option value="">{t("allEmployees")}</option>
            {employeeId && !employeeOptions?.results.some((e) => String(e.id) === employeeId) && (
              <option value={employeeId}>{employeeName}</option>
            )}
            {employeeOptions?.results.map((e) => (
              <option key={e.id} value={String(e.id)}>
                {e.name}
              </option>
            ))}
          </select>
        </label>

        <div role="group" aria-label={t("filterType")} className="flex flex-wrap gap-2">
          {typeChips.map((c) => (
            <button
              key={c.value || "all"}
              type="button"
              aria-pressed={type === c.value}
              onClick={() => setFilter("type", c.value || null)}
              className={cn(CHIP, "h-9", type === c.value ? CHIP_ON : CHIP_OFF)}
            >
              {c.label}
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

      {error ? (
        <div role="alert" className="rounded-[6px] border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">
          {t("loadError")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[6px] bg-card shadow-etiqueta">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employee")}</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("checkin")}</TableHead>
                <TableHead>{t("checkout")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    {tc("loading")}
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center">
                    <CalendarCheck size={28} strokeWidth={1.75} aria-hidden className="mx-auto mb-3 text-muted-foreground" />
                    <p className="font-medium text-foreground">
                      {isToday && !employeeId && !type ? t("emptyToday") : t("empty")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{t("emptyHint")}</p>
                    <Link
                      href={`/${locale}/empleados`}
                      className="mt-3 inline-block rounded-[6px] px-1 text-sm font-medium text-foreground underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-foreground"
                    >
                      {t("goToEmployees")}
                    </Link>
                  </TableCell>
                </TableRow>
              ) : (
                records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{r.employee.name}</p>
                      <p className="text-xs text-muted-foreground">{r.employee.position ?? t("noPosition")}</p>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                          TYPE_BADGE[r.attendance_type],
                        )}
                      >
                        {t(`types.${r.attendance_type}`)}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {dateFmt.format(new Date(r.checkin_at))}
                    </TableCell>
                    <TableCell className="tabular-nums">{timeFmt.format(new Date(r.checkin_at))}</TableCell>
                    <TableCell className="tabular-nums">
                      {r.checkout_at ? (
                        timeFmt.format(new Date(r.checkout_at))
                      ) : (
                        <span className="text-muted-foreground">{t("noCheckout")}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {data?.info && data.info.total > 0 && (
        <Pagination info={data.info} onPageChange={setPage} />
      )}

      <p className="text-xs text-muted-foreground">{t("readOnlyHint")}</p>
    </div>
  );
}
