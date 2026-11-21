// src/components/terminal-charge/integrated.ts — reglas compartidas por los cobros (spec 069, FR-017).
import type { PaymentTerminal } from "@/types";

/** ¿Se le pueden mandar cobros? (integrada, activa y con la conexión al corriente) */
export const isIntegrated = (terminal: PaymentTerminal | undefined | null) => !!terminal && terminal.chargeable === true;

export interface RowLike {
  method: string;
  terminalId: string;
  /** El cajero decidió registrar a mano en una terminal integrada (respaldo, US3). */
  manual?: boolean;
}

/** La terminal elegida en la fila, si va a la terminal integrada. */
export function integratedTerminalOf<T extends RowLike>(row: T, terminals: PaymentTerminal[], defaultTerminal: string) {
  if (row.method !== "card" || row.manual) return null;
  const id = row.terminalId || defaultTerminal;
  const terminal = terminals.find((t) => String(t.id) === id);
  return isIntegrated(terminal) ? (terminal as PaymentTerminal) : null;
}

/** Filas que irían a una terminal integrada (FR-017: como máximo una). */
export function integratedRows<T extends RowLike>(rows: T[], terminals: PaymentTerminal[], defaultTerminal: string) {
  return rows.filter((row) => integratedTerminalOf(row, terminals, defaultTerminal) != null);
}
