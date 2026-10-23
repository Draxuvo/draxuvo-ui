// src/app/[locale]/(dashboard)/asistencia/page.tsx
// Asistencia se unificó con Personal (spec 036): esta dirección lleva a la pestaña Asistencia y conserva los filtros del enlace.
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AsistenciaRedirect({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = new URLSearchParams({ tab: "asistencia" });
  for (const [key, value] of Object.entries(await searchParams)) {
    if (key !== "tab" && typeof value === "string") query.set(key, value);
  }
  redirect(`/${locale}/personal?${query}`);
}
