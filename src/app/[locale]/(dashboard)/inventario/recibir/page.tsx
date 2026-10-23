// src/app/[locale]/(dashboard)/inventario/recibir/page.tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { ModuleLocked, useModuleGate } from "@/components/subscription/module-locked";
import { ReceiveScreen } from "@/components/inventory/scan/receive-screen";
import { inventoryService } from "@/services/inventory";

export default function RecibirPage() {
  const gate = useModuleGate("inventory");
  // Un 403 `module_not_in_plan` de la API (roles que no leen la suscripción) bloquea la pantalla.
  const probe = useQuery({
    queryKey: ["products", "gate-probe"],
    queryFn: () => inventoryService.list({ page: 1, page_size: 1 }),
    enabled: gate.enabled,
    retry: false,
  });
  if (gate.isLocked(probe.error)) return <ModuleLocked module="inventory" />;
  return <ReceiveScreen />;
}
