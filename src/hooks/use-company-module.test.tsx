import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/store/auth";

const getSubscription = vi.fn();
vi.mock("@/services/subscription", () => ({ getSubscription: (...a: unknown[]) => getSubscription(...a) }));

import { useCompanyModule } from "./use-company-module";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

function session(role: string, modules?: string[], companyId = 7) {
  useAuthStore.setState({
    role: role as never,
    selectedCompanyId: companyId,
    user: { id: 1, role: role === "super_admin" ? "super_admin" : "user", companies: [{ id: companyId, name: "A", role, modules }] } as never,
  });
}

beforeEach(() => getSubscription.mockReset());

describe("useCompanyModule (spec 055, H-59)", () => {
  it("el personal lee los módulos de la sesión", () => {
    session("staff", ["work_orders", "tickets"]);
    expect(renderHook(() => useCompanyModule("whatsapp"), { wrapper }).result.current).toBe(false);
    session("staff", ["tickets", "whatsapp"]);
    expect(renderHook(() => useCompanyModule("whatsapp"), { wrapper }).result.current).toBe(true);
  });

  it("sin módulos en la sesión (anterior a la spec 054) no quita la función", () => {
    session("staff", undefined);
    expect(renderHook(() => useCompanyModule("whatsapp"), { wrapper }).result.current).toBe(true);
  });

  it("dueño y administrador siguen la suscripción", async () => {
    getSubscription.mockResolvedValue({ active_modules: ["tickets"] });
    session("owner", ["tickets", "whatsapp"]);
    const { result } = renderHook(() => useCompanyModule("whatsapp"), { wrapper });
    await vi.waitFor(() => expect(result.current).toBe(false));
  });

  it("al subir de plan la suscripción vuelve a ofrecerlo", async () => {
    getSubscription.mockResolvedValue({ active_modules: ["tickets", "whatsapp"] });
    session("admin", ["tickets"]);
    const { result } = renderHook(() => useCompanyModule("whatsapp"), { wrapper });
    await vi.waitFor(() => expect(result.current).toBe(true));
  });

  it("el super admin siempre lo tiene", () => {
    session("super_admin", []);
    expect(renderHook(() => useCompanyModule("whatsapp"), { wrapper }).result.current).toBe(true);
  });
});
