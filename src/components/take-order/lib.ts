// Reglas puras de la pantalla de tomar pedido (spec 018). No tocan red ni React.
import type { OrderMode } from "@/types";

export type ScreenMode = "restaurant" | "orders" | "none";

/** Con el módulo de restaurante: cuentas de mesa; si no, y en modo pedido: órdenes de trabajo; si no, formulario actual. */
export function screenMode(activeModules: readonly string[], orderMode: OrderMode | undefined): ScreenMode {
  if (activeModules.includes("restaurant")) return "restaurant";
  return orderMode === "order" ? "orders" : "none";
}

/** Minúsculas y sin acentos, para buscar sin distinguir. */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export interface MenuCard {
  id: number;
  name: string;
  price: number;
  icon?: string | null;
  product_type?: { icon?: string | null } | null;
  sold_out?: boolean;
  low?: boolean;
  available_qty?: number | null;
}

export interface MenuSection {
  category: string;
  items: MenuCard[];
}

/** Grupos con solo los productos cuyo nombre contiene el término; descarta los grupos vacíos. */
export function filterMenu(menu: MenuSection[], term: string): MenuSection[] {
  const needle = normalize(term);
  if (!needle) return menu;
  return menu
    .map((section) => ({ ...section, items: section.items.filter((i) => normalize(i.name).includes(needle)) }))
    .filter((section) => section.items.length > 0);
}

/** Renglón de una cuenta (`CheckItem`) o de una orden (`WorkOrderItem`) con la forma común de la pantalla. */
export interface Line {
  id: number;
  product_id?: number | null;
  name: string;
  icon?: string | null;
  type_icon?: string | null;
  quantity: number;
  note?: string | null;
  unit_price: number;
  /** Se puede cambiar: borrador en una cuenta; cualquiera en una orden abierta. */
  editable: boolean;
  /** Ya se mandó a la cocina o la barra. */
  sent: boolean;
  cancelled?: boolean;
}

/** El renglón de una cuenta no trae el producto (solo su nombre); el de una orden sí. */
function sameProduct(line: Line, product: Pick<MenuCard, "id" | "name">): boolean {
  return line.product_id != null ? line.product_id === product.id : line.name === product.name;
}

export type TapResult = { kind: "increment"; line: Line } | { kind: "add" };

/** Tocar una tarjeta sube el renglón editable del producto (sin nota) o agrega uno nuevo. */
export function tapProduct(lines: Line[], product: Pick<MenuCard, "id" | "name">): TapResult {
  const line = lines.find((l) => sameProduct(l, product) && l.editable && !l.cancelled && !l.note);
  return line ? { kind: "increment", line } : { kind: "add" };
}

/** Cantidad del producto en los renglones editables, para el contador de la tarjeta. */
export function inOrderCount(lines: Line[], product: Pick<MenuCard, "id" | "name">): number {
  return lines
    .filter((l) => sameProduct(l, product) && l.editable && !l.cancelled)
    .reduce((sum, l) => sum + l.quantity, 0);
}

/** Suma de cantidad por precio de los renglones no cancelados. */
export function runningTotal(lines: Line[]): number {
  const total = lines.filter((l) => !l.cancelled).reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
  return Math.round(total * 100) / 100;
}

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

