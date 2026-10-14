// src/app/[locale]/(auth)/registro/page.tsx
"use client";
import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import logo from "../../../../../public/logo.svg";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { z } from "zod";
import { useAuthStore } from "@/store/auth";
import { registrationsService } from "@/services/registrations";
import type { BillingCycle, PlanKey } from "@/types";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PLAN_KEYS = ["basic", "pro", "enterprise"] as const satisfies readonly PlanKey[];
const CYCLES = ["monthly", "annual"] as const satisfies readonly BillingCycle[];

// Los enlaces de draxuvo-web usan `ciclo` en español (contracts/ui-routes.md).
const CYCLE_FROM_PARAM: Record<string, BillingCycle> = { mensual: "monthly", anual: "annual" };

function planFromParam(value: string | null): PlanKey {
  return PLAN_KEYS.find((key) => key === value) ?? "pro";
}

function cycleFromParam(value: string | null): BillingCycle {
  return (value && CYCLE_FROM_PARAM[value]) || "monthly";
}

type TextField = "first_name" | "last_name" | "phone" | "email" | "password" | "company_name";

const TEXT_FIELDS: { name: TextField; type: string; autoComplete: string }[] = [
  { name: "first_name", type: "text", autoComplete: "given-name" },
  { name: "last_name", type: "text", autoComplete: "family-name" },
  { name: "phone", type: "tel", autoComplete: "tel" },
  { name: "email", type: "email", autoComplete: "email" },
  { name: "password", type: "password", autoComplete: "new-password" },
  { name: "company_name", type: "text", autoComplete: "organization" },
];

const FIELD =
  "h-11 rounded-etiqueta border-border bg-card px-3 text-base focus-visible:border-foreground focus-visible:ring-foreground/15";

const TEXT_LINK =
  "rounded-[2px] font-semibold text-foreground underline decoration-anaquel-borde decoration-2 underline-offset-4 transition-colors duration-[120ms] hover:decoration-foreground foco-etiqueta";

/** Opción de radio como etiqueta: la elegida va marcada con oferta. */
function choiceClass(selected: boolean) {
  return cn(
    "relative flex cursor-pointer flex-col rounded-etiqueta border bg-card px-3 py-2.5 text-left transition-colors duration-[120ms] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-foreground has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-card",
    selected
      ? "border-primary ring-1 ring-primary"
      : "border-border hover:border-foreground/40",
  );
}

function SelectedMark() {
  return (
    <span
      aria-hidden
      className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
    >
      <Check size={14} strokeWidth={2.5} />
    </span>
  );
}

