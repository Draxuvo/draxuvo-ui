// src/components/inventory/scan/receive-screen.tsx
// Recibir mercancía (spec 034): se escanea cada producto, se ajusta la cantidad y al confirmar se suma todo el
// stock de una vez. La lista vive solo en pantalla; al salir con algo sin confirmar se advierte.
"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductForm } from "@/components/inventory/product-form";
import { saveLabelSelection, selectionItem } from "@/hooks/use-label-selection";
import { useAppRouter } from "@/hooks/use-router";
import { inventoryService } from "@/services/inventory";
import { useAuthStore } from "@/store/auth";
import type { Product } from "@/types";
import { ScanField } from "./scan-field";
import { UnknownCodeDialog } from "./unknown-code-dialog";

interface Line {
  product: Product;
  qty: number;
}

export function ReceiveScreen() {
  const t = useTranslations("inventory");
  const tr = useTranslations("inventory.receive");
  const tl = useTranslations("inventory.labels");
  const router = useAppRouter();
  const locale = useLocale();
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.role);
  const [lines, setLines] = useState<Line[]>([]);
  // Lo que se acaba de recibir, para ofrecer sus etiquetas (una por pieza recibida).
  const [received, setReceived] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [unknown, setUnknown] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);
  // La misma llave en un reintento nunca duplica la recepción; se renueva al confirmar con éxito.
  const key = useRef<string>(crypto.randomUUID());

  // Advierte al cerrar o recargar la pestaña con una recepción sin confirmar.
  useEffect(() => {
    if (!lines.length) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [lines.length]);

  function add(product: Product, qty = 1) {
    setLines((current) => {
      const found = current.find((line) => line.product.id === product.id);
      return found
        ? current.map((line) => (line.product.id === product.id ? { ...line, qty: line.qty + qty } : line))
        : [...current, { product, qty }];
    });
  }

  async function onScan(code: string) {
    const product = await inventoryService.byCode(code);
    if (!product) return setUnknown(code);
    setReceived([]);
    if (!product.product_type?.counted) return void toast.error(tr("notCounted", { name: product.name }));
    add(product);
  }

  function setQty(id: number, qty: number) {
    setLines((current) => current.map((line) => (line.product.id === id ? { ...line, qty } : line)));
  }

  const confirm = useMutation({
    mutationFn: () =>
      inventoryService.receive(
        lines.map((line) => ({ product_id: line.product.id, qty: line.qty })),
        key.current,
        note.trim() || undefined,
      ),
    onSuccess: (result) => {
      toast.success(tr("success", { count: result.movements.length }));
      key.current = crypto.randomUUID();
      setReceived(lines);
      setLines([]);
      setNote("");
      void qc.invalidateQueries({ queryKey: ["products"] });
      setFocusSignal((n) => n + 1);
    },
  });

  function printReceived() {
    saveLabelSelection(received.map(({ product, qty }) => selectionItem(product, Math.max(1, Math.ceil(qty)))));
    router.push("/inventario/etiquetas");
  }

  const valid = lines.length > 0 && lines.every((line) => Number.isFinite(line.qty) && line.qty > 0);
  const pieces = lines.reduce((sum, line) => sum + (Number.isFinite(line.qty) ? line.qty : 0), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="space-y-1">
        <Link
          href={`/${locale}/inventario`}
          onClick={(event) => {
            if (lines.length && !window.confirm(tr("leaveBody"))) event.preventDefault();
          }}
          className="foco-etiqueta inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden />
          {tr("back")}
        </Link>
        <h1 className="font-display text-3xl font-extrabold">{tr("title")}</h1>
        <p className="text-sm text-muted-foreground">{tr("subtitle")}</p>
      </header>

      <ScanField onScan={onScan} focusSignal={focusSignal} disabled={confirm.isPending} />

      {received.length > 0 && lines.length === 0 && (
        <Button type="button" variant="outline" className="gap-1.5" onClick={printReceived}>
          <Printer size={15} aria-hidden />
          {tl("printReceived")}
        </Button>
      )}

      {lines.length === 0 ? (
        <p className="rounded-etiqueta border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{tr("empty")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-etiqueta border border-border bg-card" aria-label={tr("list")}>
          {lines.map(({ product, qty }) => {
            const step = product.product_type?.fractional ? 0.001 : 1;
            return (
              <li key={product.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{product.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {product.barcodes?.[0] ?? product.sku} · {t("stock")}: {product.stock ?? 0}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="size-10" aria-label={tr("dec", { name: product.name })} onClick={() => setQty(product.id, Math.max(step, qty - 1))}>
                    <Minus size={14} aria-hidden />
                  </Button>
                  <Input
                    type="number"
                    min={step}
                    step={step}
                    value={Number.isFinite(qty) ? qty : ""}
                    aria-label={tr("qty", { name: product.name })}
                    onChange={(event) => setQty(product.id, event.target.value === "" ? Number.NaN : Number(event.target.value))}
                    className="h-10 w-20 text-center tabular-nums"
                  />
                  <Button type="button" variant="outline" size="icon" className="size-10" aria-label={tr("inc", { name: product.name })} onClick={() => setQty(product.id, qty + 1)}>
                    <Plus size={14} aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-10 text-destructive" aria-label={tr("remove", { name: product.name })} onClick={() => setLines((current) => current.filter((line) => line.product.id !== product.id))}>
                    <Trash2 size={14} aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-3 rounded-etiqueta border border-border bg-card p-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-foreground">{tr("note")}</span>
          <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder={tr("notePlaceholder")} />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {tr("total", { pieces, lines: lines.length })}
          </p>
          <Button type="button" disabled={!valid || confirm.isPending} onClick={() => confirm.mutate()}>
            {confirm.isPending ? tr("confirming") : tr("confirm")}
          </Button>
        </div>
      </div>

      <UnknownCodeDialog
        code={unknown}
        onCancel={() => {
          setUnknown(null);
          setFocusSignal((n) => n + 1);
        }}
        onCreate={(code) => {
          setUnknown(null);
          setCreating(code);
        }}
      />
      <ProductForm
        open={creating !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(null);
            setFocusSignal((n) => n + 1);
          }
        }}
        initialBarcodes={creating ? [creating] : undefined}
        canEditIcon={role === "owner" || role === "admin" || role === "super_admin"}
        onSaved={(product) => add(product)}
      />
    </div>
  );
}
