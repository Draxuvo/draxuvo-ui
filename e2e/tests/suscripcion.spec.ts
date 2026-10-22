import { expect, test, type Browser, type Page } from "@playwright/test";
import { createCompany, uniquePrefix, type NewCompany } from "../support/data";
import { t } from "../support/i18n";
import { API_URL, storageStatePath } from "../support/session";
import { FAKE_CHECKOUT_URL, FAKE_PORTAL_URL, mockStripeRedirects, sendWebhook } from "../support/stripe";

const ANON = { cookies: [], origins: [] };
const sub = (key: string, values?: Record<string, string | number>) => t(`subscription.${key}`, values);
/** Un texto con marcadores ({days}, {date}) como expresión regular: cada marcador acepta cualquier valor. */
const pattern = (key: string) =>
  new RegExp(sub(key, { days: "\\d+", date: ".+" }).replace(/[()]/g, "\\$&"));

async function login(page: Page, email: string, password: string) {
  await page.goto("/es/login");
  await page.getByLabel(t("auth.email"), { exact: true }).fill(email);
  await page.getByLabel(t("auth.password"), { exact: true }).fill(password);
  await page.getByRole("button", { name: t("auth.submit") }).click();
}

async function ownerOf(browser: Browser, company: NewCompany) {
  const context = await browser.newContext({ storageState: ANON });
  const page = await context.newPage();
  await login(page, company.email, company.password);
  await expect(page).toHaveURL(/\/es\/inicio$/);
  return { context, page };
}

/** Responde GET /subscription con lo que devuelve la API, cambiando solo los campos dados. */
async function overrideSubscription(page: Page, patch: () => Record<string, unknown>) {
  await page.route("**/api/v1/subscription", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), ...patch() } });
  });
}

const payButton = (page: Page, plan: string) => page.getByRole("button", { name: t("plans.payPlan", { plan: t(`plans.${plan}`) }) });
const planCard = (page: Page, plan: string) => page.getByRole("button", { name: new RegExp(`^${t(`plans.${plan}`)}`) });

