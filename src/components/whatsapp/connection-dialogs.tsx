// src/components/whatsapp/connection-dialogs.tsx
// Conectar o reemplazar la llave y desconectar (spec 047). La llave nunca se muestra: solo se captura.
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDisconnect, useSaveConnection } from "@/hooks/use-whatsapp";
import { whatsappError } from "@/lib/whatsapp";
import type { WhatsappConnection } from "@/types";

type Translate = ReturnType<typeof useTranslations>;

/** Códigos con que la API explica por qué un tipo no se puede encender ni probar. */
const BLOCKED_CODES = ["connection_error", "template_not_approved", "template_incompatible"];

/** Texto del error de una acción: el motivo del rechazo de Meta, el conflicto de edición o uno genérico. */
export function useErrorText() {
  const t = useTranslations("whatsapp");
  return (error: unknown): string => {
    const info = whatsappError(error);
    if (info.code === "stale_object") return t("errors.stale");
    if (info.code === "meta_unreachable") return t("reasons.meta_unreachable");
    if (info.code === "token_required") return t("errors.tokenRequired");
    if (info.code === "not_connected") return t("errors.notConnected");
    if (info.code === "tests_limit") return t("test.limit");
    if (info.code === "invalid_phone") return t("test.errorPhone");
    if (info.code && BLOCKED_CODES.includes(info.code)) return t(`types.blocked.${info.code}`);
    if (info.reason) return reasonText(t, info.reason) + (info.metaCode ? ` (${t("errors.metaCode", { code: info.metaCode })})` : "");
    return t("errors.generic");
  };
}

function reasonText(t: Translate, reason: string): string {
  return t.has(`reasons.${reason}`) ? t(`reasons.${reason}`) : t("reasons.unknown");
}

const DIGITS = /^\d{6,20}$/;

interface ConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: WhatsappConnection;
  /** `replace_key` solo pide la llave nueva y conserva número y cuenta. */
  mode: "connect" | "replace_key";
}

export function ConnectDialog({ open, onOpenChange, connection, mode }: ConnectDialogProps) {
  const t = useTranslations("whatsapp.connection.dialog");
  const errorText = useErrorText();
  const save = useSaveConnection();

  const [token, setToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState(connection.phone_number_id ?? "");
  const [wabaId, setWabaId] = useState(connection.waba_id ?? "");
  const [error, setError] = useState<string | null>(null);

  const replacing = mode === "replace_key";

  function close(next: boolean) {
    if (!next) {
      setToken("");
      setError(null);
    }
    onOpenChange(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim() && (replacing || !connection.token_present)) return setError(t("errorToken"));
    if (!replacing && !DIGITS.test(phoneNumberId.trim())) return setError(t("errorPhone"));
    if (!replacing && !DIGITS.test(wabaId.trim())) return setError(t("errorWaba"));
    setError(null);

    save.mutate(
      {
        ...(token.trim() ? { access_token: token.trim() } : {}),
        ...(replacing ? {} : { phone_number_id: phoneNumberId.trim(), waba_id: wabaId.trim() }),
        lock_version: connection.lock_version,
      },
      {
        onSuccess: (next) => {
          toast.success(replacing ? t("replaced") : t("connected"));
          if (next.notice === "test_account") toast.info(t("testAccount"));
          close(false);
        },
        onError: (e) => setError(errorText(e)),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>{replacing ? t("replaceTitle") : t("connectTitle")}</DialogTitle>
            <DialogDescription>{replacing ? t("replaceBody") : t("connectBody")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="wa-token">{t("token")}</Label>
            <Input
              id="wa-token"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={token}
              placeholder={connection.token_present && !replacing ? t("tokenKeep") : ""}
              onChange={(e) => setToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("tokenHelp")}</p>
          </div>

          {!replacing && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="wa-phone">{t("phoneNumberId")}</Label>
                <Input id="wa-phone" inputMode="numeric" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
                <p className="text-xs text-muted-foreground">{t("phoneNumberIdHelp")}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wa-waba">{t("wabaId")}</Label>
                <Input id="wa-waba" inputMode="numeric" value={wabaId} onChange={(e) => setWabaId(e.target.value)} />
                <p className="text-xs text-muted-foreground">{t("wabaIdHelp")}</p>
              </div>
            </>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? t("verifying") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DisconnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: WhatsappConnection;
}

export function DisconnectDialog({ open, onOpenChange, connection }: DisconnectDialogProps) {
  const t = useTranslations("whatsapp.connection.disconnect");
  const errorText = useErrorText();
  const disconnect = useDisconnect();
  const [error, setError] = useState<string | null>(null);

  function close(next: boolean) {
    if (!next) setError(null);
    onOpenChange(next);
  }

  function confirm() {
    setError(null);
    disconnect.mutate(
      { confirm: true, lock_version: connection.lock_version },
      {
        onSuccess: () => {
          toast.success(t("done"));
          close(false);
        },
        onError: (e) => setError(errorText(e)),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{connection.enabled ? t("bodyOn") : t("bodyOff")}</DialogDescription>
        </DialogHeader>
        {connection.enabled && (
          <p role="alert" className="rounded-etiqueta border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {t("warningOn")}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            {t("cancel")}
          </Button>
          <Button type="button" variant="destructive" disabled={disconnect.isPending} onClick={confirm}>
            {disconnect.isPending ? t("working") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
