"use client";
// Módulos del plan que cambian qué pestañas y bloques muestra Reportes (spec 033, misma regla que
// `Reports::Modules` en la API). Mientras la suscripción carga, o si no se puede leer (super admin), se muestra
// todo: la API decide con su 403.
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { getSubscription } from "@/services/subscription";

const INCOME = ["tickets", "restaurant", "work_orders"];

export function useReportModules() {
  const { selectedCompanyId, role } = useAuthStore();
  const { data } = useQuery({
    queryKey: ["subscription", selectedCompanyId],
    queryFn: getSubscription,
    retry: false,
    enabled: !!role && role !== "super_admin" && !!selectedCompanyId,
  });
  const active = data?.active_modules;
  const has = (module: string) => !active || active.some((m) => m === module);
  const payroll = has("employees");
  const inventory = has("inventory");
  return {
    workOrders: has("work_orders"),
    income: !active || INCOME.some(has),
    payroll,
    inventory,
    expenses: payroll || inventory,
    attendance: payroll && has("attendance"),
  };
}
