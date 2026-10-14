// src/components/ui/pagination.tsx
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaginationInfo } from "@/types";

interface PaginationProps {
  info: PaginationInfo;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ info, onPageChange, className }: PaginationProps) {
  const { page_index, pages_total, page_start, page_end, total } = info;

  const pages = buildPageRange(page_index, pages_total);

  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <p className="text-xs text-muted-foreground">
        {page_start}–{page_end} de {total}
      </p>

      <div className="flex items-center gap-1">
        <PageButton
          onClick={() => onPageChange(page_index - 1)}
          disabled={page_index <= 1}
          aria-label="Anterior"
        >
          <ChevronLeft size={14} />
        </PageButton>

        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-muted-foreground">
              …
            </span>
          ) : (
            <PageButton
              key={p}
              active={p === page_index}
              onClick={() => onPageChange(p as number)}
            >
              {p}
            </PageButton>
          ),
        )}

        <PageButton
          onClick={() => onPageChange(page_index + 1)}
          disabled={page_index >= pages_total}
          aria-label="Siguiente"
        >
          <ChevronRight size={14} />
        </PageButton>
      </div>
    </div>
  );
}

function PageButton({
  children,
  active,
  disabled,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "min-w-7 h-7 px-1.5 rounded text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        disabled && "opacity-40 pointer-events-none",
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function buildPageRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}
