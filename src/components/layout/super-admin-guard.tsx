"use client";
// Spec 055 (H-57): las pantallas del super admin no se pintan para quien no lo es. El filtro de rutas (`proxy.ts`) ya
// las corta antes de cargar; esta guarda cubre una cookie de rol vieja o manipulada: sin rol todavía (hidratación) no
// pinta nada, y con otro rol manda a su inicio sin dejar que la página pida listas globales que la API niega.
import { useEffect, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

export function SuperAdminGuard({ children }: { children: ReactNode }) {
  const role = useAuthStore((s) => s.role);
  const locale = useLocale();
  const router = useRouter();
  const allowed = role === "super_admin";

  useEffect(() => {
    if (role && !allowed) router.replace(`/${locale}/${role === "staff" ? "mis-ordenes" : "inicio"}`);
  }, [role, allowed, locale, router]);

  return allowed ? <>{children}</> : null;
}
