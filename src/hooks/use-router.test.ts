import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next-intl", () => ({ useLocale: () => "es" }));

import { useAppRouter } from "./use-router";

describe("useAppRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("push antepone el locale a la ruta", () => {
    const { result } = renderHook(() => useAppRouter());
    result.current.push("/ordenes");
    expect(router.push).toHaveBeenCalledWith("/es/ordenes");
  });

  it("replace antepone el locale a la ruta", () => {
    const { result } = renderHook(() => useAppRouter());
    result.current.replace("/login");
    expect(router.replace).toHaveBeenCalledWith("/es/login");
  });

  it("back delega en el router sin tocar la ruta", () => {
    const { result } = renderHook(() => useAppRouter());
    result.current.back();
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
