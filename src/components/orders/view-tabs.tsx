"use client";
// Pestañas Activas | Cobradas de Órdenes y Mis órdenes (spec 051). Con una sola vista disponible no se pintan.
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CHIP, CHIP_ON, CHIP_OFF } from "@/components/filters/chip";

export type OrdersView = "activas" | "cobradas";

export function ViewTabs({
  value,
  onChange,
  showActive,
  showPaid,
}: {
  value: OrdersView;
  onChange: (view: OrdersView) => void;
  showActive: boolean;
  showPaid: boolean;
}) {
  const t = useTranslations("ordersView");
  if (!(showActive && showPaid)) return null;
  const tabs: { view: OrdersView; label: string }[] = [
    { view: "activas", label: t("active") },
    { view: "cobradas", label: t("paid") },
  ];
  return (
    <div role="group" aria-label={t("label")} className="flex flex-wrap gap-2">
      {tabs.map(({ view, label }) => (
        <button
          key={view}
          type="button"
          aria-pressed={value === view}
          onClick={() => onChange(view)}
          className={cn(CHIP, "min-h-10 px-4", value === view ? CHIP_ON : CHIP_OFF)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Vista efectiva según lo pedido en la URL y las pestañas disponibles (nunca una que no exista). */
export function resolveView(requested: string | null | undefined, showActive: boolean, showPaid: boolean): OrdersView {
  if (requested === "cobradas" && showPaid) return "cobradas";
  if (!showActive && showPaid) return "cobradas";
  return "activas";
}
