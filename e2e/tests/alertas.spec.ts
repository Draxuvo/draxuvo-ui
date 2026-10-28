import { expect, test } from "@playwright/test";
import { t } from "../support/i18n";
import { storageStatePath } from "../support/session";

// Spec 045: alertas operativas. Sazón (Empresa) trae productos con stock bajo en los datos de demo, así que siempre hay alertas.
// Estas pruebas no cambian datos del negocio (salvo ALR-004, que restaura el valor).
const tr = (key: string, values?: Record<string, string | number>) => t(`alerts.${key}`, values);

test.describe("Sazón: dueño", () => {
  test.use({ storageState: storageStatePath("owner", "sazon.demo") });

  test("[ALR-001] la campana del encabezado muestra el conteo y lleva a Alertas @pr", async ({ page }) => {
    await page.goto("/es/inicio");

    const bell = page.getByRole("link", { name: /^Alertas, \d+ activas$/ });
    await expect(bell).toBeVisible();
    await expect(page.getByTestId("alert-count")).toBeVisible();

    await bell.click();
    await expect(page).toHaveURL(/\/es\/alertas$/);
    await expect(page.getByRole("heading", { name: tr("title"), level: 1 })).toBeVisible();
  });

  test("[ALR-002] el stock bajo se lista con su existencia y no se puede posponer @pr", async ({ page }) => {
    await page.goto("/es/alertas");

    const rows = page.locator('li[data-kind="low_stock"]');
    await expect(rows.first()).toBeVisible();
    await expect(rows.first().getByText(/^Existencia .* · Mínimo /)).toBeVisible();
    await expect(rows.first().getByRole("button", { name: tr("snooze.action") })).toHaveCount(0);
    // Abre el producto en el inventario.
    await expect(rows.first().getByRole("link", { name: tr("open") })).toHaveAttribute("href", /\/es\/inventario\?search=/);
  });

  test("[ALR-003] Configuración muestra los tiempos por tipo de estación y 'Mis avisos' @pr", async ({ page }) => {
    await page.goto("/es/alertas");
    await page.getByRole("tab", { name: tr("tabs.settings") }).click();

    await expect(page.getByRole("heading", { name: tr("settings.title") })).toBeVisible();
    await expect(page.getByLabel(tr("settings.stations.bar"), { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel("Mesa abierta")).toBeVisible();
    await expect(page.getByLabel(tr("settings.summaryHour"))).toBeVisible();
    await expect(page.getByRole("switch", { name: tr("mine.email") })).toBeChecked();
    await expect(page.getByRole("switch", { name: tr("mine.whatsapp") })).toBeVisible();
  });

  test("[ALR-004] un límite inválido se rechaza y uno válido se guarda y se restaura @regresion", async ({ page }) => {
    await page.goto("/es/alertas");
    await page.getByRole("tab", { name: tr("tabs.settings") }).click();

    const field = page.getByLabel("Mesa abierta");
    const original = await field.inputValue();
    const save = page.getByRole("button", { name: tr("settings.save") });

    await field.fill("0");
    await expect(page.getByText(tr("settings.range")).first()).toBeVisible();
    await expect(save).toBeDisabled();

    await field.fill(original === "45" ? "46" : "45");
    await save.click();
    await expect(page.getByText(tr("settings.saved"))).toBeVisible();

    // Se deja como estaba para no afectar otras corridas.
    await field.fill(original);
    await save.click();
    await expect(page.getByLabel("Mesa abierta")).toHaveValue(original);
  });
});

test.describe("Sazón: personal", () => {
  test.use({ storageState: storageStatePath("staff", "sazon.demo") });

  test("[ALR-005] el personal no tiene campana ni entra a Alertas @pr", async ({ page }) => {
    await page.goto("/es/mis-ordenes");
    await expect(page.getByRole("link", { name: /^Alertas/ })).toHaveCount(0);

    await page.goto("/es/alertas");
    await expect(page).toHaveURL(/\/es\/mis-ordenes/);
  });
});

test.describe("Don Chuy (Básico)", () => {
  test.use({ storageState: storageStatePath("owner", "donchuy.demo") });

  test("[ALR-006] en el plan Básico solo hay alertas de stock bajo y no se configuran tiempos de comanda @regresion", async ({ page }) => {
    await page.goto("/es/alertas");
    await expect(page.locator('li[data-kind]:not([data-kind="low_stock"])')).toHaveCount(0);

    await page.getByRole("tab", { name: tr("tabs.settings") }).click();
    await expect(page.getByText(tr("settings.sections.summary"))).toBeVisible();
    await expect(page.getByText(tr("settings.sections.kitchen_wait"))).toHaveCount(0);
    await expect(page.getByText(tr("settings.sections.table_open"))).toHaveCount(0);
  });
});
