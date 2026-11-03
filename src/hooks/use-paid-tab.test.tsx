import { createElement, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "@/test/render";

const gate = vi.hoisted(() => ({ enabled: true, locked: false }));
vi.mock("@/components/subscription/module-locked", () => ({
  useModuleGate: () => ({ enabled: gate.enabled, isLocked: (error?: unknown) => gate.locked || !!(error as { locked?: boolean } | undefined)?.locked }),
}));
vi.mock("@/services/tickets", () => ({ ticketsService: { list: vi.fn() } }));

import { ticketsService } from "@/services/tickets";
import { useAuthStore } from "@/store/auth";
import { usePaidTab } from "./use-paid-tab";
import { useWorkOrdersTab } from "./use-work-orders-tab";

function wrapper() {
  const client = createTestQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  gate.enabled = true;
  gate.locked = false;
  useAuthStore.setState({ role: "owner", selectedCompanyId: 1 } as never);
});

describe("usePaidTab", () => {
  it("dueño con el módulo: disponible y no sondea", () => {
    const { result } = renderHook(() => usePaidTab(), { wrapper: wrapper() });
    expect(result.current).toEqual({ available: true, ready: true });
    expect(ticketsService.list).not.toHaveBeenCalled();
  });

  it("dueño sin el módulo: no disponible, ya se sabe y no hace solicitudes", () => {
    gate.enabled = false;
    gate.locked = true;
    const { result } = renderHook(() => usePaidTab(), { wrapper: wrapper() });
    expect(result.current).toEqual({ available: false, ready: true });
    expect(ticketsService.list).not.toHaveBeenCalled();
  });

  it("mientras la suscripción carga no está lista", () => {
    gate.enabled = false;
    const { result } = renderHook(() => usePaidTab(), { wrapper: wrapper() });
    expect(result.current).toEqual({ available: false, ready: false });
  });

  it("staff: no está lista hasta que responde la sonda y luego queda disponible", async () => {
    useAuthStore.setState({ role: "staff" } as never);
    vi.mocked(ticketsService.list).mockResolvedValue({ results: [], info: { total: 0 } } as never);
    const { result } = renderHook(() => usePaidTab(), { wrapper: wrapper() });
    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(result.current).toEqual({ available: true, ready: true }));
    expect(ticketsService.list).toHaveBeenCalledWith({ page: 1, page_size: 1 });
  });

  it("staff cuyo plan no incluye tickets (403 module_not_in_plan): no disponible", async () => {
    useAuthStore.setState({ role: "staff" } as never);
    vi.mocked(ticketsService.list).mockRejectedValue({ locked: true });
    const { result } = renderHook(() => usePaidTab(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.available).toBe(false);
  });
});

describe("useWorkOrdersTab", () => {
  it("el staff siempre la tiene; los jefes siguen al módulo", () => {
    useAuthStore.setState({ role: "staff" } as never);
    expect(renderHook(() => useWorkOrdersTab(), { wrapper: wrapper() }).result.current).toEqual({ available: true, ready: true });
    useAuthStore.setState({ role: "owner" } as never);
    gate.enabled = false;
    gate.locked = true;
    expect(renderHook(() => useWorkOrdersTab(), { wrapper: wrapper() }).result.current).toEqual({ available: false, ready: true });
  });
});
