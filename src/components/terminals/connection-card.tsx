// src/components/terminals/connection-card.tsx — conexión de la empresa con Mercado Pago (spec 069, US2): estado, cuenta,
// conectar (OAuth), volver a conectar, desconectar y agregar terminales de la cuenta.
"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuthorizeConnection, useDisconnect } from "@/hooks/use-terminal-connections";
import type { TerminalConnectionStatus, TerminalProviderEntry } from "@/types";
import { DevicesSheet } from "./devices-sheet";

const STATUS_VARIANT: Record<TerminalConnectionStatus, "secondary" | "default" | "destructive"> = {
  connected: "default",
  error: "destructive",
  disconnected: "secondary",
};

const STATUS_KEY: Record<TerminalConnectionStatus, "statusConnected" | "statusError" | "statusDisconnected"> = {
  connected: "statusConnected",
  error: "statusError",
  disconnected: "statusDisconnected",
};

export function ConnectionCard({ entry }: { entry: TerminalProviderEntry }) {
  const t = useTranslations("terminals.connection");
  const tTerminals = useTranslations("terminals");
  const locale = useLocale();
  const authorize = useAuthorizeConnection();
  const disconnect = useDisconnect();
  const [confirming, setConfirming] = useState(false);
  const [adding, setAdding] = useState(false);

  if (!entry.available) return null;

  const connection = entry.connection;
  const status = connection?.status ?? "disconnected";
  const connected = status === "connected";
  const connectedOn = connection?.connected_at
    ? format(new Date(connection.connected_at), "PP", { locale: locale === "es" ? es : enUS })
    : null;

  async function doDisconnect() {
    if (!connection) return;
    try {
      await disconnect.mutateAsync(connection.id);
      toast.success(t("disconnected"));
      setConfirming(false);
    } catch {
      // El aviso global ya mostró el error de la API (p. ej. un cobro esperando en la terminal).
    }
  }

  return (
    <section aria-labelledby="mp-connection-title" className="space-y-3 rounded-etiqueta border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="mp-connection-title" className="text-base font-medium">
            {t("title")}
          </h2>
          {connection && <Badge variant={STATUS_VARIANT[status]}>{t(STATUS_KEY[status])}</Badge>}
          {connection && !connection.live_mode && <Badge variant="secondary">{t("testMode")}</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          {connected && (
            <Button type="button" className="min-h-11" onClick={() => setAdding(true)}>
              {t("addTerminal")}
            </Button>
          )}
          {!connected && (
            <Button type="button" className="min-h-11" disabled={authorize.isPending} onClick={() => authorize.mutate(entry.provider)}>
              {connection ? t("reconnect") : t("connect")}
            </Button>
          )}
          {connection && status !== "disconnected" && (
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setConfirming(true)}>
              {t("disconnect")}
            </Button>
          )}
        </div>
      </div>

      {connection && status !== "disconnected" ? (
        <div className="space-y-1 text-sm text-muted-foreground">
          {connection.account_label && <p>{t("account", { account: connection.account_label })}</p>}
          {connectedOn && <p>{t("connectedOn", { date: connectedOn })}</p>}
          <p>{t("terminalsCount", { count: connection.terminals_count })}</p>
          {status === "error" && (
            <p role="alert" className="text-destructive">
              {connection.error_message} {t("errorHint")}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("disconnectTitle")}</DialogTitle>
            <DialogDescription>{t("disconnectDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setConfirming(false)}>
              {tTerminals("cancel")}
            </Button>
            <Button variant="destructive" className="min-h-11" disabled={disconnect.isPending} onClick={doDisconnect}>
              {t("disconnect")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {connection && connected && <DevicesSheet open={adding} onOpenChange={setAdding} connectionId={connection.id} />}
    </section>
  );
}
