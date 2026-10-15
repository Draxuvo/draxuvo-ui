import { createElement, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "@/test/render";

vi.mock("@/services/tickets", () => ({
  ticketsService: { list: vi.fn(), getById: vi.fn(), sendWhatsapp: vi.fn() },
}));

import { ticketsService } from "@/services/tickets";
import { useSendTicketWhatsapp, useTicket, useTickets } from "./use-tickets";

function wrapper() {
  const client = createTestQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  }
  return Wrapper;
}

beforeEach(() => vi.clearAllMocks());

describe("useTickets", () => {
  it("lista tickets con page 1 y los filtros, y devuelve results", async () => {
    vi.mocked(ticketsService.list).mockResolvedValue({ results: [{ id: 1 }] } as never);
    const { result } = renderHook(() => useTickets({ status: "paid" } as never), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(ticketsService.list).toHaveBeenCalledWith({ page: 1, status: "paid" });
    expect(result.current.data).toEqual([{ id: 1 }]);
  });

  it("acepta una respuesta que ya es un arreglo", async () => {
    vi.mocked(ticketsService.list).mockResolvedValue([{ id: 2 }] as never);
    const { result } = renderHook(() => useTickets(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 2 }]);
  });

  it("no hace request con enabled:false", () => {
    renderHook(() => useTickets(undefined, { enabled: false }), { wrapper: wrapper() });
    expect(ticketsService.list).not.toHaveBeenCalled();
  });
});

describe("useTicket", () => {
  it("obtiene el ticket por id", async () => {
    vi.mocked(ticketsService.getById).mockResolvedValue({ id: 5 } as never);
    const { result } = renderHook(() => useTicket(5), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(ticketsService.getById).toHaveBeenCalledWith(5);
    expect(result.current.data).toEqual({ id: 5 });
  });

  it("no consulta con id 0", () => {
    renderHook(() => useTicket(0), { wrapper: wrapper() });
    expect(ticketsService.getById).not.toHaveBeenCalled();
  });
});

describe("useSendTicketWhatsapp", () => {
  it("envía con teléfono opcional", async () => {
    vi.mocked(ticketsService.sendWhatsapp).mockResolvedValue(undefined);
    const { result } = renderHook(() => useSendTicketWhatsapp(9), { wrapper: wrapper() });
    await result.current.mutateAsync("5551234");
    expect(ticketsService.sendWhatsapp).toHaveBeenLastCalledWith(9, "5551234");
    await result.current.mutateAsync(undefined);
    expect(ticketsService.sendWhatsapp).toHaveBeenLastCalledWith(9, undefined);
  });
});
