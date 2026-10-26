// src/components/demo/plan-picker.tsx
// Elegir el plan de la demo y, en Pro, el giro (servicio técnico o restaurante).
"use client";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_PLANS, DEMO_SCENARIOS } from "@/lib/demo";
import type { DemoPlan, DemoScenario } from "@/types";

function choiceClass(selected: boolean) {
  return cn(
    "relative flex cursor-pointer flex-col rounded-etiqueta border bg-card px-3 py-2.5 text-left transition-colors duration-[120ms] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-foreground has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-card",
    selected ? "border-primary ring-1 ring-primary" : "border-border hover:border-foreground/40",
  );
}

function SelectedMark() {
  return (
    <span aria-hidden className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <Check size={14} strokeWidth={2.5} />
    </span>
  );
}

export function PlanPicker({
  plan,
  scenario,
  onPlan,
  onScenario,
}: {
  plan: DemoPlan;
  scenario: DemoScenario;
  onPlan: (plan: DemoPlan) => void;
  onScenario: (scenario: DemoScenario) => void;
}) {
  const t = useTranslations("demo.entry");
  const tp = useTranslations("plans");
  const scenarios = DEMO_SCENARIOS[plan];

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t("planTitle")}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {DEMO_PLANS.map((key) => {
            const selected = key === plan;
            return (
              <label key={key} className={choiceClass(selected)}>
                <input
                  type="radio"
                  name="demo-plan"
                  value={key}
                  checked={selected}
                  onChange={() => onPlan(key)}
                  className="sr-only"
                />
                {selected && <SelectedMark />}
                <span className="pr-6 font-display text-xl font-extrabold uppercase leading-tight">{tp(key)}</span>
                <span className="mt-1 text-xs leading-snug text-muted-foreground">{tp(`${key}Desc`)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {scenarios.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t("scenarioTitle")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {scenarios.map((key) => {
              const selected = key === scenario;
              return (
                <label key={key} className={choiceClass(selected)}>
                  <input
                    type="radio"
                    name="demo-scenario"
                    value={key}
                    checked={selected}
                    onChange={() => onScenario(key)}
                    className="sr-only"
                  />
                  {selected && <SelectedMark />}
                  <span className="pr-6 text-sm font-semibold">{t(`scenarios.${key}`)}</span>
                  <span className="mt-1 text-xs leading-snug text-muted-foreground">{t(`scenarios.${key}Desc`)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
}
