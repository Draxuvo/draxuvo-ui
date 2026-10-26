// src/app/[locale]/(super-admin)/demos/page.tsx
// Demos (spec 039): el equipo comercial genera enlaces de demo y ve quién los abrió. Solo super admin.
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { InvitesTab } from "@/components/demo/invites-tab";
import { SessionsTab } from "@/components/demo/sessions-tab";
import { cn } from "@/lib/utils";

const TABS = ["invites", "sessions"] as const;

export default function DemosPage() {
  const t = useTranslations("demo.admin");
  const [tab, setTab] = useState<(typeof TABS)[number]>("invites");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl leading-tight font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div role="tablist" aria-label={t("tabs.label")} className="flex gap-1 border-b border-border">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`demos-tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`demos-panel-${key}`}
            onClick={() => setTab(key)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium foco-etiqueta",
              tab === key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`demos-panel-${tab}`} aria-labelledby={`demos-tab-${tab}`}>
        {tab === "invites" ? <InvitesTab /> : <SessionsTab />}
      </div>
    </div>
  );
}
