// src/components/terminal-charge/remembered-terminal.ts — la terminal habitual de este dispositivo (spec 069, US4,
// FR-025, research R11). Vive en el navegador por empresa (`draxuvo.terminal.<companyId>`); si no se puede leer o la
// terminal ya no está activa, no se propone ninguna.
"use client";
import { useMemo } from "react";
import type { PaymentTerminal } from "@/types";

const PREFIX = "draxuvo.terminal.";

function storageKey(): string | null {
  try {
    const company = localStorage.getItem("selected_company_id");
    return company ? `${PREFIX}${company}` : null;
  } catch {
    return null;
  }
}

export function readRememberedTerminal(): string | null {
  try {
    const key = storageKey();
    return key ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

export function rememberTerminal(terminalId: string | number | null | undefined) {
  if (terminalId == null || terminalId === "") return;
  try {
    const key = storageKey();
    if (key) localStorage.setItem(key, String(terminalId));
  } catch {
    // Sin almacenamiento (modo privado): no se recuerda.
  }
}

/** La terminal que se propone al cobrar: la única que hay, o la última usada en este dispositivo si sigue activa. */
export function defaultTerminalFor(terminals: PaymentTerminal[], remembered: string | null): string {
  if (terminals.length === 1) return String(terminals[0].id);
  return remembered && terminals.some((t) => String(t.id) === remembered && t.active !== false) ? remembered : "";
}

export function useRememberedTerminal(terminals: PaymentTerminal[]): string {
  return useMemo(() => defaultTerminalFor(terminals, readRememberedTerminal()), [terminals]);
}
