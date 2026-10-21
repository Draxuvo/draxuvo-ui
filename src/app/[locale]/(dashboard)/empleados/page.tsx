// src/app/[locale]/(dashboard)/empleados/page.tsx
// Personal se unificó (spec 028): esta dirección lleva a la pestaña Empleados y conserva los filtros del enlace.
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EmpleadosRedirect({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = new URLSearchParams({ tab: "empleados" });
  for (const [key, value] of Object.entries(await searchParams)) {
    if (key !== "tab" && typeof value === "string") query.set(key, value);
  }
  redirect(`/${locale}/personal?${query}`);
}
