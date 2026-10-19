// src/app/[locale]/(dashboard)/restaurante/page.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ExternalLink, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleLocked, useModuleGate } from "@/components/subscription/module-locked";
import { StationForm } from "@/components/restaurant/station-form";
import { TableForm } from "@/components/restaurant/table-form";
import { StockAlerts } from "@/components/restaurant/stock-alerts";
import { useRestaurantTables, useStations } from "@/hooks/use-restaurant";
import type { DiningTable, Station } from "@/types";

const BADGE = "rounded-full px-2.5 py-0.5 text-xs font-semibold";

export default function RestaurantePage() {
  const t = useTranslations("restaurant");
  const locale = useLocale();
  const gate = useModuleGate("restaurant");
  const stations = useStations({ enabled: gate.enabled });
  const tables = useRestaurantTables({ enabled: gate.enabled });
  const [station, setStation] = useState<Station | null>(null);
  const [stationOpen, setStationOpen] = useState(false);
  const [table, setTable] = useState<DiningTable | null>(null);
  const [tableOpen, setTableOpen] = useState(false);

  if (gate.isLocked(stations.error)) return <ModuleLocked module="restaurant" />;

  const editStation = (value: Station | null) => {
    setStation(value);
    setStationOpen(true);
  };
  const editTable = (value: DiningTable | null) => {
    setTable(value);
    setTableOpen(true);
  };

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-3xl font-extrabold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <section aria-labelledby="stations-title" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="stations-title" className="font-display text-xl font-extrabold">
              {t("stations")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("stationsHint")}</p>
          </div>
          <Button onClick={() => editStation(null)} className="gap-2">
            <Plus size={16} aria-hidden />
            {t("newStation")}
          </Button>
        </div>
        {stations.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (stations.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noStations")}</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {stations.data!.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 rounded-etiqueta border border-border bg-card p-4 shadow-etiqueta">
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-semibold text-foreground">{item.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.is_default && <span className={`${BADGE} bg-estado-progreso text-estado-progreso-foreground`}>{t("defaultBadge")}</span>}
                    {!item.active && <span className={`${BADGE} bg-estado-cancelada text-estado-cancelada-foreground`}>{t("inactiveBadge")}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {item.active && (
                    <Button asChild variant="outline" size="sm" className="gap-1.5">
                      <Link href={`/${locale}/estacion/${item.id}`} target="_blank" rel="noopener">
                        <ExternalLink size={14} aria-hidden />
                        {t("openScreen")}
                      </Link>
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" aria-label={`${t("editStation")}: ${item.name}`} onClick={() => editStation(item)}>
                    <Pencil size={16} aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="tables-title" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="tables-title" className="font-display text-xl font-extrabold">
              {t("tables")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("tablesHint")}</p>
          </div>
          <Button onClick={() => editTable(null)} className="gap-2">
            <Plus size={16} aria-hidden />
            {t("newTable")}
          </Button>
        </div>
        {tables.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (tables.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noTables")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {tables.data!.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => editTable(item)}
                  aria-label={`${t("editTable")}: ${item.name}`}
                  className={`foco-etiqueta min-h-11 min-w-14 rounded-etiqueta border px-4 font-display text-lg font-bold ${
                    item.active ? "border-border bg-card text-foreground" : "border-dashed border-border bg-transparent text-muted-foreground line-through"
                  }`}
                >
                  {item.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <StockAlerts enabled={gate.enabled} />

      <StationForm open={stationOpen} onOpenChange={setStationOpen} station={station} />
      <TableForm open={tableOpen} onOpenChange={setTableOpen} table={table} />
    </div>
  );
}
