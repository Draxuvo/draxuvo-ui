"use client";
// Módulos extra de la suscripción (spec 050): precio, contratar con cobro proporcional, baja al fin del periodo,
// reactivar y desglose del cobro (plan + extras + IVA). Durante la prueba o sin suscripción pagada el extra no se
// contrata aquí: se marca para sumarlo al pago del plan.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { toast } from "sonner";
import { Puzzle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCents } from "@/components/subscription/plan-picker";
import { addAddon, reactivateAddon, removeAddon } from "@/services/subscription";
import { getPlans } from "@/services/plans";
import { useAuthStore } from "@/store/auth";
import type { AddonCatalogItem, AddonKey, BillingCycle, ModuleKey, Subscription, SubscriptionAddon } from "@/types";

const DATE_LOCALES = { es, en: enUS };

/** `manage`: suscripción pagada (contratar y dar de baja aquí); `pay`: se elige para sumarlo al pago; `readonly`: solo ver. */
export type AddonsMode = "manage" | "pay" | "readonly";

interface AddonsSectionProps {
  subscription: Subscription;
  mode: AddonsMode;
  /** Ciclo con el que se muestra el precio (el de la suscripción o el elegido para pagar). */
  cycle: BillingCycle;
  selected?: AddonKey[];
  onToggle?: (key: AddonKey) => void;
  /** En solo lectura, avisa que solo dueño y administrador contratan (no tiene sentido en una demo). */
  readOnlyNote?: boolean;
}

function errorCode(err: unknown): string | undefined {
  return (err as { response?: { data?: { error?: { details?: { code?: string; required?: string } } } } }).response?.data?.error?.details?.code;
}

