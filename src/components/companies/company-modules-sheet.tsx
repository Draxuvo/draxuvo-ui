// src/components/companies/company-modules-sheet.tsx
// Módulos de una empresa para el super admin (spec 017): solo él los activa y desactiva. Cada interruptor guarda al
// momento; si falla, queda como estaba. El módulo extra (spec 053) trae su precio y pide confirmar antes de aplicarlo.
// Spec 058: al final, la sección «Cobro» con «Cobro solo por jefes».
"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { formatCents } from "@/components/subscription/plan-picker";
import { addAddon, getCompanyModules, reactivateAddon, removeAddon, updateModules } from "@/services/subscription";
import { cn } from "@/lib/utils";
import { ChargePolicySection } from "./charge-policy-section";
import type { AddonKey, Company, CompanyAddon, ModuleKey, Subscription } from "@/types";

const DATE_LOCALES = { es, en: enUS };
const ADDON_KEYS: ModuleKey[] = ["pos"];

function addonErrorCode(err: unknown): string | undefined {
  return (err as { response?: { data?: { error?: { details?: { code?: string } } } } }).response?.data?.error?.details?.code;
}

interface CompanyModulesSheetProps {
  company: Company | null;
  subscription: Subscription | null;
  onOpenChange: (open: boolean) => void;
}

