"use client";
// La pantalla de tomar pedido se escribe una vez; este hook le da, según el modo, los mosaicos, la orden
// elegida y las acciones sobre cuentas de mesa (restaurante) u órdenes de trabajo en modo pedido (spec 018, R3).
import { useQuery } from "@tanstack/react-query";
import {
  PEDIDO_POLL_MS, useCheck, useCheckActions, useOpenCheck, useTablesOverview,
} from "@/hooks/use-restaurant";
import {
  listWorkOrders, useAddItem, useCreateWorkOrder, useDeleteItem, useUpdateItem, useWorkOrder,
} from "@/hooks/use-work-orders";
import { useAuthStore } from "@/store/auth";
import type { Check, WorkOrder } from "@/types";
import { inOrderCount, tapProduct, type Line, type MenuCard } from "./lib";

export type Selection = { kind: "check"; id: number } | { kind: "order"; id: number } | null;

export interface SourceTile {
  key: string;
  name: string;
  state: "free" | "occupied";
  total: number;
  owner: string | null;
  mine: boolean;
  selection: Selection;
  /** Mesa libre: al tocarla se abre su cuenta. */
  tableId?: number;
}

export interface CurrentOrder {
  selection: NonNullable<Selection>;
  title: string;
  lines: Line[];
  total: number;
  canAdd: boolean;
  canSend: boolean;
  canCharge: boolean;
  check?: Check;
  order?: WorkOrder;
}

const num = (value: string | number | null | undefined) => Number(value ?? 0) || 0;

export function checkLines(check: Check): Line[] {
  return check.items.map((i) => ({
    id: i.id,
    product_id: null,
    name: i.name,
    quantity: i.quantity,
    note: i.note,
    unit_price: num(i.unit_price),
    editable: i.status === "draft",
    sent: i.status !== "draft",
    cancelled: i.status === "cancelled",
  }));
}

export function orderLines(order: WorkOrder): Line[] {
  const editable = order.status === "open" || order.status === "in_progress";
  return (order.items ?? []).map((i) => ({
    id: i.id,
    product_id: i.product_id ?? null,
    name: i.description,
    quantity: Number(i.quantity),
    unit_price: num(i.unit_price),
    editable,
    sent: false,
  }));
}

