"use client";
// Caja de venta de mostrador (spec 050): búsqueda y escaneo a la izquierda, la venta en curso a la derecha. La venta
// vive en el servidor como borrador, así que sobrevive a recargar y se retoma desde otro equipo. Un cajero puede
// tener varias abiertas a la vez.
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, HandCoins, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModuleLocked, useModuleGate } from "@/components/subscription/module-locked";
import { useBossOnlyCharge, useIsChargeBoss } from "@/hooks/use-boss-only-charge";
import { useCompanyModule } from "@/hooks/use-company-module";
import { useAppRouter } from "@/hooks/use-router";
import {
  useAddSaleItem,
  useCreateSale,
  useDiscardSale,
  useOpenSales,
  useRefreshSale,
  useRemoveSaleItem,
  useReturnSale,
  useSale,
  useSalesQueue,
  useSubmitSale,
  useUpdateSaleItem,
} from "@/hooks/use-sales";
import { useAuthStore } from "@/store/auth";
import type { AddItemInput } from "@/services/sales";
import type { Sale, SaleCatalogProduct, SaleItem } from "@/types";
import { ChargeQueueList } from "./charge-queue-list";
import { BOSS_ONLY_CODES, ITEM_ERROR_CODES, errorCode, isBossOnlyError } from "./lib";
import { PosChargeDialog } from "./pos-charge-dialog";
import { ProductSearch } from "./product-search";
import { SaleCart } from "./sale-cart";

