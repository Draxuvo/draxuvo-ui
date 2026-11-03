"use client";
// Disponibilidad de la pestaña «Activas» de Órdenes (spec 051): depende del módulo `work_orders`.
// El staff se da por habilitado: su menú «Mis órdenes» ya depende de ese módulo.
import { useModuleGate } from "@/components/subscription/module-locked";
import { useAuthStore } from "@/store/auth";
import type { TabAvailability } from "./use-paid-tab";

export function useWorkOrdersTab(): TabAvailability {
  const role = useAuthStore((s) => s.role);
  const gate = useModuleGate("work_orders");
  if (role === "staff") return { available: true, ready: true };
  return { available: gate.enabled, ready: gate.enabled || gate.isLocked() };
}