export function useOrderSource(mode: "restaurant" | "orders", selection: Selection) {
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  const restaurant = mode === "restaurant";

  // ── Cuentas de mesa
  const overview = useTablesOverview({ enabled: restaurant });
  const checkId = selection?.kind === "check" ? selection.id : 0;
  const check = useCheck(restaurant && checkId ? checkId : null);
  const checkActions = useCheckActions(checkId);
  const openCheck = useOpenCheck();

  // ── Órdenes de trabajo
  const orders = useQuery({
    queryKey: ["work-orders", "pedido", companyId],
    queryFn: () => listWorkOrders({ page: 1, page_size: 100 }),
    enabled: !restaurant,
    refetchInterval: PEDIDO_POLL_MS,
    refetchIntervalInBackground: false,
  });
  const orderId = selection?.kind === "order" ? selection.id : 0;
  const order = useWorkOrder(!restaurant ? orderId : 0);
  const addItem = useAddItem(orderId);
  const updateItem = useUpdateItem(orderId);
  const deleteItem = useDeleteItem(orderId);
  const createOrder = useCreateWorkOrder();

  let tiles: SourceTile[] = [];
  if (restaurant) {
    const tables = (overview.data?.results ?? []).filter((t) => t.active);
    tiles = [
      ...tables.map((t): SourceTile => ({
        key: `table:${t.id}`,
        name: t.name,
        state: t.check ? "occupied" : "free",
        total: num(t.check?.total),
        owner: t.check?.waiter?.name ?? null,
        mine: !!t.check?.mine,
        selection: t.check ? { kind: "check", id: t.check.id } : null,
        tableId: t.id,
      })),
      ...(overview.data?.takeouts ?? []).map((c): SourceTile => ({
        key: `check:${c.id}`,
        name: c.takeout_name,
        state: "occupied",
        total: num(c.total),
        owner: c.waiter?.name ?? null,
        mine: c.mine,
        selection: { kind: "check", id: c.id },
      })),
    ];
  } else {
    tiles = (orders.data?.results ?? [])
      .filter((o) => o.status === "open" || o.status === "in_progress" || o.status === "done")
      .map((o): SourceTile => ({
        key: `order:${o.id}`,
        name: o.title,
        state: "occupied",
        total: num(o.total),
        owner: o.employee?.name ?? null,
        mine: false,
        selection: { kind: "order", id: o.id },
      }));
  }

  let current: CurrentOrder | null = null;
  if (restaurant && check.data && selection?.kind === "check") {
    const c = check.data;
    const open = c.status === "open";
    current = {
      selection,
      title: c.table?.name ?? c.takeout_name ?? "",
      lines: checkLines(c),
      total: num(c.total),
      canAdd: open && c.allowed_actions.includes("add_item"),
      canSend: open && c.allowed_actions.includes("send") && c.items.some((i) => i.status === "draft"),
      canCharge: open && c.allowed_actions.includes("pay") && c.items.length > 0,
      check: c,
    };
  } else if (!restaurant && order.data && selection?.kind === "order") {
    const o = order.data;
    const open = o.status === "open" || o.status === "in_progress";
    const actions = o.allowed_actions ?? [];
    current = {
      selection,
      title: o.title,
      lines: orderLines(o),
      total: num(o.total),
      canAdd: open,
      canSend: false,
      canCharge:
        (o.items_count ?? 0) > 0 && (actions.includes("charge") || (open && actions.includes("finish"))),
      order: o,
    };
  }

  /** Abre la cuenta de una mesa libre o una cuenta para llevar / una orden con ese nombre; devuelve la selección. */
  async function create(target: { tableId: number } | { name: string }): Promise<NonNullable<Selection>> {
    if (restaurant) {
      const opened = await openCheck.mutateAsync(
        "tableId" in target ? { dining_table_id: target.tableId } : { takeout_name: target.name },
      );
      return { kind: "check", id: opened.id };
    }
    const created = await createOrder.mutateAsync({ work_order: { title: "name" in target ? target.name : "" } });
    return { kind: "order", id: created.id };
  }

  /** Tocar una tarjeta: sube el renglón editable del producto o agrega uno con cantidad 1. */
  async function tap(card: MenuCard) {
    if (!current) return;
    const result = tapProduct(current.lines, card);
    if (result.kind === "increment") return setQuantity(result.line, result.line.quantity + 1);
    if (restaurant) return checkActions.add.mutateAsync({ product_id: card.id, quantity: 1 });
    return addItem.mutateAsync({ product_id: card.id, quantity: 1 });
  }

  async function setQuantity(line: Line, quantity: number) {
    if (quantity < 1) return remove(line);
    if (restaurant) return checkActions.update.mutateAsync({ itemId: line.id, quantity });
    return updateItem.mutateAsync({ itemId: line.id, data: { quantity } });
  }

  async function remove(line: Line) {
    if (restaurant) return checkActions.remove.mutateAsync(line.id);
    return deleteItem.mutateAsync(line.id);
  }

  async function setNote(line: Line, note: string) {
    if (!restaurant) return;
    return checkActions.update.mutateAsync({ itemId: line.id, note });
  }

  async function send(idempotencyKey: string) {
    return checkActions.send.mutateAsync(idempotencyKey);
  }

  return {
    mode,
    tiles,
    loading: restaurant ? overview.isLoading : orders.isLoading,
    error: restaurant ? overview.isError : orders.isError,
    current,
    currentLoading: restaurant ? check.isLoading && !!checkId : order.isLoading && !!orderId,
    currentMissing: restaurant ? check.isError && !!checkId : order.isError && !!orderId,
    create,
    tap,
    setQuantity,
    remove,
    setNote,
    send,
    sending: checkActions.send.isPending,
    inOrder: (card: MenuCard) => (current ? inOrderCount(current.lines, card) : 0),
  };
}
