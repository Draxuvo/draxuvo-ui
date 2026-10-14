// src/app/[locale]/(dashboard)/mis-empresas/page.tsx
// Mis empresas (US7, FR-027/FR-028): el owner ve la empresa principal y sus sucursales, agrega
// una (hasta 3 en total, con `multi_company` en el plan) y entra a cualquiera de ellas.
"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Building2, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth";
import { useAppRouter } from "@/hooks/use-router";
import { branchesService } from "@/services/branches";
import { getSubscription } from "@/services/subscription";
import { useSwitchCompany } from "@/components/layout/company-switcher";
import { cn } from "@/lib/utils";
import type { Branch } from "@/types";

/** Empresas por cuenta, la principal incluida (R17, `Company::MAX_COMPANIES_PER_ACCOUNT`). */
const MAX_COMPANIES = 3;
const ERROR_CODES = ["company_limit_reached", "module_not_in_plan", "not_a_main_company"] as const;
type ErrorCode = (typeof ERROR_CODES)[number] | "generic";

function errorCode(error: unknown): ErrorCode {
  if (!isAxiosError(error)) return "generic";
  const code = error.response?.data?.error?.details?.code;
  return (ERROR_CODES as readonly string[]).includes(code) ? (code as ErrorCode) : "generic";
}

