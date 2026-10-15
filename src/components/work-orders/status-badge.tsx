// src/components/work-orders/status-badge.tsx
"use client";

import { useTranslations } from "next-intl";
import { Circle, CircleDashed, CheckCircle2, Eye, XCircle, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  open: CircleDashed,
  in_progress: Circle,
  done: Eye,
  paid: CheckCircle2,
  cancelled: XCircle,
};

const STYLES: Record<string, string> = {
  open:        "bg-estado-pendiente text-estado-pendiente-foreground",
  in_progress: "bg-estado-progreso text-estado-progreso-foreground",
  done:        "bg-estado-revision text-estado-revision-foreground",
  paid:        "bg-estado-completada text-estado-completada-foreground",
  cancelled:   "bg-estado-cancelada text-estado-cancelada-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("workOrders");
  const Icon = ICONS[status] ?? CircleDashed;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${STYLES[status] ?? "bg-muted text-muted-foreground"}`}
    >
      <Icon size={12} aria-hidden="true" />
      {status in ICONS ? t(`statuses.${status}`) : status}
    </span>
  );
}
