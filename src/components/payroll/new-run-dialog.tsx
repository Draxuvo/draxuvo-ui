// src/components/payroll/new-run-dialog.tsx
// Nueva corrida de nómina (spec 037): tipo de periodo y fechas; crea un borrador con los empleados activos.
"use client";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { payrollService } from "@/services/payroll";
import { PAYROLL_PERIOD_TYPES, type PayrollRun } from "@/types";
import { Select } from "@/components/ui/select";

const FIELD =
  "h-10 md:h-9 w-full rounded-etiqueta border border-input bg-card px-2.5 text-sm text-foreground tabular-nums transition-colors duration-[120ms] hover:border-foreground/40 foco-etiqueta";

export function NewRunDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (run: PayrollRun) => void }) {
  const t = useTranslations("payroll");
  const qc = useQueryClient();

  const schema = z
    .object({
      period_type: z.enum(PAYROLL_PERIOD_TYPES),
      starts_on: z.string().min(1, t("new.datesRequired")),
      ends_on: z.string().min(1, t("new.datesRequired")),
    })
    .refine((v) => !v.starts_on || !v.ends_on || v.ends_on >= v.starts_on, { path: ["ends_on"], message: t("new.endBeforeStart") });
  type Values = z.infer<typeof schema>;

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: { period_type: "biweekly", starts_on: "", ends_on: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: Values) => payrollService.create(values),
    onSuccess: (run) => {
      toast.success(t("new.created"));
      qc.invalidateQueries({ queryKey: ["payroll-runs"] });
      reset();
      onOpenChange(false);
      onCreated(run);
    },
    // El mensaje de la API (empalme, periodo inválido) sale en el toast del interceptor.
  });

  const type = useWatch({ control, name: "period_type" });
  const hint = { weekly: t("new.hintWeekly"), biweekly: t("new.hintBiweekly"), monthly: t("new.hintMonthly") }[type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("new.title")}</DialogTitle>
            <DialogDescription>{t("new.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="payroll-type">{t("new.type")}</Label>
            <Select id="payroll-type" {...register("period_type")}>
              {PAYROLL_PERIOD_TYPES.map((p) => (
                <option key={p} value={p}>{t(`periodType.${p}`)}</option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="payroll-from">{t("new.from")}</Label>
              <input id="payroll-from" type="date" className={FIELD} {...register("starts_on")} />
              {errors.starts_on && <p role="alert" className="text-xs text-destructive">{errors.starts_on.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payroll-to">{t("new.to")}</Label>
              <input id="payroll-to" type="date" className={FIELD} {...register("ends_on")} />
              {errors.ends_on && <p role="alert" className="text-xs text-destructive">{errors.ends_on.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              {t("new.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>{t("new.create")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
