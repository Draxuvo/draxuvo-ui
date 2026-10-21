// src/components/attendance/time.ts
const TIME_ZONE = "America/Mexico_City";

/** Hora corta (HH:mm) en la zona del servidor, en el idioma de la interfaz. */
export function shortTime(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
