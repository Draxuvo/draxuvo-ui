// src/lib/api.ts
import axios from "axios";
import { toast } from "sonner";
import { getApiT, getLocale } from "@/lib/api-i18n";
import { notifyDemoExpired, readDemoInfo } from "@/lib/demo";
import { isSessionEnding } from "@/lib/session-end";
import es from "../../messages/es.json";
import en from "../../messages/en.json";

const MODULE_NAMES = { es: es.modules, en: en.modules } as const;

declare module "axios" {
  interface AxiosRequestConfig {
    /** La pantalla muestra el error por su cuenta (p. ej. en el formulario): sin toast global. */
    skipErrorToast?: boolean;
  }
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// Módulos cuya página está montada y muestra <ModuleLocked /> por su cuenta (R18): un 403
// `module_not_in_plan` de ese módulo no lleva toast. Contador por si dos vistas lo marcan.
const pageHandledModules = new Map<string, number>();

/** La página del módulo marca su bloqueo como esperado; devuelve la limpieza (para useEffect). */
export function expectModuleLock(module: string): () => void {
  pageHandledModules.set(module, (pageHandledModules.get(module) ?? 0) + 1);
  return () => {
    const n = (pageHandledModules.get(module) ?? 1) - 1;
    if (n > 0) pageHandledModules.set(module, n);
    else pageHandledModules.delete(module);
  };
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Inyecta el token, el idioma y la empresa activa en cada request
apiClient.interceptors.request.use((config) => {
  // Cerrando sesión: no se envía nada (llegaría sin token y volvería como 401).
  if (isSessionEnding()) throw new axios.CanceledError("session-ending", undefined, config);
  const token = localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers["locale"] = getLocale();
  if (!config.headers["X-Company-Id"]) {
    const companyId = localStorage.getItem("selected_company_id");
    if (companyId) config.headers["X-Company-Id"] = companyId;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (axios.isCancel(error) || error.config?.skipErrorToast) return Promise.reject(error);
    const t = getApiT();
    const status: number | undefined = error.response?.status;
    const err = error.response?.data?.error;
    // `details` puede ser texto, una lista de textos o un objeto ({ code, module }); el objeto no se muestra.
    const details: string | undefined =
      typeof err?.details === "string"
        ? err.details
        : Array.isArray(err?.details)
          ? err.details.join(", ")
          : undefined;
    const message: string | undefined = details ?? err?.message;

    // Demo por plan (spec 039): vencida, terminada o ya borrada. La pantalla de «tu demo terminó» lo explica.
    if (status === 403 && err?.details?.code === "demo_expired") {
      notifyDemoExpired();
      return Promise.reject(error);
    }

    if (status === 401) {
      const hasToken = !!localStorage.getItem("auth_token");
      // Una demo purgada deja el token sin usuario: no es un cierre de sesión sino el fin de la demo.
      if (hasToken && readDemoInfo()) {
        notifyDemoExpired();
      } else if (hasToken) {
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
      } else {
        toast.error(message ?? t.unauthorized);
      }
      return Promise.reject(error);
    }

    if (status === 403 && err?.code === "subscription_expired") {
      toast.error(t.subscriptionExpired);
      return Promise.reject(error);
    }

    // Módulo fuera del plan (403, o 422 al activarlo): en vez del toast genérico, invita a subir de
    // plan nombrando el módulo (salvo que la página del módulo lo muestre con <ModuleLocked />).
    if ((status === 403 || status === 422) && err?.details?.code === "module_not_in_plan") {
      // La página del módulo ya lo dice con <ModuleLocked />: sin toast de más.
      if (status === 403 && pageHandledModules.has(String(err.details.module))) {
        return Promise.reject(error);
      }
      const locale = getLocale();
      const key = err.details.module as keyof (typeof MODULE_NAMES)["es"];
      const moduleName = MODULE_NAMES[locale][key] ?? String(err.details.module);
      toast.error(t.moduleNotInPlan.replace("{module}", moduleName), {
        id: `module-not-in-plan-${key}`,
        action: {
          label: t.moduleNotInPlanAction,
          onClick: () => {
            window.location.href = `/${locale}/suscripcion`;
          },
        },
      });
      return Promise.reject(error);
    }

    const STATUS_MESSAGES: Record<number, string> = {
      400: t.invalidRequest,
      403: t.forbidden,
      404: t.notFound,
      409: t.conflict,
      422: t.validation,
      500: t.serverError,
      502: t.badGateway,
      503: t.serviceUnavailable,
    };

    const description =
      message ??
      (status ? (STATUS_MESSAGES[status] ?? t.unexpected) : t.noConnection);

    toast.error(description);

    return Promise.reject(error);
  },
);