export default function MisEmpresasPage() {
  const t = useTranslations("myCompanies");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useAppRouter();
  const qc = useQueryClient();
  const switchCompany = useSwitchCompany();
  const { user, role, selectedCompanyId, setUser } = useAuthStore();
  const isOwner = role === "owner";

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [apiError, setApiError] = useState<ErrorCode | null>(null);

  // Solo el owner administra sus empresas.
  useEffect(() => {
    if (role && !isOwner) router.replace(role === "staff" ? "/mis-ordenes" : "/inicio");
  }, [role, isOwner, router]);

  const { data: subscription } = useQuery({
    queryKey: ["subscription", selectedCompanyId],
    queryFn: getSubscription,
    retry: false,
    enabled: isOwner && !!selectedCompanyId,
  });

  const branchesQuery = useQuery({
    queryKey: ["branches", selectedCompanyId],
    queryFn: branchesService.list,
    enabled: isOwner && !!selectedCompanyId,
  });

  const create = useMutation({
    mutationFn: (branchName: string) => branchesService.create(branchName),
    onSuccess: ({ company, user: updated }) => {
      setUser(updated);
      setName("");
      qc.invalidateQueries({ queryKey: ["branches"] });
      toast.success(t("created", { company: company.name }));
    },
    onError: (error) => setApiError(errorCode(error)),
  });

  if (!isOwner) return null;

  const companies: Branch[] = branchesQuery.data ?? [];
  const main = companies.find((c) => c.parent_company_id === null) ?? companies[0];
  const memberOf = new Set(user?.companies?.map((c) => c.id));
  const activeIsBranch = !!user?.companies?.find((c) => c.id === selectedCompanyId)?.parent_company_id;
  const hasMultiCompany = !!subscription?.active_modules.includes("multi_company");
  const atLimit = companies.length >= MAX_COMPANIES;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    setApiError(null);
    if (!trimmed) {
      setNameError(true);
      return;
    }
    setNameError(false);
    create.mutate(trimmed);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight text-foreground">
            {t("title")}
          </h1>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {branchesQuery.data && (
          <p className="font-display text-xl font-semibold tabular-nums text-foreground">
            {t("usage", { count: companies.length, max: MAX_COMPANIES })}
          </p>
        )}
      </div>

      <section className="rounded-[6px] border border-border bg-card shadow-etiqueta">
        {branchesQuery.isLoading ? (
          <ul aria-busy className="divide-y divide-border">
            {Array.from({ length: 2 }).map((_, i) => (
              <li key={i} className="p-4">
                <div className="h-11 rounded-[6px] bg-muted motion-safe:animate-pulse" />
              </li>
            ))}
          </ul>
        ) : branchesQuery.isError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 p-6 text-sm">
            <span className="flex items-center gap-2 text-foreground">
              <AlertTriangle size={18} strokeWidth={1.75} className="text-alerta" aria-hidden />
              {t("loadError")}
            </span>
            <Button variant="outline" onClick={() => branchesQuery.refetch()} className="h-11 rounded-[6px]">
              {tc("retry")}
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {companies.map((company) => {
              const isActive = company.id === selectedCompanyId;
              const isMain = company.parent_company_id === null;
              return (
                <li key={company.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
                  <Building2
                    size={20}
                    strokeWidth={1.75}
                    className={cn("shrink-0", isMain ? "text-foreground" : "text-muted-foreground")}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate text-sm font-semibold text-foreground">{company.name}</p>
                    <p className="text-sm text-muted-foreground">{isMain ? t("main") : t("branch")}</p>
                  </div>
                  {isActive ? (
                    <span className="inline-flex h-7 items-center rounded-full bg-sello px-3 text-xs font-semibold text-etiqueta">
                      {t("current")}
                    </span>
                  ) : memberOf.has(company.id) ? (
                    <Button
                      variant="outline"
                      onClick={() => switchCompany(company.id)}
                      aria-label={t("switchLabel", { company: company.name })}
                      className="h-11 gap-2 rounded-[6px] border-foreground bg-card px-4 font-semibold hover:bg-background"
                    >
                      {t("switch")}
                      <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {subscription && !hasMultiCompany ? (
        <section className="flex flex-wrap items-start gap-4 rounded-[6px] border border-ceja bg-ceja/25 p-4 sm:p-6">
          <Sparkles size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-foreground" aria-hidden />
          <div className="min-w-0 flex-1 basis-60 space-y-1">
            <h2 className="text-base font-semibold text-foreground">{t("upgradeTitle")}</h2>
            <p className="max-w-prose text-sm text-foreground/80">
              {t("upgradeDesc", { max: MAX_COMPANIES })}
            </p>
          </div>
          <Button asChild className="h-11 gap-2 rounded-[6px] px-5 font-semibold">
            <Link href={`/${locale}/suscripcion`}>{t("upgradeAction")}</Link>
          </Button>
        </section>
      ) : activeIsBranch && main ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-border bg-background p-4 text-sm">
          <p className="text-muted-foreground">{t("fromBranch")}</p>
          {memberOf.has(main.id) && (
            <Button
              variant="outline"
              onClick={() => switchCompany(main.id)}
              className="h-11 rounded-[6px] border-foreground bg-card font-semibold hover:bg-background"
            >
              {t("goToMain", { company: main.name })}
            </Button>
          )}
        </section>
      ) : branchesQuery.data && atLimit ? (
        <p className="rounded-[6px] border border-border bg-background p-4 text-sm text-muted-foreground">
          {t("limitReached", { max: MAX_COMPANIES })}
        </p>
      ) : subscription && branchesQuery.data && main ? (
        <section className="rounded-[6px] border border-border bg-card p-4 shadow-etiqueta sm:p-6">
          <h2 className="font-display text-2xl font-semibold leading-none text-foreground">{t("addTitle")}</h2>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            {t("addSubtitle", { company: main.name })}
          </p>
          <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 basis-60 space-y-1.5">
              <Label htmlFor="branch-name" className="text-sm font-medium text-foreground">
                {t("name")}
              </Label>
              <Input
                id="branch-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                aria-invalid={nameError}
                aria-describedby={nameError ? "branch-name-error" : undefined}
                className="h-11"
              />
            </div>
            <Button type="submit" disabled={create.isPending} className="h-11 gap-2 rounded-[6px] px-5 font-semibold">
              <Plus size={18} strokeWidth={1.75} aria-hidden />
              {create.isPending ? t("creating") : t("create")}
            </Button>
          </form>
          {nameError && (
            <p id="branch-name-error" className="mt-2 text-sm text-alerta">{t("nameRequired")}</p>
          )}
          {apiError && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-3 rounded-[6px] border border-alerta/30 bg-alerta/[0.06] p-4 text-sm text-foreground"
            >
              <AlertTriangle size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-alerta" aria-hidden />
              <span>
                {t(`errors.${apiError}`, { max: MAX_COMPANIES })}
                {apiError === "module_not_in_plan" && (
                  <>
                    {" "}
                    <Link
                      href={`/${locale}/suscripcion`}
                      className="font-semibold underline underline-offset-4"
                    >
                      {t("upgradeAction")}
                    </Link>
                  </>
                )}
              </span>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
