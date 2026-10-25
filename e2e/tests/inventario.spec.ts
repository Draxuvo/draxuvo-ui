import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { createCompany, uniquePrefix, type NewCompany } from "../support/data";
import { t } from "../support/i18n";
import { knownFailure } from "../support/known-failure";
import { API_URL, storageStatePath } from "../support/session";

const ANON = { cookies: [], origins: [] };
const menu = (page: Page) => page.getByRole("navigation", { name: t("nav.mainNav") });
const row = (page: Page, text: string) => page.getByRole("row").filter({ hasText: text });
/** Los botones de la fila no tienen nombre accesible (solo un tooltip): van en este orden. */
const action = (rowLocator: Locator, name: "entry" | "exit" | "edit" | "delete") =>
  rowLocator.getByRole("button").nth(["entry", "exit", "edit", "delete"].indexOf(name));
/** Campo de un formulario: la etiqueta no está ligada con `for`, así que se toma el input que le sigue. */
// Cantidades en piezas (spec 016): la etiqueta y la existencia llevan la unidad.
const QTY = () => t("inventory.quantityIn", { unit: "Pieza" });
/** Columna de existencia en la vista Todos: SKU, nombre, tipo, existencia. */
const STOCK_CELL = 4; // la columna 0 es la casilla de selección (spec 035)
const field = (scope: Locator, label: string) =>
  scope.getByText(label, { exact: true }).locator("xpath=following-sibling::input");

async function login(page: Page, email: string, password: string) {
  await page.goto("/es/login");
  await page.getByLabel(t("auth.email"), { exact: true }).fill(email);
  await page.getByLabel(t("auth.password"), { exact: true }).fill(password);
  await page.getByRole("button", { name: t("auth.submit") }).click();
}

/** Dueño de una empresa nueva (plan Básico, con inventario) y las cabeceras para llamar a la API como él. */
async function ownerOf(browser: Browser, company: NewCompany) {
  const context = await browser.newContext({ storageState: ANON });
  const page = await context.newPage();
  await login(page, company.email, company.password);
  await expect(page).toHaveURL(/\/es\/inicio$/);
  const companyId = await page.evaluate(() => localStorage.getItem("selected_company_id") ?? "");
  return { context, page, headers: { Authorization: `Bearer ${company.token}`, "X-Company-Id": companyId } };
}

/** Cabeceras de la sesión abierta en la página, para llamar a la API como ese usuario. */
async function apiHeaders(page: Page) {
  const { token, companyId } = await page.evaluate(() => ({
    token: localStorage.getItem("auth_token") ?? "",
    companyId: localStorage.getItem("selected_company_id") ?? "",
  }));
  return { Authorization: `Bearer ${token}`, "X-Company-Id": companyId };
}

async function createProduct(page: Page, product: { sku: string; name: string; stock?: number; minStock?: number }) {
  await page.getByRole("button", { name: t("inventory.new") }).click();
  const sheet = page.getByRole("dialog");
  // Spec 016: el tipo decide los campos. Las empresas nuevas son de servicio: "Refacción" se vende y se cuenta.
  await sheet.getByLabel(t("inventory.type")).selectOption({ label: "Refacción" });
  await sheet.getByPlaceholder(t("inventory.skuPlaceholder")).fill(product.sku);
  await sheet.getByPlaceholder(t("inventory.namePlaceholder")).fill(product.name);
  await field(sheet, t("inventory.stock")).fill(String(product.stock ?? 0));
  await field(sheet, t("inventory.minStock")).fill(String(product.minStock ?? 0));
  await sheet.getByRole("button", { name: t("common.save") }).click();
}

async function moveStock(page: Page, productRow: Locator, kind: "entry" | "exit", qty: number) {
  await action(productRow, kind).click();
  const dialog = page.getByRole("dialog");
  await field(dialog, QTY()).fill(String(qty));
  await dialog.getByRole("button", { name: t("inventory.confirm") }).click();
}

const csv = (rows: Array<[string, string, number, number]>) =>
  ["SKU,NOMBRE,PRECIO,STOCK", ...rows.map(([sku, name, price, stock]) => `${sku},${name},${price},${stock}`)].join("\n");

async function importFile(page: Page, name: string, content: string) {
  await page.getByRole("button", { name: t("inventory.importBtn") }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(t("inventory.importTitle"))).toBeVisible();
  await dialog.locator('input[type="file"]').setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.from(content) });
  await dialog.getByRole("button", { name: t("inventory.importConfirm") }).click();
  // La importación corre en segundo plano (spec 034): se espera el resumen y se cierra el diálogo.
  await expect(dialog.getByText(t("inventory.importDone"), { exact: false })).toBeVisible({ timeout: 60_000 });
  return dialog;
}

