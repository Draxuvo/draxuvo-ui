import { ALERT_KINDS, ALERT_PRIORITY, DEFAULTS, SOUND_IDS, type AlertKind, type SoundId } from "./catalog";

export type SoundChoices = Partial<Record<AlertKind, SoundId>>;

const isSoundId = (value: unknown): value is SoundId => typeof value === "string" && (SOUND_IDS as readonly string[]).includes(value);
const isAlertKind = (value: string): value is AlertKind => (ALERT_KINDS as readonly string[]).includes(value);

/** Lee lo guardado: JSON inválido, alertas desconocidas o sonidos fuera del catálogo se descartan. */
export function parseChoices(raw: string | null | undefined): SoundChoices {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: SoundChoices = {};
    for (const [alert, id] of Object.entries(parsed)) {
      if (isAlertKind(alert) && isSoundId(id)) out[alert] = id;
    }
    return out;
  } catch {
    return {};
  }
}

/** Sonido efectivo de una alerta: la elección, o el valor por omisión si no hay o ya no existe. */
export function resolve(alert: AlertKind, choices: SoundChoices): SoundId | undefined {
  const chosen = choices[alert];
  return isSoundId(chosen) ? chosen : DEFAULTS[alert];
}

/** La alerta de mayor prioridad entre las que coinciden. */
export function pickAlert(kinds: readonly AlertKind[]): AlertKind | undefined {
  return ALERT_PRIORITY.find((kind) => kinds.includes(kind));
}

/** Alertas de `shown` que comparten sonido con otra de `shown`. */
export function duplicates(choices: SoundChoices, shown: readonly AlertKind[]): AlertKind[] {
  const bySound = new Map<SoundId, AlertKind[]>();
  for (const alert of shown) {
    const id = resolve(alert, choices);
    if (id) bySound.set(id, [...(bySound.get(id) ?? []), alert]);
  }
  return [...bySound.values()].filter((group) => group.length > 1).flat();
}

/** Solo se guardan las elecciones que difieren del valor por omisión. */
export function compact(choices: SoundChoices): SoundChoices {
  const out: SoundChoices = {};
  for (const alert of ALERT_KINDS) {
    const id = choices[alert];
    if (isSoundId(id) && id !== DEFAULTS[alert]) out[alert] = id;
  }
  return out;
}
