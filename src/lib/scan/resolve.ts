// src/lib/scan/resolve.ts
// Resuelve una lectura contra los productos que la pantalla ya tiene cargados (spec 056, D5): código de barras
// exacto y luego clave (SKU). Solo si no está se consulta `GET /products/by_code`, y únicamente para decir el motivo
// ("existe pero no se vende" o "no existe"). Nada de esto concede más de lo que el rol podría hacer a mano.
import type { Product } from "@/types";

export interface Scannable {
  id: number;
  name: string;
  sku?: string;
  barcodes?: string[];
}

export type ScanReason = "not_found" | "not_sellable" | "not_on_menu";

export type Resolution<T> = { ok: true; product: T } | { ok: false; reason: ScanReason; name?: string };

/** Producto de la lista cuyo código de barras (o, si no, su clave) es exactamente el código. */
export function findByCode<T extends Scannable>(code: string, list: T[]): T | null {
  const byBarcode = list.find((p) => p.barcodes?.includes(code));
  if (byBarcode) return byBarcode;
  const sku = code.toLowerCase();
  return list.find((p) => p.sku && p.sku.toLowerCase() === sku) ?? null;
}

/**
 * `list` son los productos que esta pantalla puede agregar. `lookup` consulta el servidor solo para dar el motivo
 * cuando el código no está en la lista. En modo `catalog` (lista parcial) un producto que sí se vende y no estaba
 * cargado se acepta; en modo `menu` (la lista es todo el menú) no.
 */
export async function resolveProduct<T extends Scannable>(
  code: string,
  list: T[],
  lookup: (code: string) => Promise<Product | null>,
  mode: "menu" | "catalog" = "menu",
): Promise<Resolution<T>> {
  const local = findByCode(code, list);
  if (local) return { ok: true, product: local };

  let remote: Product | null = null;
  try {
    remote = await lookup(code);
  } catch {
    return { ok: false, reason: "not_found" };
  }
  if (!remote) return { ok: false, reason: "not_found" };
  if (remote.product_type && (remote.product_type as { sellable?: boolean }).sellable === false) {
    return { ok: false, reason: "not_sellable", name: remote.name };
  }
  if (mode === "catalog" && remote.available !== false) return { ok: true, product: remote as unknown as T };
  return { ok: false, reason: mode === "menu" ? "not_on_menu" : "not_sellable", name: remote.name };
}
