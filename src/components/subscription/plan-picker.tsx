"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { getPlans } from "@/services/plans";
import { cn } from "@/lib/utils";
import type { BillingCycle, PlanKey } from "@/types";

const PLAN_ORDER: PlanKey[] = ["basic", "pro", "enterprise"];

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function formatCents(cents: number) {
  return currency.format(cents / 100);
}

interface PlanPickerProps {
  selected: PlanKey | null;
  onSelect: (plan: PlanKey) => void;
  cycle: BillingCycle;
  onCycleChange: (cycle: BillingCycle) => void;
  currentPlan?: PlanKey | null;
  disabled?: boolean;
}

export function PlanPicker({
  selected,
  onSelect,
  cycle,
  onCycleChange,
  currentPlan,
  disabled = false,
}: PlanPickerProps) {
  const t = useTranslations("plans");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
    staleTime: 60 * 60 * 1000,
  });

  const plans = data
    ? PLAN_ORDER.flatMap((key) => data.plans.filter((p) => p.key === key))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border border-zinc-200 p-0.5" role="group">
          {(["monthly", "annual"] as const).map((c) => (
            <button
              key={c}
              type="button"
              disabled={disabled}
              aria-pressed={cycle === c}
              onClick={() => onCycleChange(c)}
              className={cn(
                "rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
                cycle === c ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900",
              )}
            >
              {t(c)}
            </button>
          ))}
        </div>
        <span className="text-xs font-medium text-green-700">{t("annualNote")}</span>
      </div>

      {isLoading && <p className="text-sm text-zinc-500">{t("loading")}</p>}
      {isError && <p className="text-sm text-red-600">{t("loadError")}</p>}

      {data && (
        <div className="grid gap-3 sm:grid-cols-3">
          {plans.map((plan) => {
            const price = plan.prices[cycle];
            const isSelected = selected === plan.key;
            const isCurrent = currentPlan === plan.key;
            return (
              <button
                key={plan.key}
                type="button"
                disabled={disabled}
                aria-pressed={isSelected}
                onClick={() => onSelect(plan.key)}
                className={cn(
                  "flex flex-col gap-3 rounded-lg border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  isSelected
                    ? "border-zinc-900 ring-1 ring-zinc-900"
                    : "border-zinc-200 hover:border-zinc-400",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-zinc-900">{t(plan.key)}</p>
                    <p className="text-xs text-zinc-500">{t(`${plan.key}Desc`)}</p>
                  </div>
                  {isSelected && <Check size={16} className="shrink-0 text-zinc-900" />}
                </div>

                {isCurrent && (
                  <span className="w-fit rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                    {t("current")}
                  </span>
                )}

                <div>
                  <span className="text-xl font-semibold text-zinc-900">
                    {formatCents(price.amount_cents)}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {cycle === "monthly" ? t("perMonth") : t("perYear")}
                  </span>
                </div>

                <dl className="space-y-1 text-xs text-zinc-600">
                  <div className="flex justify-between">
                    <dt>{t("ivaRate", { rate: Math.round(data.iva_rate * 100) })}</dt>
                    <dd>{formatCents(price.iva_cents)}</dd>
                  </div>
                  <div className="flex justify-between font-medium text-zinc-900">
                    <dt>{t("totalWithIva")}</dt>
                    <dd>{formatCents(price.total_cents)}</dd>
                  </div>
                </dl>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
