// src/components/restaurant/station-board.tsx
"use client";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { WifiOff } from "lucide-react";
import { useNow } from "@/hooks/use-now";
import { useAdvance, useStationBoard } from "@/hooks/use-restaurant";
import { SoundToggle, useChime } from "./sound-toggle";
import { SLOW_AFTER_MINUTES, StationCard } from "./station-card";
import { STATION_KIND } from "./station-kind";
import { StationSummary } from "./station-summary";
import { cn } from "@/lib/utils";
import type { StationKind } from "@/types";

export function StationBoard({ stationId }: { stationId: number }) {
  const t = useTranslations("restaurant.station");
  const board = useStationBoard(stationId);
  const advance = useAdvance(stationId);
  const sound = useChime();
  const now = useNow();
  const seen = useRef<Set<number> | null>(null);

  // Una comanda que no se había visto hace sonar el aviso; la primera carga no suena.
  const orders = board.data?.orders;
  const { chime, enabled: soundOn } = sound;
  useEffect(() => {
    if (!orders) return;
    const ids = new Set(orders.map((order) => order.id));
    if (seen.current && [...ids].some((id) => !seen.current!.has(id)) && soundOn) chime();
    seen.current = ids;
  }, [orders, soundOn, chime]);

  const pending = advance.item.isPending || advance.order.isPending;
  const list = board.data?.orders ?? [];
  const kind: StationKind = board.data?.station.kind ?? "kitchen";
  const { Icon, tone, chip } = STATION_KIND[kind];

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1600px] flex-col gap-4 p-4">
      <header className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-etiqueta border border-l-8 border-border bg-card p-4 shadow-etiqueta", tone)}>
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className={cn("flex size-12 shrink-0 items-center justify-center rounded-full", chip)}>
            <Icon className="size-6" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-4xl font-extrabold leading-none">{board.data?.station.name ?? "…"}</h1>
            {t(`kind.${kind}`).toLowerCase() !== (board.data?.station.name ?? "").trim().toLowerCase() && (
              <p className="mt-1 text-sm font-semibold text-muted-foreground">{t(`kind.${kind}`)}</p>
            )}
          </div>
        </div>
        <StationSummary orders={list} now={now + (board.data?.offset ?? 0)} slowAfter={SLOW_AFTER_MINUTES} />
        <SoundToggle enabled={sound.enabled} onToggle={sound.toggle} />
      </header>

      {board.isError && (
        <p role="alert" className="flex items-center gap-2 rounded-etiqueta bg-estado-pendiente px-3 py-2 text-estado-pendiente-foreground">
          <WifiOff aria-hidden className="size-4" />
          {t("loadError")}
        </p>
      )}

      {board.data && list.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
          <Icon aria-hidden className="size-16" />
          <p className="font-display text-3xl font-extrabold text-foreground">{t("empty")}</p>
          <p>{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((order) => (
            <StationCard
              key={order.id}
              order={order}
              now={now + (board.data?.offset ?? 0)}
              pending={pending}
              onAdvanceItem={(id) => advance.item.mutate(id)}
              onAdvanceAll={(id) => advance.order.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