test("[SUS-018] en prueba: banner, estado, plan fijo, ciclo y salida al checkout @pr", async ({ browser, request }, info) => {
  test.setTimeout(90_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex, plan: "pro" });
  const { context, page } = await ownerOf(browser, company);
  await mockStripeRedirects(page);

  await expect(page.getByText(pattern("trialBannerDays"))).toBeVisible();
  await expect(page.getByRole("link", { name: sub("trialBannerAction") })).toBeVisible();

  await page.goto("/es/suscripcion");
  await expect(page.getByText(sub("trialing"), { exact: true })).toBeVisible();
  await expect(page.getByText(sub("trialStatus"))).toBeVisible();
  await expect(page.getByText(pattern("trialDaysLeft"))).toBeVisible();
  await expect(page.getByText(pattern("trialUntil"))).toBeVisible();

  // El plan asignado queda fijo (spec 031): los demás no se pueden elegir; los precios salen sin IVA, con IVA 16 % y total.
  await expect(page.getByText(t("plans.ivaRate", { rate: 16 }))).toHaveCount(3);
  await expect(page.getByText(t("plans.annualNote"))).toBeVisible();
  await expect(page.getByText(sub("trialPlanLocked"))).toBeVisible();
  await expect(planCard(page, "basic")).toBeDisabled();
  await expect(planCard(page, "enterprise")).toBeDisabled();
  await expect(planCard(page, "pro")).toHaveAttribute("aria-pressed", "true");
  await expect(payButton(page, "pro")).toBeVisible();

  await page.getByRole("button", { name: t("plans.annual"), exact: true }).click();
  await expect(page.getByText(t("plans.perYear")).first()).toBeVisible();
  await page.getByRole("button", { name: t("plans.monthly"), exact: true }).click();

  // El botón pasa a "Redirigiendo al pago..." y el navegador sale a la URL de checkout.
  const checkout = page.waitForRequest((r) => r.url().endsWith("/subscription/checkout"));
  await payButton(page, "pro").click();
  expect((await checkout).postDataJSON()).toMatchObject({ plan: "pro", billing_cycle: "monthly" });
  await page.waitForURL(FAKE_CHECKOUT_URL);

  // Si Stripe falla, la pantalla avisa y no sale.
  await page.route("**/api/v1/subscription/checkout", (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
  await page.goto("/es/suscripcion");
  await payButton(page, "pro").click();
  await expect(page.getByText(sub("checkoutError"))).toBeVisible();
  await expect(page).toHaveURL(/\/es\/suscripcion$/);
  await context.close();
});

test.describe("dueño de Volta (suscripción activa)", () => {
  test.use({ storageState: storageStatePath("owner", "volta.demo") });

  test("[SUS-019] suscripción activa: banner de renovación, datos y portal @regresion", async ({ page }) => {
    await mockStripeRedirects(page);
    await page.goto("/es/inicio");
    await expect(page.getByText(new RegExp(`\\d+ ${sub("activeBannerDays")}`))).toBeVisible();
    await page.getByRole("link", { name: sub("activeBannerAction") }).click();
    await expect(page).toHaveURL(/\/es\/suscripcion$/);

    await expect(page.getByText(sub("active"), { exact: true }).first()).toBeVisible();
    await expect(page.getByText(pattern("nextRenewal"))).toBeVisible();
    await expect(page.getByText(sub("billingCycle"))).toBeVisible();
    await expect(page.getByText(sub("totalWithIva"))).toBeVisible();
    await expect(page.getByText(sub("manageDesc"))).toBeVisible();

    await page.getByRole("button", { name: sub("manage") }).click();
    await page.waitForURL(FAKE_PORTAL_URL);
  });

  test("[SUS-020] pago pendiente y cancelación programada se ven en pantalla @regresion", async ({ page }) => {
    await mockStripeRedirects(page);
    let state: Record<string, unknown> = { status: "past_due" };
    await overrideSubscription(page, () => state);

    await page.goto("/es/inicio");
    await expect(page.getByText(sub("pastDueBanner"))).toBeVisible();
    await page.goto("/es/suscripcion");
    await expect(page.getByText(sub("pastDue"), { exact: true })).toHaveCount(2);
    await expect(page.getByText(sub("pastDueBanner"))).toBeVisible();
    await page.goto("/es/inicio");
    await page.getByRole("button", { name: sub("pastDueAction") }).click();
    await page.waitForURL(FAKE_PORTAL_URL);

    state = { status: "active", cancel_at_period_end: true };
    await page.goto("/es/suscripcion");
    await expect(page.getByText(sub("statusCancelScheduled"))).toBeVisible();
    await expect(page.getByText(pattern("cancelScheduled"))).toBeVisible();
    await expect(page.getByText(sub("cancelScheduledDesc"))).toBeVisible();
  });
});

test.describe("empresa con la prueba vencida (Plomería)", () => {
  for (const role of ["owner", "admin"] as const) {
    test.describe(role, () => {
      test.use({ storageState: storageStatePath(role, "plomeria.demo") });

      test(`[SUS-021] el ${role} ve el bloqueo, llega a suscripción y puede pagar @pr`, async ({ page }) => {
        await mockStripeRedirects(page);
        await page.goto("/es/inicio");
        const dialog = page.getByRole("dialog");
        await expect(dialog.getByText(sub("blockedTitle"))).toBeVisible();
        await expect(dialog.getByText(sub("blockedDescOwner"))).toBeVisible();
        await expect(dialog.getByRole("button", { name: sub("logout") })).toBeVisible();
        await expect(page.getByText(sub("trialBannerExpired"))).toBeVisible();

        // El diálogo no se cierra con Escape.
        await page.keyboard.press("Escape");
        await expect(dialog).toBeVisible();

        await dialog.getByRole("link", { name: sub("blockedAction") }).click();
        await expect(page).toHaveURL(/\/es\/suscripcion$/);
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.getByText(sub("trialExpired"))).toBeVisible();
        await page.getByRole("button", { name: /^Pagar plan/ }).click();
        await page.waitForURL(FAKE_CHECKOUT_URL);
      });
    });
  }

  test.describe("manager", () => {
    test.use({ storageState: storageStatePath("manager", "plomeria.demo") });

    test("[SUS-021] el manager ve que venció, sin botón de pago, y puede cerrar sesión @pr", async ({ page }) => {
      await page.goto("/es/inicio");
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText(sub("blockedTitleExpired"))).toBeVisible();
      await expect(dialog.getByText(sub("blockedDescMember"))).toBeVisible();
      await expect(dialog.getByRole("link", { name: sub("blockedAction") })).toHaveCount(0);
      await dialog.getByRole("button", { name: sub("logout") }).click();
      await expect(page).toHaveURL(/\/es\/login$/);
    });
  });
});

