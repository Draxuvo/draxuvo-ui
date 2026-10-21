import { expect, test } from "@playwright/test";
import { t } from "../support/i18n";
import { storageStatePath } from "../support/session";

// Spec 018: la pantalla visual para tomar pedido. Restaurante Sazón tiene mesas, así que trabaja con cuentas.
const tk = (key: string, values?: Record<string, string | number>) => t(`takeOrder.${key}`, values);

test.describe("Sazón (mesas)", () => {
  test.use({ storageState: storageStatePath("manager", "sazon.demo") });

  test("[PED-001] elegir una mesa, armar la orden con tarjetas, mandar y cobrar @pr", async ({ page }) => {
    test.setTimeout(120_000);
    // Tomar pedido vive dentro de Restaurante (spec 019): menú lateral → Restaurante → botón.
    await page.goto("/es/inicio");
    await page.getByRole("link", { name: t("nav.restaurant"), exact: true }).first().click();
    await page.getByRole("link", { name: tk("title"), exact: true }).click();
    await expect(page).toHaveURL(/\/es\/pedido\?from=restaurante$/);

    // Plano: una mesa libre con su estado en texto. Al tocarla se abre su cuenta en la misma pantalla.
    const free = page.getByRole("button", { name: /, Libre$/ }).first();
    await expect(free).toBeVisible();
    const tableName = ((await free.getAttribute("aria-label")) ?? "").replace(/, Libre$/, "");
    await free.click();
    await expect(page.getByRole("heading", { name: tableName, exact: true })).toBeVisible();
    await expect(page.getByText(tk("orderEmpty"))).toBeVisible();

    // Menú de tarjetas: tocar dos veces el mismo producto sube la cantidad y la tarjeta la muestra.
    const card = page.locator('button[aria-label$="agregar"]:not([disabled])').first();
    await card.click();
    await expect(card.locator("span[aria-label$='en la orden']")).toHaveText("1");
    await card.click();
    await expect(card.locator("span[aria-label$='en la orden']")).toHaveText("2");

    // La orden sube y baja la cantidad sin salir de la pantalla.
    await page.getByRole("button", { name: /^Quitar una unidad de / }).click();
    await expect(card.locator("span[aria-label$='en la orden']")).toHaveText("1");
    await page.getByRole("button", { name: /^Agregar una unidad de / }).click();
    await expect(card.locator("span[aria-label$='en la orden']")).toHaveText("2");

    // Mandar a cocina: los renglones pasan a "Ya mandado".
    await page.getByRole("button", { name: tk("send"), exact: true }).click();
    await expect(page.getByText(tk("sentSection"))).toBeVisible();

    // Cobrar en efectivo; si la cocina no ha entregado, se confirma el cobro.
    await page.getByRole("button", { name: tk("charge"), exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(tk("pay.received")).fill("5000");
    await dialog.getByRole("button", { name: tk("pay.confirm") }).click();
    const anyway = dialog.getByRole("button", { name: tk("pay.chargeAnyway") });
    await expect(anyway.or(dialog.getByText(/^Ticket /))).toBeVisible();
    if (await anyway.isVisible()) await anyway.click();
    await expect(dialog.getByText(/^Ticket T-/)).toBeVisible();
    await dialog.getByRole("button", { name: tk("pay.close") }).click();

    // La mesa quedó libre de nuevo.
    await expect(page.getByRole("button", { name: `${tableName}, ${tk("free")}` })).toBeVisible();
  });

  test("[PED-003] el menú lateral no tiene la entrada suelta y volver regresa a Restaurante @pr", async ({ page }) => {
    await page.goto("/es/restaurante");
    await expect(page.getByRole("link", { name: tk("title"), exact: true })).toHaveCount(1); // el botón de la página
    await expect(page.getByRole("navigation").getByRole("link", { name: tk("title"), exact: true })).toHaveCount(0);

    await page.getByRole("link", { name: tk("title"), exact: true }).click();
    await page.getByRole("button", { name: tk("back") }).click();
    await expect(page).toHaveURL(/\/es\/restaurante$/);

    // La dirección escrita a mano sigue funcionando y vuelve a Órdenes.
    await page.goto("/es/pedido");
    await expect(page.getByRole("heading", { name: tk("title") })).toBeVisible();
    await page.getByRole("button", { name: tk("back") }).click();
    await expect(page).toHaveURL(/\/es\/ordenes$/);
  });

  test.describe("teléfono", () => {
    test.use({ viewport: { width: 390, height: 800 } });

    test("[PED-002] en pantalla chica se alternan Mesas, Orden y Menú @regresion", async ({ page }) => {
      await page.goto("/es/pedido");
      const tabs = page.getByRole("navigation", { name: tk("title") });
      await expect(tabs.getByRole("button", { name: tk("tables") })).toBeVisible();
      await expect(page.getByLabel(tk("search"))).toBeHidden();

      await tabs.getByRole("button", { name: tk("menu") }).click();
      await expect(page.getByLabel(tk("search"))).toBeVisible();
      await tabs.getByRole("button", { name: tk("order") }).click();
      await expect(page.getByText(tk("pickTable"))).toBeVisible();
    });
  });
});
