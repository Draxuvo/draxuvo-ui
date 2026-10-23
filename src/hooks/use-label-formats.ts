// src/hooks/use-label-formats.ts
// Formatos de etiqueta (spec 035): los comunes del catálogo y los propios de la empresa, con sus mutaciones.
"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inventoryService } from "@/services/inventory";
import { useAuthStore } from "@/store/auth";
import type { LabelFormatPayload } from "@/types";

export function useLabelFormats() {
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  return useQuery({
    queryKey: ["label-formats", companyId],
    queryFn: inventoryService.labelFormats.list,
    staleTime: 60_000,
  });
}

export function useLabelFormatMutations() {
  const qc = useQueryClient();
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  const refresh = () => qc.invalidateQueries({ queryKey: ["label-formats", companyId] });
  return {
    create: useMutation({
      mutationFn: (data: LabelFormatPayload) => inventoryService.labelFormats.create(data),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: number; data: Partial<LabelFormatPayload> }) => inventoryService.labelFormats.update(id, data),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: number) => inventoryService.labelFormats.remove(id),
      onSuccess: refresh,
    }),
  };
}
