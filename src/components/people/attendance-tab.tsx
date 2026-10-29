// src/components/people/attendance-tab.tsx
// Pestaña "Asistencia" de Personal (spec 036; antes la página /asistencia). Arriba, la lista de hoy por empleado con
// marcar entrada y salida (administrador y dueño); abajo, el historial con filtros. Cada persona marca la suya
// desde el botón del encabezado (spec 026).
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
import { CHIP, CHIP_ON, CHIP_OFF } from "@/components/filters/chip";
import { ATTENDANCE_TYPES, type AttendanceType } from "@/types";
import { ModuleLocked, useModuleGate } from "@/components/subscription/module-locked";
import { FilterNotice } from "@/components/filters/filter-notice";
import { useAuthStore } from "@/store/auth";
import { AttendanceRoster } from "@/components/people/attendance-roster";
import { Select } from "@/components/ui/select";

const PAGE_SIZE = 20;
const MARK_ROLES = new Set(["admin", "owner", "super_admin"]);
const TIME_ZONE = "America/Mexico_City";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^\d+$/;
const ALLOWED = { type: ATTENDANCE_TYPES };
// "tab" es de la página Personal: limpiar los filtros no debe cambiar de pestaña.
const PRESERVE = ["tab"] as const;

/** Hoy en America/Mexico_City como `YYYY-MM-DD`, la misma zona que usa la API. */
function todayInMexico() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
}

const FIELD =
  "h-10 md:h-9 rounded-etiqueta border border-input bg-card px-2.5 text-sm text-foreground tabular-nums transition-colors duration-[120ms] hover:border-foreground/40 foco-etiqueta";

const TYPE_BADGE: Record<AttendanceType, string> = {
  normal: "bg-sello text-etiqueta",
  late: "bg-ceja text-foreground",
  absent: "bg-alerta text-etiqueta",
};

export function AttendanceTab() {
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
  const role = useAuthStore((s) => s.role);

  // Defaults estables: hoy en México para `from` y `to` (no se escriben en la URL).
  const [today] = useState(todayInMexico);
  const [defaults] = useState(() => ({ from: today, to: today, employee_id: "", type: "" }));
  const { filters, page, setFilter, setFilters, setPage, reset, isFiltered } = useUrlFilters(defaults, {
    allowed: ALLOWED,
    preserve: PRESERVE,
  });

  // Fecha mal formada = default; invertidas se intercambian (data-model §1).
  const rawFrom = DATE_PATTERN.test(filters.from) ? filters.from : today;
  const rawTo = DATE_PATTERN.test(filters.to) ? filters.to : today;
  const [from, to] = rawFrom <= rawTo ? [rawFrom, rawTo] : [rawTo, rawFrom];
  const employeeId = ID_PATTERN.test(filters.employee_id) ? filters.employee_id : "";
  const type = filters.type as AttendanceType | "";
  const isToday = from === today && to === today;

  // Puerta del módulo antes de consultar: fuera del plan no hay request ni toast.
  const gate = useModuleGate("attendance");
  const { data, isLoading, isFetching, refetch, error } = useQuery({
    enabled: gate.enabled,
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
    enabled: gate.enabled,
  });

  if (gate.isLocked(error)) return <ModuleLocked module="attendance" />;

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
    <div className="space-y-8">
      <AttendanceRoster canMark={!!role && MARK_ROLES.has(role)} enabled={gate.enabled} />

      <div className="space-y-4">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold leading-tight text-foreground">{t("history")}</h2>
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
            className={cn(CHIP, isToday ? CHIP_ON : CHIP_OFF)}
          >
            {t("today")}
          </button>
        </fieldset>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t("employee")}
          <Select
            aria-label={t("filterEmployee")}
            className="w-auto min-w-48"
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
          </Select>
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

      {isFiltered && <FilterNotice applied={applied} onClear={reset} />}

      {error ? (
        <div role="alert" className="rounded-etiqueta border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">
          {t("loadError")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-etiqueta bg-card shadow-etiqueta">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employee")}</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("checkin")}</TableHead>
                <TableHead>{t("checkout")}</TableHead>
                <TableHead>{t("duration")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    {tc("loading")}
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <CalendarCheck size={28} strokeWidth={1.75} aria-hidden className="mx-auto mb-3 text-muted-foreground" />
                    <p className="font-medium text-foreground">
                      {isToday && !employeeId && !type ? t("emptyToday") : t("empty")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{t("emptyHint")}</p>
                    <Link
                      href={`/${locale}/personal?tab=empleados`}
                      className="mt-3 inline-block rounded-etiqueta px-1 text-sm font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground foco-etiqueta"
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
                    <TableCell className="tabular-nums">
                      {timeFmt.format(new Date(r.checkin_at))}
                      {r.checkin_captured && r.checkin_by && (
                        <p className="text-xs text-muted-foreground">{t("capturedBy", { name: r.checkin_by.name })}</p>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {r.checkout_at ? (
                        <>
                          {timeFmt.format(new Date(r.checkout_at))}
                          {r.checkout_captured && r.checkout_by && (
                            <p className="text-xs text-muted-foreground">{t("capturedBy", { name: r.checkout_by.name })}</p>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">{t("noCheckout")}</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {r.open ? (
                        <span className="inline-flex rounded-full bg-ceja px-2 py-0.5 text-xs font-semibold text-foreground">
                          {t("open")}
                        </span>
                      ) : r.duration_minutes != null ? (
                        `${Math.floor(r.duration_minutes / 60)} h ${String(r.duration_minutes % 60).padStart(2, "0")} min`
                      ) : (
                        "—"
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
      </div>
    </div>
  );
}
