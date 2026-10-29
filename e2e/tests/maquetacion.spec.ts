import { expect, test, type Page } from "@playwright/test";
import { storageStatePath } from "../support/session";
import { SUPER_ADMIN_SESSION, authFile } from "../support/session";

// Spec 049: controles de la misma altura por fila, nombre accesible y objetivos táctiles de 40 px en móvil.

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

/** Pantallas del panel con filtros, tablas y formularios que cubre la spec. */
const SCREENS: { name: string; path: string; state: string }[] = [
  { name: "órdenes", path: "/es/ordenes", state: storageStatePath("admin", "volta.demo") },
  { name: "inventario", path: "/es/inventario", state: storageStatePath("owner", "sazon.demo") },
  { name: "personal", path: "/es/personal", state: storageStatePath("owner", "sazon.demo") },
  { name: "suscripción", path: "/es/suscripcion", state: storageStatePath("owner", "sazon.demo") },
  { name: "empresas", path: "/es/empresas", state: authFile(SUPER_ADMIN_SESSION.key) },
  { name: "usuarios", path: "/es/usuarios", state: authFile(SUPER_ADMIN_SESSION.key) },
];

async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });
  const later = page.getByRole("button", { name: /Ahora no/ });
  if (await later.count()) await later.first().click().catch(() => {});
}

/** Controles interactivos visibles sin nombre accesible. */
async function unnamedControls(page: Page) {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 2 && r.height > 2 && cs.visibility !== "hidden" && cs.display !== "none";
    };
    return [...document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [role=switch], [role=tab]")]
      .filter(visible)
      .filter((el) => {
        const named =
          el.getAttribute("aria-label") ||
          el.getAttribute("aria-labelledby") ||
          (el.textContent || "").trim() ||
          el.getAttribute("title") ||
          (el.id && document.querySelector(`label[for="${el.id}"]`)) ||
          el.closest("label");
        return !named && !(el.tagName === "INPUT" && el.getAttribute("placeholder"));
      })
      .map((el) => el.outerHTML.slice(0, 120));
  });
}

/** Controles cuyo lado menor mide menos de `min` px. Excluye el enlace estirado de las tarjetas (toda la tarjeta es el objetivo)
 * y los interruptores, cuya área táctil se amplía con un pseudo-elemento en móvil. */
async function smallTargets(page: Page, min: number) {
  return page.evaluate((limit) => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 2 && r.height > 2 && cs.visibility !== "hidden" && cs.display !== "none";
    };
    return [...document.querySelectorAll("button, select, input:not([type=hidden]), textarea, a[href]")]
      .filter(visible)
      .filter((el) => !el.matches("[data-main], [role=switch]"))
      .filter((el) => !(el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio") && el.closest("label")))
      .filter((el) => Math.min(el.getBoundingClientRect().width, el.getBoundingClientRect().height) < limit - 0.5)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)}" ${Math.round(r.width)}x${Math.round(r.height)}`;
      });
  }, min);
}

const heightOf = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => Math.round(el.getBoundingClientRect().height * 10) / 10);

for (const [label, viewport, expected] of [
  ["escritorio", DESKTOP, 36],
  ["móvil", MOBILE, 40],
] as const) {
  test.describe(`maquetación en ${label}`, () => {
    test.use({ viewport, hasTouch: label === "móvil", isMobile: label === "móvil" });

    test.describe("administrador de Volta", () => {
      test.use({ storageState: storageStatePath("admin", "volta.demo") });

      test(`[MAQ-001] buscador y filtros de órdenes miden ${expected} px @pr`, async ({ page }) => {
        await open(page, "/es/ordenes");
        const search = await heightOf(page, "input[type=search]");
        const selects = await page.locator("select").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height * 10) / 10));
        expect(selects.length).toBeGreaterThanOrEqual(2);
        expect([search, ...selects]).toEqual(Array(selects.length + 1).fill(expected));
      });
    });

    test.describe("dueño de Sazón", () => {
      test.use({ storageState: storageStatePath("owner", "sazon.demo") });

      test(`[MAQ-002] buscador y chips de personal miden ${expected} px @pr`, async ({ page }) => {
        await open(page, "/es/personal");
        const search = await heightOf(page, "input[type=search]");
        const chips = await page.locator("button[aria-pressed]").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height * 10) / 10));
        expect(chips.length).toBeGreaterThan(0);
        expect([search, ...chips]).toEqual(Array(chips.length + 1).fill(expected));
      });

      test(`[MAQ-003] formulario de producto: input y selects miden ${expected} px @pr`, async ({ page }) => {
        await open(page, "/es/inventario");
        await page.getByRole("button", { name: /Nuevo producto/ }).first().click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        const heights = await dialog.locator("input:not([type=hidden]):not([type=checkbox]), select").evaluateAll((els) =>
          els.filter((el) => el.getBoundingClientRect().height > 0).map((el) => Math.round(el.getBoundingClientRect().height * 10) / 10),
        );
        expect(heights.length).toBeGreaterThan(2);
        expect(heights).toEqual(Array(heights.length).fill(expected));
      });
    });
  });
}

test.describe("accesibilidad y toques", () => {
  for (const screen of SCREENS) {
    test.describe(screen.name, () => {
      test.use({ storageState: screen.state });

      test(`[MAQ-010] ${screen.name}: ningún control sin nombre @pr`, async ({ page }) => {
        await open(page, screen.path);
        expect(await unnamedControls(page)).toEqual([]);
      });

      test(`[MAQ-011] ${screen.name}: un solo h1 @pr`, async ({ page }) => {
        await open(page, screen.path);
        await expect(page.locator("h1")).toHaveCount(1);
      });

      test(`[MAQ-012] ${screen.name}: sin controles menores a 40 px en móvil @pr`, async ({ browser }) => {
        const context = await browser.newContext({ storageState: screen.state, viewport: MOBILE, hasTouch: true, isMobile: true, locale: "es-MX" });
        const page = await context.newPage();
        await open(page, screen.path);
        expect(await smallTargets(page, 40)).toEqual([]);
        await context.close();
      });
    });
  }
});
