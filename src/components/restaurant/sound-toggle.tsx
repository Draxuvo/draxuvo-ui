"use client";
import { useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSoundChoices } from "@/hooks/use-sound-choices";
import { useSoundPreference } from "@/hooks/use-sound-preference";
import { ALERT_KINDS, type AlertKind } from "@/lib/sounds/catalog";
import { pickAlert, resolve } from "@/lib/sounds/choices";
import { ensureContext, hasContext, play, preload } from "@/lib/sounds/engine";
import type { StationKind } from "@/types";
import { SoundSettings } from "./sound-settings";

const NEW_ALERT: Record<StationKind, AlertKind> = {
  kitchen: "new_kitchen",
  bar: "new_bar",
  other: "new_other",
};

/**
 * Los navegadores solo dejan sonar tras un gesto: el contexto de audio se crea al activar el botón.
 * El sonido de cada alerta sale de las elecciones del dispositivo (spec 046); las alertas que coinciden
 * en el mismo ciclo suenan una sola vez, la de mayor prioridad.
 */
export function useSound(surfaceKey: string, kind: StationKind = "kitchen") {
  const { enabled, volume, setEnabled, setVolume } = useSoundPreference(surfaceKey);
  const { choices } = useSoundChoices();
  const latest = useRef({ enabled, volume, choices });
  // Los avisos se vacían en una microtarea: leen lo último que se pintó, sin depender de qué efecto corrió antes.
  useEffect(() => {
    latest.current = { enabled, volume, choices };
  }, [enabled, volume, choices]);
  const queue = useRef<AlertKind[]>([]);
  const newAlert = NEW_ALERT[kind] ?? "new_other";

  useEffect(() => {
    if (enabled && hasContext()) preload(ALERT_KINDS.map((alert) => resolve(alert, choices)).filter((id) => id !== undefined));
  }, [enabled, choices]);

  const flush = useCallback(() => {
    const picked = pickAlert(queue.current);
    queue.current = [];
    const { enabled: on, volume: level, choices: chosen } = latest.current;
    if (!picked || !on || !hasContext()) return;
    const id = resolve(picked, chosen);
    if (id) void play(id, level, picked);
  }, []);

  const queueAlert = useCallback(
    (alert: AlertKind) => {
      queue.current.push(alert);
      if (queue.current.length === 1) queueMicrotask(flush);
    },
    [flush],
  );

  const toggle = useCallback(() => {
    if (enabled) {
      setEnabled(false);
      return;
    }
    if (!ensureContext()) return;
    setEnabled(true);
    const id = resolve(newAlert, choices);
    if (id) void play(id, volume, newAlert);
  }, [enabled, setEnabled, volume, choices, newAlert]);

  const playNew = useCallback(() => queueAlert(newAlert), [queueAlert, newAlert]);
  const playUrgent = useCallback(() => queueAlert("urgent"), [queueAlert]);
  const playReady = useCallback(() => queueAlert("ready"), [queueAlert]);

  return { enabled, volume, setVolume, toggle, queueAlert, playNew, playUrgent, playReady };
}

export function SoundToggle({
  enabled,
  volume,
  onToggle,
  onVolumeChange,
}: {
  enabled: boolean;
  volume: number;
  onToggle: () => void;
  onVolumeChange: (volume: number) => void;
}) {
  const t = useTranslations("restaurant.station");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={enabled ? "secondary" : "default"}
        size="lg"
        onClick={onToggle}
        aria-pressed={enabled}
        title={enabled ? undefined : t("waitingSound")}
        className="min-h-12 gap-2"
      >
        {enabled ? <Volume2 aria-hidden className="size-5" /> : <VolumeX aria-hidden className="size-5" />}
        {enabled ? t("soundOn") : t("soundOff")}
      </Button>
      {enabled && (
        <label className="flex items-center gap-2 text-sm font-semibold">
          <Volume2 aria-hidden className="size-4" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            aria-label={t("volume")}
            className="w-28"
          />
        </label>
      )}
      <SoundSettings volume={volume} />
    </div>
  );
}
