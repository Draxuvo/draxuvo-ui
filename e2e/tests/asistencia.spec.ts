import { expect, test } from "@playwright/test";
import { API_URL, DEMO_PASSWORD, storageStatePath } from "../support/session";
import { t } from "../support/i18n";

// Spec 026: el modal de entrada, el botón de salida y la lista con salida y duración.
// Usa una sesión propia (sin la entrada que deja global-setup) del staff de Volta.

test.describe("asistencia explícita (spec 026)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("[ASI-001] el staff marca entrada desde el modal y salida desde el encabezado @regresion", async ({ page, request }) => {
    const login = await request.post(`${API_URL}/api/v1/auth/login`, { data: { email: "staff@volta.demo", password: DEMO_PASSWORD } });
    expect(login.ok()).toBeTruthy();
    const { token, user } = await login.json();
    const company = user.companies[0].id;
    const headers = { Authorization: `Bearer ${token}`, "X-Company-Id": String(company) };
    // Sin turno abierto: si quedó uno de una corrida anterior, se cierra.
    await request.post(`${API_URL}/api/v1/my_attendance/check_out`, { headers, failOnStatusCode: false });

    await page.goto("/es/login");
    await page.getByLabel(t("auth.email"), { exact: true }).fill("staff@volta.demo");
    await page.getByLabel(t("auth.password"), { exact: true }).fill(DEMO_PASSWORD);
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
