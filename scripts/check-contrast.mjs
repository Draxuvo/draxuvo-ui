// Verifica el contraste de las 10 combinaciones de tema y modo de src/app/globals.css (spec 006,
// FR-006 / SC-003): 4.5:1 en texto y 3:1 en gráficas, anillo de foco y relleno del botón principal.
// Uso: node scripts/check-contrast.mjs
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const THEMES = ["anaquel", "mercado", "talavera", "rosa_mexicano", "grafito"];

const blocks = [];
for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const props = {};
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) props[name] = value.trim();
  blocks.push({ selector: selector.trim().replace(/\s+/g, " "), props });
}

// Un bloque puede agrupar varios selectores (":root, [data-theme=..]"): se compara cada uno.
const find = (selector) =>
  blocks.filter((block) => block.selector.split(",").map((part) => part.trim()).includes(selector)).map((block) => block.props);

// Los bloques de modo "system" repiten los de "dark" dentro de prefers-color-scheme: deben ser iguales.
let failures = 0;
function fail(message) {
  failures += 1;
  console.error(`FAIL ${message}`);
}
for (const [dark, system] of [["[data-mode=\"dark\"]", "[data-mode=\"system\"]"], ...THEMES.map((t) => [`[data-mode="dark"][data-theme="${t}"]`, `[data-mode="system"][data-theme="${t}"]`])]) {
  const a = JSON.stringify(Object.assign({}, ...find(dark)));
  const b = JSON.stringify(Object.assign({}, ...find(system)));
  if (a !== b) fail(`${system} difiere de ${dark}`);
}

function tokens(theme, mode) {
  const layers = [":root", `[data-theme="${theme}"]`];
  if (mode === "dark") layers.push('[data-mode="dark"]', `[data-mode="dark"][data-theme="${theme}"]`);
  const map = Object.assign({}, ...layers.flatMap(find));
  const resolve = (value, depth = 0) => {
    const ref = value.match(/^var\((--[\w-]+)\)$/);
    if (!ref || depth > 8) return value;
    return resolve(map[ref[1]] ?? value, depth + 1);
  };
  return (name) => {
    const value = map[`--${name}`];
    if (value === undefined) throw new Error(`falta --${name} en ${theme}/${mode}`);
    return resolve(value);
  };
}

function luminance(hex) {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) throw new Error(`color no hexadecimal: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const ESTADOS = ["pendiente", "progreso", "revision", "completada", "cancelada"];
const TEXT = [
  ["foreground", "background"],
  ["foreground", "ceja"],
  ["etiqueta", "sello"],
  ["etiqueta", "alerta"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["secondary-foreground", "secondary"],
  ["primary-foreground", "primary"],
  ["primary-foreground", "primary-hover"],
  ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"],
  ["success-foreground", "success"],
  ["warning-foreground", "warning"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ...ESTADOS.map((e) => [`estado-${e}-foreground`, `estado-${e}`]),
];
const GRAPHICS = [
  ["ring", "background"],
  ["primary", "card"],
  ...[1, 2, 3, 4, 5].flatMap((n) => [[`chart-${n}`, "card"]]),
];

let checked = 0;
for (const theme of THEMES) {
  for (const mode of ["light", "dark"]) {
    const t = tokens(theme, mode);
    for (const [group, min, pairs] of [["texto", 4.5, TEXT], ["gráfico", 3, GRAPHICS]]) {
      for (const [fg, bg] of pairs) {
        checked += 1;
        const value = ratio(t(fg), t(bg));
        if (value < min) fail(`${theme}/${mode} ${group}: ${fg} ${t(fg)} sobre ${bg} ${t(bg)} = ${value.toFixed(2)} (mínimo ${min})`);
      }
    }
  }
}

if (failures) {
  console.error(`\n${failures} falla(s) en ${checked} comprobaciones`);
  process.exit(1);
}
console.log(`OK: ${checked} comprobaciones en ${THEMES.length * 2} combinaciones de tema y modo`);
