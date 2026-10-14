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

/** Precio de etiqueta: cifra grande y condensada, el signo al 40% (DESIGN.md). */
function TagPrice({ cents }: { cents: number }) {
  const parts = currency.formatToParts(cents / 100);
  return (
    <span className="font-display text-[2.5rem] font-extrabold leading-none tabular-nums">
      {parts.map((part, i) =>
        part.type === "currency" ? (
          <span key={i} className="mr-0.5 align-[0.9em] text-[0.4em]">
            {part.value}
          </span>
        ) : part.type === "decimal" || part.type === "fraction" ? (
          <span key={i} className="text-[0.5em]">
            {part.value}
          </span>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </span>
  );
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
  const tm = useTranslations("modules");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
    staleTime: 60 * 60 * 1000,
  });

  const plans = data
    ? PLAN_ORDER.flatMap((key) => data.plans.filter((p) => p.key === key))
    : [];

  return (
    <div className="@container space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-[6px] border border-border bg-background p-0.5"
          role="group"
        >
          {(["monthly", "annual"] as const).map((c) => (
            <button
              key={c}
              type="button"
              disabled={disabled}
              aria-pressed={cycle === c}
              onClick={() => onCycleChange(c)}
              className={cn(
                "min-h-10 rounded-[4px] px-4 text-sm font-semibold transition-colors duration-[120ms] outline-none focus-visible:ring-2 focus-visible:ring-foreground disabled:opacity-50",
                cycle === c
                  ? "bg-card text-foreground shadow-etiqueta"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(c)}
            </button>
          ))}
        </div>
        <span className="rounded-full bg-ceja px-2.5 py-0.5 text-xs font-semibold text-foreground">
          {t("annualNote")}
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground @xl:ml-auto">
          {t("pricesWithoutIva")}
        </span>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
      {isError && <p className="text-sm text-destructive">{t("loadError")}</p>}

      {data && (
        <div className="grid gap-3 @xl:grid-cols-3">
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
                  "relative flex flex-col rounded-[6px] border bg-card p-4 text-left text-foreground shadow-etiqueta transition-colors duration-[120ms] outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60",
                  isSelected
                    ? "border-primary ring-1 ring-primary"
                    : "border-border hover:border-foreground/40",
                )}
              >
                {isSelected && (
                  <span
                    aria-hidden
                    className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  >
                    <Check size={16} strokeWidth={2.5} />
                  </span>
                )}

                <span className="block pr-8 font-display text-2xl font-extrabold uppercase leading-none">
                  {t(plan.key)}
                </span>
                <span className="mt-1 block min-h-8 text-xs leading-snug text-muted-foreground">
                  {t(`${plan.key}Desc`)}
                </span>

                {isCurrent && (
                  <span className="mt-2 w-fit rounded-full border border-border bg-background px-2 py-0.5 text-xs font-semibold">
                    {t("current")}
                  </span>
                )}

                <span className="mt-4 flex items-baseline gap-1">
                  <TagPrice cents={price.amount_cents} />
                  <span className="text-sm text-muted-foreground">
                    {cycle === "monthly" ? t("perMonth") : t("perYear")}
                  </span>
                </span>

                <span className="mt-3 block space-y-1 border-t border-dashed border-border pt-3 text-sm">
                  <span className="flex items-baseline justify-between gap-2 text-muted-foreground">
                    <span>{t("ivaRate", { rate: Math.round(data.iva_rate * 100) })}</span>
                    <span className="font-display text-base font-semibold tabular-nums">
                      {formatCents(price.iva_cents)}
                    </span>
                  </span>
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{t("totalWithIva")}</span>
                    <span className="font-display text-xl font-extrabold tabular-nums">
                      {formatCents(price.total_cents)}
                    </span>
                  </span>
                </span>

                {plan.modules.length > 0 && (
                  <span className="mt-4 block">
                    <span className="block text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      {t("includes")}
                    </span>
                    <span className="mt-2 block space-y-1.5 text-sm">
                      {plan.modules.map((module) => (
                        <span key={module} className="flex items-start gap-2">
                          <Check
                            size={16}
                            strokeWidth={2.5}
                            className="mt-0.5 shrink-0 text-sello"
                            aria-hidden
                          />
                          {tm(module)}
                        </span>
                      ))}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
