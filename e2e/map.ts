// Cruza los casos `playwright` del plan 009 con las pruebas de e2e/tests y escribe
// 31-cobertura-playwright.md. Uso: npm run e2e:map  (PLAN_DIR cambia la carpeta del plan).
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dirname, "..");
const planDir = process.env.PLAN_DIR ?? join(root, "../../specs/009-plan-pruebas-regresion/plan-pruebas");
const testsDir = join(root, "e2e/tests");

if (!existsSync(planDir)) {
  console.error(`No encuentro el plan en ${planDir}. Corre esto desde el workspace o pasa PLAN_DIR.`);
  process.exit(1);
}

interface PlanCase {
  id: string;
  title: string;
  priority: string;
  suite: string;
  automation: string;
  file: string;
}

interface Found {
  file: string;
  titles: string[];
  findings: string[];
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith(".spec.ts") ? [join(dir, e.name)] : [],
  );
}

// Casos del plan: "### ID título" seguido de la tabla Rol|Empresa|Capa|Prioridad|Suite|Automatización|Cobertura.
const cases: PlanCase[] = [];
for (const name of readdirSync(planDir).filter((n) => /^(0[1-9]|1[01])-.*\.md$/.test(n)).sort()) {
  const text = readFileSync(join(planDir, name), "utf8");
  for (const m of text.matchAll(/^### ([A-Z]{3}-\d{3}) (.*?)\n([\s\S]*?)(?=^### |(?![\s\S]))/gm)) {
    const row = /\|\s*[^|]+\|\s*[^|]+\|\s*[^|]+\|\s*(P\d)\s*\|\s*(\w+)\s*\|\s*(\w+)\s*\|/.exec(m[3]);
    if (row) cases.push({ id: m[1], title: m[2], priority: row[1], suite: row[2], automation: row[3], file: name });
  }
}
const planIds = new Set(cases.map((c) => c.id));

// Pruebas: ids entre corchetes en cada test() y los knownFailure("H-xx") de su cuerpo.
const tests: Found[] = [];
for (const file of walk(testsDir)) {
  const text = readFileSync(file, "utf8");
  const parts = text.split(/\btest\(/).slice(1);
  const titles: string[] = [];
  const findings: string[] = [];
  for (const part of parts) {
    const titleEnd = part.search(/,\s*async/);
    const title = titleEnd > 0 ? part.slice(0, titleEnd) : part.slice(0, 200);
    const ids = [...title.matchAll(/\[([A-Z]{3}-\d{2,3})\]/g)].map((m) => m[1]);
    titles.push(...ids);
    const kf = /knownFailure\("(H-\d+)"\)/.exec(part.split(/\ntest\(|\n\}\);\n/)[0]);
    if (kf) findings.push(...ids.map((id) => `${id}:${kf[1]}`));
  }
  tests.push({ file: relative(root, file), titles, findings });
}

const byId = new Map<string, string[]>();
for (const t of tests) for (const id of t.titles) byId.set(id, [...(byId.get(id) ?? []), t.file]);
const known = new Map<string, string>();
for (const t of tests) for (const f of t.findings) known.set(f.split(":")[0], f.split(":")[1]);

const pw = cases.filter((c) => c.automation === "playwright");
// Los flujos viven en 20-flujos.md.
const flowIds = [...readFileSync(join(planDir, "20-flujos.md"), "utf8").matchAll(/^### (FLU-\d+)/gm)].map((m) => m[1]);

let out = "# Cobertura de Playwright\n\nGenerado por `npm run e2e:map` en `draxuvo-ui`. No se edita a mano.\n\n";
out += `Casos \`playwright\` del plan: ${pw.length}. Con prueba: ${pw.filter((c) => byId.has(c.id)).length}. Sin prueba: ${pw.filter((c) => !byId.has(c.id)).length}.\n\n`;
out += "## Casos `playwright`\n\n| Caso | Prioridad | Suite | Prueba | Nota |\n|---|---|---|---|---|\n";
for (const c of pw) {
  const files = byId.get(c.id);
  out += `| ${c.id} ${c.title} | ${c.priority} | ${c.suite} | ${files ? [...new Set(files)].join(", ") : "falta"} | ${known.has(c.id) ? `fallo conocido ${known.get(c.id)}` : files ? "" : "Sin prueba todavía; indica por qué en el PR si no se automatiza."} |\n`;
}
out += "\n## Flujos\n\n| Flujo | Prueba |\n|---|---|\n";
for (const id of flowIds) out += `| ${id} | ${byId.get(id) ? [...new Set(byId.get(id))].join(", ") : "falta"} |\n`;
const extra = [...byId.keys()].filter((id) => !planIds.has(id) && !flowIds.includes(id));
if (extra.length) out += `\n## Pruebas con un id que no está en el plan\n\n${extra.map((id) => `- ${id}`).join("\n")}\n`;
if (known.size) out += `\n## Fallos conocidos\n\n${[...known].map(([id, h]) => `- ${id}: ${h}`).join("\n")}\n`;

const target = join(planDir, "31-cobertura-playwright.md");
writeFileSync(target, out);
console.log(`Escrito ${target}`);
