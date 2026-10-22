// src/components/restaurant/service-view.tsx
"use client";
// Restaurante → Servicio (spec 032): plano de mesas con estado, cuentas para llevar y resumen vivo.
import { useTranslations } from "next-intl";
import { ConciergeBell, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/use-now";
import { useAppRouter } from "@/hooks/use-router";
import { useOpenCheck, useTablesOverview } from "@/hooks/use-restaurant";
import type { TableSummary } from "@/types";
import { ServiceSummary } from "./service-summary";
import { TableTile } from "./table-tile";

const num = (value: string | undefined) => (value == null ? null : Number(value));

export function ServiceView({ enabled, onConfigure }: { enabled: boolean; onConfigure?: () => void }) {
  const t = useTranslations("restaurant");
  const router = useAppRouter();
  const overview = useTablesOverview({ enabled });
  const openCheck = useOpenCheck();
  const now = useNow();

  const data = overview.data;
  const tables = (data?.results ?? []).filter((table) => table.active);
  const takeouts = data?.takeouts ?? [];

  async function pick(table: TableSummary) {
    if (table.check) return router.push(`/pedido?cuenta=${table.check.id}&from=restaurante`);
    const opened = await openCheck.mutateAsync({ dining_table_id: table.id });
    router.push(`/pedido?cuenta=${opened.id}&from=restaurante`);
  }

  if (overview.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      {overview.isError && data && (
        <p role="status" className="flex items-center gap-2 rounded-etiqueta bg-estado-pendiente px-3 py-2 text-sm text-estado-pendiente-foreground">
          <WifiOff aria-hidden className="size-4" />
          {t("service.stale")}
        </p>
      )}
      {data?.overview && <ServiceSummary overview={data.overview} />}

      <section aria-labelledby="plan-title" className="space-y-3">
        <h2 id="plan-title" className="font-display text-xl font-extrabold">
          {t("service.plan")}
        </h2>
        {tables.length === 0 ? (
          <div className="space-y-3 rounded-etiqueta border border-dashed border-border p-6">
            <p className="font-semibold text-foreground">{t("service.noTables")}</p>
            <p className="text-sm text-muted-foreground">{t("service.noTablesHint")}</p>
            {onConfigure && (
              <Button type="button" className="gap-2" onClick={onConfigure}>
                <ConciergeBell size={16} aria-hidden />
                {t("service.configure")}
              </Button>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {tables.map((table) => (
              <li key={table.id} className="contents">
                <TableTile
                  name={table.name}
                  state={table.state ?? (table.check ? "occupied" : "free")}
                  openedAt={table.check?.opened_at}
                  total={num(table.check?.total)}
                  owner={table.check?.waiter?.name}
                  mine={table.check?.mine}
                  now={now}
                  onClick={() => void pick(table)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {takeouts.length > 0 && (
        <section aria-labelledby="takeouts-title" className="space-y-3">
          <h2 id="takeouts-title" className="font-display text-xl font-extrabold">
            {t("service.takeouts")}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {takeouts.map((check) => (
              <li key={check.id} className="contents">
                <TableTile
                  name={check.takeout_name}
                  caption={t("service.takeoutCaption")}
                  state="occupied"
                  openedAt={check.opened_at}
                  total={num(check.total)}
                  owner={check.waiter?.name}
                  mine={check.mine}
                  now={now}
                  onClick={() => router.push(`/pedido?cuenta=${check.id}&from=restaurante`)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
