"use client";
// Variación contra el periodo anterior (FR-007, FR-008): flecha, porcentaje y texto; el color refuerza
// pero nunca es la única señal. Sin base comparable dice "Sin periodo anterior comparable".
import { useTranslations } from "next-intl";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/reports/format";
import type { Variation } from "@/lib/reports/variation";

export function DeltaBadge({ value, className }: { value: Variation; className?: string }) {
  const t = useTranslations("reports.delta");

  if (value.pct === null) {
    return <span className={cn("text-xs text-muted-foreground", className)}>{t("noBase")}</span>;
  }
  const Icon = value.direction === "up" ? ArrowUpRight : value.direction === "down" ? ArrowDownRight : Minus;
  const text =
    value.direction === "flat" ? t("flat") : t(value.direction, { pct: formatPercent(value.pct) });
  const tone =
    value.favorable === null ? "text-muted-foreground" : value.favorable ? "text-sello" : "text-destructive";

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", tone, className)}>
      <Icon size={14} strokeWidth={2} aria-hidden />
      {text}
      <span className="font-normal text-muted-foreground">{t("vs")}</span>
    </span>
  );
}
