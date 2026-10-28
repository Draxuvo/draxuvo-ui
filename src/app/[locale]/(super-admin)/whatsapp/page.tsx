// src/app/[locale]/(super-admin)/whatsapp/page.tsx
// WhatsApp (spec 047): el equipo de Draxuvo conecta y mantiene la cuenta de WhatsApp Business. Solo super admin.
"use client";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChannelSwitch } from "@/components/whatsapp/channel-switch";
import { ConnectionCard } from "@/components/whatsapp/connection-card";
import { MessageTypesSection } from "@/components/whatsapp/message-types-section";
import { useWhatsappState } from "@/hooks/use-whatsapp";

export default function WhatsappPage() {
  const t = useTranslations("whatsapp");
  const { data, isLoading, isError, refetch } = useWhatsappState();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl leading-tight font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {isLoading && <Skeleton className="h-64 w-full" aria-busy="true" />}

      {data && <ConnectionCard state={data} />}
      {data && data.source !== "env" && <ChannelSwitch state={data} />}
      {data && <MessageTypesSection state={data} />}

      {!isLoading && (isError || !data) && (
        <div role="alert" className="rounded-etiqueta border border-border bg-card p-6 text-center">
          <p className="text-sm font-medium text-foreground">{t("error.title")}</p>
          <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => refetch()}>
            {t("error.retry")}
          </Button>
        </div>
      )}
    </div>
  );
}
