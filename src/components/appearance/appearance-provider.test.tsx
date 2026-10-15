import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setMatchMedia } from "@/test/setup";
import { AppearanceProvider, useAppearance } from "./appearance-provider";

function Probe() {
  const { theme, mode, resolvedMode } = useAppearance();
  return <p data-testid="estado">{`${theme}|${mode}|${resolvedMode}`}</p>;
}

beforeEach(() => {
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.mode;
  setMatchMedia("(prefers-color-scheme: dark)", false);
});

afterEach(() => {
  setMatchMedia("(prefers-color-scheme: dark)", false);
});

describe("AppearanceProvider", () => {
  it("usa anaquel y modo sistema cuando el html no trae atributos", () => {
    render(<AppearanceProvider><Probe /></AppearanceProvider>);
    expect(screen.getByTestId("estado")).toHaveTextContent("anaquel|system|light");
  });

  it("lee el tema y el modo pintados en el html", () => {
    document.documentElement.dataset.theme = "mercado";
    document.documentElement.dataset.mode = "dark";
    render(<AppearanceProvider><Probe /></AppearanceProvider>);
    expect(screen.getByTestId("estado")).toHaveTextContent("mercado|dark|dark");
  });

  it("en modo sistema resuelve oscuro cuando el dispositivo prefiere oscuro", () => {
    setMatchMedia("(prefers-color-scheme: dark)", true);
    render(<AppearanceProvider><Probe /></AppearanceProvider>);
    expect(screen.getByTestId("estado")).toHaveTextContent("anaquel|system|dark");
  });

  it("en modo sistema sigue los cambios de matchMedia", () => {
    render(<AppearanceProvider><Probe /></AppearanceProvider>);
    expect(screen.getByTestId("estado")).toHaveTextContent("|light");
    act(() => setMatchMedia("(prefers-color-scheme: dark)", true));
    expect(screen.getByTestId("estado")).toHaveTextContent("|dark");
  });

  it("setAppearance actualiza el contexto y los atributos del html", () => {
    const { result } = renderHook(() => useAppearance(), { wrapper: AppearanceProvider });
    act(() => result.current.setAppearance({ theme: "grafito", mode: "light" }));
    expect(result.current.theme).toBe("grafito");
    expect(result.current.mode).toBe("light");
    expect(result.current.resolvedMode).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("grafito");
  });

  it("useAppearance fuera del proveedor lanza un error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAppearance())).toThrow(/AppearanceProvider/);
    spy.mockRestore();
  });
});
