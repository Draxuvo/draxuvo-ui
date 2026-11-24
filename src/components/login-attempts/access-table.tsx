// src/components/login-attempts/access-table.tsx — renglones de la bitácora (spec 073, FR-012): tabla en escritorio y
// tarjetas en el teléfono.
"use client";
import { useLocale, useTranslations } from "next-intl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatWhen } from "@/lib/login-attempts";
import type { LoginAttempt } from "@/types";
import { ResultBadge } from "./result-badge";

function usePersonLabel() {
  const t = useTranslations("accessLog");
  return (attempt: LoginAttempt) => {
    if (attempt.user?.deleted) return t("deletedAccount");
    if (attempt.user?.name) return attempt.user.name;
    return t("noAccount");
  };
}

export function AccessTable({ attempts }: { attempts: LoginAttempt[] }) {
  const t = useTranslations("accessLog");
  const locale = useLocale();
  const personOf = usePersonLabel();

  const companiesOf = (attempt: LoginAttempt) => attempt.companies.map((c) => c.name).join(", ") || "—";
  const deviceOf = (attempt: LoginAttempt) => attempt.device ?? t("unknownDevice");

  return (
    <>
      <div className="hidden overflow-x-auto rounded-etiqueta border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.when")}</TableHead>
              <TableHead>{t("columns.result")}</TableHead>
              <TableHead>{t("columns.person")}</TableHead>
              <TableHead>{t("columns.companies")}</TableHead>
              <TableHead>{t("columns.ip")}</TableHead>
              <TableHead>{t("columns.device")}</TableHead>
              <TableHead>{t("columns.channel")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attempts.map((attempt) => (
              <TableRow key={attempt.id}>
                <TableCell className="whitespace-nowrap tabular-nums">{formatWhen(attempt.created_at, locale)}</TableCell>
                <TableCell>
                  <ResultBadge result={attempt.result} />
                </TableCell>
                <TableCell>
                  <p className="font-medium text-foreground">{personOf(attempt)}</p>
                  <p className="text-xs text-muted-foreground">{attempt.email}</p>
                </TableCell>
                <TableCell className="max-w-48 truncate">{companiesOf(attempt)}</TableCell>
                <TableCell className="font-mono text-xs">{attempt.ip ?? "—"}</TableCell>
                <TableCell title={attempt.user_agent ?? undefined}>{deviceOf(attempt)}</TableCell>
                <TableCell>{t(`channels.${attempt.channel}`)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-2 md:hidden">
        {attempts.map((attempt) => (
          <li key={attempt.id} className="rounded-etiqueta border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{personOf(attempt)}</p>
                <p className="truncate text-xs text-muted-foreground">{attempt.email}</p>
              </div>
              <ResultBadge result={attempt.result} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {formatWhen(attempt.created_at, locale)} · {t(`channels.${attempt.channel}`)} · {deviceOf(attempt)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-mono">{attempt.ip ?? "—"}</span> · {companiesOf(attempt)}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
