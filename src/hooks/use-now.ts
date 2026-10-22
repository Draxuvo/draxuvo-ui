// src/hooks/use-now.ts
"use client";
import { useEffect, useState } from "react";

/** Reloj que se actualiza solo para que los minutos corran sin esperar al servidor. */
export function useNow(everyMs = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}
