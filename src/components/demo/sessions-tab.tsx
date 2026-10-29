// src/components/demo/sessions-tab.tsx
// Aperturas de la demo (spec 039): quién la abrió, con qué plan, por invitación o por su cuenta, con su contacto si lo
// dejó y cómo terminó. Muestra qué porcentaje de las aperturas recientes pasó al registro (SC-006).
"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Download, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DEMO_PLANS } from "@/lib/demo";
import { downloadCsv, toCsv } from "@/lib/reports/csv";
import { demoService } from "@/services/demo";
import type { DemoPlan, DemoSession } from "@/types";
import { Select } from "@/components/ui/select";

const PAGE_SIZE = 20;
/** Aperturas que se leen para calcular el porcentaje que pasó al registro. */
const SAMPLE_SIZE = 100;

type Outcome = "open" | "left" | "signup" | "expired";
const outcomeOf = (session: DemoSession): Outcome => session.ended_reason ?? (session.ended_at || session.purged_at ? "left" : "open");
const TONE: Record<Outcome, "default" | "secondary" | "outline"> = {
  signup: "default",
  left: "secondary",
  expired: "secondary",
  open: "outline",
};

export function SessionsTab() {
  const t = useTranslations("demo.admin");
  const ts = useTranslations("demo.admin.sessions");
  const tp = useTranslations("plans");
  const tn = useTranslations("demo.entry.scenarios");
  const locale = useLocale();

  const [plan, setPlan] = useState<DemoPlan | "">("");
  const [withContact, setWithContact] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filters = { plan: plan || undefined, with_contact: withContact || undefined, search: search.trim() || undefined };
  const list = useQuery({
    queryKey: ["demo-sessions", filters, page],
    queryFn: () => demoService.listSessions({ ...filters, page, page_size: PAGE_SIZE }),
  });
  // Lectura aparte, más grande y sin página, para el porcentaje y el CSV.
  const sample = useQuery({
    queryKey: ["demo-sessions", "sample", filters],
    queryFn: () => demoService.listSessions({ ...filters, page: 1, page_size: SAMPLE_SIZE }),
  });

  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const sessions = list.data?.results ?? [];
  const recent = sample.data?.results ?? [];
  const percent = recent.length ? Math.round((recent.filter((s) => s.ended_reason === "signup").length / recent.length) * 100) : 0;

  const exportCsv = () =>
    downloadCsv(
      "demo-aperturas.csv",
      toCsv<DemoSession>(
        [
          { header: ts("columns.date"), value: (s) => s.created_at },
          { header: ts("columns.plan"), value: (s) => tp(s.plan) },
          { header: ts("columns.origin"), value: (s) => s.invite?.label ?? ts("origin.self") },
          { header: ts("filters.search"), value: (s) => s.contact?.name },
          { header: "Email", value: (s) => s.contact?.email },
          { header: "WhatsApp", value: (s) => s.contact?.phone },
          { header: ts("columns.outcome"), value: (s) => ts(`outcome.${outcomeOf(s)}`) },
        ],
        recent,
      ),
    );

  const apply = (change: () => void) => {
    change();
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {ts("filters.plan")}
            <Select className="w-auto" value={plan} onChange={(e) => apply(() => setPlan(e.target.value as DemoPlan | ""))}>
              <option value="">{t("all")}</option>
              {DEMO_PLANS.map((key) => (
                <option key={key} value={key}>
                  {tp(key)}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={withContact} onChange={(e) => apply(() => setWithContact(e.target.checked))} />
            {ts("filters.withContact")}
          </label>
          <Input
            aria-label={ts("filters.search")}
            placeholder={ts("filters.search")}
            value={search}
            onChange={(e) => apply(() => setSearch(e.target.value))}
            className="h-8 w-56"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => list.refetch()} disabled={list.isFetching} aria-label={t("refresh")}>
            <RefreshCw size={15} className={list.isFetching ? "animate-spin" : ""} />
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={recent.length === 0}>
            <Download size={15} aria-hidden /> {ts("export")}
          </Button>
        </div>
      </div>

      {recent.length > 0 && (
        <p className="text-sm text-muted-foreground" data-testid="conversion">
          {ts("conversion", { count: recent.length, percent })}
        </p>
      )}

      {list.isError ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">{t("loadError")}</p>
          <Button variant="outline" onClick={() => list.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : list.isLoading ? (
        <Skeleton className="h-48 w-full rounded-etiqueta" />
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="font-medium">{ts("empty")}</p>
          <p className="text-sm text-muted-foreground">{ts("emptyHint")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-etiqueta border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ts("columns.date")}</TableHead>
                <TableHead>{ts("columns.plan")}</TableHead>
                <TableHead>{ts("columns.origin")}</TableHead>
                <TableHead>{ts("columns.contact")}</TableHead>
                <TableHead>{ts("columns.outcome")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => {
                const outcome = outcomeOf(session);
                return (
                  <TableRow key={session.id}>
                    <TableCell className="text-muted-foreground">{date.format(new Date(session.created_at))}</TableCell>
                    <TableCell>
                      <span className="font-medium">{tp(session.plan)}</span>
                      <span className="block text-xs text-muted-foreground">{tn(session.scenario)}</span>
                    </TableCell>
                    <TableCell>{session.invite?.label ?? ts("origin.self")}</TableCell>
                    <TableCell>
                      {session.contact ? (
                        <>
                          <span className="font-medium">{session.contact.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {[session.contact.email, session.contact.phone].filter(Boolean).join(" · ")}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">{ts("noContact")}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TONE[outcome]}>{ts(`outcome.${outcome}`)}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {list.data?.info && list.data.info.total > 0 && <Pagination info={list.data.info} onPageChange={setPage} />}
    </div>
  );
}
