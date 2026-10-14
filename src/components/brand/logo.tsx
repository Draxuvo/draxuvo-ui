// src/components/brand/logo.tsx
// La marca de Draxuvo: el mismo SVG que `public/logo.svg` (etiqueta oferta con la muesca
// perforada recortada en el trazo y la "D" en tinta). Una sola marca y una sola técnica de
// muesca en todo el panel (DESIGN.md: Shapes).
import { cn } from "@/lib/utils";

export function Logo({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn("size-8 shrink-0", className)}
    >
      <path
        fill="#ff5a1f"
        d="M7 2h19a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-6.5a3.5 3.5 0 0 0 0-7V6a4 4 0 0 1 4-4z"
      />
      <path
        fill="#141414"
        fillRule="evenodd"
        d="M12 8h5.5C21 8 23 10.2 23 14v4c0 3.8-2 6-5.5 6H12zm4 3.5v9h1.25c1.4 0 2-.85 2-2.6v-3.8c0-1.75-.6-2.6-2-2.6z"
      />
    </svg>
  );
}
