// Icono de producto (spec 026). Decorativo: el nombre del producto sigue siendo la etiqueta.
import { memo, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { isProductIconKey } from "@/lib/product-icons/catalog";
import { resolveProductIcon, type IconSource } from "@/lib/product-icons/resolve";
import { SHAPES } from "@/lib/product-icons/shapes";

export const ProductIcon = memo(function ProductIcon({
  name,
  size = 20,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  if (!isProductIconKey(name)) return null;
  return (
    <svg
      aria-hidden
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
    >
      {SHAPES[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
});

/** Cuadro de color con el icono del producto en blanco; sin icono conocido, la inicial del nombre. */
export const ProductIconBadge = memo(function ProductIconBadge({
  product,
  color,
  className,
  size = 20,
}: {
  product: IconSource & { name: string };
  color: string;
  className?: string;
  size?: number;
}) {
  const key = resolveProductIcon(product);
  const style: CSSProperties = { background: color };
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-md font-display text-base font-extrabold text-white",
        className,
      )}
      style={style}
    >
      {key ? <ProductIcon name={key} size={size} /> : product.name.trim().charAt(0).toUpperCase()}
    </span>
  );
});

/** Icono suelto (inventario, renglones): nada si no hay icono conocido. */
export function ProductGlyph({
  product,
  size = 18,
  className,
}: {
  product: IconSource;
  size?: number;
  className?: string;
}) {
  const key = resolveProductIcon(product);
  return key ? <ProductIcon name={key} size={size} className={className} /> : null;
}
