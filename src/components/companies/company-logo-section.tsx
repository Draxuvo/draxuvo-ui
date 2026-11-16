// src/components/companies/company-logo-section.tsx
// Logo de una empresa en la hoja del super admin (spec 063, US3): lo ve y puede quitarlo (por ejemplo, una imagen
// inapropiada). Subirlo es cosa del dueño o el administrador desde «Mi negocio».
"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { companyLogoService } from "@/services/company-logo";
import type { Company } from "@/types";

const DATE_LOCALES = { es, en: enUS };

export function CompanyLogoSection({ company }: { company: Company }) {
  const t = useTranslations("companies.logo");
  const locale = useLocale() as "es" | "en";
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [removed, setRemoved] = useState(false);
  const logo = removed ? null : company.logo ?? null;

  const remove = useMutation({
    mutationFn: () => companyLogoService.remove(company.id),
    onSuccess: () => {
      setConfirming(false);
      setRemoved(true);
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success(t("removed"));
    },
    onError: () => toast.error(t("error")),
  });

  return (
    <section aria-label={t("title")} className="mt-6 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
      {logo ? (
        <>
          <div className="rounded-md border border-border bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo.url} alt={t("alt", { name: company.name })} className="h-12 w-full object-contain" />
          </div>
          {logo.updated_at && (
            <p className="text-xs text-muted-foreground">
              {t("changedBy", {
                name: logo.updated_by?.name ?? "—",
                date: format(new Date(logo.updated_at), "d MMM yyyy", { locale: DATE_LOCALES[locale] }),
              })}
            </p>
          )}
          {confirming ? (
            <div role="alert" className="space-y-2 rounded-md border border-border p-3">
              <p className="text-sm">{t("removeConfirm", { name: company.name })}</p>
              <div className="flex gap-2">
                <Button type="button" variant="destructive" size="sm" disabled={remove.isPending} onClick={() => remove.mutate()}>
                  {t("removeYes")}
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={remove.isPending} onClick={() => setConfirming(false)}>
                  {t("keep")}
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)}>
              {t("remove")}
            </Button>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      )}
    </section>
  );
}
