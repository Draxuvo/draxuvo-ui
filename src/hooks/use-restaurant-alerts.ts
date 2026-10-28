"use client";
// Avisos operativos del restaurante en el panel (spec 043, US5, US6 y US8): un aviso efímero de cliente
// cuando un artículo de una cuenta propia pasa a listo, cuando una cuenta queda por cobrar o cuando otra
// persona toma una mesa que se está viendo. No se dispara en la carga inicial (solo avisa lo que aparece
// después de abrir la pantalla) y un aviso descartado no vuelve por el mismo evento.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openChecksOf } from "@/components/take-order/lib";
import { useTablesOverview } from "./use-restaurant";
import type { ReadyItem, TableState, TablesResponse } from "@/types";

export type RestaurantAlert =
  | { kind: "ready"; key: string; item: ReadyItem }
  | { kind: "to_pay"; key: string; checkId: number; name: string; takeout: boolean }
  | { kind: "table_taken"; key: string; checkId: number; name: string };

const readyKey = (id: number) => `ready:${id}`;
const toPayKey = (id: number) => `to_pay:${id}`;
const tableKey = (id: number) => `table:${id}`;

/** Claves de los eventos presentes en este sondeo; lo que sale de aquí deja de poder avisar. */
function presentKeys(data: TablesResponse): Set<string> {
  const keys = new Set<string>();
  for (const item of data.ready_items ?? []) keys.add(readyKey(item.id));
  for (const check of openChecksOf(data, "mine")) {
    if (check.state === "to_pay") keys.add(toPayKey(check.id));
  }
  return keys;
}

/** Sin cambios no hace falta un estado nuevo: devolver el mismo Set evita renders de más. */
function keepPresent(prev: Set<string>, present: Set<string>): Set<string> {
  const next = new Set([...prev].filter((key) => present.has(key)));
  return next.size === prev.size ? prev : next;
}

const stateOf = (table: TablesResponse["results"][number]): TableState => table.state ?? (table.check ? "occupied" : "free");

interface TakenTable {
  checkId: number;
  name: string;
}

export function useRestaurantAlerts(enabled = true) {
  const overview = useTablesOverview({ enabled });
  const data = overview.data;
  // Eventos que aparecieron después de abrir la pantalla (la carga inicial solo se registra).
  const [announced, setAnnounced] = useState<Set<string>>(() => new Set());
  const [taken, setTaken] = useState<Map<string, TakenTable>>(() => new Map());
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const seen = useRef<Set<string> | null>(null);
  const tableStates = useRef<Map<number, TableState> | null>(null);

  useEffect(() => {
    if (!data) return;
    const present = presentKeys(data);
    if (seen.current) {
      const fresh = [...present].filter((key) => !seen.current!.has(key));
      if (fresh.length) setAnnounced((prev) => new Set([...prev, ...fresh]));
    }
    seen.current = present;
    setAnnounced((prev) => keepPresent(prev, present));

    // Una mesa que estaba libre y ahora tiene una cuenta ajena: la tomó otra persona.
    const next = new Map<number, TableState>();
    for (const table of data.results) next.set(table.id, stateOf(table));
    const before = tableStates.current;
    tableStates.current = next;
    if (!before) return;
    const openedByOther = data.results.filter(
      (table) => table.active && before.get(table.id) === "free" && next.get(table.id) === "occupied" && table.check && !table.check.mine,
    );
    if (openedByOther.length) {
      setTaken((prev) => {
        const copy = new Map(prev);
        for (const table of openedByOther) copy.set(tableKey(table.id), { checkId: table.check!.id, name: table.name });
        return copy;
      });
    }
  }, [data]);

  const alerts = useMemo<RestaurantAlert[]>(() => {
    if (!data) return [];
    const list: RestaurantAlert[] = [];
    for (const item of data.ready_items ?? []) {
      const key = readyKey(item.id);
      if (announced.has(key) && !dismissed.has(key)) list.push({ kind: "ready", key, item });
    }
    for (const check of openChecksOf(data, "mine")) {
      if (check.state !== "to_pay") continue;
      const key = toPayKey(check.id);
      if (announced.has(key) && !dismissed.has(key)) list.push({ kind: "to_pay", key, checkId: check.id, name: check.name, takeout: check.takeout });
    }
    // El aviso de mesa tomada sigue mientras esa cuenta siga abierta y sea de otra persona.
    for (const [key, value] of taken) {
      if (dismissed.has(key)) continue;
      const table = data.results.find((t) => t.id === Number(key.slice("table:".length)));
      if (table?.check?.id === value.checkId && !table.check.mine) {
        list.push({ kind: "table_taken", key, checkId: value.checkId, name: value.name });
      }
    }
    return list;
  }, [data, announced, taken, dismissed]);

  const dismiss = useCallback((key: string) => setDismissed((prev) => new Set(prev).add(key)), []);
  return { alerts, dismiss };
}
