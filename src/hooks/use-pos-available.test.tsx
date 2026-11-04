import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/store/auth";
import { salesService } from "@/services/sales";
import { usePosAvailable } from "./use-pos-available";

vi.mock("@/lib/api", () => ({ expectModuleLock: () => () => {} }));
vi.mock("@/services/sales", () => ({ salesService: { list: vi.fn() } }));

const list = vi.mocked(salesService.list);

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const company = (id: number, modules?: string[]) => ({ id, name: `Empresa ${id}`, slug: `e${id}`, role: "staff" as const, parent_company_id: null, order_mode: "service" as const, modules });

beforeEach(() => {
  vi.clearAllMocks();
});

// Spec 054: la sesión trae los módulos activos; no se pide /sales para averiguar si hay punto de venta.
describe("usePosAvailable", () => {
  it("lee los módulos de la empresa activa y no hace ninguna petición", () => {
    useAuthStore.setState({ user: { id: 1, companies: [company(7, ["inventory", "pos"]), company(8, ["inventory"])] } as never, selectedCompanyId: 7 });
    const { result } = renderHook(() => usePosAvailable(), { wrapper });
    expect(result.current).toBe(true);
    expect(list).not.toHaveBeenCalled();
  });

  it("es falso, sin petición, cuando la empresa no tiene el módulo", () => {
    useAuthStore.setState({ user: { id: 1, companies: [company(7, ["inventory", "pos"]), company(8, ["inventory"])] } as never, selectedCompanyId: 8 });
    const { result } = renderHook(() => usePosAvailable(), { wrapper });
    expect(result.current).toBe(false);
    expect(list).not.toHaveBeenCalled();
  });

  it("sigue a la empresa activa cuando se cambia de empresa", () => {
    useAuthStore.setState({ user: { id: 1, companies: [company(7, ["pos"]), company(8, [])] } as never, selectedCompanyId: 7 });
    const { result, rerender } = renderHook(() => usePosAvailable(), { wrapper });
    expect(result.current).toBe(true);
    useAuthStore.setState({ selectedCompanyId: 8 });
    rerender();
    expect(result.current).toBe(false);
  });

  it("una sesión guardada sin `modules` cae al sondeo de antes", async () => {
    list.mockResolvedValue({ results: [], info: {} } as never);
    useAuthStore.setState({ user: { id: 1, companies: [company(7)] } as never, selectedCompanyId: 7 });
    const { result } = renderHook(() => usePosAvailable(), { wrapper });
    await waitFor(() => expect(result.current).toBe(true));
    expect(list).toHaveBeenCalledTimes(1);
  });
});
