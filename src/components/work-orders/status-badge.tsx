// src/components/work-orders/status-badge.tsx
import { Circle, CircleDashed, Eye, CheckCircle2, XCircle, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  pending: CircleDashed,
  in_progress: Circle,
  in_review: Eye,
  completed: CheckCircle2,
  cancelled: XCircle,
};

const STYLES: Record<string, string> = {
  pending:     "bg-estado-pendiente text-estado-pendiente-foreground",
  in_progress: "bg-estado-progreso text-estado-progreso-foreground",
  in_review:   "bg-estado-revision text-estado-revision-foreground",
  completed:   "bg-estado-completada text-estado-completada-foreground",
  cancelled:   "bg-estado-cancelada text-estado-cancelada-foreground",
};

const LABELS: Record<string, string> = {
  pending:     "Pendiente",
  in_progress: "En progreso",
  in_review:   "En revisión",
  completed:   "Completada",
  cancelled:   "Cancelada",
};

export function StatusBadge({ status }: { status: string }) {
  const Icon = ICONS[status] ?? CircleDashed;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${STYLES[status] ?? "bg-muted text-muted-foreground"}`}
    >
      <Icon size={12} aria-hidden="true" />
      {LABELS[status] ?? status}
    </span>
  );
}
