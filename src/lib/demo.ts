// src/lib/demo.ts
// Demo por plan (spec 039): lo que el navegador recuerda de la demo en curso y los escenarios que ofrece cada plan.
import type { DemoPlan, DemoScenario } from "@/types";

export const DEMO_PLANS: readonly DemoPlan[] = ["basic", "pro", "enterprise"];

/** Giros de cada plan: Pro tiene dos (servicio técnico y restaurante); los demás, uno. */
export const DEMO_SCENARIOS: Record<DemoPlan, readonly DemoScenario[]> = {
  basic: ["basic_retail"],
  pro: ["pro_service", "pro_restaurant"],
  enterprise: ["enterprise_restaurant"],
};

export const DEMO_STORAGE_KEY = "draxuvo_demo";
/** Evento de ventana que dispara la pantalla de «tu demo terminó» (lo emite el cliente de la API). */
export const DEMO_EXPIRED_EVENT = "draxuvo:demo-expired";

export interface DemoInfo {
  plan: DemoPlan;
  scenario: DemoScenario;
  /** Cuándo termina la demo (ISO). */
  expiresAt: string;
}

export function planFromParam(value: string | null | undefined): DemoPlan | null {
  return DEMO_PLANS.find((plan) => plan === value) ?? null;
}

export function saveDemoInfo(info: DemoInfo): void {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(info));
  } catch {
    // Sin almacenamiento la demo sigue funcionando; solo se pierde el plan del aviso.
  }
}

export function readDemoInfo(): DemoInfo | null {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return null;
    const info = JSON.parse(raw) as Partial<DemoInfo>;
    return planFromParam(info.plan) && info.scenario && info.expiresAt ? (info as DemoInfo) : null;
  } catch {
    return null;
  }
}

export function clearDemoInfo(): void {
  try {
    localStorage.removeItem(DEMO_STORAGE_KEY);
  } catch {
    // nada que limpiar
  }
}

/** Avisa a la pantalla de que la demo terminó (vencida, terminada o ya borrada). */
export function notifyDemoExpired(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DEMO_EXPIRED_EVENT));
}

/** Destino de «Salir de la demo»: el sitio público si está configurado; si no, el inicio de sesión. */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "/login";
}