export function AddonsSection({ subscription, mode, cycle, selected = [], onToggle, readOnlyNote = true }: AddonsSectionProps) {
  const t = useTranslations("subscription.addons");
  const tm = useTranslations("modules");
  const locale = useLocale() as "es" | "en";
  const client = useQueryClient();
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  const [removing, setRemoving] = useState<AddonKey | null>(null);

  const { data: catalog } = useQuery({ queryKey: ["plans"], queryFn: getPlans, staleTime: 5 * 60_000 });
  const addons = catalog?.addons ?? [];
  const contracted = new Map<string, SubscriptionAddon>((subscription.addons ?? []).map((a) => [a.module, a]));

  const formatDate = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yyyy", { locale: DATE_LOCALES[locale] }) : "");
  const nameOf = (key: AddonKey) => tm(key);

  function done(updated: Subscription) {
    client.setQueryData(["subscription", companyId], updated);
    client.invalidateQueries({ queryKey: ["subscription"] });
    client.invalidateQueries({ queryKey: ["sales", "probe"] });
  }

  function failed(err: unknown, item: AddonCatalogItem) {
    const code = errorCode(err);
    if (code === "addon_requires_module") return void toast.error(t("errors.addon_requires_module", { modules: item.requires.map((m) => tm(m)).join(", ") }));
    const known = ["addon_payment_failed", "subscription_not_paid", "subscription_suspended"] as const;
    toast.error(code && (known as readonly string[]).includes(code) ? t(`errors.${code as (typeof known)[number]}`) : t("errors.generic"));
  }

  const add = useMutation({
    mutationFn: (item: AddonCatalogItem) => addAddon(item.key),
    onSuccess: (updated, item) => {
      done(updated);
      toast.success(t("added", { name: nameOf(item.key) }));
    },
    onError: failed,
  });
  const remove = useMutation({
    mutationFn: (item: AddonCatalogItem) => removeAddon(item.key),
    onSuccess: (updated, item) => {
      done(updated);
      setRemoving(null);
      toast.success(t("removed", { name: nameOf(item.key), date: formatDate(updated.addons?.find((a) => a.module === item.key)?.ends_at ?? null) }));
    },
    onError: (err, item) => failed(err, item),
  });
  const reactivate = useMutation({
    mutationFn: (item: AddonCatalogItem) => reactivateAddon(item.key),
    onSuccess: (updated, item) => {
      done(updated);
      toast.success(t("reactivated", { name: nameOf(item.key) }));
    },
    onError: failed,
  });

  if (addons.length === 0 && (subscription.addons ?? []).length === 0) return null;

  const busy = add.isPending || remove.isPending || reactivate.isPending;
  const removingItem = addons.find((a) => a.key === removing) ?? null;
  const removingRow = removing ? contracted.get(removing) : undefined;
  const missingModules = (item: AddonCatalogItem): ModuleKey[] => item.requires.filter((m) => !subscription.available_modules.includes(m));

  return (
    <section aria-labelledby="addons-heading" className="space-y-4 rounded-etiqueta border border-border bg-card p-4 text-card-foreground shadow-etiqueta sm:p-6">
      <div>
        <h2 id="addons-heading" className="font-display text-2xl font-extrabold uppercase leading-none">
          {t("title")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("desc")}</p>
      </div>

      <ul className="space-y-3">
        {addons.map((item) => {
          const row = contracted.get(item.key);
          const price = item.prices[cycle];
          const missing = missingModules(item);
          const picked = selected.includes(item.key);
          return (
            <li key={item.key} className="flex flex-wrap items-start justify-between gap-3 rounded-etiqueta border border-border bg-background p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold">
                  <Puzzle size={16} aria-hidden />
                  {nameOf(item.key)}
                  {row && (
                    <Badge variant="secondary" className="h-6 rounded-full px-2.5 text-xs font-semibold">
                      {row.status === "ending" ? t("endsOn", { date: formatDate(row.ends_at) }) : t("contracted")}
                    </Badge>
                  )}
                </p>
                <p className="mt-1 text-sm tabular-nums">
                  {t(cycle === "monthly" ? "perMonth" : "perYear", { price: formatCents(price.amount_cents) })} · {t("beforeTax")}
                </p>
                {missing.length > 0 && !row && (
                  <p className="mt-1 text-sm text-muted-foreground">{t("requires", { modules: missing.map((m) => tm(m)).join(", ") })}</p>
                )}
                {mode === "manage" && !row && missing.length === 0 && <p className="mt-1 text-xs text-muted-foreground">{t("prorationNote")}</p>}
                {mode === "pay" && picked && <p className="mt-1 text-xs text-muted-foreground">{t("selectedForCheckout")}</p>}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {mode === "manage" && !row && (
                  <Button className="h-11" disabled={busy || missing.length > 0} onClick={() => add.mutate(item)}>
                    {add.isPending && add.variables?.key === item.key ? t("contracting") : t("contract")}
                  </Button>
                )}
                {mode === "manage" && row?.status === "active" && (
                  <Button variant="outline" className="h-11" disabled={busy} onClick={() => setRemoving(item.key)}>
                    {t("remove")}
                  </Button>
                )}
                {mode === "manage" && row?.status === "ending" && (
                  <Button variant="outline" className="h-11" disabled={busy} onClick={() => reactivate.mutate(item)}>
                    {reactivate.isPending ? t("reactivating") : t("reactivate")}
                  </Button>
                )}
                {mode === "pay" && (
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={picked}
                      disabled={missing.length > 0}
                      onChange={() => onToggle?.(item.key)}
                    />
                    {t("includeInCheckout", { name: nameOf(item.key) })}
                  </label>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {mode === "readonly" && readOnlyNote && <p className="text-sm text-muted-foreground">{t("readOnly")}</p>}

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("removeTitle", { name: removing ? nameOf(removing) : "" })}</DialogTitle>
            <DialogDescription>{t("removeBody", { date: formatDate(subscription.current_period_end ?? removingRow?.ends_at ?? null) })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-11" onClick={() => setRemoving(null)}>
              {t("keep")}
            </Button>
            <Button className="h-11" disabled={remove.isPending || !removingItem} onClick={() => removingItem && remove.mutate(removingItem)}>
              {remove.isPending ? t("removing") : t("removeConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Desglose del cobro recurrente: plan, cada módulo extra, subtotal, IVA y total (spec 050, FR-004). */
export function BillingBreakdown({ subscription, planName }: { subscription: Subscription; planName: string }) {
  const t = useTranslations("subscription.addons");
  const tm = useTranslations("modules");
  const addons = subscription.addons ?? [];
  if (addons.length === 0) return null;
  const subtotal = subscription.amount_cents + (subscription.addons_cents ?? 0);

  return (
    <dl aria-label={t("breakdown.title")} className="space-y-1 rounded-etiqueta border border-border bg-background p-3 text-sm tabular-nums">
      <Row label={t("breakdown.plan", { plan: planName })} value={formatCents(subscription.amount_cents)} />
      {addons.map((addon) => (
        <Row key={addon.module} label={t("breakdown.addon", { name: tm(addon.module) })} value={formatCents(addon.amount_cents)} />
      ))}
      <Row label={t("breakdown.subtotal")} value={formatCents(subtotal)} />
      <Row label={t("breakdown.iva")} value={formatCents(subscription.iva_cents)} />
      <Row label={t("breakdown.total")} value={formatCents(subscription.total_cents)} strong />
    </dl>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between gap-4 border-t border-border pt-1 font-semibold" : "flex justify-between gap-4"}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
