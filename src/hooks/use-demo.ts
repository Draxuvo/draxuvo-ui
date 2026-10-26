// src/hooks/use-demo.ts
// Demo por plan (spec 039): abrir una demo, saber si se está en una y salir de ella.
"use client";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { demoService } from "@/services/demo";
import { clearDemoInfo, readDemoInfo, saveDemoInfo, siteUrl, type DemoInfo } from "@/lib/demo";
import { useAuthStore } from "@/store/auth";
import type { DemoEndedReason, DemoSessionPayload } from "@/types";

/** ¿La empresa activa es una demo? Con el plan y el giro que recordó el navegador al abrirla. */
export function useDemoInfo(): { isDemo: boolean; info: DemoInfo | null } {
  const isDemo = useAuthStore((s) => !!s.user?.companies?.find((c) => c.id === s.selectedCompanyId)?.demo);
  // Se lee al montar: el valor cambia solo al abrir o salir de una demo, que recargan la página.
  const info = useMemo(() => (isDemo ? readDemoInfo() : null), [isDemo]);
  return { isDemo, info };
}

/** ¿Hay una sesión real (no de demo) abierta en este navegador? Entrar a la demo la cerraría. */
export function useHasRealSession(): boolean {
  return useAuthStore((s) => !!s.token && !s.user?.companies?.some((c) => c.demo));
}

/** Abre una demo nueva: guarda la sesión que devuelve la API y recuerda plan, giro y vencimiento. */
export function useOpenDemo() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (payload: DemoSessionPayload) => demoService.open(payload),
    onSuccess: (res) => {
      setSession({ token: res.token, user: res.user });
      saveDemoInfo({ plan: res.plan, scenario: res.scenario, expiresAt: res.expires_at });
    },
  });
}

/**
 * Termina la demo y sale de ella. Con `signup` lleva al registro con el plan que se estaba probando; con `left`, al
 * sitio público (o a `destination`, p. ej. para abrir otra demo). Si la demo ya había terminado, la API lo rechaza y da igual: se limpia la sesión de todos modos.
 */
export function useLeaveDemo() {
  const endSession = useAuthStore((s) => s.endSession);
  const [pending, setPending] = useState(false);

  async function leave(reason: Exclude<DemoEndedReason, "expired">, plan?: string | null, destination?: string) {
    setPending(true);
    try {
      await demoService.finish(reason);
    } catch {
      // Vencida o ya borrada: no hay nada que terminar.
    }
    clearDemoInfo();
    endSession(destination ?? (reason === "signup" ? `/registro${plan ? `?plan=${plan}` : ""}` : siteUrl()));
  }

  return { leave, pending };
}
