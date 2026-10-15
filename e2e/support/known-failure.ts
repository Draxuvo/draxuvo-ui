import { test } from "@playwright/test";

const FINDING_ID = /^H-(0[1-9]|[1-9]\d)$/;

/**
 * Marca la prueba como fallo conocido ligado a un hallazgo (H-01 a H-99).
 * Usa test.fail(): si la prueba pasa por error, Playwright la reporta como fallida.
 * Llamar al inicio de la prueba.
 */
export function knownFailure(finding: string): void {
  if (!FINDING_ID.test(finding)) {
    throw new Error(`knownFailure: hallazgo inválido "${finding}" (se espera H-01 a H-99)`);
  }
  test.info().annotations.push({ type: "known-failure", description: finding });
  test.fail(true, `Fallo conocido ${finding}`);
}
