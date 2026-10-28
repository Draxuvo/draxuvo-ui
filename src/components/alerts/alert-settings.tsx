// src/components/alerts/alert-settings.tsx — tiempos límite, hora del resumen y zona horaria (spec 045, FR-016).
"use client";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAlertSettings, useUpdateAlertSettings } from "@/hooks/use-alerts";
import type { AlertKind, AlertSettings, AlertSettingsPatch, StationKind } from "@/types";

const STATIONS: StationKind[] = ["kitchen", "bar", "other"];
const MIN = 1;
const MAX = 10_080;
const ZONES = [
  "America/Mexico_City",
  "America/Monterrey",
  "America/Cancun",
  "America/Merida",
  "America/Chihuahua",
  "America/Mazatlan",
  "America/Hermosillo",
  "America/Tijuana",
];

/** Secciones de tiempo que existen: una fila por tipo de estación o un solo campo. */
const SECTIONS: { kind: Exclude<AlertKind, "low_stock">; perStation: boolean }[] = [
  { kind: "kitchen_wait", perStation: true },
  { kind: "kitchen_preparing", perStation: true },
  { kind: "table_open", perStation: false },
  { kind: "work_order_stalled", perStation: false },
];

type Draft = Record<string, string>;

const fieldKey = (kind: string, station?: StationKind) => (station ? `${kind}.${station}` : kind);

function toDraft(settings: AlertSettings): Draft {
  const draft: Draft = {};
  for (const { kind, perStation } of SECTIONS) {
    if (perStation) {
      for (const station of STATIONS) draft[fieldKey(kind, station)] = String(settings.thresholds[kind as "kitchen_wait" | "kitchen_preparing"][station]);
    } else {
      draft[fieldKey(kind)] = String(settings.thresholds[kind as "table_open" | "work_order_stalled"]);
    }
  }
  draft.summary_hour = String(settings.summary_hour);
  draft.time_zone = settings.time_zone;
  return draft;
}

const validMinutes = (value: string) => /^\d+$/.test(value) && Number(value) >= MIN && Number(value) <= MAX;

/** Solo manda lo que cambió, con la misma forma que `thresholds` de la API. */
function toPatch(settings: AlertSettings, draft: Draft): AlertSettingsPatch {
  const patch: AlertSettingsPatch = {};
  const thresholds: NonNullable<AlertSettingsPatch["thresholds"]> = {};

  for (const { kind, perStation } of SECTIONS) {
    if (perStation) {
      const current = settings.thresholds[kind as "kitchen_wait" | "kitchen_preparing"];
      const changed: Partial<Record<StationKind, number>> = {};
      for (const station of STATIONS) {
        const value = Number(draft[fieldKey(kind, station)]);
        if (value !== current[station]) changed[station] = value;
      }
      if (Object.keys(changed).length) thresholds[kind as "kitchen_wait" | "kitchen_preparing"] = changed;
    } else {
      const value = Number(draft[fieldKey(kind)]);
      if (value !== settings.thresholds[kind as "table_open" | "work_order_stalled"]) thresholds[kind as "table_open" | "work_order_stalled"] = value;
    }
  }

  if (Object.keys(thresholds).length) patch.thresholds = thresholds;
  if (Number(draft.summary_hour) !== settings.summary_hour) patch.summary_hour = Number(draft.summary_hour);
  if (draft.time_zone !== settings.time_zone) patch.time_zone = draft.time_zone;
  return patch;
}

export function AlertSettingsForm() {
  const t = useTranslations("alerts.settings");
  const { data, isLoading, isError } = useAlertSettings();

  if (isLoading) return <Skeleton className="h-64 w-full" aria-busy="true" />;
  if (isError || !data) return <p role="alert" className="text-sm text-muted-foreground">{t("loadError")}</p>;

  // `key`: si la configuración cambia en el servidor (o tras guardar), el borrador vuelve a empezar de lo guardado.
  return <SettingsEditor key={JSON.stringify(data)} data={data} />;
}

function SettingsEditor({ data }: { data: AlertSettings }) {
  const t = useTranslations("alerts.settings");
  const update = useUpdateAlertSettings();
  const [draft, setDraft] = useState<Draft>(() => toDraft(data));

  const patch = useMemo(() => toPatch(data, draft), [data, draft]);
  const invalid = useMemo(
    () => Object.entries(draft).some(([key, value]) => key !== "time_zone" && key !== "summary_hour" && !validMinutes(value)),
    [draft],
  );

  const applicable = new Set(data.applicable);
  const zones = ZONES.includes(draft.time_zone) ? ZONES : [draft.time_zone, ...ZONES];

  function set(key: string, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function field(kind: string, station: StationKind | undefined, id: string, label: string, defaultValue: number) {
    const key = fieldKey(kind, station);
    const bad = !validMinutes(draft[key]);
    return (
      <div key={key} className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={MIN}
            max={MAX}
            step={1}
            value={draft[key]}
            onChange={(event) => set(key, event.target.value)}
            aria-invalid={bad}
            aria-describedby={`${id}-hint`}
            className="min-h-11 w-28"
          />
          <span className="text-sm text-muted-foreground">{t("minutes")}</span>
        </div>
        <p id={`${id}-hint`} className={bad ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {bad ? t("range") : t("default", { value: defaultValue })}
        </p>
      </div>
    );
  }

  async function save() {
    if (!data || Object.keys(patch).length === 0) return;
    try {
      await update.mutateAsync(patch);
      toast.success(t("saved"));
    } catch {
      // El aviso global ya mostró el error de la API.
    }
  }

  return (
    <form
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div>
        <h2 className="text-base font-medium text-foreground">{t("title")}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      {SECTIONS.filter(({ kind }) => applicable.has(kind)).map(({ kind, perStation }) => (
        <fieldset key={kind} className="space-y-3 rounded-etiqueta border border-border bg-card p-4">
          <legend className="px-1 text-sm font-medium text-foreground">{t(`sections.${kind}`)}</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            {perStation
              ? STATIONS.map((station) =>
                  field(
                    kind,
                    station,
                    `${kind}-${station}`,
                    t(`stations.${station}`),
                    data.defaults[kind as "kitchen_wait" | "kitchen_preparing"][station],
                  ),
                )
              : field(kind, undefined, kind, t(`sections.${kind}`), data.defaults[kind as "table_open" | "work_order_stalled"])}
          </div>
        </fieldset>
      ))}

      {applicable.has("low_stock") && (
        <fieldset className="space-y-3 rounded-etiqueta border border-border bg-card p-4">
          <legend className="px-1 text-sm font-medium text-foreground">{t("sections.summary")}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="summary-hour">{t("summaryHour")}</Label>
              <select
                id="summary-hour"
                value={draft.summary_hour}
                onChange={(event) => set("summary_hour", event.target.value)}
                className="foco-etiqueta min-h-11 w-full rounded-etiqueta border border-border bg-background px-3 text-sm"
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={hour}>
                    {`${String(hour).padStart(2, "0")}:00`}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="time-zone">{t("timeZone")}</Label>
              <select
                id="time-zone"
                value={draft.time_zone}
                onChange={(event) => set("time_zone", event.target.value)}
                className="foco-etiqueta min-h-11 w-full rounded-etiqueta border border-border bg-background px-3 text-sm"
              >
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("summaryHint")}</p>
        </fieldset>
      )}

      <Button type="submit" className="min-h-11" disabled={invalid || update.isPending || Object.keys(patch).length === 0}>
        {t("save")}
      </Button>
    </form>
  );
}
