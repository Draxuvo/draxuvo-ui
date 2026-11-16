// src/components/brand/company-mark.tsx
// Marca de la empresa activa (spec 063): su logo o, sin logo (o si la imagen no carga), un distintivo con la inicial.
// Sustituye a la marca Draxuvo en todo el panel con empresa activa; Draxuvo queda solo para el super admin y las pantallas
// sin empresa (FR-005, FR-007). El logo se ajusta sin recortarse ni deformarse (FR-012).
"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Size = "md" | "sm" | "lg";

const BOX: Record<Size, string> = { sm: "h-7 max-w-[7rem]", md: "h-8 max-w-[8.75rem]", lg: "h-12 max-w-[12rem]" };
const TILE: Record<Size, string> = { sm: "size-7 text-sm", md: "size-8 text-base", lg: "size-12 text-xl" };

export function CompanyMark({
  name,
  logoUrl,
  expanded = false,
  size = "md",
  className,
}: {
  name: string;
  logoUrl: string | null | undefined;
  /** Muestra el nombre junto al logo o al distintivo. */
  expanded?: boolean;
  size?: Size;
  className?: string;
}) {
  // Se recuerda qué URL falló: con otra empresa u otro logo se vuelve a intentar cargar la imagen.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const showLogo = !!logoUrl && failedUrl !== logoUrl;
  const initial = name.trim().charAt(0).toLocaleUpperCase("es") || "·";

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)} data-testid="company-mark">
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={expanded ? "" : name}
          className={cn("w-auto shrink-0 object-contain", BOX[size])}
          onError={() => setFailedUrl(logoUrl)}
        />
      ) : (
        <span
          aria-hidden={expanded ? true : undefined}
          aria-label={expanded ? undefined : name}
          role={expanded ? undefined : "img"}
          className={cn(
            "flex shrink-0 items-center justify-center rounded-md bg-primary font-display font-extrabold text-primary-foreground",
            TILE[size],
          )}
        >
          {initial}
        </span>
      )}
      {expanded && (
        <span className="min-w-0 truncate font-display text-base font-extrabold uppercase leading-tight tracking-[0.01em] text-foreground">
          {name}
        </span>
      )}
    </div>
  );
}