/** Color estable por categoría: el mismo nombre da siempre el mismo color. */
export function categoryColor(category: string): string {
  let hash = 0;
  for (const ch of category) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export interface OpenCheck {
  id: number;
  /** Nombre de la mesa o del cliente (para llevar). */
  name: string;
  takeout: boolean;
  /** `to_pay`: ya se entregó todo y falta cobrar. */
  state: "occupied" | "to_pay";
  waiter: string | null;
  /** Usuario del mesero; `null` con el mesero oculto. */
  waiterId: number | null;
  /** `null` en las cuentas ajenas cuando quien pide no es jefe (spec 032, FR-019b). */
  total: number | null;
  openedAt: string;
  mine: boolean;
}

export interface ClosedCheck {
  id: number;
  name: string;
  takeout: boolean;
  waiter: string | null;
  waiterId: number | null;
  total: number | null;
  closedAt: string;
  mine: boolean;
}

interface ClosedLike {
  closed_today?: { id: number; name: string | null; takeout_name: string | null; closed_at: string; waiter?: { id: number; name: string } | null; total?: string; mine: boolean }[];
}

/** Cuentas cobradas hoy, la más reciente primero; con `scope="mine"` solo las que atendió la persona. */
export function closedChecksOf(overview: ClosedLike | undefined, scope: "all" | "mine"): ClosedCheck[] {
  return (overview?.closed_today ?? [])
    .map((c) => ({
      id: c.id, name: c.name ?? c.takeout_name ?? "", takeout: c.name == null, waiter: c.waiter?.name ?? null, waiterId: c.waiter?.id ?? null,
      total: c.total == null ? null : Number(c.total) || 0, closedAt: c.closed_at, mine: c.mine,
    }))
    .filter((c) => scope === "all" || c.mine);
}

interface OverviewLike {
  results: { name: string; active?: boolean; state?: string; check: { id: number; waiter?: { id: number; name: string } | null; opened_at: string; total?: string; mine: boolean } | null }[];
  takeouts: { id: number; takeout_name: string; waiter?: { id: number; name: string } | null; opened_at: string; total?: string; mine: boolean; counts?: { new: number; preparing: number; ready: number; delivered: number } }[];
}

/** Cuentas abiertas del plano: las de las mesas y las para llevar; con `scope="mine"` solo las que atiende la persona. */
export function openChecksOf(overview: OverviewLike | undefined, scope: "all" | "mine"): OpenCheck[] {
  if (!overview) return [];
  const tables = overview.results.flatMap((t) =>
    t.check
      ? [{ id: t.check.id, name: t.name, takeout: false, state: (t.state === "to_pay" ? "to_pay" : "occupied") as OpenCheck["state"], waiter: t.check.waiter?.name ?? null, waiterId: t.check.waiter?.id ?? null, total: t.check.total == null ? null : Number(t.check.total) || 0, openedAt: t.check.opened_at, mine: t.check.mine }]
      : [],
  );
  const takeouts = overview.takeouts.map((c) => ({
    id: c.id, name: c.takeout_name, takeout: true, state: (c.counts && c.counts.new + c.counts.preparing + c.counts.ready === 0 && c.counts.delivered > 0 ? "to_pay" : "occupied") as OpenCheck["state"], waiter: c.waiter?.name ?? null, waiterId: c.waiter?.id ?? null, total: c.total == null ? null : Number(c.total) || 0, openedAt: c.opened_at, mine: c.mine,
  }));
  return [...tables, ...takeouts].filter((c) => scope === "all" || c.mine);
}

export type CheckGroup = "to_pay" | "open" | "paid";

export interface CheckFilter {
  /** Estado elegido en las fichas de Cuentas (`""` = todos). */
  status: string;
  /** Usuario del responsable elegido; `null` = cualquiera. */
  userId: number | null;
  search: string;
}

/**
 * Si una cuenta de mesa cabe en los filtros de Cuentas. Las fichas de estado son las de las órdenes: Terminada es Por
 * cobrar, Abierta son las abiertas y Cobrada las cobradas hoy; En curso y Cancelada no tienen cuentas de mesa.
 */
export function matchesCheckFilter(
  check: { name: string; waiter: string | null; waiterId: number | null },
  group: CheckGroup,
  filter: CheckFilter,
): boolean {
  const statusOk =
    filter.status === "" ||
    (group === "to_pay" && filter.status === "done") ||
    (group === "open" && filter.status === "open") ||
    (group === "paid" && filter.status === "paid");
  const needle = normalize(filter.search);
  return (
    statusOk &&
    (filter.userId == null || check.waiterId === filter.userId) &&
    (!needle || normalize(`${check.name} ${check.waiter ?? ""}`).includes(needle))
  );
}
