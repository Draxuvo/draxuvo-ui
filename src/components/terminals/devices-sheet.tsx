// src/components/terminals/devices-sheet.tsx — terminales Point de la cuenta conectada para agregarlas a Draxuvo
// (spec 069, US2): nombre por dispositivo, «Agregar» y aviso de reiniciar si cambió a modo punto de venta.
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useLinkTerminal, useTerminalDevices } from "@/hooks/use-terminal-connections";
import type { TerminalDevice } from "@/types";

interface DevicesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: number;
}

export function DevicesSheet({ open, onOpenChange, connectionId }: DevicesSheetProps) {
  const t = useTranslations("terminals.devices");
  const [search, setSearch] = useState("");
  const [restart, setRestart] = useState<string | null>(null);
  const { data, isLoading, isError } = useTerminalDevices(open ? connectionId : null, search.trim());
  const devices = data?.results ?? [];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("title")}</SheetTitle>
            <SheetDescription>{t("description")}</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <Label htmlFor="devices-search" className="sr-only">
              {t("search")}
            </Label>
            <Input id="devices-search" placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="space-y-3 px-4 pb-4">
            {isLoading ? (
              [0, 1].map((i) => <Skeleton key={i} className="h-24 w-full rounded-etiqueta" />)
            ) : isError ? (
              <p role="alert" className="text-destructive">
                {t("loadError")}
              </p>
            ) : devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              devices.map((device) => (
                <DeviceRow key={device.device_id} device={device} connectionId={connectionId} onRestart={setRestart} />
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={restart != null} onOpenChange={(value) => !value && setRestart(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("restartTitle")}</DialogTitle>
            <DialogDescription>{restart && t("restartDesc", { name: restart })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="min-h-11" onClick={() => setRestart(null)}>
              {t("understood")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeviceRow({ device, connectionId, onRestart }: { device: TerminalDevice; connectionId: number; onRestart: (name: string) => void }) {
  const t = useTranslations("terminals.devices");
  const link = useLinkTerminal();
  const [name, setName] = useState("");
  const inputId = `device-${device.device_id}`;
  const trimmed = name.trim();

  async function add() {
    try {
      const terminal = await link.mutateAsync({ name: trimmed, terminal_connection_id: connectionId, device_id: device.device_id });
      toast.success(t("linked", { name: terminal.name }));
      setName("");
      if (terminal.restart_required) onRestart(terminal.name);
    } catch {
      // El aviso global ya mostró el error (repetida, no admite el modo, conexión con error).
    }
  }

  return (
    <div className="space-y-2 rounded-etiqueta border border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{device.label}</p>
        {device.mode && <p className="text-xs text-muted-foreground">{t("mode", { mode: device.mode })}</p>}
      </div>
      {device.linked_terminal ? (
        <p className="text-sm text-muted-foreground">{t("linkedHere", { name: device.linked_terminal.name })}</p>
      ) : !device.linkable ? (
        <p className="text-sm text-muted-foreground">{t("linkedElsewhere")}</p>
      ) : (
        <div className="flex gap-2">
          <Label htmlFor={inputId} className="sr-only">
            {t("nameLabel", { device: device.label })}
          </Label>
          <Input
            id={inputId}
            placeholder={t("namePlaceholder")}
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button className="min-h-11" disabled={!trimmed || link.isPending} onClick={add}>
            {t("link")}
          </Button>
        </div>
      )}
    </div>
  );
}
