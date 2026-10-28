import { expect, test } from "@playwright/test";
import { t } from "../support/i18n";
import { authFile, storageStatePath } from "../support/session";

// Spec 047: configurar WhatsApp desde el panel. Estas pruebas nunca conectan una cuenta real: el único intento de
// conectar usa una llave inventada y Meta (o la falta de red) lo rechaza, así que no queda nada guardado.
const tr = (key: string, values?: Record<string, string | number>) => t(`whatsapp.${key}`, values);

test.describe("super admin", () => {
  test.use({ storageState: authFile("super_admin-draxuvo") });

  test("[WAP-001] sin conexión: «No conectada», los tipos bloqueados con su motivo y el historial @pr", async ({ page }) => {
    await page.goto("/es/whatsapp");

    await expect(page.getByRole("heading", { name: tr("title"), level: 1 })).toBeVisible();
    await expect(page.getByText(tr("connection.status.not_connected"), { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: tr("connection.connect"), exact: true })).toBeVisible();

    // Interruptor general y uno por tipo, todos bloqueados mientras no haya conexión.
    await expect(page.getByRole("switch", { name: tr("channel.title") })).toBeDisabled();
    for (const kind of ["verification_code", "stock_alert", "ticket"]) {
      await expect(page.getByRole("switch", { name: tr("types.switchLabel", { type: tr(`types.${kind}.label`) }) })).toBeDisabled();
    }
    await expect(page.getByText(tr("types.blocked.not_connected"))).toHaveCount(3);

    await expect(page.getByRole("heading", { name: tr("history.title") })).toBeVisible();
  });

  test("[WAP-002] la guía de plantillas muestra los datos exactos y copia el nombre @pr", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/es/whatsapp");

    await page.getByRole("button", { name: tr("template.guideAll") }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(tr("guide.title"))).toBeVisible();
    await expect(dialog.getByText("UTILITY").first()).toBeVisible();
    await expect(dialog.getByText("stock_bajo", { exact: true })).toBeVisible();

    // Copiar el nombre de la plantilla de stock bajo (el segundo bloque de la guía).
    const stock = dialog.getByRole("region", { name: tr("types.stock_alert.label") });
    await stock.getByRole("button", { name: tr("guide.copy", { label: tr("guide.name") }) }).click();
    await expect(page.getByText(tr("guide.copied", { label: tr("guide.name") }))).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("stock_bajo");
  });

  test("[WAP-004] una llave inventada se rechaza con su motivo y no queda nada guardado @regresion", async ({ page }) => {
    // Llama a Meta de verdad (por eso va en regresión): con una llave inventada responde 190 (o no hay red).
    test.setTimeout(60_000);
    await page.goto("/es/whatsapp");

    await page.getByRole("button", { name: tr("connection.connect"), exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(tr("connection.dialog.token")).fill("EAAGllaveinventadaparaprobar0000");
    await dialog.getByLabel(tr("connection.dialog.phoneNumberId")).fill("104512345678901");
    await dialog.getByLabel(tr("connection.dialog.wabaId")).fill("109876543210987");
    await dialog.getByRole("button", { name: tr("connection.dialog.save") }).click();

    // El motivo sale en español: llave inválida, vencida o, sin red, que no se pudo contactar a Meta.
    await expect(dialog.getByRole("alert")).toContainText(
      new RegExp(
        [tr("reasons.invalid_token"), tr("reasons.token_expired"), tr("reasons.meta_unreachable")]
          .map((text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("|"),
      ),
      { timeout: 30_000 },
    );

    // Nada se guardó: al cerrar sigue «No conectada».
    await page.keyboard.press("Escape");
    await expect(page.getByText(tr("connection.status.not_connected"), { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(tr("connection.status.not_connected"), { exact: true })).toBeVisible();
  });
});

test.describe("dueño", () => {
  test.use({ storageState: storageStatePath("owner", "volta.demo") });

  test("[WAP-003] quien no es super admin no ve «WhatsApp» ni entra a la página @pr", async ({ page }) => {
    await page.goto("/es/inicio");
    await expect(page.getByRole("navigation").getByRole("link", { name: t("nav.whatsapp"), exact: true })).toHaveCount(0);

    await page.goto("/es/whatsapp");
    await expect(page.getByRole("heading", { name: tr("forbidden.title") })).toBeVisible();
    await expect(page.getByRole("button", { name: tr("connection.connect"), exact: true })).toHaveCount(0);
  });
});
