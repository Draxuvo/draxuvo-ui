import { expect, test, type Browser, type Page } from "@playwright/test";
import { createCompany, type NewCompany } from "../support/data";
import { t } from "../support/i18n";
import { API_URL } from "../support/session";

// Spec 035: códigos de barras propios y etiquetas en PDF. Cada prueba crea su empresa (plan Básico) para no tocar datos demo.
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

async function addProduct(page: Page, headers: Record<string, string>, product: { sku: string; name: string; barcodes?: string[] }) {
  const res = await page.request.post(`${API_URL}/api/v1/products`, {
    headers,
    data: { product: { sku: product.sku, name: product.name, stock: 3, min_stock: 1, unit_cost: 5, price: 20, barcodes: product.barcodes ?? [] } },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as { id: number };
}

test("[INV-025] generar códigos en lote desde la selección da códigos propios únicos @pr", async ({ browser, request }, info) => {
  test.setTimeout(120_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex });
  const { context, page, headers } = await ownerOf(browser, company);
  const ids = [
    (await addProduct(page, headers, { sku: "ET-1", name: "Regla" })).id,
    (await addProduct(page, headers, { sku: "ET-2", name: "Tijeras" })).id,
    (await addProduct(page, headers, { sku: "ET-3", name: "Pegamento", barcodes: ["7501000000011"] })).id,
  ];

  await page.goto("/es/inventario");
  for (const name of ["Regla", "Tijeras", "Pegamento"]) await page.getByLabel(t("inventory.labels.selectRow", { name })).check();
  await page.getByRole("button", { name: t("inventory.labels.generateCodes") }).click();
  await page.getByRole("button", { name: "Generar 2 códigos" }).click();
  await expect(page.getByLabel(t("inventory.labels.generateSummary"))).toContainText("2");

  const codes: string[] = [];
  for (const id of ids) {
    const product = (await (await page.request.get(`${API_URL}/api/v1/products/${id}`, { headers })).json()) as { barcodes: string[] };
    codes.push(...product.barcodes);
  }
  const own = codes.filter((code) => code.startsWith("29"));
  expect(own).toHaveLength(2);
  for (const code of own) expect(code).toMatch(/^\d{13}$/);
  expect(new Set(codes).size).toBe(codes.length);
  expect(codes).toContain("7501000000011");
  await context.close();
});

test("[INV-026] imprimir etiquetas: vista previa, PDF del tamaño del formato y formato propio @pr", async ({ browser, request }, info) => {
  test.setTimeout(180_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex });
  const { context, page, headers } = await ownerOf(browser, company);
  await addProduct(page, headers, { sku: "PR-1", name: "Cuaderno", barcodes: ["7501000000011"] });
  await addProduct(page, headers, { sku: "PR-2", name: "Lápiz", barcodes: ["7501000000028"] });
  await addProduct(page, headers, { sku: "PR-3", name: "Goma", barcodes: ["7501000000035"] });

  await page.goto("/es/inventario");
  for (const name of ["Cuaderno", "Lápiz", "Goma"]) await page.getByLabel(t("inventory.labels.selectRow", { name })).check();
  await page.getByRole("button", { name: t("inventory.labels.printLabels") }).click();
  await expect(page).toHaveURL(/\/es\/inventario\/etiquetas$/);

  await page.getByLabel(t("inventory.labels.copiesOf", { name: "Cuaderno" })).fill("5");
  await page.getByLabel(t("inventory.labels.copiesOf", { name: "Lápiz" })).fill("2");
  await expect(page.getByText("8 etiquetas en total")).toBeVisible();

  // La vista previa es el mismo PDF que se descarga.
  const download = page.getByRole("link", { name: t("inventory.labels.download") });
  await expect(download).toBeVisible({ timeout: 30_000 });
  const href = await download.getAttribute("href");
  const pdf = await page.evaluate(async (url) => {
    const bytes = new Uint8Array(await (await fetch(url!)).arrayBuffer());
    return new TextDecoder("latin1").decode(bytes);
  }, href);
  expect(pdf.startsWith("%PDF")).toBe(true);
  expect(pdf).toMatch(/\/MediaBox\s*\[\s*0(\.0+)?\s+0(\.0+)?\s+(\d+(\.\d+)?)\s+(\d+(\.\d+)?)\s*\]/);

  // Un formato propio con medidas imposibles se rechaza; con medidas válidas se guarda.
  await page.getByRole("button", { name: t("inventory.labels.manageFormats") }).click();
  await page.getByRole("button", { name: t("inventory.labels.newFormat") }).first().click();
  await page.getByLabel(t("inventory.labels.formatName"), { exact: true }).fill("Imposible");
  await page.getByLabel(t("inventory.labels.field.columns")).fill("9");
  await page.getByRole("button", { name: t("inventory.labels.save"), exact: true }).click();
  await expect(page.getByRole("alert").last()).toBeVisible();

  await page.getByLabel(t("inventory.labels.formatName"), { exact: true }).fill("Mi hoja");
  await page.getByLabel(t("inventory.labels.field.columns")).fill("3");
  await page.getByRole("button", { name: t("inventory.labels.save"), exact: true }).click();
  await expect(page.getByRole("button", { name: t("inventory.labels.editFormatAria", { name: "Mi hoja" }) })).toBeVisible();
  await context.close();
});
