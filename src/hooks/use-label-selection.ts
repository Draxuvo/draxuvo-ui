// src/hooks/use-label-selection.ts
// Los productos que se van a etiquetar viajan del inventario (o de Recibir mercancía) a la pantalla de etiquetas por
// `sessionStorage`: hasta 1,000 productos no caben en la URL (spec 035). Todo con try/catch: puede no haber almacenamiento.
import type { Product } from "@/types";

const KEY = "labelSelection";

/** Lo que la pantalla de etiquetas necesita de cada producto, para no volver a pedirlo a la API. */
export interface LabelSelectionItem {
  id: number;
  name: string;
  copies: number;
  barcodes: string[];
  /** Existencia; `null` si el tipo no se cuenta. */
  stock: number | null;
  fractional: boolean;
  price: number | null;
}

/** Un producto con las copias que se piden (por defecto 1). */
export function selectionItem(product: Product, copies = 1): LabelSelectionItem {
  return {
    id: product.id,
    name: product.name,
    copies,
    barcodes: product.barcodes ?? [],
    stock: product.product_type?.counted === false ? null : (product.stock ?? null),
    fractional: !!product.product_type?.fractional,
    price: product.price ?? null,
  };
}

export function saveLabelSelection(items: LabelSelectionItem[]): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Sin almacenamiento la pantalla abre vacía y la persona elige desde el inventario.
  }
}

export function readLabelSelection(): LabelSelectionItem[] {
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is LabelSelectionItem =>
        !!item && typeof item.id === "number" && typeof item.name === "string" && Number.isInteger(item.copies) && item.copies > 0 && Array.isArray(item.barcodes),
    );
  } catch {
    return [];
  }
}

export function clearLabelSelection(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // nada que limpiar
  }
}
