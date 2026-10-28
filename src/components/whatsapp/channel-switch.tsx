// src/components/whatsapp/channel-switch.tsx
// Interruptor general del canal de WhatsApp (spec 047): un solo botón para toda la plataforma. Apagar siempre se puede;
// encender exige una conexión válida. Las elecciones por tipo se conservan al apagar.
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useSetChannel } from "@/hooks/use-whatsapp";
import type { WhatsappState } from "@/types";
import { useErrorText } from "./connection-dialogs";

export function ChannelSwitch({ state }: { state: WhatsappState }) {
  const t = useTranslations("whatsapp.channel");
  const errorText = useErrorText();
  const setChannel = useSetChannel();
  const [error, setError] = useState<string | null>(null);

  const { connection } = state;
  const connected = connection.status === "connected";
  const on = connection.enabled;
  // Para encender hace falta una conexión válida; para apagar nunca hay bloqueo.
  const blocked = !on && !connected;
  const sending = on && connected;

  function toggle(next: boolean) {
    setError(null);
    setChannel.mutate(
      { enabled: next, lock_version: connection.lock_version },
      {
        onSuccess: () => toast.success(next ? t("turnedOn") : t("turnedOff")),
        onError: (e) => setError(errorText(e)),
      },
    );
  }

  return (
    <section aria-labelledby="wa-channel-title" className="space-y-3 rounded-etiqueta border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="wa-channel-title" className="font-display text-xl font-semibold">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-medium text-foreground" aria-hidden>
            {on ? t("on") : t("off")}
          </span>
          <Switch
            checked={on}
            disabled={blocked || setChannel.isPending}
            aria-label={t("title")}
            onCheckedChange={toggle}
          />
        </div>
      </div>

      {blocked && <p className="text-sm text-muted-foreground">{t(connection.status === "error" ? "blockedError" : "blockedNotConnected")}</p>}
      {on && !connected && (
        <p role="status" className="rounded-etiqueta border border-border bg-muted p-3 text-sm text-muted-foreground">
          {t("unavailableConnection")}
        </p>
      )}
      {!on && connected && <p className="text-sm text-muted-foreground">{t("unavailableOff")}</p>}
      {sending && <p className="text-sm text-muted-foreground">{t("sending")}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
