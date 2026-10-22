"use client";
// Pantalla para tomar pedidos (spec 018): plano de mesas, orden y menú de tarjetas en una sola vista.
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import type { AxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChargeDialog } from "@/components/work-orders/charge-dialog";
import { useAppRouter } from "@/hooks/use-router";
import { useSaleMenu } from "@/hooks/use-restaurant";
import { useFinishOrder } from "@/hooks/use-work-orders";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import { CheckPaymentDialog } from "./check-payment-dialog";
import type { Line, MenuCard, MenuSection } from "./lib";
import { MenuGrid } from "./menu-grid";
import { OrderPanel } from "./order-panel";
import { TablePlan } from "./table-plan";
import { useOrderSource, type Selection, type SourceTile } from "./use-order-source";
import { useScreenMode } from "./use-screen-mode";

type Tab = "tables" | "order" | "menu";

const BACK_TO: Record<string, string> = { restaurante: "/restaurante", ordenes: "/ordenes", "mis-ordenes": "/mis-ordenes" };

export function TakeOrderScreen() {
  const { mode, ready } = useScreenMode();
  const role = useAuthStore((s) => s.role);
  const router = useAppRouter();
  const t = useTranslations("takeOrder");

  // Sin restaurante y en modo servicio la pantalla no aplica: vuelve al formulario de siempre.
  useEffect(() => {
    if (ready && mode === "none") router.replace(role === "staff" ? "/mis-ordenes" : "/ordenes");
  }, [ready, mode, role, router]);

  if (!ready || mode === "none") return <p className="p-6 text-sm text-muted-foreground">{t("title")}…</p>;
  return <Board mode={mode} />;
}

function errorCode(err: unknown): string | undefined {
  const e = err as AxiosError<{ error?: { code?: string; details?: { code?: string } } }>;
  return e.response?.data?.error?.details?.code ?? e.response?.data?.error?.code;
}