test.describe("dueño de Aroma (en prueba)", () => {
  test.use({ storageState: storageStatePath("owner", "aroma.demo") });

  test("[SUS-022] tras pagar, la pantalla espera el webhook y pasa a suscripción al activarse @regresion", async ({ page }) => {
    let active = false;
    await overrideSubscription(page, () => (active ? { status: "active", trial_ends_at: null } : {}));
    await page.goto("/es/suscripcion/exito");
    await expect(page.getByText(sub("processingTitle"))).toBeVisible();
    await expect(page.getByText(sub("processingDesc"))).toBeVisible();
    await expect(page).toHaveURL(/\/exito$/);

    // Llega el evento de Stripe: la siguiente consulta ya dice `active` y la pantalla redirige.
    active = true;
    await expect(page).toHaveURL(/\/es\/suscripcion$/, { timeout: 15_000 });
  });

  test("[SUS-022] sin webhook, al minuto avisa que sigue en proceso y ofrece volver @regresion", async ({ page }) => {
    await page.clock.install();
    await page.goto("/es/suscripcion/exito");
    await expect(page.getByText(sub("processingDesc"))).toBeVisible();
    await page.clock.fastForward(61_000);
    await expect(page.getByText(sub("processingSlow"))).toBeVisible();
    await page.getByRole("button", { name: sub("cancelledBack") }).click();
    await expect(page).toHaveURL(/\/es\/suscripcion$/);
  });

  test("[SUS-023] el pago cancelado no cobra y la suscripción sigue en prueba @regresion", async ({ page }) => {
    await page.goto("/es/suscripcion/cancelado");
    await expect(page.getByText(sub("cancelledTitle"))).toBeVisible();
    await expect(page.getByText(sub("cancelledDesc"))).toBeVisible();
    await page.getByRole("button", { name: sub("cancelledBack") }).click();
    await expect(page).toHaveURL(/\/es\/suscripcion$/);
    await expect(page.getByText(sub("trialing"), { exact: true })).toBeVisible();
  });
});

// Cuarentena (spec 010): falló o fue inestable en la primera corrida local. Arreglar o borrar en 14 días.
test("[FLU-07] de la prueba al checkout: plan, pago simulado, webhook firmado y bloqueo al vencer @regresion @flaky", async ({ browser, request }, info) => {
  test.setTimeout(120_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex });
  const { context, page } = await ownerOf(browser, company);
  await mockStripeRedirects(page);

  // 1-2. En prueba el plan asignado es fijo (spec 031): elige el ciclo y paga ese plan en el checkout simulado (SUS-018).
  await page.goto("/es/suscripcion");
  await expect(page.getByText(sub("trialing"), { exact: true })).toBeVisible();
  await page.getByRole("button", { name: t("plans.annual"), exact: true }).click();
  const checkout = page.waitForRequest((r) => r.url().endsWith("/subscription/checkout"));
  await payButton(page, "basic").click();
  expect((await checkout).postDataJSON()).toMatchObject({ plan: "basic", billing_cycle: "annual" });
  await page.waitForURL(FAKE_CHECKOUT_URL);

  // 3. Un webhook sin firma válida se rechaza (SUS-012); uno firmado se acepta.
  const forged = await sendWebhook(request, "invoice.paid", {}, { secret: "otro-secreto" });
  expect(forged.status()).toBe(400);
  const signed = await sendWebhook(request, "invoice.paid", {}, { id: `evt_${uniquePrefix(info.workerIndex)}` });
  expect(signed.status()).toBe(200);
  expect(await signed.json()).toEqual({ received: true });

  // 4. El estado solo lo cambia Stripe: sin un evento que la API pueda releer, sigue en prueba, con el plan asignado.
  const login = await request.post(`${API_URL}/api/v1/auth/login`, { data: { email: company.email, password: company.password } });
  const companyId = (await login.json()).user.companies[0].id;
  const current = await request.get(`${API_URL}/api/v1/subscription`, {
    headers: { Authorization: `Bearer ${company.token}`, "X-Company-Id": String(companyId) },
  });
  expect(await current.json()).toMatchObject({ status: "trialing", plan: "basic" });
  await context.close();

  // 5. Con la prueba vencida, la empresa queda bloqueada y su dueño llega a pagar (SUS-021).
  const expired = await browser.newContext({ storageState: storageStatePath("owner", "plomeria.demo") });
  const blocked = await expired.newPage();
  await mockStripeRedirects(blocked);
  await blocked.goto("/es/inicio");
  await expect(blocked.getByRole("dialog").getByText(sub("blockedTitle"))).toBeVisible();
  await blocked.getByRole("dialog").getByRole("link", { name: sub("blockedAction") }).click();
  await expect(blocked).toHaveURL(/\/es\/suscripcion$/);
  await blocked.getByRole("button", { name: /^Pagar plan/ }).click();
  await blocked.waitForURL(FAKE_CHECKOUT_URL);
  await expired.close();
});

