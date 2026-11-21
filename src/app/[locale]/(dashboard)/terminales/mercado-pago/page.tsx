// src/app/[locale]/(dashboard)/terminales/mercado-pago/page.tsx — regreso de la autorización de Mercado Pago (spec 069,
// research R2). Mercado Pago vuelve aquí con `code` y `state` (o `error`); la página los manda una sola vez a la API con la
// sesión del usuario y regresa a Terminales.
"use client";
import { Suspense } from "react";
import { MercadoPagoCallback } from "@/components/terminals/mercado-pago-callback";

// `useSearchParams` exige un límite de Suspense.
export default function MercadoPagoCallbackPage() {
  return (
    <Suspense fallback={null}>
      <MercadoPagoCallback />
    </Suspense>
  );
}
