// src/lib/scan/lib.ts
// Lógica pura del lector de códigos (spec 056): normalizar una lectura, filtrar rebotes y elegir el código central.
// La misma regla vive en draxuvo-app/src/lib/scan.ts: si cambia una, cambia la otra.

export const MAX_CODE_LENGTH = 128;

/** Recorta la lectura; devuelve null si queda vacía, es muy larga o trae caracteres fuera de ASCII imprimible. */
export function normalizeCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim();
  if (!code || code.length > MAX_CODE_LENGTH) return null;
  return /^[ -~]+$/.test(code) ? code : null;
}

export interface DebounceOptions {
  /** Sin ver el código este tiempo se considera que salió de cuadro y puede contarse otra vez. */
  gapMs?: number;
  /** Aunque siga a la vista, tras este tiempo vuelve a contar (quien sostiene el producto a propósito). */
  holdMs?: number;
  now?: () => number;
}

/** Anti-rebote: una misma lectura sostenida frente a la cámara cuenta una sola vez; una distinta pasa al instante. */
export function createDebounce({ gapMs = 1000, holdMs = 4000, now = Date.now }: DebounceOptions = {}) {
  let last: string | null = null;
  let lastSeen = 0;
  let acceptedAt = 0;
  return {
    /** true si la lectura debe contarse; cada avistamiento refresca "visto por última vez". */
    accept(code: string): boolean {
      const t = now();
      const same = code === last;
      const left = same && t - lastSeen >= gapMs;
      const held = same && t - acceptedAt >= holdMs;
      lastSeen = t;
      if (same && !left && !held) return false;
      last = code;
      acceptedAt = t;
      return true;
    },
    reset() {
      last = null;
      lastSeen = 0;
      acceptedAt = 0;
    },
  };
}

export interface DetectedCode {
  value: string;
  /** Centro del código en píxeles del cuadro, si el detector lo da. */
  center?: { x: number; y: number };
}

/** Con varios códigos en cuadro, el más cercano al centro del cuadro (o el primero si no hay posiciones). */
export function pickCentral(codes: DetectedCode[], width: number, height: number): DetectedCode | null {
  if (codes.length === 0) return null;
  const cx = width / 2;
  const cy = height / 2;
  const dist = (c: DetectedCode) => (c.center ? Math.hypot(c.center.x - cx, c.center.y - cy) : Number.POSITIVE_INFINITY);
  return codes.reduce((best, c) => (dist(c) < dist(best) ? c : best));
}
