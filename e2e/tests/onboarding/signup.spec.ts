import { expect, test, type Page } from "@playwright/test";
import { createCompany, E2E_PASSWORD, uniquePrefix } from "../../support/data";
import { t } from "../../support/i18n";
import { expiredPasswordToken, passwordToken } from "../../support/tokens";

test.use({ storageState: { cookies: [], origins: [] } });

async function fillSignup(page: Page, prefix: string, email: string) {
  await page.getByPlaceholder(t("registration.placeholders.first_name")).fill("E2E");
  await page.getByPlaceholder(t("registration.placeholders.last_name")).fill(prefix);
  await page.getByPlaceholder(t("registration.placeholders.phone")).fill("55 1234 5678");
  await page.getByPlaceholder(t("registration.placeholders.email")).fill(email);
  await page.getByPlaceholder(t("registration.placeholders.password")).fill(E2E_PASSWORD);
  await page.getByPlaceholder(t("registration.placeholders.company_name")).fill(`Empresa ${prefix}`);
  await page.getByRole("button", { name: t("registration.submit") }).click();
}

test("[FLU-01][AUT-011] alta de empresa con plan sugerido: el dueño entra y su prueba corre @pr", async ({ page }, info) => {
  const prefix = uniquePrefix(info.workerIndex);

  // [AUT-011] El plan y el ciclo sugeridos vienen marcados; la nota de la prueba se ve.
  await page.goto("/es/registro?plan=enterprise&ciclo=anual");
  await expect(page.getByRole("radio", { name: new RegExp(t("plans.enterprise")) })).toBeChecked();
  await expect(page.getByRole("radio", { name: new RegExp(t("plans.annual")) })).toBeChecked();
  await expect(page.getByText(t("registration.trialNote"))).toBeVisible();

  await fillSignup(page, prefix, `${prefix}@mailinator.com`);
  await expect(page).toHaveURL(/\/es\/inicio$/);
  await expect(page.getByText(t("home.shortcuts"))).toBeVisible();

  // Estado final: la suscripción está en prueba.
  await page.goto("/es/suscripcion");
  await expect(page.getByText(/prueba/i).first()).toBeVisible();
});

test("[AUT-013] el registro valida cada campo sin llamar a la API @regresion", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/registrations")) calls.push(r.url());
  });
  await page.goto("/es/registro");
  await page.getByRole("button", { name: t("registration.submit") }).click();
  for (const key of ["first_nameRequired", "last_nameRequired", "phoneRequired", "emailInvalid", "passwordMin", "company_nameRequired"]) {
    await expect(page.getByText(t(`registration.errors.${key}`))).toBeVisible();
  }
  await page.getByPlaceholder(t("registration.placeholders.email")).fill("sin-arroba");
  await page.getByPlaceholder(t("registration.placeholders.password")).fill("12345");
  await page.getByRole("button", { name: t("registration.submit") }).click();
  await expect(page.getByText(t("registration.errors.emailInvalid"))).toBeVisible();
  await expect(page.getByText(t("registration.errors.passwordMin"))).toBeVisible();
  expect(calls).toHaveLength(0);
});

test("[AUT-014] un correo ya registrado no crea nada y marca el campo @regresion", async ({ page }) => {
  await page.goto("/es/registro");
  await fillSignup(page, "dup", "dueno@volta.demo");
  await expect(page.getByText(t("registration.emailTaken"))).toBeVisible();
  await expect(page).toHaveURL(/\/es\/registro/);
});

test.describe("enlace de contraseña", () => {
  test("[AUT-022] sin token o con token vencido el enlace se rechaza @regresion", async ({ page, request }, info) => {
    await page.goto("/es/set-password");
    await expect(page.getByText(t("setPassword.invalidLinkTitle"))).toBeVisible();

    const company = await createCompany(request, { workerIndex: info.workerIndex });
    const user = { id: company.userId, email: company.email, fullName: "E2E" };
    await page.goto(`/es/set-password?token=${encodeURIComponent(expiredPasswordToken(user))}`);
    await page.getByPlaceholder("••••••••").first().fill("NuevaClave123*");
    await page.getByPlaceholder("••••••••").nth(1).fill("NuevaClave123*");
    await page.getByRole("button", { name: t("setPassword.submit") }).click();
    await expect(page.getByText(t("setPassword.successTitle"))).toHaveCount(0);
    await expect(page).toHaveURL(/set-password/);
  });

  // Cuarentena (spec 010): inestable en la regresión local. Arreglar o borrar en 14 días.
  test("[AUT-022] la contraseña nueva se valida, se guarda y permite entrar @regresion @flaky", async ({ page, request }, info) => {
    const company = await createCompany(request, { workerIndex: info.workerIndex });
    const user = { id: company.userId, email: company.email, fullName: "E2E" };
    await page.goto(`/es/set-password?token=${encodeURIComponent(passwordToken(user))}`);

    await page.getByRole("button", { name: t("setPassword.submit") }).click();
    await expect(page.getByText(t("setPassword.passwordMin")).first()).toBeVisible();
    await expect(page.getByText(t("setPassword.confirmRequired"))).toBeVisible();

    await page.getByPlaceholder("••••••••").first().fill("NuevaClave123*");
    await page.getByPlaceholder("••••••••").nth(1).fill("Otra123456*");
    await page.getByRole("button", { name: t("setPassword.submit") }).click();
    await expect(page.getByText(t("setPassword.passwordMismatch"))).toBeVisible();

    await page.getByPlaceholder("••••••••").nth(1).fill("NuevaClave123*");
    await page.getByRole("button", { name: t("setPassword.submit") }).click();
    await expect(page.getByText(t("setPassword.successTitle"))).toBeVisible();
    await expect(page).toHaveURL(/\/es\/login/, { timeout: 8000 });

    await page.getByLabel(t("auth.email"), { exact: true }).fill(company.email);
    await page.getByLabel(t("auth.password"), { exact: true }).fill("NuevaClave123*");
    await page.getByRole("button", { name: t("auth.submit") }).click();
    await expect(page).toHaveURL(/\/es\/inicio$/);
  });
});
