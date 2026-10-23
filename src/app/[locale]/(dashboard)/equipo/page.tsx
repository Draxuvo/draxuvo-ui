// src/app/[locale]/(dashboard)/equipo/page.tsx
// Equipo se unificó con Personal (spec 029): esta dirección lleva a la pestaña Empleados (el acceso vive en la ficha, spec 036) y conserva los filtros del enlace.
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EquipoRedirect({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = new URLSearchParams({ tab: "empleados" });
  for (const [key, value] of Object.entries(await searchParams)) {
    if (key !== "tab" && typeof value === "string") query.set(key, value);
  }
  redirect(`/${locale}/personal?${query}`);
}
