// src/components/terminals/mercado-pago-callback.tsx — termina la conexión con Mercado Pago al volver de autorizar
// (spec 069). Manda `code` y `state` una sola vez (también con el doble montaje de React en desarrollo).
"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConnectCallback } from "@/hooks/use-terminal-connections";
import { useAppRouter } from "@/hooks/use-router";

type Failure = "denied" | "invalid_state" | "authorization_failed" | "failed";

export function MercadoPagoCallback() {
  const t = useTranslations("terminals.callback");
  const params = useSearchParams();
  const router = useAppRouter();
  const connect = useConnectCallback();
  const sent = useRef(false);
  const [apiFailure, setApiFailure] = useState<Failure | null>(null);

  const code = params.get("code");
  const state = params.get("state");
  const denied = params.get("error");
  // Sin código (o con `error`) no hay nada que mandar: el motivo sale de la URL.
  const urlFailure: Failure | null = denied ? "denied" : !code || !state ? "invalid_state" : null;
  const failure = urlFailure ?? apiFailure;

  useEffect(() => {
    if (sent.current || !code || !state || denied) return;
    sent.current = true;
    connect
      .mutateAsync({ provider: "mercado_pago", code, state })
      .then(() => {
        toast.success(t("success"));
        router.replace("/terminales");
      })
      .catch((error: unknown) => {
        const reason = isAxiosError(error) ? error.response?.data?.error?.details?.code : undefined;
        setApiFailure(reason === "invalid_state" || reason === "authorization_failed" ? reason : "failed");
      });
  }, [code, state, denied, connect, router, t]);

  if (!failure) {
    return (
      <p role="status" aria-live="polite" className="py-12 text-center text-muted-foreground">
        {t("title")}
      </p>
    );
  }

  return (
    <div role="alert" className="mx-auto max-w-md space-y-4 py-12 text-center">
      <h1 className="text-xl font-medium">{t("failed")}</h1>
      <p className="text-sm text-muted-foreground">{failure === "failed" ? t("authorization_failed") : t(failure)}</p>
      <Button className="min-h-11" onClick={() => router.replace("/terminales")}>
        {t("back")}
      </Button>
    </div>
  );
}
