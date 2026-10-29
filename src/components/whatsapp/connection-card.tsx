// src/components/whatsapp/connection-card.tsx
// Estado de la conexión de WhatsApp Business y sus acciones (spec 047): conectar, verificar, reemplazar la llave, desconectar.
"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useVerifyConnection } from "@/hooks/use-whatsapp";
import type { WhatsappConnectionStatus, WhatsappSource, WhatsappState } from "@/types";
import { ConnectDialog, DisconnectDialog, useErrorText } from "./connection-dialogs";

const STATUS_VARIANT: Record<WhatsappConnectionStatus, "secondary" | "default" | "destructive"> = {
  not_connected: "secondary",
  connected: "default",
  error: "destructive",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium break-all text-foreground">{value}</dd>
    </div>
  );
}

export function ConnectionCard({ state }: { state: WhatsappState }) {
  const t = useTranslations("whatsapp.connection");
  const locale = useLocale();
  const errorText = useErrorText();
  const verify = useVerifyConnection();
  const [dialog, setDialog] = useState<"connect" | "replace_key" | "disconnect" | null>(null);

  const { connection } = state;
  const source: WhatsappSource = state.source;
  const fromEnv = source === "env";
  const connected = connection.status !== "not_connected";
  const dash = "—";

  function verifyNow() {
    verify.mutate(undefined, {
      onSuccess: (next) => {
        if (next.connection.stale) toast.info(t("verifyUnreachable"));
        else if (next.connection.status === "connected") {
          toast.success(t("verifyOk"));
          if (next.notice === "test_account") toast.info(t("testAccountNotice"));
        }
        else toast.error(t("verifyFailed"));
      },
      onError: (e) => toast.error(errorText(e)),
    });
  }

  const checkedAt = connection.last_verified_at
    ? format(new Date(connection.last_verified_at), "PPp", { locale: locale === "es" ? es : enUS })
    : null;

  return (
    <section aria-labelledby="wa-connection-title" className="space-y-4 rounded-etiqueta border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 id="wa-connection-title" className="font-display text-xl font-semibold">
            {t("title")}
          </h2>
          <Badge variant={STATUS_VARIANT[connection.status]}>{t(`status.${connection.status}`)}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {connected ? (
            <>
              <Button type="button" variant="outline" className="min-h-11" disabled={verify.isPending} onClick={verifyNow}>
                {verify.isPending ? t("verifying") : t("verify")}
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setDialog("replace_key")}>
                {t("replaceKey")}
              </Button>
              <Button type="button" variant="destructive" className="min-h-11" onClick={() => setDialog("disconnect")}>
                {t("disconnectAction")}
              </Button>
            </>
          ) : (
            <Button type="button" className="min-h-11" onClick={() => setDialog("connect")}>
              {fromEnv ? t("connectFromPanel") : t("connect")}
            </Button>
          )}
        </div>
      </div>

      {fromEnv && (
        <p className="rounded-etiqueta border border-border bg-muted p-3 text-sm text-muted-foreground">{t("envNotice")}</p>
      )}

      {connection.status === "error" && (
        <p role="alert" className="rounded-etiqueta border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {t("errorNotice", { detail: connection.error?.message ?? t("errorUnknown") })}
        </p>
      )}

      {connection.stale && <p className="text-sm text-muted-foreground">{t("verifyUnreachable")}</p>}

      {connected || fromEnv ? (
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.verifiedName")} value={connection.verified_name ?? dash} />
          <Field label={t("fields.displayPhone")} value={connection.display_phone_number ?? dash} />
          <Field label={t("fields.phoneNumberId")} value={connection.phone_number_id ?? dash} />
          <Field label={t("fields.wabaId")} value={connection.waba_id ?? dash} />
          <Field
            label={t("fields.token")}
            value={connection.token_present ? (connection.token_hint ? `••••${connection.token_hint}` : t("fields.tokenEnv")) : dash}
          />
          <Field label={t("fields.lastVerified")} value={checkedAt ?? t("fields.never")} />
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">{t("emptyBody")}</p>
      )}

      {dialog === "connect" && <ConnectDialog open mode="connect" connection={connection} onOpenChange={(o) => !o && setDialog(null)} />}
      {dialog === "replace_key" && (
        <ConnectDialog open mode="replace_key" connection={connection} onOpenChange={(o) => !o && setDialog(null)} />
      )}
      {dialog === "disconnect" && <DisconnectDialog open connection={connection} onOpenChange={(o) => !o && setDialog(null)} />}
    </section>
  );
}
