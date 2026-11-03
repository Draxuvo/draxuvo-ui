// src/app/[locale]/(dashboard)/tickets/page.tsx
// Tickets se unificó con Órdenes (spec 051): esta dirección lleva a la pestaña Cobradas y conserva los filtros del enlace.
// Misma firma de página de servidor que `asistencia/page.tsx` (Next 16: `params` y `searchParams` son promesas).
import { redirect } from "next/navigation";
import { buildPaidRedirect } from "@/lib/paid-redirect";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TicketsRedirect({ params, searchParams }: Props) {
  const { locale } = await params;
  redirect(buildPaidRedirect(locale, "/ordenes", await searchParams));
}