export function CompanyModulesSheet({ company, subscription, onOpenChange }: CompanyModulesSheetProps) {
  const t = useTranslations("companies.modules");
  const tm = useTranslations("modules");
  const tp = useTranslations("companies.plans");
  const ta = useTranslations("companies.modules.addon");
  const locale = useLocale() as "es" | "en";
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<{ addon: CompanyAddon; action: "on" | "off" | "again" } | null>(null);

  const details = useQuery({
    queryKey: ["company-modules", company?.id],
    queryFn: () => getCompanyModules(company!.id),
    enabled: !!company,
  });
  const addons = details.data?.addons ?? [];
  const changes = details.data?.changes ?? [];
  const formatDate = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yyyy", { locale: DATE_LOCALES[locale] }) : "");

  const changeAddon = useMutation({
    mutationFn: ({ addon, action }: { addon: CompanyAddon; action: "on" | "off" | "again" }) => {
      const key: AddonKey = addon.key;
      return action === "on" ? addAddon(key, company!.id) : action === "off" ? removeAddon(key, company!.id) : reactivateAddon(key, company!.id);
    },
    onSuccess: () => {
      setConfirming(null);
      queryClient.invalidateQueries({ queryKey: ["company-modules", company!.id] });
      queryClient.invalidateQueries({ queryKey: ["company-subscription", company!.id] });
      toast.success(ta("saved"));
    },
    onError: (err) => {
      const code = addonErrorCode(err);
      const known = ["addon_payment_failed", "addon_requires_module", "addon_not_available", "subscription_not_paid", "subscription_suspended", "billing_managed_by_parent"];
      toast.error(code && known.includes(code) ? ta(`errors.${code}`) : ta("errors.generic"));
    },
  });

  const save = useMutation({
    mutationFn: (disabled: ModuleKey[]) => updateModules(disabled, company!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-subscription", company!.id] });
      toast.success(t("saved"));
    },
    onError: () => toast.error(t("error")),
  });

  // Los extras se manejan con su propia fila (spec 053): no entran a la lista genérica de módulos del plan.
  const available = (subscription?.available_modules ?? []).filter((module) => !ADDON_KEYS.includes(module));
  const savedDisabled = available.filter((module) => !subscription?.active_modules.includes(module));
  // Mientras se guarda se muestra lo que se envió; si falla, vuelve a lo guardado.
  const disabled = save.isPending && save.variables ? save.variables : savedDisabled;

  function toggle(module: ModuleKey, on: boolean) {
    save.mutate(on ? disabled.filter((item) => item !== module) : [...disabled, module]);
  }

  return (
    <Sheet open={!!company} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 px-6 py-5">
          <SheetTitle className="text-base">{t("title", { name: company?.name ?? "" })}</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {subscription ? t("planLine", { plan: tp(subscription.plan), status: subscription.status }) : t("noSubscription")}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {available.length === 0 && addons.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("none")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {available.map((module) => {
                const on = !disabled.includes(module);
                return (
                  <li key={module} className="flex min-h-14 items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{tm(module)}</p>
                      <p className={cn("text-sm", on ? "text-sello" : "text-muted-foreground")}>{on ? t("on") : t("off")}</p>
                    </div>
                    <Switch
                      checked={on}
                      disabled={save.isPending}
                      onCheckedChange={(checked) => toggle(module, checked)}
                      aria-label={tm(module)}
                      className="h-6 w-11 data-[state=checked]:bg-sello data-[state=unchecked]:bg-muted-foreground/70 [&>span]:size-5 [&>span]:data-[state=checked]:translate-x-5"
                    />
                  </li>
                );
              })}
            </ul>
          )}

          {addons.length > 0 && (
            <section aria-label={ta("title")} className="mt-6 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{ta("title")}</h3>
              <ul className="divide-y divide-border">
                {addons.map((addon) => (
                  <AddonRow
                    key={addon.key}
                    addon={addon}
                    name={tm(addon.key)}
                    busy={changeAddon.isPending}
                    formatDate={formatDate}
                    onChange={(action) => setConfirming({ addon, action })}
                  />
                ))}
              </ul>
              {changes.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground">{ta("history")}</h4>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {changes.map((change, index) => (
                      <li key={`${change.created_at}-${index}`}>
                        {ta(change.enabled ? "historyOn" : "historyOff", {
                          name: tm(change.module as ModuleKey),
                          actor: change.actor,
                          date: formatDate(change.created_at),
                        })}
                        {change.amount_after_cents !== null && change.amount_before_cents !== null
                          ? ` · ${formatCents(change.amount_before_cents)} → ${formatCents(change.amount_after_cents)}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Sin suscripción la empresa no opera: no hay cobro que configurar. */}
          {company && subscription && <ChargePolicySection companyId={company.id} />}
        </div>
      </SheetContent>

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && !changeAddon.isPending && setConfirming(null)}>
        <DialogContent className="max-w-sm">
          {confirming && (
            <>
              <DialogHeader>
                <DialogTitle>{ta(`confirm.${confirming.action}.title`, { name: tm(confirming.addon.key) })}</DialogTitle>
                <DialogDescription>
                  {ta(`confirm.${confirming.action}.body`, {
                    price: formatCents(confirming.addon.price[confirming.addon.cycle]),
                    cycle: ta(confirming.addon.cycle === "monthly" ? "perMonth" : "perYear"),
                    date: formatDate(subscription?.current_period_end ?? confirming.addon.ends_at),
                  })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" className="h-11" disabled={changeAddon.isPending} onClick={() => setConfirming(null)}>
                  {ta("cancel")}
                </Button>
                <Button className="h-11" disabled={changeAddon.isPending} onClick={() => changeAddon.mutate(confirming)}>
                  {changeAddon.isPending ? ta("applying") : ta("confirmButton")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}

function AddonRow({
  addon,
  name,
  busy,
  formatDate,
  onChange,
}: {
  addon: CompanyAddon;
  name: string;
  busy: boolean;
  formatDate: (iso: string | null) => string;
  onChange: (action: "on" | "off" | "again") => void;
}) {
  const ta = useTranslations("companies.modules.addon");
  const on = addon.state === "active" || addon.state === "trial";
  const ending = addon.state === "ending";
  const blocked = addon.state === "off" && !addon.available;
  const price = `${formatCents(addon.price[addon.cycle])} ${ta(addon.cycle === "monthly" ? "perMonth" : "perYear")} · ${ta("beforeTax")}`;
  const status = ending ? ta("endsOn", { date: formatDate(addon.ends_at) }) : addon.state === "trial" ? ta("trial") : on ? ta("on") : ta("off");

  return (
    <li className="flex min-h-14 items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{name}</p>
        <p className={cn("text-sm", on || ending ? "text-sello" : "text-muted-foreground")}>{status}</p>
        <p className="text-xs tabular-nums text-muted-foreground">{blocked ? ta("noPrices") : price}</p>
      </div>
      {ending ? (
        <Button variant="outline" className="h-11 shrink-0" disabled={busy} onClick={() => onChange("again")}>
          {ta("reactivate")}
        </Button>
      ) : (
        <Switch
          checked={on}
          disabled={busy || blocked}
          onCheckedChange={(checked) => onChange(checked ? "on" : "off")}
          aria-label={name}
          className="h-6 w-11 data-[state=checked]:bg-sello data-[state=unchecked]:bg-muted-foreground/70 [&>span]:size-5 [&>span]:data-[state=checked]:translate-x-5"
        />
      )}
    </li>
  );
}
