// src/app/[locale]/(dashboard)/inventario/conteo/page.tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { ModuleLocked, useModuleGate } from "@/components/subscription/module-locked";
import { CountScreen } from "@/components/inventory/scan/count-screen";
import { inventoryService } from "@/services/inventory";

export default function ConteoPage() {
  const gate = useModuleGate("inventory");
  const probe = useQuery({
    queryKey: ["products", "gate-probe"],
    queryFn: () => inventoryService.list({ page: 1, page_size: 1 }),
    enabled: gate.enabled,
    retry: false,
  });
  if (gate.isLocked(probe.error)) return <ModuleLocked module="inventory" />;
  return <CountScreen />;
}
