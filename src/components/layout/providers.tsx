// src/components/layout/providers.tsx
"use client";
import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { AppearanceProvider } from "@/components/appearance/appearance-provider";
import { initMonitoring, setMonitoringUser } from "@/lib/monitoring";
import { queryClient } from "@/lib/query";
import { useAuthStore } from "@/store/auth";

// Spec 071: lo antes posible en el navegador (sin NEXT_PUBLIC_SENTRY_DSN no hace nada).
initMonitoring();

type AuthSnapshot = ReturnType<typeof useAuthStore.getState>;

// Los errores llevan solo el id del usuario y de la empresa activa, y si es demo (nunca correo ni nombre).
function syncMonitoringUser({ user, selectedCompanyId }: AuthSnapshot) {
  const company = user?.companies?.find((c) => c.id === selectedCompanyId);
  setMonitoringUser(user?.id, selectedCompanyId, company?.demo === true);
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    syncMonitoringUser(useAuthStore.getState());
    return useAuthStore.subscribe(syncMonitoringUser);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppearanceProvider>{children}</AppearanceProvider>
    </QueryClientProvider>
  );
}
