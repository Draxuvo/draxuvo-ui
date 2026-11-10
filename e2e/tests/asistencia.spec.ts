import { expect, test } from "@playwright/test";
import { createCompany, createStaff } from "../support/data";
import { storageStatePath } from "../support/session";
import { t } from "../support/i18n";

// Spec 026: el modal de entrada, el botón de salida y la lista con salida y duración.
// Usa su propia empresa y su propio personal: cerrar el turno de staff@volta dejaba el aviso «Marcar entrada» encima de
// las demás pruebas de ese usuario, que comparten la entrada abierta que deja global-setup (spec 060).

test.describe("asistencia explícita (spec 026)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("[ASI-001] el staff marca entrada desde el modal y salida desde el encabezado @regresion", async ({ page, request }, info) => {
    const company = await createCompany(request, { workerIndex: info.workerIndex, plan: "pro" });
    const staff = await createStaff(request, company);

    await page.goto("/es/login");
    await page.getByLabel(t("auth.email"), { exact: true }).fill(staff.email);
    await page.getByLabel(t("auth.password"), { exact: true }).fill(staff.password);
    await page.getByRole("button", { name: t("auth.submit") }).click();

    const dialog = page.getByRole("dialog", { name: t("attendance.entry.title") });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: t("attendance.entry.mark") }).click();
    await expect(dialog).toBeHidden();

    const out = page.getByRole("button", { name: /Marcar salida/ });
    await expect(out).toBeVisible();
    await out.click();
    await expect(page.getByRole("button", { name: t("attendance.status.markIn") })).toBeVisible();
  });
});

test.describe("lista de asistencia", () => {
  test.use({ storageState: storageStatePath("owner", "volta.demo") });

  test("[ASI-002] muestra salida y duración de los turnos @regresion", async ({ page }) => {
    await page.goto("/es/asistencia");
    await expect(page.getByRole("columnheader", { name: t("attendance.duration") })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: t("attendance.checkout") })).toBeVisible();
  });
});
