import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useSoundChoices } from "./use-sound-choices";

const KEY = "draxuvo.sound-choices";

describe("useSoundChoices", () => {
  beforeEach(() => {
    const { result, unmount } = renderHook(() => useSoundChoices());
    act(() => result.current.resetAll());
    unmount();
    window.localStorage.clear();
  });

  it("empieza vacío y guarda una elección que sobrevive a un montaje nuevo", () => {
    const first = renderHook(() => useSoundChoices());
    expect(first.result.current.choices).toEqual({});
    act(() => first.result.current.choose("ready", "campana"));
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual({ ready: "campana" });
    first.unmount();
    expect(renderHook(() => useSoundChoices()).result.current.choices).toEqual({ ready: "campana" });
  });

  it("comparte la elección entre componentes montados a la vez", () => {
    const a = renderHook(() => useSoundChoices());
    const b = renderHook(() => useSoundChoices());
    act(() => a.result.current.choose("urgent", "pulso"));
    expect(b.result.current.choices).toEqual({ urgent: "pulso" });
  });

  it("no guarda lo que coincide con el valor por omisión", () => {
    const { result } = renderHook(() => useSoundChoices());
    act(() => result.current.choose("new_kitchen", "cocina"));
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("restablece una alerta o todas", () => {
    const { result } = renderHook(() => useSoundChoices());
    act(() => {
      result.current.choose("ready", "gota");
      result.current.choose("urgent", "pulso");
    });
    act(() => result.current.reset("ready"));
    expect(result.current.choices).toEqual({ urgent: "pulso" });
    act(() => result.current.resetAll());
    expect(result.current.choices).toEqual({});
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("ignora un valor guardado dañado", () => {
    window.localStorage.setItem(KEY, "{no es json");
    const { result } = renderHook(() => useSoundChoices());
    expect(result.current.choices).toEqual({});
  });
});
