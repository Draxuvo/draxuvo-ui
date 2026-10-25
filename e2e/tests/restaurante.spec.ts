import { expect, test } from "@playwright/test";
import { t } from "../support/i18n";
import { storageStatePath } from "../support/session";

// Spec 032: Restaurante como centro del servicio. Sazón tiene seis mesas libres de arranque.
const tr = (key: string, values?: Record<string, string | number>) => t(`restaurant.${key}`, values);

test.describe("Sazón: administrador", () => {
  test.use({ storageState: storageStatePath("admin", "sazon.demo") });

  test("[RES-001] el administrador ve el servicio en vivo y la configuración @pr", async ({ page }) => {
    await page.goto("/es/restaurante");

    await expect(page.getByRole("heading", { name: tr("service.plan") })).toBeVisible();
    // Resumen vivo de las cuatro cifras y el plano con el estado de cada mesa en texto.
    const summary = page.getByRole("group", { name: tr("summary.title") }).or(page.locator("dl"));
    await expect(summary.getByText(tr("summary.openChecks"))).toBeVisible();
    await expect(page.getByRole("button", { name: /^Mesa \d+, Libre$/ }).first()).toBeVisible();
    // Configuración es de dueño y administrador.
    await expect(page.getByRole("tab", { name: tr("tabSettings") })).toBeVisible();
  });

  test("[RES-002] tocar una mesa libre abre su cuenta y la mesa pasa a ocupada @pr", async ({ page }) => {
    await page.goto("/es/restaurante");
    // La última mesa libre: los recorridos de pedido.spec usan la primera y pueden correr a la vez.
    const free = page.getByRole("button", { name: /^Mesa \d+, Libre$/ }).last();
    await expect(free).toBeVisible();
    const tableName = ((await free.getAttribute("aria-label")) ?? "").replace(/, Libre$/, "").replace(/^Mesa /, "");

    await free.click();
    await expect(page).toHaveURL(/\/es\/pedido\?cuenta=\d+&from=restaurante$/);
    await expect(page.getByRole("heading", { name: tableName, exact: true })).toBeVisible();

    // Vuelve al servicio: la mesa se ve ocupada; se libera para no dejar cuentas abiertas.
    await page.getByRole("button", { name: t("takeOrder.back") }).click();
    await expect(page).toHaveURL(/\/es\/restaurante$/);
    await expect(page.getByRole("button", { name: new RegExp(`^Mesa ${tableName}, ${t("restaurant.tile.occupied")}`) })).toBeVisible();
    await page.getByRole("button", { name: new RegExp(`^Mesa ${tableName}, ${t("restaurant.tile.occupied")}`) }).click();
    await page.getByRole("button", { name: t("takeOrder.release") }).click();
    await page.getByRole("button", { name: t("takeOrder.back") }).click();
    await expect(page.getByRole("button", { name: new RegExp(`^Mesa ${tableName}, ${t("restaurant.tile.free")}`) })).toBeVisible();
  });
});

test.describe("Sazón: dueño", () => {
  test.use({ storageState: storageStatePath("owner", "sazon.demo") });

  test("[RES-003] el dueño ve Servicio y Configuración, con el tipo de cada estación @pr", async ({ page }) => {
    await page.goto("/es/restaurante");
    await expect(page.getByRole("tab", { name: tr("tabService"), selected: true })).toBeVisible();

    await page.getByRole("tab", { name: tr("tabSettings") }).click();
    await expect(page.getByRole("heading", { name: tr("stations"), exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: tr("newStation") })).toBeVisible();
    // La barra se distingue de la cocina por su tipo.
    await expect(page.getByRole("img", { name: tr("stationKind.bar") })).toBeVisible();
    await expect(page.getByRole("heading", { name: tr("tables"), exact: true })).toBeVisible();
  });

  test("[RES-004] la barra y la cocina se distinguen en su pantalla @regresion", async ({ page }) => {
    await page.goto("/es/restaurante");
    await page.getByRole("tab", { name: tr("tabSettings") }).click();
    const open = page.getByRole("link", { name: tr("openScreen") });
    await expect(open.first()).toBeVisible();
    await open.first().evaluate((a) => a.removeAttribute("target"));
    await open.first().click();

    await expect(page.getByRole("list", { name: tr("station.summary") })).toBeVisible();
    await expect(page.getByRole("button", { name: /sonido/i })).toBeVisible();
  });
});
