// src/components/whatsapp/message-type-row.tsx
// Un tipo de mensaje (código de verificación, stock bajo, ticket) con su plantilla y su estado en Meta (spec 047).
"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateMessageType, useVerifyMessageType } from "@/hooks/use-whatsapp";
import type { WhatsappMessageType, WhatsappTemplateStatus } from "@/types";
import { useErrorText } from "./connection-dialogs";
import { TemplateGuideDialog } from "./template-guide-dialog";

const STATUS_VARIANT: Record<WhatsappTemplateStatus, "secondary" | "default" | "destructive" | "outline"> = {
  unknown: "secondary",
  approved: "default",
  pending: "outline",
  rejected: "destructive",
  not_found: "destructive",
  incompatible: "destructive",
};

export function MessageTypeRow({ type, connected }: { type: WhatsappMessageType; connected: boolean }) {
  const t = useTranslations("whatsapp");
  const locale = useLocale();
  const errorText = useErrorText();
  const update = useUpdateMessageType(type.kind);
  const verify = useVerifyMessageType(type.kind);

  const [name, setName] = useState(type.template_name ?? "");
  const [language, setLanguage] = useState(type.template_language ?? "");
  const [guideOpen, setGuideOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateLocale = locale === "es" ? es : enUS;
  const changed = name.trim() !== (type.template_name ?? "") || language.trim() !== (type.template_language ?? "");
  const checkedAt = type.template_checked_at ? format(new Date(type.template_checked_at), "PPp", { locale: dateLocale }) : null;
  const status = type.template_status ?? "unknown";

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError(t("template.errorName"));
    if (!/^[a-z]{2}(_[A-Z]{2})?$/.test(language.trim())) return setError(t("template.errorLanguage"));
    setError(null);
    update.mutate(
      { template_name: name.trim(), template_language: language.trim(), lock_version: type.lock_version },
      {
        onSuccess: (next) => {
          const saved = next.message_types.find((item) => item.kind === type.kind);
          if (saved?.stale) toast.info(t("template.staleToast"));
          else toast.success(t("template.saved"));
        },
        onError: (err) => setError(errorText(err)),
      },
    );
  }

  function verifyNow() {
    setError(null);
    verify.mutate(undefined, {
      onSuccess: (next) => {
        const checked = next.message_types.find((item) => item.kind === type.kind);
        if (checked?.stale) toast.info(t("template.staleToast"));
        else toast.success(t(`template.verified.${checked?.template_status ?? "unknown"}`));
      },
      onError: (err) => setError(errorText(err)),
    });
  }

  return (
    <li className="space-y-3 rounded-etiqueta border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold">{t(`types.${type.kind}.label`)}</h3>
          <p className="text-sm text-muted-foreground">{t(`types.${type.kind}.description`)}</p>
        </div>
        {type.uses_template && (
          <Badge variant={STATUS_VARIANT[status]}>{t(`template.status.${status}`)}</Badge>
        )}
      </div>

      {type.uses_template ? (
        <>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor={`tpl-name-${type.kind}`}>{t("template.name")}</Label>
              <Input id={`tpl-name-${type.kind}`} value={name} spellCheck={false} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`tpl-lang-${type.kind}`}>{t("template.language")}</Label>
              <Input id={`tpl-lang-${type.kind}`} value={language} spellCheck={false} onChange={(e) => setLanguage(e.target.value)} />
            </div>
            <Button type="submit" className="min-h-11" disabled={!changed || update.isPending}>
              {update.isPending ? t("template.saving") : t("template.save")}
            </Button>
          </form>

          {type.template_detail && <p className="text-sm text-muted-foreground">{type.template_detail}</p>}
          {type.stale && <p className="text-sm text-muted-foreground">{t("template.stale")}</p>}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="min-h-11" disabled={!connected || verify.isPending} onClick={verifyNow}>
              {verify.isPending ? t("template.verifying") : t("template.verify")}
            </Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setGuideOpen(true)}>
              {t("template.guide")}
            </Button>
            <span className="text-xs text-muted-foreground">
              {checkedAt ? t("template.checkedAt", { date: checkedAt }) : t("template.neverChecked")}
            </span>
          </div>
          {!connected && <p className="text-xs text-muted-foreground">{t("template.needsConnection")}</p>}

          {guideOpen && <TemplateGuideDialog open kind={type.kind} onOpenChange={(open) => !open && setGuideOpen(false)} />}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("template.none")}</p>
      )}
    </li>
  );
}
