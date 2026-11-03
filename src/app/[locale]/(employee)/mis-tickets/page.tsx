// src/app/[locale]/(employee)/mis-tickets/page.tsx
// Mis tickets se unificó con Mis órdenes (spec 051): esta dirección lleva a la pestaña de cobradas.
import { redirect } from "next/navigation";
import { buildPaidRedirect } from "@/lib/paid-redirect";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MisTicketsRedirect({ params, searchParams }: Props) {
  const { locale } = await params;
  redirect(buildPaidRedirect(locale, "/mis-ordenes", await searchParams));
}
