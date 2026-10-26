// src/components/demo/demo-shell.tsx
// Marco de las pantallas públicas de la demo: la misma ceja con la marca que el registro.
import Image from "next/image";
import { useTranslations } from "next-intl";
import logo from "../../../public/logo.svg";

export function DemoShell({ children }: { children: React.ReactNode }) {
  const tc = useTranslations("common");
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="border-b border-foreground/15 bg-ceja">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-2.5 px-4 sm:px-6">
          <Image src={logo} alt="" width={32} height={32} unoptimized className="size-8 shrink-0" />
          <span className="font-display text-xl font-extrabold uppercase tracking-[0.01em]">{tc("brandName")}</span>
          <span className="ml-auto hidden text-sm font-medium text-gris-texto sm:block">{tc("brandTagline")}</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}
