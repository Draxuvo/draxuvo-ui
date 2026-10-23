import { expect, test, type Browser, type Page } from "@playwright/test";
import { createCompany, type NewCompany } from "../support/data";
import { t } from "../support/i18n";
import { API_URL } from "../support/session";

// Spec 034: códigos de barras, importación en segundo plano, recibir mercancía y conteo físico. La pistola USB
// escribe el código y termina con Enter; aquí se simula con `type` + Enter. Cada prueba crea su propia empresa
// (plan Básico: personal, asistencia e inventario) para no tocar datos demo.
const ANON = { cookies: [], origins: [] };

async function login(page: Page, company: NewCompany) {
  await page.goto("/es/login");
  await page.getByLabel(t("auth.email"), { exact: true }).fill(company.email);
  await page.getByLabel(t("auth.password"), { exact: true }).fill(company.password);
  await page.getByRole("button", { name: t("auth.submit") }).click();
  await expect(page).toHaveURL(/\/es\/inicio$/);
}

async function ownerOf(browser: Browser, company: NewCompany) {
  const context = await browser.newContext({ storageState: ANON });
  const page = await context.newPage();
  await login(page, company);
  const companyId = await page.evaluate(() => localStorage.getItem("selected_company_id") ?? "");
  const headers = { Authorization: `Bearer ${company.token}`, "X-Company-Id": companyId };
  return { context, page, headers };
}

