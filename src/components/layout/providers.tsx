// src/components/layout/providers.tsx
"use client";
import { QueryClientProvider } from "@tanstack/react-query";
import { AppearanceProvider } from "@/components/appearance/appearance-provider";
import { queryClient } from "@/lib/query";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AppearanceProvider>{children}</AppearanceProvider>
    </QueryClientProvider>
  );
}
