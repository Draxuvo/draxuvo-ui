// src/components/terminals/own-credentials-dialog.tsx — conectar Mercado Pago con las credenciales de la aplicación
// propia del negocio (spec 069, credenciales propias). Dos pasos con instrucciones: «token» (crear la aplicación y pegar
// el Access Token) y «avisos» (copiar la URL de avisos de esta conexión a Mercado Pago y pegar su clave secreta).
// Solo dueño y administrador llegan aquí; la API nunca devuelve el token ni la clave.
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveCredentials } from "@/hooks/use-terminal-connections";
import type { TerminalConnection, TerminalProvider } from "@/types";

export const MP_DEVELOPERS_URL = "https://www.mercadopago.com.mx/developers/panel/app";

export type CredentialsStep = "token" | "webhook";

interface ErrorShape {
  response?: { data?: { error?: { message?: string } } };
}

function apiMessage(error: unknown): string | null {
  return (error as ErrorShape)?.response?.data?.error?.message ?? null;
}

export function OwnCredentialsDialog({
  open,
  onOpenChange,
  provider,
  connection,
  initialStep = "token",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: TerminalProvider;
  connection: TerminalConnection | null;
  initialStep?: CredentialsStep;
}) {
  const t = useTranslations("terminals.ownCredentials");
  const save = useSaveCredentials();
  const [step, setStep] = useState<CredentialsStep>(initialStep);
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  // La URL de avisos llega con la respuesta al conectar; si ya estaba conectada, viene de la conexión.
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const url = webhookUrl ?? connection?.webhook_url ?? null;
  const secretSaved = connection?.webhook_secret_present ?? false;

  function reset(nextOpen: boolean) {
    if (!nextOpen) {
      setToken("");
      setSecret("");
      setError(null);
      setWebhookUrl(null);
      setStep(initialStep);
    }
    onOpenChange(nextOpen);
  }

  async function connect(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const result = await save.mutateAsync({ provider, access_token: token.trim() });
      setToken("");
      setWebhookUrl(result.webhook_url ?? null);
      toast.success(t("connected"));
      setStep("webhook");
    } catch (err) {
      setError(apiMessage(err) ?? t("genericError"));
    }
  }

  async function saveSecret(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({ provider, access_token: "", webhook_secret: secret.trim() });
      toast.success(t("secretSaved"));
      reset(false);
    } catch (err) {
      setError(apiMessage(err) ?? t("genericError"));
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("copied"));
    } catch {
      // Sin permiso de portapapeles la URL sigue a la vista para copiarla a mano.
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        {step === "token" ? (
          <form onSubmit={connect} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t("tokenTitle")}</DialogTitle>
              <DialogDescription>{t("tokenIntro")}</DialogDescription>
            </DialogHeader>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
              <li>
                {t("step1")}{" "}
                <a href={MP_DEVELOPERS_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline">
                  {t("step1Link")}
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              </li>
              <li>{t("step2")}</li>
              <li>{t("step3")}</li>
            </ol>
            <div className="space-y-1.5">
              <Label htmlFor="mp-access-token">{t("tokenLabel")}</Label>
              <Input
                id="mp-access-token"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="APP_USR-…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="min-h-11 font-mono"
                aria-describedby="mp-access-token-help"
                aria-invalid={error ? true : undefined}
              />
              <p id="mp-access-token-help" className="text-xs text-muted-foreground">
                {connection?.token_hint ? t("tokenReplaceHelp", { hint: connection.token_hint }) : t("tokenHelp")}
              </p>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => reset(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" className="min-h-11" disabled={save.isPending || token.trim() === ""}>
                {save.isPending ? t("checking") : t("connect")}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={saveSecret} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t("webhookTitle")}</DialogTitle>
              <DialogDescription>{t("webhookIntro")}</DialogDescription>
            </DialogHeader>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
              <li>{t("webhookStep1")}</li>
              <li>
                {t("webhookStep2")}
                {url && (
                  <div className="mt-2 flex items-center gap-2">
                    <code className="min-w-0 flex-1 break-all rounded-etiqueta border border-border bg-muted px-2 py-1.5 text-xs">{url}</code>
                    <Button type="button" variant="outline" className="min-h-11 shrink-0 gap-1.5" onClick={copy}>
                      <Copy size={14} aria-hidden="true" />
                      {t("copy")}
                    </Button>
                  </div>
                )}
              </li>
              <li>{t("webhookStep3")}</li>
              <li>{t("webhookStep4")}</li>
            </ol>
            <div className="space-y-1.5">
              <Label htmlFor="mp-webhook-secret">{t("secretLabel")}</Label>
              <Input
                id="mp-webhook-secret"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="min-h-11 font-mono"
                aria-describedby="mp-webhook-secret-help"
                aria-invalid={error ? true : undefined}
              />
              <p id="mp-webhook-secret-help" className="text-xs text-muted-foreground">
                {secretSaved ? t("secretReplaceHelp") : t("secretHelp")}
              </p>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => reset(false)}>
                {t("later")}
              </Button>
              <Button type="submit" className="min-h-11" disabled={save.isPending || secret.trim() === ""}>
                {t("saveSecret")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
