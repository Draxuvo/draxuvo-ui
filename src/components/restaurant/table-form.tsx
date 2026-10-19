// src/components/restaurant/table-form.tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTableMutations } from "@/hooks/use-restaurant";
import type { DiningTable } from "@/types";

interface TableFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table?: DiningTable | null;
}

export function TableForm({ open, onOpenChange, table }: TableFormProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <TableFields key={table?.id ?? "new"} table={table} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function TableFields({ table, onDone }: { table?: DiningTable | null; onDone: () => void }) {
  const t = useTranslations("restaurant");
  const { create, update } = useTableMutations();
  const [name, setName] = useState(table?.name ?? "");
  const [active, setActive] = useState(table?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError(t("nameRequired"));
      return;
    }
    setError(null);
    const data = { name: name.trim(), active };
    try {
      if (table) await update.mutateAsync({ id: table.id, data });
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
        <SheetTitle className="text-base">{table ? t("editTable") : t("newTable")}</SheetTitle>
      </SheetHeader>
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <div className="flex-1 space-y-5 px-6 py-6">
          <div className="space-y-1.5">
            <Label htmlFor="table-name" className="text-xs font-medium text-foreground">
              {t("tableName")}
            </Label>
            <Input id="table-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("tableNamePlaceholder")} />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="table-active" className="text-sm font-medium text-foreground">
              {t("tableActive")}
            </Label>
            <Switch id="table-active" checked={active} onCheckedChange={setActive} />
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
