// src/lib/scan/detector.ts
// Detector de códigos de barras del navegador (spec 056): usa BarcodeDetector nativo si lo trae con todos los formatos
// que necesitamos y, si no (Safari, Firefox, escritorio), el polyfill de WASM servido desde nuestro dominio. El
// polyfill se descarga solo al abrir la cámara.
import type { DetectedCode } from "./lib";

/** Formatos que Draxuvo genera y acepta (spec 035): EAN-13, UPC-A, EAN-8 y Code 128. */
export const SCAN_FORMATS = ["ean_13", "upc_a", "ean_8", "code_128"] as const;

export const WASM_URL = "/vendor/zxing/zxing_reader.wasm";

export interface Detector {
  detect(source: HTMLVideoElement): Promise<DetectedCode[]>;
}

interface RawBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface RawCode {
  rawValue: string;
  boundingBox?: RawBox;
}
interface DetectorCtor {
  new (options: { formats: string[] }): { detect(source: HTMLVideoElement): Promise<RawCode[]> };
  getSupportedFormats?: () => Promise<string[]>;
}

async function nativeCtor(): Promise<DetectorCtor | null> {
  const native = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  if (!native) return null;
  try {
    const supported = (await native.getSupportedFormats?.()) ?? [];
    return SCAN_FORMATS.every((format) => supported.includes(format)) ? native : null;
  } catch {
    return null;
  }
}

async function polyfillCtor(): Promise<DetectorCtor> {
  const mod = await import("barcode-detector/ponyfill");
  mod.prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? WASM_URL : prefix + path) },
    fireImmediately: false,
  });
  return mod.BarcodeDetector as unknown as DetectorCtor;
}

export async function createDetector(): Promise<Detector> {
  const Ctor = (await nativeCtor()) ?? (await polyfillCtor());
  const instance = new Ctor({ formats: [...SCAN_FORMATS] });
  return {
    async detect(source) {
      const found = await instance.detect(source);
      return found.map((code) => ({
        value: code.rawValue,
        center: code.boundingBox
          ? { x: code.boundingBox.x + code.boundingBox.width / 2, y: code.boundingBox.y + code.boundingBox.height / 2 }
          : undefined,
      }));
    },
  };
}