test("[FLU-03] el dueño importa productos, mueve stock y el historial cuadra @pr", async ({ browser, request }, info) => {
  test.setTimeout(120_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex });
  const prefix = uniquePrefix(info.workerIndex);
  const [a, b] = [`${prefix}-A`, `${prefix}-B`];
  const owner = await ownerOf(browser, company);
  const { page } = owner;

  // 1. Descarga la plantilla (INV-013) e importa dos productos (INV-014).
  await page.goto("/es/inventario");
  await page.getByRole("button", { name: t("inventory.importBtn") }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("dialog").getByRole("button", { name: t("inventory.importDownload") }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("plantilla_productos.xlsx");
  await page.getByRole("dialog").getByRole("button", { name: t("inventory.cancel") }).click();

  const done = await importFile(page, "productos.csv", csv([[a, `Tornillo ${a}`, 5, 10], [b, `Tuerca ${b}`, 2, 4]]));
  await done.getByRole("button", { name: t("inventory.importClose") }).click();

  // 2. La lista muestra cada producto con su existencia.
  await expect(row(page, a)).toContainText("10");
  await expect(row(page, b)).toContainText("4");

  // 3. Una entrada de 5 y una salida de 3 sobre el primero (INV-007, INV-008, INV-020).
  await moveStock(page, row(page, a), "entry", 5);
  await expect(page.getByText(t("inventory.entrySuccess"))).toBeVisible();
  await expect(row(page, a).getByRole("cell").nth(STOCK_CELL)).toHaveText("15 pza");
  await moveStock(page, row(page, a), "exit", 3);
  await expect(page.getByText(t("inventory.exitSuccess"))).toBeVisible();
  await expect(row(page, a).getByRole("cell").nth(STOCK_CELL)).toHaveText("12 pza");
  await expect(row(page, b).getByRole("cell").nth(STOCK_CELL)).toHaveText("4 pza");

  // 4. La pantalla no muestra el historial; se revisa por la API: la entrada y la salida están, y el stock cuadra.
  const found = await request.get(`${API_URL}/api/v1/products?search=${a}`, { headers: owner.headers });
  const productId = (await found.json()).results[0].id;
  const history = await request.get(`${API_URL}/api/v1/products/${productId}/stock_movements`, { headers: owner.headers });
  const movements: Array<{ movement_type: string; qty: number }> = (await history.json()).results;
  // La importación deja el stock inicial como una entrada (spec 034), además de la entrada y la salida manuales.
  expect(movements.map((m) => [m.movement_type, Number(m.qty)]).sort()).toEqual([["entry", 10], ["entry", 5], ["exit", 3]]);
  expect(10 + 5 - 3).toBe(12);
  await owner.context.close();
});

test("[INV-017] importar un archivo con filas malas informa cuántos entraron y qué falló @regresion", async ({ browser, request }, info) => {
  test.setTimeout(90_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex });
  const prefix = uniquePrefix(info.workerIndex);
  const owner = await ownerOf(browser, company);
  const { page } = owner;
  await page.goto("/es/inventario");

  // Un archivo que no es .xlsx, .xls ni .csv se rechaza al elegirlo.
  await page.getByRole("button", { name: t("inventory.importBtn") }).click();
  await page.getByRole("dialog").locator('input[type="file"]').setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("hola") });
  await expect(page.getByText(t("inventory.importInvalidFile"))).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: t("inventory.cancel") }).click();

  // Una fila válida y una sin SKU: entra la válida y el aviso dice cuántas (1) y qué falló.
  const dialog = await importFile(page, "mixto.csv", csv([[`${prefix}-OK`, `Bueno ${prefix}`, 5, 3], ["", "Sin SKU", 1, 1]]));
  await expect(dialog.getByText(t("inventory.importErrorRow", { row: 3 }))).toBeVisible();
  await expect(dialog.getByText(/SKU requerido/)).toBeVisible();
  await dialog.getByRole("button", { name: t("inventory.importClose") }).click();
  await expect(row(page, `${prefix}-OK`)).toBeVisible();
  await owner.context.close();
});