function RegistrationForm() {
  const t = useTranslations("registration");
  const tp = useTranslations("plans");
  const tc = useTranslations("common");
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const schema = z.object({
    first_name: z.string().trim().min(1, t("errors.first_nameRequired")),
    last_name: z.string().trim().min(1, t("errors.last_nameRequired")),
    phone: z.string().trim().min(1, t("errors.phoneRequired")),
    email: z.string().trim().email(t("errors.emailInvalid")),
    password: z.string().min(8, t("errors.passwordMin")),
    company_name: z.string().trim().min(1, t("errors.company_nameRequired")),
    plan: z.enum(PLAN_KEYS),
    billing_cycle: z.enum(CYCLES),
  });
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
      password: "",
      company_name: "",
      plan: planFromParam(searchParams.get("plan")),
      billing_cycle: cycleFromParam(searchParams.get("ciclo")),
    },
  });

  const selectedPlan = useWatch({ control, name: "plan" });
  const selectedCycle = useWatch({ control, name: "billing_cycle" });

  async function onSubmit(data: FormValues) {
    setLoading(true);
    setFormError(null);
    try {
      const session = await registrationsService.create(data);
      useAuthStore.getState().setSession(session);
      router.push(`/${locale}/inicio`);
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      const details: unknown = isAxiosError(error) ? error.response?.data?.error?.details : undefined;
      const emailTaken =
        status === 422 &&
        Array.isArray(details) &&
        details.some((d) => typeof d === "string" && /email|correo/i.test(d));

      if (emailTaken) {
        setError("email", { message: t("emailTaken") }, { shouldFocus: true });
      } else if (status === 429) {
        setFormError(t("rateLimited"));
      } else {
        setFormError(t("errors.generic"));
      }
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      {/* Ceja: la banda de precio del anaquel lleva la marca */}
      <header className="border-b border-foreground/15 bg-ceja">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-2.5 px-4 sm:px-6">
          <Image src={logo} alt="" width={32} height={32} unoptimized className="size-8 shrink-0" />
          <span className="font-display text-xl font-extrabold uppercase tracking-[0.01em]">
            {tc("brandName")}
          </span>
          <span className="ml-auto hidden text-sm font-medium text-gris-texto sm:block">
            {tc("brandTagline")}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="font-display text-[2.25rem] font-extrabold uppercase leading-none tracking-[-0.01em] sm:text-[2.5rem]">
          {t("title")}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">{t("subtitle")}</p>

        <div className="mt-6 rounded-etiqueta border border-border bg-card p-4 shadow-etiqueta sm:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">{t("plan")}</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {PLAN_KEYS.map((key) => {
                  const selected = key === selectedPlan;
                  return (
                    <label key={key} className={choiceClass(selected)}>
                      <input type="radio" value={key} className="sr-only" {...register("plan")} />
                      {selected && <SelectedMark />}
                      <span className="pr-6 font-display text-xl font-extrabold uppercase leading-tight">
                        {tp(key)}
                      </span>
                      <span className="mt-1 text-xs leading-snug text-muted-foreground">
                        {tp(`${key}Desc`)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold">{t("cycle")}</legend>
              <div className="grid grid-cols-2 gap-2">
                {CYCLES.map((cycle) => {
                  const selected = cycle === selectedCycle;
                  return (
                    <label key={cycle} className={cn(choiceClass(selected), "min-h-11 justify-center")}>
                      <input type="radio" value={cycle} className="sr-only" {...register("billing_cycle")} />
                      {selected && <SelectedMark />}
                      <span className="pr-6 text-sm font-semibold">{tp(cycle)}</span>
                      {cycle === "annual" && (
                        <span className="mt-1 w-fit rounded-full bg-ceja px-2 py-0.5 text-xs font-semibold">
                          {tp("annualNote")}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
              {TEXT_FIELDS.map(({ name, type, autoComplete }) => {
                const error = errors[name]?.message;
                const errorId = `${name}-error`;
                return (
                  <div
                    key={name}
                    className={cn(
                      "space-y-1.5",
                      (name === "email" || name === "password" || name === "company_name") && "sm:col-span-2",
                    )}
                  >
                    <Label htmlFor={name} className="text-sm font-semibold">
                      {t(`fields.${name}`)}
                    </Label>
                    <Input
                      id={name}
                      type={type}
                      autoComplete={autoComplete}
                      placeholder={t(`placeholders.${name}`)}
                      aria-invalid={!!error}
                      aria-describedby={error ? errorId : undefined}
                      className={FIELD}
                      {...register(name)}
                    />
                    {error && (
                      <p id={errorId} className="text-sm text-destructive">
                        {error}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {formError && (
              <p
                role="alert"
                className="rounded-etiqueta border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {formError}
              </p>
            )}

            <div className="space-y-3">
              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-etiqueta text-base font-semibold"
              >
                {loading ? t("submitting") : t("submit")}
              </Button>
              <p className="text-center text-sm text-muted-foreground">{t("trialNote")}</p>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("haveAccount")}{" "}
          <Link href={`/${locale}/login`} className={TEXT_LINK}>
            {t("login")}
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function RegistrationPage() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-background" />}>
      <RegistrationForm />
    </Suspense>
  );
}
