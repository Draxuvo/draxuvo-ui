import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAudio } from "@/test/audio";
import { resetEngine, ensureContext } from "@/lib/sounds/engine";
import { useSoundChoices } from "@/hooks/use-sound-choices";
import { useSound } from "../sound-toggle";

let audio: ReturnType<typeof installFakeAudio>;

beforeEach(() => {
  resetEngine();
  window.localStorage.clear();
  audio = installFakeAudio();
});
afterEach(() => vi.unstubAllGlobals());

const enabled = (surface = "station:1", kind: "kitchen" | "bar" | "other" = "kitchen") => {
  window.localStorage.setItem(`draxuvo.sound.${surface}`, JSON.stringify({ enabled: true, volume: 0.5 }));
  ensureContext();
  return renderHook(() => useSound(surface, kind));
};

describe("useSound con sonidos elegidos", () => {
  it("sin elección suena el sonido por omisión de cada alerta", async () => {
    const { result } = enabled();
    act(() => result.current.playNew());
    await waitFor(() => expect(audio.played.map((p) => p.url)).toEqual(["/sounds/cocina.wav"]));
    act(() => result.current.playUrgent());
    await waitFor(() => expect(audio.played.at(-1)!.url).toBe("/sounds/urgente.wav"));
    act(() => result.current.playReady());
    await waitFor(() => expect(audio.played.at(-1)!.url).toBe("/sounds/listo.wav"));
  });

  it("el tipo de estación elige la alerta de comanda nueva", async () => {
    const bar = enabled("station:2", "bar");
    act(() => bar.result.current.playNew());
    await waitFor(() => expect(audio.played.at(-1)!.url).toBe("/sounds/barra.wav"));
    const other = enabled("station:3", "other");
    act(() => other.result.current.playNew());
    await waitFor(() => expect(audio.played.at(-1)!.url).toBe("/sounds/otra.wav"));
  });

  it("suena el sonido elegido, al volumen de la superficie", async () => {
    const { result } = enabled();
    const choices = renderHook(() => useSoundChoices());
    act(() => choices.result.current.choose("new_kitchen", "campana"));
    act(() => result.current.playNew());
    await waitFor(() => expect(audio.played).toEqual([{ url: "/sounds/campana.wav", volume: 0.5 }]));
  });

  it("un id inexistente guardado cae al sonido por omisión", async () => {
    window.localStorage.setItem("draxuvo.sound-choices", JSON.stringify({ new_kitchen: "nope" }));
    const { result } = enabled();
    act(() => result.current.playNew());
    await waitFor(() => expect(audio.played.at(-1)!.url).toBe("/sounds/cocina.wav"));
  });

  it("silenciado no suena", async () => {
    window.localStorage.setItem("draxuvo.sound.station:1", JSON.stringify({ enabled: false, volume: 1 }));
    ensureContext();
    const { result } = renderHook(() => useSound("station:1", "kitchen"));
    act(() => result.current.playNew());
    await Promise.resolve();
    await Promise.resolve();
    expect(audio.played).toHaveLength(0);
  });

  it("alertas que coinciden en el mismo ciclo suenan una vez, la de mayor prioridad", async () => {
    const { result } = enabled();
    act(() => {
      result.current.playReady();
      result.current.playNew();
      result.current.playUrgent();
      result.current.playNew();
    });
    await waitFor(() => expect(audio.played).toHaveLength(1));
    expect(audio.played[0].url).toBe("/sounds/urgente.wav");
  });

  it("varias comandas nuevas suenan una sola vez", async () => {
    const { result } = enabled();
    act(() => {
      result.current.playNew();
      result.current.playNew();
      result.current.playNew();
    });
    await waitFor(() => expect(audio.played).toHaveLength(1));
  });

  it("si el archivo falla suena el tono de respaldo", async () => {
    audio.fetchMock.mockResolvedValue({ ok: false, status: 404 } as never);
    const { result } = enabled();
    act(() => result.current.playNew());
    await waitFor(() => expect(audio.oscillators).toEqual([660, 880]));
  });
});
