// src/components/whatsapp/test-dialog.tsx
// Mensaje de prueba de un tipo (spec 047): llega marcado como prueba, funciona con el canal apagado y tiene límite por hora.
"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTestMessage } from "@/hooks/use-whatsapp";
import { useAuthStore } from "@/store/auth";
import type { WhatsappKind } from "@/types";
import { useErrorText } from "./connection-dialogs";

interface TestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: WhatsappKind;
  testsRemaining: number;
}

export function TestDialog({ open, onOpenChange, kind, testsRemaining }: TestDialogProps) {
  const t = useTranslations("whatsapp");
  const locale = useLocale();
  const errorText = useErrorText();
  const profilePhone = useAuthStore((s) => s.user?.phone);
  const test = useTestMessage(kind);

  const [phone, setPhone] = useState(profilePhone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ to: string; at: Date } | null>(null);

  const digits = phone.replace(/\D/g, "");
  const outOfTests = testsRemaining <= 0;

  function close(next: boolean) {
    if (!next) {
      setError(null);
      setSent(null);
    }
    onOpenChange(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (digits.length < 10 || digits.length > 15) return setError(t("test.errorPhone"));
    setError(null);
    setSent(null);
    test.mutate(digits, {
      onSuccess: (res) => setSent({ to: res.to, at: new Date() }),
      onError: (err) => setError(errorText(err)),
    });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t("test.title", { type: t(`types.${kind}.label`) })}</DialogTitle>
            <DialogDescription>{t("test.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor={`wa-test-phone-${kind}`}>{t("test.phone")}</Label>
            <Input
              id={`wa-test-phone-${kind}`}
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("test.phoneHelp")}</p>
          </div>

          <p className="text-sm text-muted-foreground">{t("test.remaining", { count: testsRemaining })}</p>
          {outOfTests && !error && <p className="text-sm text-destructive">{t("test.limit")}</p>}

          {sent && (
            <p role="status" className="rounded-etiqueta border border-border bg-muted p-3 text-sm text-foreground">
              {t("test.sent", {
                to: sent.to,
                time: format(sent.at, "p", { locale: locale === "es" ? es : enUS }),
              })}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              {t("test.close")}
            </Button>
            <Button type="submit" disabled={test.isPending || outOfTests}>
              {test.isPending ? t("test.sending") : t("test.send")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
