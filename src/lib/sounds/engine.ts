import type { AlertKind, SoundId } from "./catalog";

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

/** Tonos de la spec 043: respaldo cuando un archivo no carga o no se puede decodificar (FR-009). */
const FALLBACK_TONES: Record<AlertKind, number[]> = {
  new_kitchen: [660, 880],
  new_bar: [523, 784],
  new_other: [392, 523],
  urgent: [196, 262],
  ready: [880, 660],
};

let context: AudioContext | null = null;
let current: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
const buffers = new Map<SoundId, Promise<AudioBuffer>>();

/** Los navegadores solo dejan sonar tras un gesto: llamar esto dentro de un clic o toque. */
export function ensureContext(): AudioContext | null {
  if (!context) {
    const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  void context.resume();
  return context;
}

export function hasContext(): boolean {
  return context !== null;
}

function load(id: SoundId): Promise<AudioBuffer> {
  let pending = buffers.get(id);
  if (!pending) {
    const audio = context;
    pending = (async () => {
      if (!audio) throw new Error("sin contexto de audio");
      const response = await fetch(`/sounds/${id}.wav`);
      if (!response.ok) throw new Error(`sonido ${id}: ${response.status}`);
      return audio.decodeAudioData(await response.arrayBuffer());
    })();
    // Un fallo no se queda en caché: el siguiente intento vuelve a pedirlo.
    pending.catch(() => buffers.delete(id));
    buffers.set(id, pending);
  }
  return pending;
}

export function preload(ids: readonly SoundId[]): void {
  if (!context) return;
  ids.forEach((id) => void load(id).catch(() => {}));
}

export function stop(): void {
  if (!current) return;
  try {
    current.source.stop();
  } catch {
    // Ya había terminado.
  }
  current = null;
}

function scheduleTone(audio: AudioContext, frequencies: number[], volume: number): void {
  const now = audio.currentTime;
  frequencies.forEach((frequency, i) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now + i * 0.18);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.35 * volume), now + i * 0.18 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.16);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(now + i * 0.18);
    oscillator.stop(now + i * 0.18 + 0.18);
  });
}

/**
 * Reproduce un sonido del catálogo al volumen dado (0–1) y corta el anterior.
 * Devuelve `false` si no pudo; con `alert`, en ese caso suena el tono de respaldo de esa alerta.
 */
export async function play(id: SoundId, volume: number, alert?: AlertKind): Promise<boolean> {
  const audio = context;
  if (!audio) return false;
  stop();
  try {
    const buffer = await load(id);
    stop(); // otra llamada pudo empezar mientras cargaba
    const source = audio.createBufferSource();
    const gain = audio.createGain();
    source.buffer = buffer;
    gain.gain.value = Math.min(1, Math.max(0, volume));
    source.connect(gain).connect(audio.destination);
    source.onended = () => {
      if (current?.source === source) current = null;
    };
    current = { source, gain };
    source.start();
    return true;
  } catch {
    if (alert) scheduleTone(audio, FALLBACK_TONES[alert], volume);
    return false;
  }
}

/** Solo para pruebas. */
export function resetEngine(): void {
  stop();
  context = null;
  buffers.clear();
}
