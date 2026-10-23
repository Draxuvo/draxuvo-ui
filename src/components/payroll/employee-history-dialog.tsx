// src/components/payroll/employee-history-dialog.tsx
// Historial de pagos de nómina de un empleado (spec 037, FR-016).
"use client";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { money } from "@/lib/payroll";
import { formatDay } from "@/lib/reports/format";
import { payrollService } from "@/services/payroll";

export type HistoryTarget = { employeeId: number; name: string } | null;

export function EmployeeHistoryDialog({ target, onClose }: { target: HistoryTarget; onClose: () => void }) {
  const t = useTranslations("payroll.history");
  const tm = useTranslations("payroll.method");
  const locale = useLocale();
  const { data, isLoading } = useQuery({
    queryKey: ["payroll-history", target?.employeeId],
    queryFn: () => payrollService.employeeHistory(target!.employeeId),
    enabled: !!target,
  });
  const payments = data?.results ?? [];

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title", { name: target?.name ?? "" })}</DialogTitle>
        </DialogHeader>
        {!isLoading && payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-etiqueta border border-border">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div>
                  <Link href={`/${locale}/personal?tab=nomina&run=${p.payroll_run_id}`} className="font-medium underline-offset-4 hover:underline">
                    {p.run ? `${formatDay(p.run.starts_on, locale)} – ${formatDay(p.run.ends_on, locale)}` : p.payroll_run_id}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {p.method ? tm(p.method) : ""} · {p.paid_on ? formatDay(p.paid_on, locale) : ""}
                  </p>
                </div>
                <span className="tabular-nums">{money(p.net_cents, locale)}</span>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