// Spec 031: en la prueba solo el super admin cambia el plan.
test("[SUS-024] el dueño en prueba no puede cambiar el plan y el super admin sí @pr", async ({ browser, request }, info) => {
  test.setTimeout(90_000);
  const company = await createCompany(request, { workerIndex: info.workerIndex, plan: "pro" });
  const { context, page } = await ownerOf(browser, company);
  const companyId = await page.evaluate(() => localStorage.getItem("selected_company_id") ?? "");
  const ownerHeaders = { Authorization: `Bearer ${company.token}`, "X-Company-Id": companyId };

  // El dueño no tiene cómo cambiarlo: ni en pantalla ni por la API.
  await page.goto("/es/suscripcion");
  await expect(planCard(page, "basic")).toBeDisabled();
  const refused = await request.patch(`${API_URL}/api/v1/subscription`, { headers: ownerHeaders, data: { plan: "enterprise" } });
  expect(refused.status()).toBe(403);
  expect((await refused.json()).error.details).toMatchObject({ code: "trial_plan_locked" });

  // El super admin sí, y el dueño lo ve al recargar.
  const admin = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email: process.env.SUPER_ADMIN_EMAIL ?? "draxuvo@mailinator.com", password: process.env.SUPER_ADMIN_PASSWORD ?? "SuperAdmin12345*" },
  });
  const adminToken = (await admin.json()).token;
  const changed = await request.patch(`${API_URL}/api/v1/subscription`, {
    headers: { Authorization: `Bearer ${adminToken}`, "X-Company-Id": companyId },
    data: { plan: "enterprise" },
  });
  expect(changed.status()).toBe(200);
  await page.reload();
  await expect(planCard(page, "enterprise")).toHaveAttribute("aria-pressed", "true");
  await context.close();
});

// Spec 031: una empresa suspendida por falta de pago queda bloqueada y su dueño llega a pagar.
test.describe("dueño de Volta con la suscripción suspendida", () => {
  test.use({ storageState: storageStatePath("owner", "volta.demo") });

  test("[SUS-025] el bloqueo explica el motivo y ofrece pagar la factura pendiente @pr", async ({ page }) => {
    await overrideSubscription(page, () => ({
      status: "suspended",
      active_access: false,
      suspension_reason: "plan_change",
      cancels_at: new Date(Date.now() + 20 * 86_400_000).toISOString(),
      pay_url: "https://invoice.stripe.test/i/e2e",
    }));
    await page.route("https://invoice.stripe.test/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>factura</body></html>" }));

    await page.goto("/es/inicio");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(sub("suspendedTitle"))).toBeVisible();
    await expect(dialog.getByText(sub("suspendedReasonPlanChange"), { exact: false })).toBeVisible();
    await expect(dialog.getByRole("link", { name: sub("payNow") })).toHaveAttribute("href", "https://invoice.stripe.test/i/e2e");

    // La pantalla de Suscripción no se tapa: ahí se ve el detalle y se paga.
    await page.goto("/es/suscripcion");
    await expect(page.getByText(sub("suspendedDescOwner"))).toBeVisible();
    await expect(page.getByRole("link", { name: sub("payNow") })).toBeVisible();
  });
});
