"use client";
// Cambio del plan de prueba de una empresa por el super admin (spec 031, FR-001/FR-004): el dueño y el
// administrador no pueden. No mueve la fecha de fin de la prueba.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateCompanyTrialPlan } from "@/services/subscription";
import { cn } from "@/lib/utils";
import type { Company, PlanKey } from "@/types";

interface Props {
  company: Company | null;
  currentPlan?: PlanKey | null;
  onOpenChange: (open: boolean) => void;
}

const PLANS: PlanKey[] = ["basic", "pro", "enterprise"];
const PLAN_LABEL = { basic: "planBasic", pro: "planPro", enterprise: "planEnterprise" } as const;

export function TrialPlanDialog({ company, currentPlan, onOpenChange }: Props) {
  const t = useTranslations("adminSubscriptions");
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<PlanKey | null>(null);
  const plan = picked ?? currentPlan ?? "pro";

  const change = useMutation({
    mutationFn: () => updateCompanyTrialPlan(company!.id, plan),
    onSuccess: () => {
      toast.success(t("trialPlanSuccess"));
      queryClient.invalidateQueries({ queryKey: ["company-subscription", company!.id] });
      setPicked(null);
      onOpenChange(false);
    },
    onError: () => toast.error(t("trialPlanError")),
  });

  return (
    <Dialog open={!!company} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{company && t("trialPlanTitle", { company: company.name })}</DialogTitle>
          <DialogDescription>{t("trialPlanDesc")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          {PLANS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={plan === p}
              onClick={() => setPicked(p)}
              className={cn(
                "foco-etiqueta min-h-11 rounded-etiqueta border text-sm font-medium transition-colors duration-[120ms] ease-etiqueta",
                plan === p
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              {t(PLAN_LABEL[p])}
            </button>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={change.isPending}>
            {t("checkoutCancel")}
          </Button>
          <Button onClick={() => change.mutate()} disabled={change.isPending || plan === currentPlan}>
            {t("trialPlanConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
