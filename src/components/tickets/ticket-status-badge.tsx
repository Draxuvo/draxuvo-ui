// src/components/tickets/ticket-status-badge.tsx
"use client";
import { useTranslations } from "next-intl";
import { CheckCircle2, Clock } from "lucide-react";

const STYLES: Record<string, string> = {
  pending: "bg-estado-pendiente text-estado-pendiente-foreground border-estado-pendiente-border",
  paid: "bg-estado-completada text-estado-completada-foreground border-estado-completada-border",
};

export function TicketStatusBadge({ status }: { status: "pending" | "paid" }) {
  const t = useTranslations("tickets");
  const Icon = status === "paid" ? CheckCircle2 : Clock;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${STYLES[status]}`}
    >
      <Icon size={11} aria-hidden="true" />
      {t(`statuses.${status}`)}
    </span>
  );
}