test.describe("administrador de Volta", () => {
  test.use({ storageState: storageStatePath("admin", "volta.demo") });

  test("[INV-018] las filas con stock bajo o agotadas llevan la etiqueta Stock bajo @regresion", async ({ page }) => {
    // H-22 se corrigió en la spec 016: la etiqueta usa la regla única de bajo inventario.
    await page.goto("/es/inventario");
    await expect(row(page, "FOC-09")).toBeVisible();
    await expect(row(page, "FOC-09")).toContainText(t("inventory.lowStockBadge"));
    await expect(row(page, "CON-02")).toContainText(t("inventory.lowStockBadge"));
    await expect(row(page, "CAB-12")).not.toContainText(t("inventory.lowStockBadge"));
  });

  test("[INV-018] lista, existencias, filtros excluyentes y búsqueda @regresion", async ({ page }) => {
    await page.goto("/es/inventario");
    await expect(page.getByRole("heading", { name: t("inventory.title") })).toBeVisible();
    for (const header of ["sku", "name", "stock", "unitCost", "actions"]) {
      await expect(page.getByRole("columnheader", { name: t(`inventory.${header}`) })).toBeVisible();
    }
    // El subtítulo cuenta los productos y el aviso de stock bajo trae el conteo real.
    await expect(page.getByText(/^\d+ productos/)).toBeVisible();
    const response = await page.request.get(`${API_URL}/api/v1/products?low_stock=true`, { headers: await apiHeaders(page) });
    const low: number = (await response.json()).info.total;
    expect(low).toBeGreaterThan(0);

    await page.getByRole("button", { name: t("analyticsBoard.subset.lowStock", { count: low }) }).click();
    await expect(page).toHaveURL(/low_stock=true/);
    await expect(page.getByRole("row")).toHaveCount(low + 1);

    // Los filtros de existencias son excluyentes: uno a la vez, y se guardan en la URL.
    const chip = (key: string) => page.getByRole("group", { name: t("inventory.filters.stock") }).getByRole("button", { name: t(`inventory.filters.${key}`) });
    await chip("outOfStock").click();
    await expect(page).toHaveURL(/out_of_stock=true/);
    await expect(page).not.toHaveURL(/low_stock/);
    await expect(chip("outOfStock")).toHaveAttribute("aria-pressed", "true");
    await expect(chip("lowStock")).toHaveAttribute("aria-pressed", "false");
    await chip("available").click();
    await expect(page).toHaveURL(/available=true/);
    await expect(page).not.toHaveURL(/out_of_stock/);
    await chip("all").click();
    await expect(page).not.toHaveURL(/available|low_stock|out_of_stock/);

    // Búsqueda por nombre o SKU, y "Limpiar filtros" la quita.
    await page.getByPlaceholder(t("inventory.searchPlaceholder")).fill("cable");
    await expect(page).toHaveURL(/search=cable/);
    await expect(row(page, "Cable THW")).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(2);
    await page.getByRole("button", { name: t("common.filters.clear") }).click();
    await expect(page).not.toHaveURL(/search=/);
    await expect(page.getByRole("row").nth(2)).toBeVisible();

    await page.getByPlaceholder(t("inventory.searchPlaceholder")).fill("zzz-no-existe");
    await expect(page.getByText(t("common.filters.noResults"))).toBeVisible();
  });
});

test.describe("dueño de Don Chuy", () => {
  test.use({ storageState: storageStatePath("owner", "donchuy.demo") });

  // Cuarentena (spec 010): falló o fue inestable en la primera corrida local. Arreglar o borrar en 14 días.
  test("[INV-019] crea, edita, no duplica el SKU y elimina un producto @pr @flaky", async ({ page }, info) => {
    const prefix = uniquePrefix(info.workerIndex);
    const sku = `${prefix}-PAN`;
    const name = `Pan de caja ${prefix}`;
    await page.goto("/es/inventario");

    // Sin SKU ni nombre no se guarda.
    await page.getByRole("button", { name: t("inventory.new") }).click();
    await page.getByRole("dialog").getByRole("button", { name: t("common.save") }).click();
    await expect(page.getByText(t("inventory.skuRequired"))).toBeVisible();
    await expect(page.getByText(t("inventory.nameRequired"))).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: t("inventory.cancel") }).click();

    await createProduct(page, { sku, name, stock: 8, minStock: 2 });
    await expect(page.getByText(t("inventory.createSuccess"))).toBeVisible();
    await expect(row(page, sku)).toContainText(name);

    // Edición: cambia el costo.
    await action(row(page, sku), "edit").click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText(t("inventory.editTitle"))).toBeVisible();
    await expect(sheet.getByPlaceholder(t("inventory.skuPlaceholder"))).toHaveValue(sku);
    await field(sheet, t("inventory.unitCost")).fill("12.5");
    await sheet.getByRole("button", { name: t("common.save") }).click();
    await expect(page.getByText(t("inventory.updateSuccess"))).toBeVisible();
    await expect(row(page, sku)).toContainText("$12.50");

    // Otro con el mismo SKU lo rechaza la API y no se duplica.
    await createProduct(page, { sku, name: `${name} copia` });
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(t("inventory.createSuccess"))).toHaveCount(0);
    await page.getByRole("dialog").getByRole("button", { name: t("inventory.cancel") }).click();
    await expect(row(page, sku)).toHaveCount(1);

    await action(row(page, sku), "delete").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(t("inventory.deleteConfirm", { name }))).toBeVisible();
    await dialog.getByRole("button", { name: t("common.delete") }).click();
    await expect(page.getByText(t("inventory.deleteSuccess"))).toBeVisible();
    await expect(row(page, sku)).toHaveCount(0);
  });
});

