// src/components/alerts/my-notifications.tsx — canal de correo de la persona para los avisos de stock bajo (spec 045,
// FR-017 y FR-018). Desde la spec 048 es el único canal externo: el stock bajo se ve siempre en el panel y en la app.
"use client";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useNotificationPreference, useUpdateNotificationPreference } from "@/hooks/use-alerts";

export function MyNotifications() {
  const t = useTranslations("alerts.mine");
  const { data, isLoading, isError } = useNotificationPreference();
  const update = useUpdateNotificationPreference();

  if (isLoading) return <Skeleton className="h-32 w-full" aria-busy="true" />;
  if (isError || !data) return null;

  async function change(patch: { stock_email: boolean }) {
    try {
      await update.mutateAsync(patch);
      toast.success(t("saved"));
    } catch {
      // El aviso global ya mostró el error de la API.
    }
  }

  return (
    <section className="space-y-4 rounded-etiqueta border border-border bg-card p-4" aria-labelledby="my-notifications-title">
      <div>
        <h2 id="my-notifications-title" className="text-base font-medium text-foreground">
          {t("title")}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      <div className="space-y-1">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <Label htmlFor="notify-email">{t("email")}</Label>
          <Switch id="notify-email" checked={data.stock_email} disabled={update.isPending} onCheckedChange={(checked) => change({ stock_email: checked })} />
        </div>
        <p className="text-xs text-muted-foreground">{t("panelNote")}</p>
      </div>
    </section>
  );
}
