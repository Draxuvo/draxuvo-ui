// src/components/demo/demo-banner.tsx
// Aviso permanente de demostración (spec 039, FR-005) con el paso al registro y la salida. También monta la pantalla
// de «tu demo terminó», porque va en todos los marcos donde puede estar quien está en una demo.
"use client";
import { useTranslations } from "next-intl";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoInfo, useLeaveDemo } from "@/hooks/use-demo";
import { DemoExpired } from "./demo-expired";

export function DemoBanner() {
  const t = useTranslations("demo.banner");
  const tp = useTranslations("plans");
  const { isDemo, info } = useDemoInfo();
  const { leave, pending } = useLeaveDemo();

  if (!isDemo) return null;
  const plan = info?.plan;

  return (
    <>
      <div
        role="status"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-primary/30 bg-primary/10 px-4 py-2 text-sm text-foreground sm:px-6"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <FlaskConical size={14} className="shrink-0 text-primary" aria-hidden="true" />
          <span className="font-medium">{plan ? t("text", { plan: tp(plan) }) : t("text", { plan: "" })}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <Button size="sm" disabled={pending} onClick={() => void leave("signup", plan)}>
            {t("create")}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => void leave("left", plan)}>
            {pending ? t("leaving") : t("leave")}
          </Button>
        </span>
      </div>
      <DemoExpired />
    </>
  );
}