export function SaleScreen() {
  const t = useTranslations("pos");
  const router = useAppRouter();
  const role = useAuthStore((s) => s.role);
  const gate = useModuleGate("pos");
  // Spec 055 (H-56): si la sesión o la suscripción ya dicen que el módulo no está, se avisa sin pedir ventas ni catálogo.
  const posAvailable = useCompanyModule("pos");
  const [saleId, setSaleIdState] = useState<number | null>(null);
  // La venta actual también vive en una referencia: dos escaneos seguidos llegan antes de que React repinte, y con solo
  // el estado el segundo vería "sin venta" y abriría otra. `opening` evita abrir dos a la vez.
  const saleRef = useRef<number | null>(null);
  const opening = useRef<Promise<number> | null>(null);
  const setSaleId = useCallback((id: number | null) => {
    saleRef.current = id;
    setSaleIdState(id);
  }, []);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);
  // Spec 058: con «Cobro solo por jefes», el jefe ve la pestaña «Por cobrar» (también desde `?vista=por-cobrar`) y puede
  // abrir una venta directo con `?venta=<id>` (lo usan el contador del encabezado y el aviso push).
  const searchParams = useSearchParams();
  const bossOnly = useBossOnlyCharge();
  const isBoss = useIsChargeBoss();
  const showQueueTab = bossOnly && isBoss;
  const [queueOpen, setQueueOpen] = useState(searchParams.get("vista") === "por-cobrar");
  const linkedSale = Number(searchParams.get("venta")) || null;

  const openSales = useOpenSales();
  const queue = useSalesQueue(showQueueTab);
  const queued = queue.data?.results ?? [];
  const saleQuery = useSale(saleId);
  const create = useCreateSale();
  const addItem = useAddSaleItem();
  const updateItem = useUpdateSaleItem();
  const removeItem = useRemoveSaleItem();
  const discard = useDiscardSale();
  const submit = useSubmitSale();
  const returnSale = useReturnSale();
  const refreshSale = useRefreshSale();
  const sale = saleQuery.data ?? null;
  const busy = addItem.isPending || updateItem.isPending || removeItem.isPending || create.isPending || submit.isPending || returnSale.isPending;
  // Spec 058: una venta que el cajero ya pasó a cobro no se edita; el siguiente artículo abre otra venta.
  const saleLockedRef = useRef(false);
  saleLockedRef.current = !!sale && !!sale.actions && !sale.actions.includes("add_item");
  const locked = gate.isLocked(openSales.error) || !posAvailable;

  // Al entrar retoma la venta abierta más reciente; si no hay, la venta se abre con el primer artículo.
  const firstOpen = openSales.data?.results[0]?.id ?? null;
  // Solo la primera vez que llega la lista: después, "Nueva venta" o un cobro dejan la caja sin venta a propósito.
  const restored = useRef(false);
  const listLoaded = openSales.isSuccess;
  useEffect(() => {
    if (restored.current || !listLoaded) return;
    restored.current = true;
    if (saleRef.current !== null) return;
    if (linkedSale !== null) setSaleId(linkedSale);
    else if (firstOpen !== null) setSaleId(firstOpen);
  }, [listLoaded, firstOpen, linkedSale, setSaleId]);

  const refocus = useCallback(() => setFocusSignal((n) => n + 1), []);

  const reportItemError = useCallback(
    (err: unknown) => {
      const code = errorCode(err);
      const known = [...ITEM_ERROR_CODES, ...BOSS_ONLY_CODES] as readonly string[];
      toast.error(code && known.includes(code) ? t(`errors.${code}`) : t("errors.generic"));
      // Spec 058: la opción cambió o la venta ya espera cobro; se recarga para mostrar el aviso.
      if (isBossOnlyError(err) && saleRef.current !== null) refreshSale(saleRef.current);
    },
    [t, refreshSale],
  );

  const ensureSale = useCallback(async () => {
    if (saleRef.current !== null && saleLockedRef.current) {
      saleRef.current = null;
      saleLockedRef.current = false;
    }
    if (saleRef.current !== null) return saleRef.current;
    opening.current ??= create.mutateAsync().then((created) => {
      setSaleId(created.id);
      return created.id;
    }).finally(() => {
      opening.current = null;
    });
    return opening.current;
  }, [create, setSaleId]);

  const add = useCallback(
    async (input: AddItemInput) => {
      try {
        await addItem.mutateAsync({ saleId: await ensureSale(), input });
      } catch (err) {
        reportItemError(err);
        throw err;
      } finally {
        refocus();
      }
    },
    [addItem, ensureSale, reportItemError, refocus],
  );

  const onScan = (code: string) => add({ barcode: code });
  const onPick = (product: SaleCatalogProduct) => void add({ product_id: product.id }).catch(() => undefined);

  function onQuantity(item: SaleItem, quantity: number) {
    if (!sale) return;
    const done = quantity === 0 ? removeItem.mutateAsync({ saleId: sale.id, itemId: item.id }) : updateItem.mutateAsync({ saleId: sale.id, itemId: item.id, quantity });
    done.catch(reportItemError).finally(refocus);
  }

  function onRemove(item: SaleItem) {
    if (!sale) return;
    removeItem.mutateAsync({ saleId: sale.id, itemId: item.id }).catch(reportItemError).finally(refocus);
  }

  function confirmDiscard() {
    if (!sale) return;
    discard.mutate(sale.id, {
      onSuccess: () => {
        setDiscardOpen(false);
        setSaleId(null);
        refocus();
      },
    });
  }

  function startNewSale() {
    setSaleId(null);
    refocus();
  }

  // Spec 058: el cajero pasa la venta a cobro y la caja queda lista para otra.
  function onSubmit() {
    if (!sale) return;
    submit
      .mutateAsync({ saleId: sale.id, lockVersion: sale.lock_version })
      .then(() => {
        toast.success(t("bossOnly.submitted"));
        startNewSale();
      })
      .catch((err) => {
        const code = errorCode(err);
        toast.error(code && ["nothing_to_submit", "already_submitted", "stale_object", ...BOSS_ONLY_CODES].includes(code) ? t(`errors.${code}`) : t("errors.generic"));
        refreshSale(sale.id);
      });
  }

  function onReturn() {
    if (!sale) return;
    returnSale
      .mutateAsync(sale.id)
      .then((returned) => {
        toast.success(t("bossOnly.returned", { name: returned.opened_by?.name ?? "" }));
        startNewSale();
      })
      .catch(() => toast.error(t("errors.generic")));
  }

  function pickQueued(picked: Sale) {
    setSaleId(picked.id);
    refocus();
  }

  if (locked) return <ModuleLocked module="pos" />;

  // Las ventas que esperan cobro van en su pestaña, no entre los botones de ventas abiertas.
  const queuedIds = new Set(queued.map((s) => s.id));
  const others = (openSales.data?.results ?? []).filter((s) => s.id !== saleId && !(showQueueTab && queuedIds.has(s.id)));

  return (
    <div className="flex h-dvh flex-col gap-3 p-3 md:p-4">
      <header className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" className="h-11 gap-2" onClick={() => router.push(role === "staff" ? "/mis-ordenes" : "/inicio")}>
          <ArrowLeft size={16} aria-hidden />
          {t("back")}
        </Button>
        <h1 className="font-display text-2xl font-extrabold uppercase">{t("title")}</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {showQueueTab && (
            <Button
              type="button"
              variant={queueOpen ? "default" : "outline"}
              className="h-11 gap-1.5"
              aria-pressed={queueOpen}
              onClick={() => setQueueOpen((open) => !open)}
            >
              <HandCoins size={16} aria-hidden />
              {t("queue.tab")}
              <span className="tabular-nums">({queued.length})</span>
            </Button>
          )}
          {others.length > 0 && (
            <nav aria-label={t("openSales")} className="flex gap-2">
              {others.map((s) => (
                <Button key={s.id} type="button" variant="outline" className="h-11" onClick={() => setSaleId(s.id)}>
                  {t("saleN", { n: s.id })}
                </Button>
              ))}
            </nav>
          )}
          <Button type="button" variant="outline" className="h-11 gap-1.5" disabled={saleId === null && !openSales.data?.results.length} onClick={startNewSale}>
            <Plus size={16} aria-hidden />
            {t("newSale")}
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {showQueueTab && queueOpen ? (
          <ChargeQueueList sales={queued} loading={queue.isLoading} selectedId={saleId} onPick={pickQueued} />
        ) : (
          <ProductSearch onScan={onScan} onPick={onPick} disabled={chargeOpen} focusSignal={focusSignal} />
        )}
        <SaleCart
          sale={sale}
          busy={busy}
          onQuantity={onQuantity}
          onRemove={onRemove}
          onCharge={() => setChargeOpen(true)}
          onDiscard={() => setDiscardOpen(true)}
          onSubmit={onSubmit}
          onReturn={onReturn}
          onNewSale={startNewSale}
        />
      </div>

      {sale && (
        <PosChargeDialog
          // Solo cambia con la venta: al cobrar, la venta trae otra versión y reiniciar aquí borraría el folio y el ticket.
          key={sale.id}
          sale={sale}
          open={chargeOpen}
          onOpenChange={(open) => {
            setChargeOpen(open);
            if (!open) refocus();
          }}
          onDone={startNewSale}
        />
      )}

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("cart.discardTitle")}</DialogTitle>
            <DialogDescription>{t("cart.discardBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-11" onClick={() => setDiscardOpen(false)}>
              {t("cart.keep")}
            </Button>
            <Button className="h-11" disabled={discard.isPending} onClick={confirmDiscard}>
              {t("cart.discardConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
