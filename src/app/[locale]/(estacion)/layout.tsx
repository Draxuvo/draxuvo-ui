// src/app/[locale]/(estacion)/layout.tsx
// Pantalla de estación (cocina, barra) y Tomar pedido: a pantalla completa, sin barra lateral, para una tablet o monitor.
// En una demo (spec 039) lleva el aviso de demostración arriba.
import { DemoBanner } from "@/components/demo/demo-banner";

export default function EstacionLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <DemoBanner />
      {children}
    </main>
  );
}
