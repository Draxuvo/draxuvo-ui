// src/components/restaurant/station-kind.ts
// Identidad de cada tipo de estación (spec 032): icono y color. La barra no se confunde con la cocina.
import { CookingPot, GlassWater, UtensilsCrossed } from "lucide-react";
import type { StationKind } from "@/types";

export const STATION_KIND: Record<StationKind, { Icon: typeof CookingPot; tone: string; chip: string }> = {
  kitchen: { Icon: CookingPot, tone: "border-l-estado-pendiente-border", chip: "bg-estado-pendiente text-estado-pendiente-foreground" },
  bar: { Icon: GlassWater, tone: "border-l-estado-progreso-border", chip: "bg-estado-progreso text-estado-progreso-foreground" },
  other: { Icon: UtensilsCrossed, tone: "border-l-estado-revision-border", chip: "bg-estado-revision text-estado-revision-foreground" },
};
