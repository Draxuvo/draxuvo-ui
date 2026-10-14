// Mini etiqueta que muestra un tema en claro y en oscuro. Cada mitad lleva sus propios
// data-theme y data-mode, así que usa los mismos tokens que el panel (globals.css).
import { cn } from "@/lib/utils";
import type { ThemeKey } from "@/lib/appearance";

function Half({ theme, mode, label }: { theme: ThemeKey; mode: "light" | "dark"; label: string }) {
  return (
    <div data-theme={theme} data-mode={mode} className="min-w-0 flex-1 overflow-hidden bg-background p-2 text-foreground">
      <div className="rounded-interior border border-border bg-card p-1.5">
        <p className="text-[0.625rem] leading-none font-semibold uppercase">{label}</p>
        <div className="mt-1.5 flex items-end gap-1" aria-hidden="true">
          <span className="h-3 w-6 rounded-sm bg-primary" />
          <span className="h-3 w-3 rounded-sm bg-accent" />
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <span
              key={n}
              className={cn("w-1.5 rounded-sm", `bg-chart-${n}`)}
              style={{ height: `${6 + n * 3}px` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ThemeSwatch({ theme, light, dark }: { theme: ThemeKey; light: string; dark: string }) {
  return (
    <div className="flex overflow-hidden rounded-etiqueta border border-border" aria-hidden="true">
      <Half theme={theme} mode="light" label={light} />
      <Half theme={theme} mode="dark" label={dark} />
    </div>
  );
}
