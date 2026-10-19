// src/components/restaurant/station-board.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CookingPot, WifiOff } from "lucide-react";
import { useAdvance, useStationBoard } from "@/hooks/use-restaurant";
import { SoundToggle, useChime } from "./sound-toggle";
import { StationCard } from "./station-card";

/** Reloj que se actualiza solo para que los minutos corran sin esperar al servidor. */
function useNow(everyMs = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

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

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1600px] flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-extrabold leading-none">{board.data?.station.name ?? "…"}</h1>
          <p className="text-muted-foreground" aria-live="polite">
            {t("pending", { count: list.length })}
          </p>
        </div>
        <SoundToggle enabled={sound.enabled} onToggle={sound.toggle} />
      </header>

      {!sound.enabled && (
        <p className="text-sm text-muted-foreground">{t("waitingSound")}</p>
      )}
      {board.isError && (
        <p role="alert" className="flex items-center gap-2 rounded-etiqueta bg-estado-pendiente px-3 py-2 text-estado-pendiente-foreground">
          <WifiOff aria-hidden className="size-4" />
          {t("loadError")}
        </p>
      )}

      {board.data && list.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
          <CookingPot aria-hidden className="size-16" />
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
