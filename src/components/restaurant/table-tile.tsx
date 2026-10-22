// src/components/restaurant/table-tile.tsx
"use client";
// Pieza única del plano de mesas (spec 032): la usan Restaurante → Servicio y Tomar pedido, para que una mesa
// se vea igual en los dos. El estado va siempre en texto y en icono, nunca solo en color.
import { useLocale, useTranslations } from "next-intl";
import { Check, Clock, Receipt, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TableState } from "@/types";

/** Minutos enteros desde que se abrió la cuenta; nunca negativos. */
export function minutesOpen(openedAt: string | null | undefined, now: number): number | null {
  if (!openedAt) return null;
  return Math.max(0, Math.floor((now - new Date(openedAt).getTime()) / 60_000));
}

/** `12 min` o `1 h 05 min`. */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

const TONE: Record<TableState, string> = {
  free: "border-border bg-card hover:bg-muted",
  occupied: "border-estado-progreso-border bg-estado-progreso text-estado-progreso-foreground hover:brightness-95",
  to_pay: "border-estado-pendiente-border bg-estado-pendiente text-estado-pendiente-foreground hover:brightness-95",
};

const STATE_ICON = { free: Check, occupied: Users, to_pay: Receipt } as const;

export interface TableTileProps {
  name: string;
  state: TableState;
  openedAt?: string | null;
  /** Solo llega de las cuentas propias o a quien es jefe (FR-019b). */
  total?: number | null;
  owner?: string | null;
  mine?: boolean;
  now: number;
  selected?: boolean;
  /** Etiqueta de apoyo, p. ej. "Para llevar". */
  caption?: string;
  inactive?: boolean;
  onClick?: () => void;
  className?: string;
}

export function TableTile({
  name, state, openedAt, total, owner, mine, now, selected, caption, inactive, onClick, className,
}: TableTileProps) {
  const t = useTranslations("restaurant.tile");
  const locale = useLocale();
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-MX", { style: "currency", currency: "MXN" });
  const minutes = minutesOpen(openedAt, now);
  const stateText = t(state);
  const Icon = STATE_ICON[state];
  const open = state !== "free";

  // Si la mesa ya se llama "Mesa 1" no se repite la palabra.
  const parts = [caption ?? (/^(mesa|table)\b/i.test(name.trim()) ? name : t("table", { name })), stateText];
  if (open && minutes != null) parts.push(t("openFor", { time: formatMinutes(minutes) }));
  if (open && total != null) parts.push(money.format(total));
  if (open && owner) parts.push(mine ? t("mine") : owner);
  const label = parts.join(", ");

  const body = (
    <>
      <span className="flex w-full items-start justify-between gap-2">
        <span className="min-w-0 truncate font-display text-xl font-extrabold leading-tight">{name}</span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-background/70 px-2 py-0.5 text-xs font-semibold text-foreground">
          <Icon aria-hidden className="size-3" />
          {stateText}
        </span>
      </span>
      {caption && <span className="text-xs font-medium opacity-80">{caption}</span>}
      {open && (
        <span className="mt-auto flex w-full flex-wrap items-baseline justify-between gap-x-2 text-sm">
          {total != null ? <span className="font-display text-base font-extrabold">{money.format(total)}</span> : <span />}
          {minutes != null && (
            <span className="inline-flex items-center gap-1 opacity-90">
              <Clock aria-hidden className="size-3.5" />
              {formatMinutes(minutes)}
            </span>
          )}
        </span>
      )}
      {open && owner && (
        <span className="w-full truncate text-xs opacity-80">{mine ? t("mine") : owner}</span>
      )}
    </>
  );

  const classes = cn(
    "flex min-h-[96px] flex-col items-start gap-1.5 rounded-etiqueta border p-3 text-left transition-colors",
    TONE[state],
    inactive && "border-dashed opacity-60",
    selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
    className,
  );

  if (!onClick) {
    return (
      <div className={classes} aria-label={label} role="group">
        {body}
      </div>
    );
  }
  return (
    <button type="button" aria-label={label} aria-pressed={selected} onClick={onClick} className={cn(classes, "foco-etiqueta")}>
      {body}
    </button>
  );
}
