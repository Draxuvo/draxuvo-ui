// src/components/login-attempts/result-badge.tsx — resultado de un intento con su color (spec 073, FR-012).
"use client";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { resultTone } from "@/lib/login-attempts";
import type { LoginAttemptResult } from "@/types";

const TONES = {
  ok: "bg-success/10 text-success",
  warn: "bg-warning/15 text-foreground",
  bad: "bg-destructive/10 text-destructive",
} as const;

export function ResultBadge({ result }: { result: LoginAttemptResult }) {
  const t = useTranslations("accessLog.results");
  return (
    <span
      data-tone={resultTone(result)}
      className={cn("inline-flex h-6 items-center rounded-etiqueta px-2 text-xs font-medium whitespace-nowrap", TONES[resultTone(result)])}
    >
      {t(result)}
    </span>
  );
}