/** Producto por API: las empresas nuevas son de servicio, así que con existencia se clasifica como "Refacción" (se cuenta). */
async function addProduct(page: Page, headers: Record<string, string>, product: { sku: string; name: string; stock: number; barcodes: string[] }) {
  const res = await page.request.post(`${API_URL}/api/v1/products`, {
    headers,
    data: { product: { sku: product.sku, name: product.name, stock: product.stock, min_stock: 1, unit_cost: 5, barcodes: product.barcodes } },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as { id: number };
}

async function stockOf(page: Page, headers: Record<string, string>, id: number) {
  const res = await page.request.get(`${API_URL}/api/v1/products/${id}`, { headers });
  return ((await res.json()) as { stock: number }).stock;
}

async function scan(page: Page, code: string) {
  await page.getByLabel(t("inventory.scan.label")).fill(code);
  await page.getByLabel(t("inventory.scan.label")).press("Enter");
}

test("[INV-021] un producto guarda varios códigos de barras y se encuentra por cualquiera @pr", async ({ browser, request }, info) => {
  test.setTimeout(120_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex });
  const { context, page, headers } = await ownerOf(browser, company);
  const code = `75${Date.now().toString().slice(-11)}`;
  const pack = `76${Date.now().toString().slice(-11)}`;
  await addProduct(page, headers, { sku: "BAR-1", name: "Cuaderno profesional", stock: 4, barcodes: [code, pack] });
  const other = await addProduct(page, headers, { sku: "BAR-2", name: "Otro", stock: 1, barcodes: [] });

  // La búsqueda del inventario encuentra por cualquiera de los códigos.
  await page.goto("/es/inventario");
  await page.getByPlaceholder(t("inventory.searchPlaceholder")).fill(pack);
  await expect(page.getByRole("row").filter({ hasText: "Cuaderno profesional" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Otro" })).toHaveCount(0);

  // Un código de otro producto se rechaza con el nombre de ese producto.
  const taken = await page.request.patch(`${API_URL}/api/v1/products/${other.id}`, { headers, data: { product: { barcodes: [code] } } });
  expect(taken.status()).toBe(422);
  expect((await taken.json()).error.details).toMatchObject({ code: "barcode_taken", product: { name: "Cuaderno profesional" } });
  await context.close();
});

test("[INV-022] recibir mercancía escaneando suma el stock de todos de una vez @pr", async ({ browser, request }, info) => {
  test.setTimeout(120_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex });
  const { context, page, headers } = await ownerOf(browser, company);
  const a = await addProduct(page, headers, { sku: "REC-1", name: "Lápiz", stock: 10, barcodes: ["7501000000011"] });
  const b = await addProduct(page, headers, { sku: "REC-2", name: "Goma", stock: 2, barcodes: ["7501000000028"] });

  await page.goto("/es/inventario/recibir");
  await scan(page, "7501000000011");
  await scan(page, "7501000000011");
  await scan(page, "7501000000028");
  await expect(page.getByLabel(t("inventory.receive.qty", { name: "Lápiz" }))).toHaveValue("2");
  await page.getByLabel(t("inventory.receive.qty", { name: "Goma" })).fill("5");

  // Un código que no existe ofrece crear el producto.
  await scan(page, "9999999999999");
  await expect(page.getByText(t("inventory.scan.unknownTitle"))).toBeVisible();
  await page.getByRole("button", { name: t("inventory.scan.unknownSkip") }).click();

  await page.getByRole("button", { name: t("inventory.receive.confirm") }).click();
  await expect(page.getByText(t("inventory.receive.empty"))).toBeVisible();

  expect(await stockOf(page, headers, a.id)).toBe(12);
  expect(await stockOf(page, headers, b.id)).toBe(7);
  const movements = await page.request.get(`${API_URL}/api/v1/products/${a.id}/stock_movements`, { headers });
  const first = ((await movements.json()) as { results: { movement_type: string; user: { name: string } | null }[] }).results[0];
  expect(first.movement_type).toBe("entry");
  expect(first.user?.name).toBeTruthy();
  await context.close();
});

test("[INV-023] el conteo físico se guarda como borrador, se retoma y ajusta lo contado @pr", async ({ browser, request }, info) => {
  test.setTimeout(150_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex });
  const { context, page, headers } = await ownerOf(browser, company);
  const a = await addProduct(page, headers, { sku: "CNT-1", name: "Regla", stock: 10, barcodes: ["7502000000011"] });
  const b = await addProduct(page, headers, { sku: "CNT-2", name: "Compás", stock: 6, barcodes: ["7502000000028"] });
  const untouched = await addProduct(page, headers, { sku: "CNT-3", name: "Escuadra", stock: 3, barcodes: ["7502000000035"] });

  await page.goto("/es/inventario/conteo");
  await page.getByRole("button", { name: t("inventory.count.start") }).click();
  await scan(page, "7502000000011");
  await scan(page, "7502000000011");
  await scan(page, "7502000000028");
  await expect(page.getByLabel(t("inventory.count.qty", { name: "Regla" }))).toHaveValue("2");

  // Lo contado quedó guardado: al recargar se retoma el mismo borrador.
  await page.reload();
  await expect(page.getByLabel(t("inventory.count.qty", { name: "Regla" }))).toHaveValue("2");
  await expect(page.getByLabel(t("inventory.count.qty", { name: "Compás" }))).toHaveValue("1");

  // Revisar muestra faltantes; no cambia el stock hasta confirmar.
  await page.getByRole("button", { name: t("inventory.count.review") }).click();
  await expect(page.getByText(t("inventory.count.shortage", { qty: 8 }))).toBeVisible();
  expect(await stockOf(page, headers, a.id)).toBe(10);

  await page.getByRole("button", { name: t("inventory.count.confirm") }).click();
  await page.getByRole("button", { name: t("inventory.count.confirmAdjust") }).click();
  await expect(page.getByText(t("inventory.count.confirmed")).first()).toBeVisible();

  expect(await stockOf(page, headers, a.id)).toBe(2);
  expect(await stockOf(page, headers, b.id)).toBe(1);
  expect(await stockOf(page, headers, untouched.id)).toBe(3);
  await context.close();
});

test("[INV-024] importar un Excel con códigos corre en segundo plano y deja el resumen @regresion", async ({ browser, request }, info) => {
  test.setTimeout(150_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex });
  const { context, page } = await ownerOf(browser, company);
  const csv = [
    "sku,name,stock,barcodes",
    'IMP-1,Marcador,5,"0012345678905; 7503000000011"',
    "IMP-2,Folder,3,7503000000028",
    ",Sin sku,1,",
  ].join("\n");

  await page.goto("/es/inventario");
  await page.getByRole("button", { name: t("inventory.importBtn") }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "catalogo.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: t("inventory.importConfirm"), exact: true }).click();

  await expect(page.getByText(t("inventory.importDone"), { exact: false })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(t("inventory.importErrorRow", { row: 4 }))).toBeVisible();
  await page.getByRole("button", { name: t("inventory.importClose") }).or(page.getByRole("button", { name: t("common.cancel") })).first().click();

  // Los códigos se conservan como texto, con el cero inicial.
  await page.getByPlaceholder(t("inventory.searchPlaceholder")).fill("0012345678905");
  await expect(page.getByRole("row").filter({ hasText: "Marcador" })).toBeVisible();
  await context.close();
});
