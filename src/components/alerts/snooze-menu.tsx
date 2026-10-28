// src/components/alerts/snooze-menu.tsx — posponer una alerta de tiempo 30 min, 1 h o 2 h (spec 045, FR-005a).
"use client";
import { useTranslations } from "next-intl";
import { BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { SnoozeMinutes } from "@/types";

const OPTIONS: { minutes: SnoozeMinutes; key: "m30" | "m60" | "m120" }[] = [
  { minutes: 30, key: "m30" },
  { minutes: 60, key: "m60" },
  { minutes: 120, key: "m120" },
];

export function SnoozeMenu({ onSnooze, disabled }: { onSnooze: (minutes: SnoozeMinutes) => void; disabled?: boolean }) {
  const t = useTranslations("alerts.snooze");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="min-h-11 gap-1.5" disabled={disabled}>
          <BellOff size={14} aria-hidden="true" />
          {t("action")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map(({ minutes, key }) => (
          <DropdownMenuItem key={minutes} onSelect={() => onSnooze(minutes)}>
            {t(key)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
