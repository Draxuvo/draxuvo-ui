// Copia el .wasm del lector de códigos a public/vendor/zxing/ (spec 056): se sirve desde nuestro propio dominio
// en vez de un CDN. Se ejecuta en postinstall y antes de dev/build; no falla si el paquete aún no está.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "zxing-wasm", "dist", "reader", "zxing_reader.wasm");
const target = join(root, "public", "vendor", "zxing", "zxing_reader.wasm");

if (!existsSync(source)) {
  console.warn("[scan] zxing_reader.wasm no encontrado; omito la copia");
} else {
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}
