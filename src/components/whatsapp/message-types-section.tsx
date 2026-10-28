// src/components/whatsapp/message-types-section.tsx — los tipos de mensaje de WhatsApp y su plantilla (spec 047).
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { WhatsappState } from "@/types";
import { MessageTypeRow } from "./message-type-row";
import { TemplateGuideDialog } from "./template-guide-dialog";

export function MessageTypesSection({ state }: { state: WhatsappState }) {
  const t = useTranslations("whatsapp");
  const [guideOpen, setGuideOpen] = useState(false);
  const connected = state.connection.status === "connected";

  return (
    <section aria-labelledby="wa-types-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="wa-types-title" className="font-display text-xl font-semibold">
            {t("types.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("types.subtitle")}</p>
        </div>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => setGuideOpen(true)}>
          {t("template.guideAll")}
        </Button>
      </div>
      <ul className="space-y-3">
        {state.message_types.map((type) => (
          <MessageTypeRow key={type.kind} type={type} connected={connected} controllable={state.source !== "env"} testsRemaining={state.tests_remaining} />
        ))}
      </ul>
      {guideOpen && <TemplateGuideDialog open onOpenChange={(open) => !open && setGuideOpen(false)} />}
    </section>
  );
}
