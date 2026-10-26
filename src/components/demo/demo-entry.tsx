// src/components/demo/demo-entry.tsx
// Entrada a la demo (spec 039): elegir plan y giro (o traerlos de una invitación), dejar un contacto opcional y abrirla.
"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_SCENARIOS } from "@/lib/demo";
import { useHasRealSession, useOpenDemo } from "@/hooks/use-demo";
import type { DemoContact, DemoPlan, DemoScenario } from "@/types";
import { PlanPicker } from "./plan-picker";

const FIELD =
  "h-11 rounded-etiqueta border-border bg-card px-3 text-base focus-visible:border-foreground focus-visible:ring-foreground/15";
const TEXT_LINK =
  "rounded-[2px] font-semibold text-foreground underline decoration-anaquel-borde decoration-2 underline-offset-4 transition-colors duration-[120ms] hover:decoration-foreground foco-etiqueta";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ContactValues {
  name: string;
  email: string;
  phone: string;
}

/** Solo los datos que la persona sí quiso dar: el contacto es opcional. */
function contactOf(values: ContactValues): DemoContact | undefined {
  const contact: DemoContact = {};
  if (values.name.trim()) contact.name = values.name.trim();
  if (values.email.trim()) contact.email = values.email.trim();
  const digits = values.phone.replace(/\D/g, "");
  if (digits) contact.phone = digits;
  return Object.keys(contact).length ? contact : undefined;
}

export function DemoEntry({
  initialPlan = "pro",
  invite,
}: {
  initialPlan?: DemoPlan;
  /** Con una invitación el plan y el giro vienen fijos y se abre con su token. */
  invite?: { token: string; plan: DemoPlan; scenario: DemoScenario };
}) {
  const t = useTranslations("demo.entry");
  const tp = useTranslations("plans");
  const router = useRouter();
  const locale = useLocale();
  const hasRealSession = useHasRealSession();
  const open = useOpenDemo();

  const [plan, setPlan] = useState<DemoPlan>(invite?.plan ?? initialPlan);
  const [scenario, setScenario] = useState<DemoScenario>(invite?.scenario ?? DEMO_SCENARIOS[initialPlan][0]);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ContactValues | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().max(120, t("errors.nameTooLong")),
        email: z.string().refine((value) => !value.trim() || EMAIL.test(value.trim()), t("errors.emailInvalid")),
        phone: z.string().refine((value) => !value.trim() || value.replace(/\D/g, "").length === 10, t("errors.phoneInvalid")),
      }),
    [t],
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactValues>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", phone: "" } });

  const privacyUrl = process.env.NEXT_PUBLIC_PRIVACY_URL;
  const shownPlan = invite?.plan ?? plan;

  function pickPlan(next: DemoPlan) {
    setPlan(next);
    setScenario(DEMO_SCENARIOS[next][0]);
  }

  function start(values: ContactValues) {
    setFormError(null);
    setConfirm(null);
    open.mutate(
      {
        locale: locale === "en" ? "en" : "es",
        contact: contactOf(values),
        ...(invite ? { invite_token: invite.token } : { plan, scenario }),
      },
      {
        onSuccess: () => router.replace(`/${locale}/inicio`),
        onError: (error) => {
          const status = isAxiosError(error) ? error.response?.status : undefined;
          setFormError(status === 429 ? t("rateLimited") : status === 503 ? t("busy") : t("errorGeneric"));
        },
      },
    );
  }

  // Entrar a la demo reemplaza la sesión real que haya en este navegador: se pide confirmar.
  const onSubmit = (values: ContactValues) => (hasRealSession ? setConfirm(values) : start(values));

  return (
    <>
      <h1 className="font-display text-[2.25rem] font-extrabold uppercase leading-none tracking-[-0.01em] sm:text-[2.5rem]">
        {t("title")}
      </h1>
      <p className="mt-2 text-base text-muted-foreground">{t("subtitle")}</p>

      <div className="mt-6 rounded-etiqueta border border-border bg-card p-4 shadow-etiqueta sm:p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          {invite ? (
            <p className="rounded-etiqueta border border-border bg-background px-3 py-2 text-sm">
              <span className="font-semibold">{tp(shownPlan)}</span> · {t(`scenarios.${invite.scenario}`)}
            </p>
          ) : (
            <PlanPicker plan={plan} scenario={scenario} onPlan={pickPlan} onScenario={setScenario} />
          )}

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">{t("contactTitle")}</legend>
            <p className="text-sm text-muted-foreground">{t("contactHint")}</p>
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
              {(["name", "email", "phone"] as const).map((field) => {
                const error = errors[field]?.message;
                return (
                  <div key={field} className={field === "name" ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
                    <Label htmlFor={`demo-${field}`} className="text-sm font-semibold">
                      {t(`fields.${field}`)}
                    </Label>
                    <Input
                      id={`demo-${field}`}
                      type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
                      autoComplete={field === "name" ? "name" : field}
                      placeholder={t(`placeholders.${field}`)}
                      aria-invalid={!!error}
                      aria-describedby={error ? `demo-${field}-error` : undefined}
                      className={FIELD}
                      {...register(field)}
                    />
                    {error && (
                      <p id={`demo-${field}-error`} className="text-sm text-destructive">
                        {error}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("privacy")}{" "}
              {privacyUrl ? (
                <a href={privacyUrl} target="_blank" rel="noreferrer" className={TEXT_LINK}>
                  {t("privacyLink")}
                </a>
              ) : (
                t("privacyLink")
              )}
              .
            </p>
          </fieldset>

          {formError && (
            <p role="alert" className="rounded-etiqueta border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          )}

          <div className="space-y-3">
            <Button type="submit" disabled={open.isPending} className="h-11 w-full rounded-etiqueta text-base font-semibold">
              {open.isPending ? t("opening") : t("submit")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">{t("notice")}</p>
          </div>
        </form>
      </div>

      <p className="mt-6 text-center text-sm">
        <Link href={`/${locale}/registro?plan=${shownPlan}`} className={TEXT_LINK}>
          {t("createAccount")}
        </Link>
      </p>

      <Dialog open={!!confirm} onOpenChange={(openState) => !openState && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("replaceTitle")}</DialogTitle>
            <DialogDescription>{t("replaceBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)}>
              {t("replaceCancel")}
            </Button>
            <Button onClick={() => confirm && start(confirm)}>{t("replaceConfirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
