"use client";
import { useEffect, useRef } from "react";
import { useSound } from "@/components/restaurant/sound-toggle";
import { useTablesOverview } from "./use-restaurant";

/** Aviso sonoro de "listo" para Tomar pedido: suena cuando aparece un `ready_item` nuevo. */
export function useReadySound(enabled = true) {
  const sound = useSound("take-order", "other");
  const { playReady } = sound;
  const overview = useTablesOverview({ enabled });
  const seen = useRef<Set<number> | null>(null);
  const ready = overview.data?.ready_items;

  useEffect(() => {
    if (!ready) return;
    const ids = new Set(ready.map((item) => item.id));
    if (seen.current && [...ids].some((id) => !seen.current!.has(id))) playReady();
    seen.current = ids;
  }, [ready, playReady]);

  return sound;
}
