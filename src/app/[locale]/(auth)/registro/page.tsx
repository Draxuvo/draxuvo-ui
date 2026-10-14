// src/app/[locale]/(auth)/registro/page.tsx
"use client";
import { Suspense, useState } from "react";
import Image from "next/image";
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
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

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

function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const px = size === "sm" ? 28 : 40;
  const dim = size === "sm" ? "w-7 h-7" : "w-10 h-10";
  return <Image src={logo} alt="" width={px} height={px} unoptimized className={`${dim} shrink-0`} />;
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
    <div className="min-h-screen flex">
      {/* ── Left panel: branding ── */}
      <div className="hidden lg:flex lg:w-[46%] relative flex-col justify-between p-12 overflow-hidden bg-slate-950 text-white select-none">
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        <div className="absolute -bottom-24 -left-24 w-[420px] h-[420px] bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-72 h-72 bg-orange-700/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="font-semibold text-base leading-tight">{tc("brandName")}</p>
            <p className="text-[11px] text-slate-400 uppercase tracking-widest">{tc("brandTagline")}</p>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-[2.4rem] font-bold leading-tight tracking-tight">{t("title")}</h1>
            <p className="mt-4 text-slate-400 text-sm leading-relaxed max-w-sm">{t("subtitle")}</p>
          </div>
          <ul className="space-y-3">
            {PLAN_KEYS.map((key) => (
              <li
                key={key}
                className={cn(
                  "rounded-xl px-4 py-3.5 border transition-colors",
                  key === selectedPlan
                    ? "bg-amber-400/10 border-amber-400/40"
                    : "bg-white/[0.04] border-white/[0.08]",
                )}
              >
                <p className="text-sm font-medium leading-none mb-1">{tp(key)}</p>
                <p className="text-xs text-slate-400">{tp(`${key}Desc`)}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-slate-500 max-w-sm">{t("trialNote")}</p>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <BrandMark size="sm" />
            <span className="font-semibold text-slate-900">{tc("brandName")}</span>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-semibold text-slate-900">{t("title")}</h2>
            <p className="text-sm text-slate-500 mt-1">{t("subtitle")}</p>
          </div>

          <Card className="shadow-sm border-slate-200 bg-white">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <fieldset className="space-y-1.5">
                  <legend className="text-sm font-medium text-slate-900 mb-1.5">{t("plan")}</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {PLAN_KEYS.map((key) => (
                      <label
                        key={key}
                        className={cn(
                          "cursor-pointer rounded-lg border px-3 py-2 text-center text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-400",
                          key === selectedPlan
                            ? "border-amber-500 bg-amber-50 font-medium text-slate-900"
                            : "border-slate-200 text-slate-600 hover:border-slate-300",
                        )}
                      >
                        <input type="radio" value={key} className="sr-only" {...register("plan")} />
                        {tp(key)}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="space-y-1.5">
                  <legend className="text-sm font-medium text-slate-900 mb-1.5">{t("cycle")}</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {CYCLES.map((cycle) => (
                      <label
                        key={cycle}
                        className={cn(
                          "cursor-pointer rounded-lg border px-3 py-2 text-center text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-400",
                          cycle === selectedCycle
                            ? "border-amber-500 bg-amber-50 font-medium text-slate-900"
                            : "border-slate-200 text-slate-600 hover:border-slate-300",
                        )}
                      >
                        <input type="radio" value={cycle} className="sr-only" {...register("billing_cycle")} />
                        {tp(cycle)}
                        {cycle === "annual" && (
                          <span className="block text-[11px] font-normal text-amber-700">{tp("annualNote")}</span>
                        )}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        <Label htmlFor={name}>{t(`fields.${name}`)}</Label>
                        <Input
                          id={name}
                          type={type}
                          autoComplete={autoComplete}
                          placeholder={t(`placeholders.${name}`)}
                          aria-invalid={!!error}
                          aria-describedby={error ? errorId : undefined}
                          {...register(name)}
                        />
                        {error && (
                          <p id={errorId} className="text-xs text-red-500">
                            {error}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {formError && (
                  <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                    {formError}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t("submitting") : t("submit")}
                </Button>
                <p className="text-xs text-slate-500 text-center">{t("trialNote")}</p>
              </form>
            </CardContent>
          </Card>

          <p className="text-center mt-5 text-sm text-slate-500">
            {t("haveAccount")}{" "}
            <button
              type="button"
              className="text-slate-700 font-medium underline-offset-2 hover:underline"
              onClick={() => router.push(`/${locale}/login`)}
            >
              {t("login")}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegistrationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <RegistrationForm />
    </Suspense>
  );
}