test("[INV-020] el dueño registra entradas y salidas desde la fila @pr", async ({ browser, request }, info) => {
  test.setTimeout(90_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex });
  const sku = uniquePrefix(info.workerIndex);
  const owner = await ownerOf(browser, company);
  const { page } = owner;
  await page.goto("/es/inventario");
  await createProduct(page, { sku, name: `Llave ${sku}`, stock: 3, minStock: 1 });
  await expect(row(page, sku)).toBeVisible();

  await action(row(page, sku), "entry").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(t("inventory.entryTitle", { name: `Llave ${sku}` }))).toBeVisible();
  await expect(dialog.getByText(t("inventory.currentStock", { stock: "3 pza" }))).toBeVisible();
  await field(dialog, QTY()).fill("0");
  await dialog.getByRole("button", { name: t("inventory.confirm") }).click();
  // El navegador frena el 0 (min=1) antes de que la pantalla muestre su propio aviso.
  expect(await field(dialog, QTY()).evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow)).toBe(true);
  await expect(page.getByText(t("inventory.entrySuccess"))).toHaveCount(0);
  await field(dialog, QTY()).fill("7");
  await dialog.getByRole("button", { name: t("inventory.confirm") }).click();
  await expect(page.getByText(t("inventory.entrySuccess"))).toBeVisible();
  await expect(row(page, sku).getByRole("cell").nth(STOCK_CELL)).toHaveText("10 pza");

  await moveStock(page, row(page, sku), "exit", 4);
  await expect(page.getByText(t("inventory.exitSuccess"))).toBeVisible();
  await expect(row(page, sku).getByRole("cell").nth(STOCK_CELL)).toHaveText("6 pza");
  await owner.context.close();
});

test("[INV-020] una salida mayor al stock se rechaza y el stock queda igual @pr", async ({ browser, request }, info) => {
  knownFailure("H-08");
  test.setTimeout(90_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex });
  const sku = uniquePrefix(info.workerIndex);
  const owner = await ownerOf(browser, company);
  const { page } = owner;
  await page.goto("/es/inventario");
  await createProduct(page, { sku, name: `Llave ${sku}`, stock: 3, minStock: 1 });
  await expect(row(page, sku)).toBeVisible();

  await moveStock(page, row(page, sku), "exit", 10);
  await expect(page.getByText(t("inventory.insufficientStock"))).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: t("common.cancel") }).click();
  await expect(row(page, sku).getByRole("cell").nth(STOCK_CELL)).toHaveText("3 pza");
  await owner.context.close();
});

test.describe("permisos por rol en inventario", () => {
  test.describe("staff", () => {
    test.use({ storageState: storageStatePath("staff", "volta.demo") });

    test("[INV-023] el staff no llega a /inventario @regresion", async ({ page }) => {
      await page.goto("/es/inventario").catch(() => {});
      await expect(page).toHaveURL(/\/es\/mis-ordenes$/);
    });
  });

  for (const role of ["admin", "owner"] as const) {
    test.describe(role, () => {
      test.use({ storageState: storageStatePath(role, "volta.demo") });

      test(`[INV-023] ${role} ve el menú y la pantalla completa @regresion`, async ({ page }) => {
        await page.goto("/es/inicio");
        await menu(page).getByRole("link", { name: t("nav.inventory") }).click();
        await expect(page).toHaveURL(/\/es\/inventario$/);
        await expect(page.getByRole("button", { name: t("inventory.new") })).toBeVisible();
        await expect(page.getByRole("button", { name: t("inventory.importBtn") })).toBeVisible();
        await expect(action(page.getByRole("row").nth(1), "delete")).toBeVisible();
        await expect(action(page.getByRole("row").nth(1), "edit")).toBeVisible();
      });
    });
  }
});
