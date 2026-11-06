import { apiClient } from "@/lib/api";
import type {
  AddonKey,
  BillingCycle,
  ChargePolicy,
  CheckoutResponse,
  CompanyModulesDetail,
  ModuleKey,
  ModulesResponse,
  PlanKey,
  PortalResponse,
  Subscription,
} from "@/types";

export const getSubscription = (): Promise<Subscription> =>
  apiClient.get("/api/v1/subscription").then((r) => r.data);

// Solo en `trialing`: cambia el plan sin mover `trial_ends_at`.
export const updateTrialPlan = (plan: PlanKey): Promise<Subscription> =>
  apiClient.patch("/api/v1/subscription", { plan }).then((r) => r.data);

// Super admin: cambia el plan de prueba de una empresa (el dueño y el administrador reciben 403, spec 031).
export const updateCompanyTrialPlan = (companyId: number, plan: PlanKey): Promise<Subscription> =>
  apiClient
    .patch("/api/v1/subscription", { plan }, { headers: { "X-Company-Id": String(companyId) } })
    .then((r) => r.data);

export const createCheckout = (
  plan: PlanKey,
  billingCycle: BillingCycle,
  successUrl: string,
  cancelUrl: string,
): Promise<CheckoutResponse> =>
  apiClient
    .post("/api/v1/subscription/checkout", {
      plan,
      billing_cycle: billingCycle,
      success_url: successUrl,
      cancel_url: cancelUrl,
    })
    .then((r) => r.data);

// Módulos extra (spec 053): solo el super admin los enciende y apaga, con `X-Company-Id` de la empresa que administra.
const asCompany = (companyId: number) => ({ headers: { "X-Company-Id": String(companyId) }, skipErrorToast: true });

// Spec 058: «Cobro solo por jefes» de una empresa (solo super admin).
export const getChargePolicy = (companyId: number): Promise<ChargePolicy> =>
  apiClient.get("/api/v1/company/charge_policy", asCompany(companyId)).then((r) => r.data);

export const updateChargePolicy = (companyId: number, enabled: boolean): Promise<ChargePolicy> =>
  apiClient.patch("/api/v1/company/charge_policy", { boss_only_charge: enabled }, asCompany(companyId)).then((r) => r.data);

export const getCompanyModules = (companyId: number): Promise<CompanyModulesDetail> =>
  apiClient.get("/api/v1/company/modules", { headers: { "X-Company-Id": String(companyId) } }).then((r) => r.data);

export const addAddon = (module: AddonKey, companyId: number): Promise<Subscription> =>
  apiClient.post("/api/v1/subscription/addons", { module }, asCompany(companyId)).then((r) => r.data);

export const removeAddon = (module: AddonKey, companyId: number): Promise<Subscription> =>
  apiClient.delete(`/api/v1/subscription/addons/${module}`, asCompany(companyId)).then((r) => r.data);

export const reactivateAddon = (module: AddonKey, companyId: number): Promise<Subscription> =>
  apiClient.post(`/api/v1/subscription/addons/${module}/reactivate`, {}, asCompany(companyId)).then((r) => r.data);

export const createPortal = (returnUrl: string): Promise<PortalResponse> =>
  apiClient
    .post("/api/v1/subscription/portal", { return_url: returnUrl })
    .then((r) => r.data);

// Programa la cancelación al fin del periodo (`cancel_at_period_end: true`).
export const cancelSubscription = (): Promise<Subscription> =>
  apiClient.delete("/api/v1/subscription").then((r) => r.data);

// Lista completa de módulos desactivados (reemplaza). `[]` activa todos los del plan.
// Solo el super admin cambia módulos (spec 017); `companyId` es la empresa que administra.
export const updateModules = (disabledModules: ModuleKey[], companyId: number): Promise<ModulesResponse> =>
  apiClient
    .patch(
      "/api/v1/company/modules",
      { disabled_modules: disabledModules },
      { headers: { "X-Company-Id": String(companyId) } },
    )
    .then((r) => r.data);

// ── Super admin: opera sobre cualquier empresa pasando X-Company-Id explícito ──

// validateStatus < 500 evita que el error interceptor lance toast cuando la
// empresa tiene suscripción vencida (403). Devuelve null en ese caso.
export const getCompanySubscription = async (
  companyId: number,
): Promise<Subscription | null> => {
  const res = await apiClient.get("/api/v1/subscription", {
    headers: { "X-Company-Id": String(companyId) },
    validateStatus: (s) => s < 500,
  });
  if (res.status !== 200) return null;
  return res.data;
};

export const createCompanyCheckout = (
  companyId: number,
  plan: PlanKey,
  billingCycle: BillingCycle,
  successUrl: string,
  cancelUrl: string,
): Promise<CheckoutResponse> =>
  apiClient
    .post(
      "/api/v1/subscription/checkout",
      {
        plan,
        billing_cycle: billingCycle,
        success_url: successUrl,
        cancel_url: cancelUrl,
      },
      { headers: { "X-Company-Id": String(companyId) } },
    )
    .then((r) => r.data);

export const cancelCompanySubscription = (companyId: number): Promise<Subscription> =>
  apiClient
    .delete("/api/v1/subscription", {
      headers: { "X-Company-Id": String(companyId) },
    })
    .then((r) => r.data);
