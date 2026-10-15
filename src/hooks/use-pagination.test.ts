import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePagination } from "./use-pagination";

describe("usePagination", () => {
  it("empieza en la página 1 o en la inicial indicada", () => {
    expect(renderHook(() => usePagination()).result.current.page).toBe(1);
    expect(renderHook(() => usePagination(4)).result.current.page).toBe(4);
  });

  it("goTo salta a una página", () => {
    const { result } = renderHook(() => usePagination());
    act(() => result.current.goTo(5));
    expect(result.current.page).toBe(5);
  });

  it("next avanza sin pasar del total", () => {
    const { result } = renderHook(() => usePagination(2));
    act(() => result.current.next(3));
    expect(result.current.page).toBe(3);
    act(() => result.current.next(3));
    expect(result.current.page).toBe(3);
  });

  it("prev retrocede sin bajar de 1", () => {
    const { result } = renderHook(() => usePagination(2));
    act(() => result.current.prev());
    expect(result.current.page).toBe(1);
    act(() => result.current.prev());
    expect(result.current.page).toBe(1);
  });

  it("reset vuelve a la página 1", () => {
    const { result } = renderHook(() => usePagination(7));
    act(() => result.current.reset());
    expect(result.current.page).toBe(1);
  });
});
