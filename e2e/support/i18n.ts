import { readFileSync } from "node:fs";
import { join } from "node:path";

type Tree = { [key: string]: string | Tree };

const messages: Tree = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "messages", "es.json"), "utf-8"),
) as Tree;

/**
 * Texto de `messages/es.json` por clave con puntos: `t("auth.login.title")`.
 * `values` reemplaza los marcadores `{nombre}`. Lanza si la clave no existe o no es un texto,
 * para que un cambio de copy rompa la prueba con un mensaje claro.
 */
export function t(key: string, values: Record<string, string | number> = {}): string {
  let node: string | Tree | undefined = messages;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null || !(part in node)) {
      throw new Error(`i18n: la clave "${key}" no existe en messages/es.json`);
    }
    node = node[part];
  }
  if (typeof node !== "string") {
    throw new Error(`i18n: la clave "${key}" no es un texto en messages/es.json`);
  }
  return node.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}