function Board({ mode }: { mode: "restaurant" | "orders" }) {
  const t = useTranslations("takeOrder");
  const router = useAppRouter();
  const params = useSearchParams();
  // Dónde vuelve "volver" según `from`; solo valores conocidos, cualquier otro se ignora.
  const backTo = BACK_TO[params.get("from") ?? ""];
  // `?cuenta=<id>` abre esa cuenta al entrar (spec 020); un valor que no sea entero positivo se ignora.
  const [initialCheck] = useState(() => {
    const id = Number(params.get("cuenta"));
    return mode === "restaurant" && Number.isInteger(id) && id > 0 ? id : null;
  });
  const client = useQueryClient();
  const role = useAuthStore((s) => s.role);
  const [selection, setSelection] = useState<Selection>(initialCheck ? { kind: "check", id: initialCheck } : null);
  const [tab, setTab] = useState<Tab>(initialCheck ? "order" : "tables");
  const [payOpen, setPayOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const source = useOrderSource(mode, selection);
  const menuQuery = useSaleMenu();
  const finish = useFinishOrder(selection?.kind === "order" ? selection.id : 0);

  const menu: MenuSection[] = (menuQuery.data ?? []).map((section) => ({
    category: section.category,
    items: section.items.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price ?? 0),
      icon: p.icon,
      product_type: p.product_type,
      sold_out: p.sold_out,
      low: p.low,
      available_qty: p.available_qty,
    })),
  }));

  // Ejecuta un cambio; si no se guarda, lo dice y la orden queda como estaba.
  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (err) {
      if (errorCode(err) === "table_occupied") {
        toast.info(t("tableTaken"));
        void client.invalidateQueries({ queryKey: ["restaurant", "overview"] });
      } else {
        toast.error(t("saveError"));
      }
    }
  }

  async function pick(tile: SourceTile) {
    if (tile.selection) {
      setSelection(tile.selection);
      setTab("order");
      return;
    }
    if (tile.tableId == null) return;
    await run(async () => {
      setSelection(await source.create({ tableId: tile.tableId as number }));
      setTab("menu");
    });
  }

  async function createNamed(name: string) {
    await run(async () => {
      setSelection(await source.create({ name }));
      setTab("menu");
    });
  }

  async function send() {
    try {
      const res = await source.send(crypto.randomUUID());
      toast.success(t("sendDone", { number: res.kitchen_order.number }));
      for (const r of res.rejected) toast.error(t("sendRejected", { name: r.name, reason: r.reason }));
    } catch {
      toast.error(t("saveError"));
    }
  }

  // Liberar la mesa: sin productos se cancela de una vez; con productos sin mandar se pide confirmar.
  async function release(confirmed = false) {
    const current = source.current;
    if (!current?.canRelease) return;
    if (!confirmed && current.lines.some((l) => !l.cancelled)) return setReleaseOpen(true);
    setReleaseOpen(false);
    await run(async () => {
      await source.release();
      setSelection(null);
      setTab("tables");
      toast.success(t("released"));
    });
  }

  async function charge() {
    const current = source.current;
    if (!current) return;
    if (current.check) return setPayOpen(true);
    // Una orden abierta se termina antes de cobrarla.
    if (current.order && current.order.status !== "done") {
      await run(async () => {
        await finish.mutateAsync(undefined);
        setChargeOpen(true);
      });
      return;
    }
    setChargeOpen(true);
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "tables", label: t("tables") },
    { key: "order", label: t("order") },
    { key: "menu", label: t("menu") },
  ];
  const current = source.current;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Button
          type="button" variant="ghost" size="icon" className="size-11"
          aria-label={t("back")}
          onClick={() => router.push(backTo ?? (role === "staff" ? "/mis-ordenes" : "/ordenes"))}
        >
          <ArrowLeft size={18} aria-hidden />
        </Button>
        <h1 className="font-display text-xl font-extrabold">{t("title")}</h1>
      </header>

      <nav aria-label={t("title")} className="grid grid-cols-3 gap-1 border-b border-border p-1 lg:hidden">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            className={cn("min-h-11 rounded-md text-sm font-medium", tab === key ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
          >
            {label}
          </button>
        ))}
      </nav>

      <div
        className={cn(
          "grid min-h-0 flex-1 gap-3 p-3",
          tab === "menu" ? "sm:grid-cols-1 lg:grid-cols-[minmax(260px,1fr)_minmax(340px,1.1fr)_minmax(420px,2fr)]" : "sm:grid-cols-2 lg:grid-cols-[minmax(260px,1fr)_minmax(340px,1.1fr)_minmax(420px,2fr)]",
        )}
      >
        <section
          aria-label={t("tables")}
          className={cn("min-h-0 overflow-y-auto rounded-etiqueta border border-border bg-card/40 p-3", tab === "menu" ? "hidden lg:block" : tab === "tables" ? "block" : "hidden sm:block")}
        >
          <TablePlan
            tiles={source.tiles}
            mode={mode}
            selection={selection}
            loading={source.loading}
            error={source.error}
            onPick={(tile) => void pick(tile)}
            onCreate={(name) => void createNamed(name)}
          />
        </section>

        <section
          aria-label={t("order")}
          className={cn("min-h-0 flex-col rounded-etiqueta border border-border bg-card/40 p-3", tab === "order" ? "flex" : tab === "menu" ? "hidden lg:flex" : "hidden sm:flex")}
        >
          <OrderPanel
            current={current}
            loading={source.currentLoading}
            missing={source.currentMissing}
            canNote={mode === "restaurant"}
            sending={source.sending}
            onQuantity={(line: Line, q: number) => void run(() => source.setQuantity(line, q))}
            onRemove={(line: Line) => void run(() => source.remove(line))}
            onNote={(line: Line, note: string) => void run(() => source.setNote(line, note))}
            onAddMore={() => setTab("menu")}
            onSend={() => void send()}
            onCharge={() => void charge()}
            onRelease={() => void release()}
          />
        </section>

        <section
          aria-label={t("menu")}
          className={cn("min-h-0 overflow-y-auto rounded-etiqueta border border-border bg-card/40 p-3", tab === "menu" ? "block" : "hidden lg:block")}
        >
          <MenuGrid
            menu={menu}
            loading={menuQuery.isLoading}
            error={menuQuery.isError}
            disabled={!current?.canAdd}
            countOf={(card) => source.inOrder(card)}
            onTap={(card: MenuCard) => void run(() => source.tap(card))}
          />
        </section>
      </div>

      <Dialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("releaseTitle")}</DialogTitle>
            <DialogDescription>{t("releaseBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setReleaseOpen(false)}>
              {t("releaseKeep")}
            </Button>
            <Button type="button" className="min-h-11" onClick={() => void release(true)}>
              {t("releaseConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {current?.check && (
        <CheckPaymentDialog
          key={current.check.id}
          check={current.check}
          open={payOpen}
          onOpenChange={(open) => {
            setPayOpen(open);
            // Cuenta cobrada: al cerrar el ticket la mesa queda libre y se limpia la orden.
            if (!open && current.check?.status !== "open") setSelection(null);
          }}
        />
      )}
      {current?.order && (
        <ChargeDialog
          key={current.order.id}
          order={current.order}
          open={chargeOpen}
          onOpenChange={(open) => {
            setChargeOpen(open);
            if (!open && current.order?.status === "paid") setSelection(null);
          }}
        />
      )}
    </div>
  );
}
