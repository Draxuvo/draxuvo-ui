// src/components/tickets/ticket-status-badge.tsx
"use client";
import { useTranslations } from "next-intl";
import { Ban, CheckCircle2, Clock } from "lucide-react";
import type { TicketStatus } from "@/types";

const STYLES: Record<TicketStatus, string> = {
  pending: "bg-estado-pendiente text-estado-pendiente-foreground border-estado-pendiente-border",
  paid: "bg-estado-completada text-estado-completada-foreground border-estado-completada-border",
  voided: "bg-estado-cancelada text-estado-cancelada-foreground border-estado-cancelada-border",
};

const ICONS = { pending: Clock, paid: CheckCircle2, voided: Ban } as const;

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const t = useTranslations("tickets");
  const Icon = ICONS[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${STYLES[status]}`}
    >
      <Icon size={11} aria-hidden="true" />
      {t(`statuses.${status}`)}
    </span>
  );
}
