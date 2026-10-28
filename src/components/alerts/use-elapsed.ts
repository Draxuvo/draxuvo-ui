// src/components/alerts/use-elapsed.ts — "190 min" como "3 h 10 min" para las alertas (spec 045).
import { useTranslations } from "next-intl";

/** Formatea minutos como min, h o d según su tamaño, con los textos de `alerts.time`. */
export function useElapsed() {
  const t = useTranslations("alerts.time");

  return (minutes: number): string => {
    const total = Math.max(0, Math.round(minutes));
    if (total < 60) return t("minutes", { count: total });

    if (total < 1440) {
      const hours = Math.floor(total / 60);
      const rest = total % 60;
      return rest === 0 ? t("hours", { count: hours }) : t("hoursMinutes", { hours, minutes: rest });
    }

    const days = Math.floor(total / 1440);
    const hours = Math.floor((total % 1440) / 60);
    return hours === 0 ? t("days", { count: days }) : t("daysHours", { days, hours });
  };
}
