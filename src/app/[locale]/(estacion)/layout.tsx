// src/app/[locale]/(estacion)/layout.tsx
// Pantalla de estación (cocina, barra): a pantalla completa, sin barra lateral, para una tablet o monitor.
export default function EstacionLayout({ children }: { children: React.ReactNode }) {
  return <main className="min-h-dvh bg-background text-foreground">{children}</main>;
}
