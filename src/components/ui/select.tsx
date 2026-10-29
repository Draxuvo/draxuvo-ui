import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

// <select> nativo (selector del sistema en móvil) con la flecha dibujada por el panel,
// para que mida y se alinee igual que Input y Button (spec 049).
function Select({
  className,
  selectClassName,
  children,
  ...props
}: React.ComponentProps<"select"> & { selectClassName?: string }) {
  return (
    <div
      data-slot="select-wrapper"
      className={cn("relative w-full min-w-0", className)}
    >
      <select
        data-slot="select"
        className={cn(
          "h-10 w-full min-w-0 appearance-none truncate rounded-etiqueta border border-input bg-card pr-9 pl-3 text-base transition-colors duration-[120ms] ease-etiqueta outline-none foco-etiqueta hover:border-foreground/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 md:h-9 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          selectClassName
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}

export { Select }
