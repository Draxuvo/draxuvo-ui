"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Music, Play, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSoundChoices } from "@/hooks/use-sound-choices";
import { ALERT_KINDS, DEFAULTS, SOUND_IDS, type SoundId } from "@/lib/sounds/catalog";
import { duplicates, resolve } from "@/lib/sounds/choices";
import { ensureContext, play } from "@/lib/sounds/engine";
import { Select } from "@/components/ui/select";

/** Ajustes de sonido de este dispositivo: elegir, probar y restablecer el sonido de cada alerta (spec 046). */
export function SoundSettings({ volume }: { volume: number }) {
  const t = useTranslations("restaurant.sounds");
  const { choices, choose, reset, resetAll } = useSoundChoices();
  const [failed, setFailed] = useState(false);
  const repeated = new Set(duplicates(choices, ALERT_KINDS));
  const changed = ALERT_KINDS.filter((alert) => resolve(alert, choices) !== DEFAULTS[alert]);

  // "Probar" es una acción explícita: suena aunque la superficie esté silenciada.
  const preview = async (id: SoundId) => {
    setFailed(false);
    if (!ensureContext()) return setFailed(true);
    if (!(await play(id, volume))) setFailed(true);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="lg" className="min-h-12 gap-2">
          <Music aria-hidden className="size-5" />
          {t("open")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("hint")}</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-3">
          {ALERT_KINDS.map((alert) => {
            const id = resolve(alert, choices) ?? DEFAULTS[alert];
            return (
              <li key={alert} className="flex flex-col gap-1 rounded-etiqueta border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor={`sound-${alert}`} className="min-w-40 flex-1 text-sm font-semibold">
                    {t(alert)}
                  </label>
                  <Select
                    id={`sound-${alert}`}
                    value={id}
                    onChange={(event) => choose(alert, event.target.value as SoundId)}
                    className="w-auto"
                  >
                    {SOUND_IDS.map((option) => (
                      <option key={option} value={option}>
                        {t(option)}
                      </option>
                    ))}
                  </Select>
                  <Button type="button" variant="secondary" size="sm" onClick={() => void preview(id)} aria-label={t("previewLabel", { sound: t(id) })}>
                    <Play aria-hidden className="size-4" />
                    {t("preview")}
                  </Button>
                  {changed.includes(alert) && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => reset(alert)} aria-label={`${t("reset")}: ${t(alert)}`}>
                      {t("reset")}
                    </Button>
                  )}
                </div>
                {repeated.has(alert) && (
                  <p className="flex items-center gap-1 text-xs font-semibold text-estado-pendiente-foreground">
                    <TriangleAlert aria-hidden className="size-3.5" />
                    {t("duplicate")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {failed && (
          <p role="alert" className="rounded-etiqueta bg-estado-pendiente px-3 py-2 text-sm text-estado-pendiente-foreground">
            {t("playError")}
          </p>
        )}
        {changed.length > 0 && (
          <Button type="button" variant="outline" onClick={resetAll} className="self-start">
            {t("resetAll")}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
