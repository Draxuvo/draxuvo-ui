"use client";
import { useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSoundPreference } from "@/hooks/use-sound-preference";
import type { StationKind } from "@/types";

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

const NEW_TONES: Record<StationKind, number[]> = {
  kitchen: [660, 880],
  bar: [523, 784],
  other: [392, 523],
};
const URGENT_TONES = [196, 262];
const READY_TONES = [880, 660];

function scheduleTone(audio: AudioContext, frequencies: number[], volume: number): void {
  const now = audio.currentTime;
  frequencies.forEach((frequency, i) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now + i * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.35 * volume, now + i * 0.18 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.16);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(now + i * 0.18);
    oscillator.stop(now + i * 0.18 + 0.18);
  });
}

/** Los navegadores solo dejan sonar tras un gesto: el contexto de audio se crea al activar el botón. */
export function useSound(surfaceKey: string, kind: StationKind = "kitchen") {
  const context = useRef<AudioContext | null>(null);
  const { enabled, volume, setEnabled, setVolume } = useSoundPreference(surfaceKey);

  const ensureContext = useCallback(() => {
    const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!Ctor) return null;
    context.current ??= new Ctor();
    void context.current.resume();
    return context.current;
  }, []);

  const play = useCallback((frequencies: number[], level: number) => {
    const audio = context.current;
    if (!audio) return;
    scheduleTone(audio, frequencies, level);
  }, []);

  const toggle = useCallback(() => {
    if (enabled) {
      setEnabled(false);
      return;
    }
    if (!ensureContext()) return;
    setEnabled(true);
    play(NEW_TONES[kind], volume);
  }, [enabled, setEnabled, volume, kind, ensureContext, play]);

  const playNew = useCallback(() => {
    if (enabled && context.current) play(NEW_TONES[kind], volume);
  }, [enabled, volume, kind, play]);

  const playUrgent = useCallback(() => {
    if (enabled && context.current) play(URGENT_TONES, volume);
  }, [enabled, volume, play]);

  const playReady = useCallback(() => {
    if (enabled && context.current) play(READY_TONES, volume);
  }, [enabled, volume, play]);

  return {
    enabled,
    volume,
    setVolume,
    toggle,
    playNew,
    playUrgent,
    playReady,
  };
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
    </div>
  );
}
