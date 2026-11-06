// src/components/companies/charge-policy-section.tsx
// «Cobro solo por jefes» de una empresa (spec 058, FR-001 a FR-004): solo el super admin lo enciende y apaga, con
// confirmación y los últimos cambios. Vive dentro de la hoja «Módulos» de /empresas.
"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { getChargePolicy, updateChargePolicy } from "@/services/subscription";
import { cn } from "@/lib/utils";

const DATE_LOCALES = { es, en: enUS };

export function ChargePolicySection({ companyId }: { companyId: number }) {
  const t = useTranslations("companies.chargePolicy");
  const locale = useLocale() as "es" | "en";
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<boolean | null>(null);
  const key = ["company-charge-policy", companyId];

  const policy = useQuery({ queryKey: key, queryFn: () => getChargePolicy(companyId) });
  const change = useMutation({
    mutationFn: (enabled: boolean) => updateChargePolicy(companyId, enabled),
    onSuccess: (data) => {
      queryClient.setQueryData(key, data);
      setConfirming(null);
      toast.success(t("saved"));
    },
    onError: () => toast.error(t("error")),
  });

  const on = policy.data?.boss_only_charge ?? false;
  const changes = policy.data?.changes ?? [];
  const formatDate = (iso: string) => format(new Date(iso), "d MMM yyyy, HH:mm", { locale: DATE_LOCALES[locale] });

  return (
    <section aria-label={t("title")} className="mt-6 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("title")}</h3>
      <div className="flex min-h-14 items-center justify-between gap-4 py-1">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{t("label")}</p>
          <p className={cn("text-sm", on ? "text-sello" : "text-muted-foreground")}>{on ? t("on") : t("off")}</p>
          <p className="text-xs text-muted-foreground">{t("description")}</p>
        </div>
        <Switch
          checked={on}
          disabled={!policy.data || change.isPending}
          onCheckedChange={(checked) => setConfirming(checked)}
          aria-label={t("label")}
          className="h-6 w-11 shrink-0 data-[state=checked]:bg-sello data-[state=unchecked]:bg-muted-foreground/70 [&>span]:size-5 [&>span]:data-[state=checked]:translate-x-5"
        />
      </div>
      {changes.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground">{t("history")}</h4>
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            {changes.map((item, index) => (
              <li key={`${item.created_at}-${index}`}>
                {t(item.enabled ? "historyOn" : "historyOff", { actor: item.actor, date: formatDate(item.created_at) })}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && !change.isPending && setConfirming(null)}>
        <DialogContent className="max-w-sm">
          {confirming !== null && (
            <>
              <DialogHeader>
                <DialogTitle>{t(`confirm.${confirming ? "on" : "off"}.title`)}</DialogTitle>
                <DialogDescription>{t(`confirm.${confirming ? "on" : "off"}.body`)}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" className="h-11" disabled={change.isPending} onClick={() => setConfirming(null)}>
                  {t("cancel")}
                </Button>
                <Button className="h-11" disabled={change.isPending} onClick={() => change.mutate(confirming)}>
                  {change.isPending ? t("applying") : t("confirmButton")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
