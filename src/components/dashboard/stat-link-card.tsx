// src/components/dashboard/stat-link-card.tsx
// Tarjeta-enlace del dashboard y del inicio (contracts/ui-routes.md, FR-001 a FR-005).
// Toda la tarjeta abre `href` (enlace estirado); los subconjuntos son enlaces propios encima
// de él, así no hay enlaces anidados y cada uno tiene su nombre accesible.
import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatSubset {
  label: string;
  /** Sin href se muestra como texto. */
  href?: string;
  ariaLabel?: string;
  /** Resalta el subconjunto clave con la ceja (DESIGN.md). */
  highlight?: boolean;
}

export interface StatLinkCardProps {
  label: string;
  /** Número o cifra ya formateada. Sin valor, la tarjeta muestra `description`. */
  value?: React.ReactNode;
  description?: string;
  href: string;
  ariaLabel: string;
  icon?: LucideIcon;
  subsets?: StatSubset[];
  className?: string;
}

const FOCUS =
  "foco-etiqueta";

export function StatLinkCard({
  label,
  value,
  description,
  href,
  ariaLabel,
  icon: Icon,
  subsets = [],
  className,
}: StatLinkCardProps) {
  return (
    <div
      className={cn(
        "group relative flex min-h-36 flex-col rounded-etiqueta border border-transparent bg-card p-4 text-card-foreground shadow-etiqueta",
        "transition-colors duration-[120ms] ease-etiqueta hover:border-foreground/40",
        "has-[[data-main]:focus-visible]:ring-2 has-[[data-main]:focus-visible]:ring-foreground has-[[data-main]:focus-visible]:ring-offset-2 has-[[data-main]:focus-visible]:ring-offset-background",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Link
          href={href}
          aria-label={ariaLabel}
          data-main
          className="flex items-center gap-2 text-[0.8125rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground outline-none after:absolute after:inset-0 after:rounded-etiqueta after:content-['']"
        >
          {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />}
          {label}
        </Link>
        <ArrowUpRight
          size={20}
          strokeWidth={1.75}
          aria-hidden
          className="shrink-0 text-muted-foreground transition-colors duration-[120ms] group-hover:text-foreground"
        />
      </div>

      {value !== undefined ? (
        <p className="mt-3 font-display text-[2.25rem] font-semibold leading-none tabular-nums">
          {value}
        </p>
      ) : (
        description && <p className="mt-3 max-w-[32ch] text-sm text-muted-foreground">{description}</p>
      )}

      {subsets.length > 0 && (
        <ul className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-3 text-sm">
          {subsets.map((s) => (
            <li key={s.label} className="relative z-10">
              {s.href ? (
                <Link
                  href={s.href}
                  aria-label={s.ariaLabel}
                  className={cn(
                    "inline-flex min-h-10 items-center rounded-full transition-colors duration-[120ms] md:min-h-0",
                    s.highlight
                      ? "bg-ceja px-2 py-0.5 font-medium text-foreground hover:bg-ceja/80"
                      : "text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-foreground",
                    FOCUS,
                  )}
                >
                  <span className="tabular-nums">{s.label}</span>
                </Link>
              ) : (
                <span className="text-muted-foreground tabular-nums">{s.label}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function StatLinkCardSkeleton() {
  return (
    <div aria-hidden className="flex min-h-36 flex-col rounded-etiqueta bg-card p-4 shadow-etiqueta">
      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-4 h-9 w-16 animate-pulse rounded bg-muted" />
      <div className="mt-auto h-4 w-28 animate-pulse rounded bg-muted" />
    </div>
  );
}
