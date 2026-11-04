import { expect, test, type Page } from "@playwright/test";
import { t } from "../support/i18n";

// Spec 056: el código también se da con la cámara o escribiéndolo. En CI no hay cámara, así que aquí se cubre lo que sí
// se puede probar en un navegador real: la captura manual, el botón de cámara y el aviso cuando la cámara no está.
// La lectura con video se prueba en los componentes (detector simulado) y a mano en el quickstart de la spec.
const ANON = { cookies: [], origins: [] };
test.use({ storageState: ANON });

const ENTER = { timeout: 30_000 };
const STATIONERY = t("demo.entry.scenarios.basic_stationery");

async function enterStationery(page: Page) {
  await page.goto("/es/demo?plan=basic");
  await page.locator("label").filter({ hasText: new RegExp(`^${STATIONERY}`) }).click();
  await page.getByRole("button", { name: t("demo.entry.submit") }).click();
  await expect(page).toHaveURL(/\/es\/inicio$/, ENTER);
}

test.describe("escaneo con cámara o captura manual", () => {
  test("[ESC-001] escribir el número a mano, con espacios, agrega el producto igual que la pistola @pr", async ({ page }) => {
    await enterStationery(page);
    await page.goto("/es/venta");

    const field = page.getByLabel(t("inventory.scan.label"));
    await field.fill("  7509900000001  ");
    await field.press("Enter");
    await expect(page.getByText("Cuaderno profesional 100 hojas").first()).toBeVisible(ENTER);
    await expect(field).toHaveValue("");
  });

  test("[ESC-002] sin cámara disponible el botón explica el motivo y el campo manual sigue funcionando @pr", async ({ page, context }) => {
    await context.clearPermissions();
    await enterStationery(page);
    await page.goto("/es/venta");

    await page.getByRole("button", { name: t("scan.open") }).click();
    const dialog = page.getByRole("dialog", { name: t("scan.title") });
    await expect(dialog).toBeVisible();
    // Sin cámara real (o sin permiso) el diálogo lo dice en vez de quedarse en negro.
    await expect(dialog.getByRole("alert")).toBeVisible(ENTER);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    const field = page.getByLabel(t("inventory.scan.label"));
    await expect(field).toBeFocused();
    await field.fill("7509900000003");
    await field.press("Enter");
    await expect(page.getByText("Pluma azul").first()).toBeVisible();
  });
});
