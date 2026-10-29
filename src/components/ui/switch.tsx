"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] md:before:hidden transition-colors duration-[120ms] ease-etiqueta foco-etiqueta disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-sello data-[state=unchecked]:bg-muted-foreground/70",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-card transition-transform duration-[120ms] ease-etiqueta data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
