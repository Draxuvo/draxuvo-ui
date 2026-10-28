import { vi } from "vitest";

/** AudioContext y fetch simulados para probar sonidos: registra qué archivo suena y con qué volumen. */
export function installFakeAudio() {
  const played: { url: string; volume: number }[] = [];
  const oscillators: number[] = [];
  const urls = new WeakMap<object, string>();

  class FakeAudioContext {
    currentTime = 0;
    destination = {};
    resume = vi.fn(async () => {});
    decodeAudioData = vi.fn(async (data: ArrayBuffer & { url?: string }) => {
      const buffer = { url: (data as { url?: string }).url ?? "" };
      urls.set(buffer, buffer.url);
      return buffer;
    });
    createBufferSource() {
      const source = {
        buffer: null as { url: string } | null,
        onended: null,
        connect: (node: unknown) => node,
        stop: vi.fn(),
        start: vi.fn(() => played.push({ url: source.buffer?.url ?? "", volume: lastGain })),
      };
      return source;
    }
    createGain() {
      const gain = {
        gain: {
          set value(v: number) {
            lastGain = v;
          },
          get value() {
            return lastGain;
          },
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: (node: unknown) => node,
      };
      return gain;
    }
    createOscillator() {
      const osc = {
        frequency: {
          set value(v: number) {
            oscillators.push(v);
          },
          get value() {
            return 0;
          },
        },
        connect: (node: unknown) => node,
        start: vi.fn(),
        stop: vi.fn(),
      };
      return osc;
    }
  }
  let lastGain = 1;

  const fetchMock = vi.fn(async (url: string) => {
    const bytes = new ArrayBuffer(8) as ArrayBuffer & { url?: string };
    bytes.url = url;
    return { ok: true, arrayBuffer: async () => bytes };
  });
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("fetch", fetchMock);
  return { played, oscillators, fetchMock };
}
