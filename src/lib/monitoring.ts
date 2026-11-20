// src/lib/monitoring.ts
// Spec 071: errores del navegador a Sentry. Sin NEXT_PUBLIC_SENTRY_DSN (desarrollo, pruebas, CI) no se inicializa y todo
// esto no hace nada. Solo navegador: el plugin de Sentry para Workers necesita un wrangler.json que este repo no usa
// (se despliega con cloudflare.config.ts), así que los errores del render en el servidor se ven en Cloudflare
// (Workers → draxuvo-ui → Observability). Privacidad (contracts/error-event.md de la spec): solo el id del usuario y la
// empresa; sin query string, sin tokens en la ruta, sin texto de pantalla ni Replay.
import * as Sentry from "@sentry/browser";
import type { Breadcrumb, ErrorEvent } from "@sentry/browser";

/** Ruido del navegador que no es un error de Draxuvo (cancelaciones, extensiones, avisos de layout). */
export const IGNORE_ERRORS: (string | RegExp)[] = [
  /ResizeObserver loop/,
  /^AbortError/,
  /The (user|operation) aborted/,
  /^Failed to fetch$/,
  /^Load failed$/,
  /^NetworkError when attempting to fetch resource\.?$/,
  /Non-Error promise rejection captured/,
];

/** Scripts que no son nuestros: extensiones del navegador. */
export const DENY_URLS: RegExp[] = [/extensions\//i, /^chrome:\/\//i, /^chrome-extension:\/\//i, /^moz-extension:\/\//i, /^safari-(web-)?extension:\/\//i];

// Rutas que llevan un token de un solo uso en la ruta misma (invitación a la demo, spec 039).
const TOKEN_ROUTES: [RegExp, string][] = [[/\/demo\/[^/?#]+/, "/demo/:token"]];

let initialized = false;

/** Quita query string y hash, y enmascara los tokens que viajan en la ruta. */
export function scrubUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  let clean = url.split(/[?#]/, 1)[0];
  for (const [pattern, replacement] of TOKEN_ROUTES) clean = clean.replace(pattern, replacement);
  return clean;
}

export function beforeSend(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    event.request.url = scrubUrl(event.request.url);
    delete event.request.query_string;
    delete event.request.cookies;
    delete event.request.data;
    event.request.headers = event.request.headers?.["User-Agent"]
      ? { "User-Agent": event.request.headers["User-Agent"] }
      : undefined;
  }
  if (event.transaction) event.transaction = scrubUrl(event.transaction);
  event.user = event.user?.id !== undefined ? { id: event.user.id } : undefined;
  return event;
}

export function beforeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  const data = breadcrumb.data;
  if (data) {
    for (const key of ["url", "from", "to"] as const) {
      if (typeof data[key] === "string") data[key] = scrubUrl(data[key]);
    }
  }
  // Los clics guardan el selector, no el texto; las líneas de consola pueden traer datos de clientes.
  if (breadcrumb.category === "console") return null;
  return breadcrumb;
}

/** Inicializa Sentry una sola vez, solo en el navegador y solo con DSN. */
export function initMonitoring(dsn = process.env.NEXT_PUBLIC_SENTRY_DSN): boolean {
  if (initialized) return true;
  if (typeof window === "undefined" || !dsn) return false;
  Sentry.init({
    dsn,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "production",
    // Sentry 11 reemplazó `sendDefaultPii` por `dataCollection`: nada de usuario automático, cookies, encabezados,
    // cuerpos ni query string (beforeSend vuelve a limpiar lo que se cuele).
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { allow: ["User-Agent"] }, response: false },
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
    },
    tracesSampleRate: 0,
    ignoreErrors: IGNORE_ERRORS,
    denyUrls: DENY_URLS,
    beforeSend,
    beforeBreadcrumb,
  });
  initialized = true;
  return true;
}

/** Usuario y empresa activa de la sesión: solo ids. Sin sesión, los borra. */
export function setMonitoringUser(userId: number | null | undefined, companyId: number | null | undefined, demo = false) {
  if (!initialized) return;
  Sentry.setUser(userId ? { id: String(userId) } : null);
  Sentry.setTag("company_id", companyId ? String(companyId) : undefined);
  Sentry.setTag("demo", companyId ? String(demo) : undefined);
}
