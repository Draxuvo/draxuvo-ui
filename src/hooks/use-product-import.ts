// src/hooks/use-product-import.ts
// Importación de productos en segundo plano (spec 034): sube el archivo, consulta el avance cada 2 s y retoma la
// importación activa al abrir el diálogo, aunque la persona haya salido de la pantalla.
"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { inventoryService } from "@/services/inventory";
import { useAuthStore } from "@/store/auth";
import type { ProductImport } from "@/types";

export const IMPORT_POLL_MS = 2000;
const running = (item?: ProductImport | null) => item?.status === "queued" || item?.status === "processing";

export function useProductImport(open: boolean) {
  const qc = useQueryClient();
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  const [importId, setImportId] = useState<number | null>(null);

  // Al abrir, si la empresa ya tiene una importación corriendo, se muestra su avance.
  const activeKey = ["product-imports", companyId, "active"];
  const active = useQuery({
    queryKey: activeKey,
    queryFn: () => inventoryService.listImports({ active: true }).then((r) => r.results[0] ?? null),
    enabled: open && importId === null,
    staleTime: 0,
  });
  const shownId = importId ?? (open ? (active.data?.id ?? null) : null);

  const current = useQuery({
    queryKey: ["product-imports", companyId, shownId],
    queryFn: () => inventoryService.getImport(shownId as number),
    enabled: shownId !== null,
    refetchInterval: (query) => (running(query.state.data) ? IMPORT_POLL_MS : false),
  });

  const finished = current.data && !running(current.data);
  useEffect(() => {
    if (!finished) return;
    void qc.invalidateQueries({ queryKey: ["products"] });
    void qc.invalidateQueries({ queryKey: ["product-imports", companyId, "recent"] });
  }, [finished, qc, companyId]);

  const recent = useQuery({
    queryKey: ["product-imports", companyId, "recent"],
    queryFn: () => inventoryService.listImports({ page_size: 5 }).then((r) => r.results),
    enabled: open,
  });

  const start = useMutation({
    mutationFn: (file: File) => inventoryService.startImport(file),
    onSuccess: (created) => setImportId(created.id),
    onError: (error) => {
      // 409: ya había una importación corriendo; se muestra esa en lugar de la que se intentó subir.
      const existing = isAxiosError(error) ? error.response?.data?.error?.details?.import : null;
      if (existing?.id) setImportId(existing.id);
    },
  });

  return {
    current: current.data ?? null,
    loading: (shownId !== null && current.isLoading) || start.isPending,
    start: start.mutate,
    starting: start.isPending,
    recent: recent.data ?? [],
    open: (id: number) => setImportId(id),
    reset: () => {
      qc.setQueryData(activeKey, null);
      setImportId(null);
    },
    running: running(current.data),
  };
}
