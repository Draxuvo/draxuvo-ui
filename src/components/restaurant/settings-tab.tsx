// src/components/restaurant/settings-tab.tsx
"use client";
// Restaurante → Configuración (dueño y administrador): estaciones, plano de mesas y existencias.
import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ExternalLink, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStations } from "@/hooks/use-restaurant";
import type { DiningTable, Station } from "@/types";
import { cn } from "@/lib/utils";
import { FloorPlanEditor } from "./floor-plan-editor";
import { STATION_KIND } from "./station-kind";
import { StationForm } from "./station-form";
import { StockAlerts } from "./stock-alerts";
import { TableForm } from "./table-form";

const BADGE = "rounded-full px-2.5 py-0.5 text-xs font-semibold";

export function SettingsTab({ enabled }: { enabled: boolean }) {
  const t = useTranslations("restaurant");
  const locale = useLocale();
  const stations = useStations({ enabled });
  const [station, setStation] = useState<Station | null>(null);
  const [stationOpen, setStationOpen] = useState(false);
  const [table, setTable] = useState<DiningTable | null>(null);
  const [tableOpen, setTableOpen] = useState(false);

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
            {stations.data!.map((item) => {
              const kind = item.kind ?? "kitchen";
              const { Icon, chip } = STATION_KIND[kind];
              const kindName = t(`stationKind.${kind}`);
              return (
                <li key={item.id} className="flex items-center justify-between gap-3 rounded-etiqueta border border-border bg-card p-4 shadow-etiqueta">
                  <div className="flex min-w-0 items-center gap-3">
                    <span role="img" aria-label={kindName} className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", chip)}>
                      <Icon aria-hidden className="size-5" />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-semibold text-foreground">{item.name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {kindName.toLowerCase() !== item.name.trim().toLowerCase() && (
                          <span className={`${BADGE} bg-muted text-foreground`}>{kindName}</span>
                        )}
                        {item.is_default && <span className={`${BADGE} bg-estado-progreso text-estado-progreso-foreground`}>{t("defaultBadge")}</span>}
                        {!item.active && <span className={`${BADGE} bg-estado-cancelada text-estado-cancelada-foreground`}>{t("inactiveBadge")}</span>}
                      </div>
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
              );
            })}
          </ul>
        )}
      </section>

      <FloorPlanEditor enabled={enabled} onEdit={editTable} />

      <StockAlerts enabled={enabled} />

      <StationForm open={stationOpen} onOpenChange={setStationOpen} station={station} />
      <TableForm open={tableOpen} onOpenChange={setTableOpen} table={table} />
    </div>
  );
}
