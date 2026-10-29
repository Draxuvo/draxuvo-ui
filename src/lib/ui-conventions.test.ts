import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

// Reglas de maquetación del panel (spec 049): un solo Select, y nombre accesible en botones de
// solo icono y en interruptores. Es un análisis de texto: barato y suficiente para que la regresión falle en CI.

const SRC = join(process.cwd(), "src")

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

const files = walk(SRC).filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
const read = (f: string) => readFileSync(f, "utf8")
const rel = (f: string) => relative(SRC, f)

/** Fin de la etiqueta de apertura que empieza en `start`: primer ">" fuera de llaves y comillas, que no sea "=>". */
function openingTagEnd(src: string, start: number): number {
  let depth = 0
  let quote: string | null = null
  for (let i = start; i < src.length; i++) {
    const c = src[i]
    if (quote) {
      if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'" || c === "`") quote = c
    else if (c === "{") depth++
    else if (c === "}") depth--
    else if (c === ">" && depth === 0 && src[i - 1] !== "=") return i
  }
  return -1
}

type Tag = { file: string; line: number; open: string; children: string | null }

function tagsOf(name: string, closing: string | null): Tag[] {
  const found: Tag[] = []
  const re = new RegExp(`<${name}(?=[\\s/>])`, "g")
  for (const file of files) {
    const src = read(file)
    for (const m of src.matchAll(re)) {
      const end = openingTagEnd(src, m.index!)
      if (end < 0) continue
      const open = src.slice(m.index!, end + 1)
      let children: string | null = null
      if (closing && !open.endsWith("/>")) {
        const close = src.indexOf(closing, end)
        children = close < 0 ? null : src.slice(end + 1, close)
      }
      found.push({ file, line: src.slice(0, m.index!).split("\n").length, open, children })
    }
  }
  return found
}

const named = (open: string) => /\baria-label(ledby)?=/.test(open) || /\{\.\.\.[a-zA-Z]*props\}/.test(open)
const where = (t: Tag) => `${rel(t.file)}:${t.line}`
/** Tiene `id="x"` y el mismo archivo declara `htmlFor="x"` (etiqueta visible asociada). */
const labelledById = (t: Tag) => {
  const id = /\bid="([^"]+)"/.exec(t.open)?.[1]
  return !!id && read(t.file).includes(`htmlFor="${id}"`)
}

describe("convenciones de maquetación del panel", () => {
  it("no hay <select> nativo fuera de components/ui/select.tsx", () => {
    const bad = files
      .filter((f) => !f.endsWith(join("components", "ui", "select.tsx")))
      .flatMap((f) => (read(f).split("\n").map((l, i) => ({ l, i })).filter(({ l }) => /<select[\s>]/.test(l) && !l.trim().startsWith("//")).map(({ i }) => `${rel(f)}:${i + 1}`)))
    expect(bad).toEqual([])
  })

  it("todo botón de solo icono declara aria-label", () => {
    const iconOnly = (t: Tag) => {
      if (t.children === null) return false
      const rest = t.children.replace(/<[A-Z][\w.]*\b[^>]*\/>/g, "").replace(/\s+/g, "")
      return rest === ""
    }
    const bad = [...tagsOf("Button", "</Button>"), ...tagsOf("button", "</button>")]
      .filter((t) => iconOnly(t) && !named(t.open))
      .map(where)
    expect(bad).toEqual([])
  })

  it("todo interruptor declara aria-label o aria-labelledby", () => {
    const bad = tagsOf("Switch", null).filter((t) => !named(t.open) && !labelledById(t)).map(where)
    expect(bad).toEqual([])
  })

  it("todo textarea tiene aria-label, aria-labelledby o un id para su etiqueta", () => {
    const bad = tagsOf("textarea", null).filter((t) => !named(t.open) && !labelledById(t)).map(where)
    expect(bad).toEqual([])
  })
})
