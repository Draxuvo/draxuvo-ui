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
import type { Company, PlanKey } from "@/types";

interface Props {
  company: Company | null;
  onOpenChange: (open: boolean) => void;
}

const PLANS = ["basic", "pro", "enterprise"] as const satisfies readonly PlanKey[];
type Plan = (typeof PLANS)[number];

export function CompanyCheckoutDialog({ company, onOpenChange }: Props) {
  const t = useTranslations("adminSubscriptions");
  const locale = useLocale();
  const [plan, setPlan] = useState<Plan>("pro");
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!company) return;
    setLoading(true);
    try {
      const origin = window.location.origin;
      const { checkout_url } = await createCompanyCheckout(
        company.id,
        plan,
        "monthly",
        `${origin}/${locale}/suscripciones`,
        `${origin}/${locale}/suscripciones`,
      );
      toast.success(t("checkoutSuccess"));
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
          <p className="text-sm font-medium text-zinc-700">{t("checkoutPlan")}</p>
          <div className="grid grid-cols-3 gap-2">
            {PLANS.map((p) => (
              <button
                key={p}
                onClick={() => setPlan(p)}
                className={cn(
                  "rounded-md border py-2.5 text-sm font-medium capitalize transition-colors",
                  plan === p
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900",
                )}
              >
                {p === "enterprise" ? t("planEnterprise") : p}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("checkoutCancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={loading} className="gap-2">
            <CreditCard size={14} />
            {t("checkoutConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
