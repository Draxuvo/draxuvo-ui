"use client";
// Avisos de "listo" y "cuenta por cobrar" para las pantallas de lista (spec 043, US5 y US6). En Tomar
// pedido la banda abre la cuenta sin salir de la pantalla; aquí navega a la cuenta.
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useRestaurantAlerts } from "@/hooks/use-restaurant-alerts";
import { AlertBanner } from "./alert-banner";
import { useScreenMode } from "./use-screen-mode";

export function RestaurantAlerts() {
  const { mode } = useScreenMode();
  const locale = useLocale();
  const router = useRouter();
  const { alerts, dismiss } = useRestaurantAlerts(mode === "restaurant");
  if (mode !== "restaurant") return null;

  return (
    <AlertBanner
      alerts={alerts}
      onOpen={(alert) => {
        const checkId = alert.kind === "ready" ? alert.item.check_id : alert.checkId;
        dismiss(alert.key);
        router.push(`/${locale}/pedido?cuenta=${checkId}&hoja=1`);
      }}
      onDismiss={dismiss}
    />
  );
}
