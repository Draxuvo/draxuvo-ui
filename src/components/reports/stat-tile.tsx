// Cifra de un reporte. `hero` es la cifra principal de la pantalla (una sola); las demás van subordinadas.
import { cn } from "@/lib/utils";
import { CARD, LABEL } from "./styles";

interface StatTileProps {
  label: string;
  value: string | number;
  /** Línea de apoyo bajo la cifra (por ejemplo la variación). */
  children?: React.ReactNode;
  hero?: boolean;
  className?: string;
}

export function StatTile({ label, value, children, hero = false, className }: StatTileProps) {
  return (
    <div className={cn(CARD, hero && "flex flex-col justify-between bg-ceja text-tinta", className)}>
      <p className={cn(LABEL, hero && "text-tinta")}>{label}</p>
      <div>
        <p
          className={cn(
            "mt-2 font-display font-semibold leading-none tabular-nums",
            hero ? "text-[clamp(2.5rem,5vw,3.75rem)]" : "text-[2.25rem]",
          )}
        >
          {value}
        </p>
        {children && <div className={cn("mt-2 text-sm", hero ? "text-tinta" : "text-muted-foreground")}>{children}</div>}
      </div>
    </div>
  );
}
