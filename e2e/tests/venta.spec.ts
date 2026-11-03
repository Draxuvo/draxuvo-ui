import { expect, test, type Page } from "@playwright/test";
import { t } from "../support/i18n";

// Punto de venta de mostrador (spec 050). Usan la demo de papelería, que ya trae el módulo contratado, inventario con
// códigos de barras y una semana de ventas; así no dependen de Stripe. Entran sin sesión, como un prospecto.
const ANON = { cookies: [], origins: [] };
test.use({ storageState: ANON });

// Aprovisionar la demo (con ventas, tickets y movimientos) tarda varios segundos en un CI lento.
const ENTER = { timeout: 30_000 };
const STATIONERY = t("demo.entry.scenarios.basic_stationery");

async function enterStationery(page: Page) {
  await page.goto("/es/demo?plan=basic");
  await page.locator("label").filter({ hasText: new RegExp(`^${STATIONERY}`) }).click();
  await page.getByRole("button", { name: t("demo.entry.submit") }).click();
  await expect(page).toHaveURL(/\/es\/inicio$/, ENTER);
}

const scan = async (page: Page, code: string) => {
  const field = page.getByLabel(t("inventory.scan.label"));
  await field.fill(code);
  await field.press("Enter");
};

test.describe("el punto de venta de mostrador", () => {
  test("[VEN-001] la demo de papelería trae Venta y Ventas en el menú y el módulo en Suscripción @pr", async ({ page }) => {
    await enterStationery(page);

    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: t("nav.pos"), exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: t("nav.sales"), exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: t("nav.orders"), exact: true })).toHaveCount(0);

    await page.goto("/es/suscripcion");
    await expect(page.getByRole("heading", { name: t("subscription.addons.title") })).toBeVisible();
    await expect(page.getByText(t("modules.pos")).first()).toBeVisible();
  });

  test("[VEN-002] escanear dos artículos, cobrar en efectivo con cambio y entregar el ticket @pr", async ({ page }) => {
    await enterStationery(page);
    await page.goto("/es/venta");

    // PAP-001 Cuaderno profesional ($42.00) y PAP-003 Pluma azul ($9.00), por código de barras.
    await scan(page, "7509900000001");
    await expect(page.getByText("Cuaderno profesional 100 hojas").first()).toBeVisible(ENTER);
    await scan(page, "7509900000003");
    await expect(page.getByText("Pluma azul").first()).toBeVisible();
    await scan(page, "7509900000003");

    const total = "$60.00";
    const charge = page.getByRole("button", { name: t("pos.charge.button", { total }) });
    await expect(charge).toBeEnabled();
    await charge.click();

    await page.getByLabel(t("workOrders.charge.received")).fill("100");
    await expect(page.getByText(`${t("workOrders.charge.change")}: $40.00`)).toBeVisible();
    await page.getByRole("button", { name: t("workOrders.charge.confirm") }).click();

    await expect(page.getByText(/T-\d+/).first()).toBeVisible(ENTER);
    await expect(page.getByRole("button", { name: t("pos.ticket.download") })).toBeVisible();
    await expect(page.getByLabel(t("pos.ticket.paper"))).toBeVisible();
    await page.getByRole("button", { name: t("pos.charge.newSale") }).click();
    await expect(page.getByRole("button", { name: t("pos.charge.button", { total: "$0.00" }) })).toBeDisabled();
  });

  test("[VEN-003] un código que no existe avisa y no deja un renglón @pr", async ({ page }) => {
    await enterStationery(page);
    await page.goto("/es/venta");

    await scan(page, "0000000000000");

    await expect(page.getByText(t("pos.errors.product_not_found"))).toBeVisible(ENTER);
    await expect(page.getByRole("button", { name: /^Cobrar/ })).toBeDisabled();
  });

  test("[VEN-004] la venta cobrada aparece en el historial y se puede cancelar con motivo @regresion", async ({ page }) => {
    await enterStationery(page);
    await page.goto("/es/venta");
    await scan(page, "7509900000001");
    await expect(page.getByText("Cuaderno profesional 100 hojas").first()).toBeVisible(ENTER);
    await page.getByRole("button", { name: /^Cobrar/ }).click();
    await page.getByLabel(t("workOrders.charge.received")).fill("100");
    await page.getByRole("button", { name: t("workOrders.charge.confirm") }).click();
    await expect(page.getByText(/T-\d+/).first()).toBeVisible(ENTER);

    await page.goto("/es/ventas");
    await page.getByRole("button", { name: /T-\d+/ }).first().click();
    await page.getByRole("button", { name: t("pos.history.cancel.button") }).click();
    await page.getByRole("button", { name: t("pos.history.cancel.confirm") }).click();
    await expect(page.getByText(t("pos.history.cancel.reasonRequired"))).toBeVisible();
    await page.getByLabel(t("pos.history.cancel.reason")).fill("Cliente devolvió");
    await page.getByRole("button", { name: t("pos.history.cancel.confirm") }).click();
    await expect(page.getByText(t("pos.history.cancel.done"))).toBeVisible();
  });

  test("[VEN-005] sin el módulo (demo de abarrotes) la caja muestra el bloqueo del plan @pr", async ({ page }) => {
    await page.goto("/es/demo?plan=basic");
    await page.getByRole("button", { name: t("demo.entry.submit") }).click();
    await expect(page).toHaveURL(/\/es\/inicio$/, ENTER);

    await page.goto("/es/venta");
    await expect(page.getByRole("heading", { name: t("subscription.moduleLocked") })).toBeVisible();
  });
});
