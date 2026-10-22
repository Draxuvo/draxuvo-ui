// src/components/restaurant/station-form.tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useStationMutations } from "@/hooks/use-restaurant";
import { cn } from "@/lib/utils";
import type { Station, StationKind } from "@/types";

const KINDS: StationKind[] = ["kitchen", "bar", "other"];

interface StationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  station?: Station | null;
}

export function StationForm({ open, onOpenChange, station }: StationFormProps) {
  // Se vuelve a montar con `key` al abrir otra estación, así el estado inicial siempre es el de la estación.
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <StationFields key={station?.id ?? "new"} station={station} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function StationFields({ station, onDone }: { station?: Station | null; onDone: () => void }) {
  const t = useTranslations("restaurant");
  const { create, update } = useStationMutations();
  const [name, setName] = useState(station?.name ?? "");
  const [kind, setKind] = useState<StationKind>(station?.kind ?? "kitchen");
  const [isDefault, setIsDefault] = useState(station?.is_default ?? false);
  const [active, setActive] = useState(station?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError(t("nameRequired"));
      return;
    }
    setError(null);
    const data = { name: name.trim(), kind, is_default: isDefault, active };
    try {
      if (station) await update.mutateAsync({ id: station.id, data });
      else await create.mutateAsync(data);
      toast.success(t("saved"));
      onDone();
    } catch {
      // El mensaje de la API ya salió en el aviso global.
    }
  }

  return (
    <>
      <SheetHeader className="border-b border-border/60 px-6 py-5">
        <SheetTitle className="text-base">{station ? t("editStation") : t("newStation")}</SheetTitle>
      </SheetHeader>
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <div className="flex-1 space-y-5 px-6 py-6">
          <div className="space-y-1.5">
            <Label htmlFor="station-name" className="text-xs font-medium text-foreground">
              {t("stationName")}
            </Label>
            <Input id="station-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("stationNamePlaceholder")} />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-foreground">{t("stationKindLabel")}</legend>
            <div role="radiogroup" aria-label={t("stationKindLabel")} className="grid grid-cols-3 gap-2">
              {KINDS.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={kind === value}
                  onClick={() => setKind(value)}
                  className={cn(
                    "min-h-10 rounded-etiqueta border px-3 text-sm font-semibold foco-etiqueta transition-colors",
                    kind === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(`stationKind.${value}`)}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t("stationKindHint")}</p>
          </fieldset>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="station-default" className="text-sm font-medium text-foreground">
                {t("stationDefault")}
              </Label>
              <p className="text-xs text-muted-foreground">{t("stationDefaultHint")}</p>
            </div>
            <Switch id="station-default" checked={isDefault} onCheckedChange={setIsDefault} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="station-active" className="text-sm font-medium text-foreground">
              {t("stationActive")}
            </Label>
            <Switch id="station-active" checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border/60 px-6 py-4">
          <Button type="button" variant="outline" onClick={onDone}>
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {t("save")}
          </Button>
        </div>
      </form>
    </>
  );
}
