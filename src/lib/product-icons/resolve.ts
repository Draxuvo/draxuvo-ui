// Icono que se muestra de un producto (spec 026): el suyo, el sugerido de su tipo o ninguno (se pinta la inicial).
import { isProductIconKey, type ProductIconKey } from "./catalog";

export interface IconSource {
  icon?: string | null;
  /** Icono sugerido del tipo, en el renglón de una orden o de una cuenta. */
  type_icon?: string | null;
  product_type?: { icon?: string | null } | null;
}

/** Una clave desconocida (por ejemplo de una versión más nueva de la API) se ignora y cae al siguiente respaldo. */
export function resolveProductIcon(source: IconSource | null | undefined): ProductIconKey | null {
  if (!source) return null;
  for (const candidate of [source.icon, source.product_type?.icon, source.type_icon]) {
    if (isProductIconKey(candidate)) return candidate;
  }
  return null;
}
