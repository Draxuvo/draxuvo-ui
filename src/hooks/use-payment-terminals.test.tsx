import { waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePaymentTerminals } from "./use-payment-terminals";

const gate = vi.hoisted(() => ({ enabled: true }));
const list = vi.hoisted(() => vi.fn());

vi.mock("@/components/subscription/module-locked", () => ({ useModuleGate: () => ({ enabled: gate.enabled }) }));
vi.mock("@/services/payment-terminals", () => ({ paymentTerminalsService: { list } }));

function run(options?: Parameters<typeof usePaymentTerminals>[0]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => usePaymentTerminals(options), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}

beforeEach(() => {
  gate.enabled = true;
  list.mockReset().mockResolvedValue([{ id: 1, name: "BBVA caja 1" }]);
});

describe("usePaymentTerminals (spec 030)", () => {
  it("con el módulo activo pide las terminales", async () => {
    const { result } = run();
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("con el módulo bloqueado no pide nada y la lista queda vacía", () => {
    gate.enabled = false;
    const { result } = run();
    expect(list).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it("respeta el enabled de quien lo llama aunque el módulo esté activo", () => {
    run({ enabled: false });
    expect(list).not.toHaveBeenCalled();
  });
});
