// src/lib/sale-ticket-pdf.ts — descargar o imprimir el ticket de una venta de mostrador (spec 050).
import { salesService } from "@/services/sales";
import type { TicketPaper } from "@/types";

export const PAPER_STORAGE_KEY = "draxuvo.pos.paper";
export const PAPERS: TicketPaper[] = ["a4", "thermal58", "thermal80"];

/** El tamaño que se usó por última vez en este equipo (la caja suele tener siempre la misma impresora). */
export function readPaper(): TicketPaper {
  if (typeof localStorage === "undefined") return "thermal80";
  const saved = localStorage.getItem(PAPER_STORAGE_KEY);
  return PAPERS.includes(saved as TicketPaper) ? (saved as TicketPaper) : "thermal80";
}

export function savePaper(paper: TicketPaper) {
  if (typeof localStorage !== "undefined") localStorage.setItem(PAPER_STORAGE_KEY, paper);
}

export async function downloadSaleTicketPdf(saleId: number, folio: string, paper: TicketPaper) {
  const blob = await salesService.ticketPdf(saleId, paper);
  const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `ticket-${folio}-${paper}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Abre el PDF en un marco oculto y lanza el diálogo de impresión; si el navegador no lo permite, lo abre en una pestaña. */
export async function printSaleTicketPdf(saleId: number, paper: TicketPaper) {
  const blob = await salesService.ticketPdf(saleId, paper);
  const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(url, "_blank");
    }
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };
  document.body.appendChild(frame);
}
