// src/components/restaurant/sound-toggle.tsx
"use client";
import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

/** Los navegadores solo dejan sonar tras un gesto: el contexto de audio se crea al activar el botón. */
export function useChime() {
  const context = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(false);

  const chime = useCallback(() => {
    const audio = context.current;
    if (!audio) return;
    const now = audio.currentTime;
    [660, 880].forEach((frequency, i) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.35, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.16);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now + i * 0.18);
      oscillator.stop(now + i * 0.18 + 0.18);
    });
  }, []);

  const toggle = useCallback(() => {
    if (enabled) {
      setEnabled(false);
      return;
    }
    const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!Ctor) return;
    context.current ??= new Ctor();
    void context.current.resume();
    setEnabled(true);
    chime();
  }, [enabled, chime]);

  return { enabled, toggle, chime };
}

export function SoundToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  const t = useTranslations("restaurant.station");
  return (
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
  );
}
