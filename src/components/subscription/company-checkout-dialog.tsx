"use client";
import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createCompanyCheckout } from "@/services/subscription";
import { cn } from "@/lib/utils";
import type { BillingCycle, Company, PlanKey } from "@/types";

interface Props {
  company: Company | null;
  onOpenChange: (open: boolean) => void;
}

const PLANS: PlanKey[] = ["basic", "pro", "enterprise"];
const CYCLES: BillingCycle[] = ["monthly", "annual"];
const PLAN_LABEL = { basic: "planBasic", pro: "planPro", enterprise: "planEnterprise" } as const;

export function CompanyCheckoutDialog({ company, onOpenChange }: Props) {
  const t = useTranslations("adminSubscriptions");
  const tPlans = useTranslations("plans");
  const locale = useLocale();
  const [plan, setPlan] = useState<PlanKey>("pro");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!company) return;
    setLoading(true);
    try {
      const origin = window.location.origin;
      const { checkout_url } = await createCompanyCheckout(
        company.id,
        plan,
        cycle,
        `${origin}/${locale}/suscripciones`,
        `${origin}/${locale}/suscripciones`,
      );
      // El pago lo confirma el webhook; aquí solo avisamos que se abre Stripe.
      toast.message(t("checkoutSuccess"));
      window.open(checkout_url, "_blank");
      onOpenChange(false);
    } catch {
      toast.error(t("checkoutError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={!!company} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {company && t("checkoutTitle", { company: company.name })}
          </DialogTitle>
          <DialogDescription>{t("checkoutDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{t("checkoutPlan")}</p>
          <div className="grid grid-cols-3 gap-2">
            {PLANS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={plan === p}
                onClick={() => setPlan(p)}
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
          <p className="pt-2 text-sm font-medium text-foreground">{t("checkoutCycle")}</p>
          <div className="grid grid-cols-2 gap-2">
            {CYCLES.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={cycle === c}
                onClick={() => setCycle(c)}
                className={cn(
                  "foco-etiqueta min-h-11 rounded-etiqueta border text-sm font-medium transition-colors duration-[120ms] ease-etiqueta",
                  cycle === c
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
              >
                {tPlans(c)}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("checkoutCancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={loading} className="gap-2">
            <CreditCard size={16} strokeWidth={1.75} aria-hidden />
            {t("checkoutConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
