// src/hooks/use-debounced-value.ts
"use client";
import { useEffect, useState } from "react";

/** El valor, pero solo después de `delay` ms sin cambios (la vista previa no pide un PDF por cada tecla). */
export function useDebouncedValue<T>(value: T, delay = 500): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
