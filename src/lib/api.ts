// src/lib/api.ts
import axios from "axios";
import { toast } from "sonner";
import { getApiT, getLocale } from "@/lib/api-i18n";
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

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Inyecta el token, el idioma y la empresa activa en cada request
apiClient.interceptors.request.use((config) => {
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
    if (error.config?.skipErrorToast) return Promise.reject(error);
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

    if (status === 401) {
      const hasToken = !!localStorage.getItem("auth_token");
      if (hasToken) {
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
    // plan nombrando el módulo. La página del módulo muestra además <ModuleLocked />.
    if ((status === 403 || status === 422) && err?.details?.code === "module_not_in_plan") {
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
