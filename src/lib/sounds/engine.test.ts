import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureContext, hasContext, play, preload, resetEngine } from "./engine";

const sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; buffer: unknown }[] = [];
const gains: { gain: { value: number } }[] = [];
const oscillators: { frequency: { value: number } }[] = [];
const decode = vi.fn(async () => ({ duration: 0.5 }));

class FakeAudioContext {
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => {});
  decodeAudioData = decode;
  createBufferSource() {
    const source = { start: vi.fn(), stop: vi.fn(), connect: (n: unknown) => n, buffer: null as unknown, onended: null };
    sources.push(source);
    return source;
  }
  createGain() {
    const g = { gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: (n: unknown) => n };
    gains.push(g);
    return g;
  }
  createOscillator() {
    const o = { frequency: { value: 0 }, connect: (n: unknown) => n, start: vi.fn(), stop: vi.fn() };
    oscillators.push(o);
    return o;
  }
}

describe("engine de sonidos", () => {
  beforeEach(() => {
    resetEngine();
    sources.length = 0;
    gains.length = 0;
    oscillators.length = 0;
    decode.mockClear();
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("no suena ni carga sin un contexto creado por un gesto", async () => {
    expect(hasContext()).toBe(false);
    expect(await play("campana", 1)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("decodifica una vez por id y aplica el volumen", async () => {
    ensureContext();
    expect(await play("campana", 0.4)).toBe(true);
    expect(await play("campana", 0.4)).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/sounds/campana.wav");
    expect(decode).toHaveBeenCalledTimes(1);
    expect(gains.at(-1)!.gain.value).toBe(0.4);
  });

  it("corta el sonido anterior al empezar otro", async () => {
    ensureContext();
    await play("campana", 1);
    await play("gota", 1);
    expect(sources[0].stop).toHaveBeenCalled();
    expect(sources[1].start).toHaveBeenCalled();
  });

  it("precarga sin reproducir", async () => {
    ensureContext();
    preload(["gota", "pulso"]);
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sources).toHaveLength(0);
  });

  it("con el archivo caído devuelve false y, con alerta, suena el tono de respaldo", async () => {
    ensureContext();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 })));
    expect(await play("campana", 1)).toBe(false);
    expect(oscillators).toHaveLength(0);
    expect(await play("campana", 1, "new_kitchen")).toBe(false);
    expect(oscillators.map((o) => o.frequency.value)).toEqual([660, 880]);
  });

  it("reintenta un archivo que falló", async () => {
    ensureContext();
    const failing = vi.fn(async () => ({ ok: false, status: 500 }));
    vi.stubGlobal("fetch", failing);
    await play("gota", 1);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })));
    expect(await play("gota", 1)).toBe(true);
  });
});
