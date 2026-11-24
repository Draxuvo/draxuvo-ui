// src/lib/login-attempts.ts — filtros de «Accesos» en la URL y formato de fechas en la hora de México (spec 073).
import type { LoginAttemptChannel, LoginAttemptFilters, LoginAttemptResult } from "@/types";

export const RESULTS: LoginAttemptResult[] = ["success", "wrong_password", "unknown_email", "inactive", "rate_limited", "invalid"];
export const CHANNELS: LoginAttemptChannel[] = ["panel", "app", "unknown"];
export const PAGE_SIZE = 50;
export const ZONE = "America/Mexico_City";

/** Claves de la URL; `company` en vez de `company_id` para que la URL se lea bien. */
type ParamKey = "result" | "q" | "company" | "ip" | "channel" | "since" | "from" | "to" | "page";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function positiveInt(raw: string | null): number | undefined {
  const n = Number(raw);
  return raw && Number.isInteger(n) && n > 0 ? n : undefined;
}

/** Lee los filtros de la URL e ignora lo que no reconoce. */
export function filtersFromParams(params: URLSearchParams): LoginAttemptFilters {
  const result = (params.get("result") ?? "")
    .split(",")
    .filter((r): r is LoginAttemptResult | "failures" => r === "failures" || (RESULTS as string[]).includes(r));
  const channel = params.get("channel");
  const from = params.get("from");
  const to = params.get("to");
  const since = positiveInt(params.get("since"));
  return {
    ...(result.length ? { result } : {}),
    ...(params.get("q")?.trim() ? { q: params.get("q")!.trim() } : {}),
    ...(positiveInt(params.get("company")) ? { company_id: positiveInt(params.get("company")) } : {}),
    ...(params.get("ip")?.trim() ? { ip: params.get("ip")!.trim() } : {}),
    ...(channel && (CHANNELS as string[]).includes(channel) ? { channel: channel as LoginAttemptChannel } : {}),
    ...(since && since <= 1440 ? { since } : {}),
    ...(from && DATE.test(from) ? { from } : {}),
    ...(to && DATE.test(to) ? { to } : {}),
    page: positiveInt(params.get("page")) ?? 1,
    page_size: PAGE_SIZE,
  };
}

/**
 * Aplica cambios a la query actual y devuelve la nueva. Cualquier cambio de filtro vuelve a la página 1; un valor vacío
 * quita la clave.
 */
export function updateParams(
  current: URLSearchParams,
  changes: Partial<Record<ParamKey, string | number | null | undefined>>,
): string {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  if (!("page" in changes)) next.delete("page");
  return next.toString();
}

/** «24 nov 2026, 13:05» en la hora de México. */
export function formatWhen(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    timeZone: ZONE,
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
  }).format(new Date(iso));
}

/** Fecha de hoy `YYYY-MM-DD` en la hora de México. */
export function todayInMexico(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(now);
}

export type ResultTone = "ok" | "warn" | "bad";

export function resultTone(result: LoginAttemptResult): ResultTone {
  if (result === "success") return "ok";
  if (result === "rate_limited") return "bad";
  return "warn";
}
