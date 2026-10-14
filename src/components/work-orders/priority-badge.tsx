// src/components/work-orders/priority-badge.tsx

import { ArrowDown, ArrowRight, ArrowUp, AlertTriangle } from "lucide-react";
import type { WorkOrder } from "@/types";

const ICONS = { low: ArrowDown, medium: ArrowRight, high: ArrowUp, urgent: AlertTriangle };

const STYLES = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-estado-progreso text-estado-progreso-foreground border-estado-progreso-border",
  high: "bg-estado-pendiente text-estado-pendiente-foreground border-estado-pendiente-border",
  urgent: "bg-destructive/10 text-destructive border-destructive/30",
};

const LABELS = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export function PriorityBadge({
  priority,
}: {
  priority: WorkOrder["priority"];
}) {
  const Icon = ICONS[priority];
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${STYLES[priority]}`}
    >
      <Icon size={11} aria-hidden="true" />
      {LABELS[priority]}
    </span>
  );
}
