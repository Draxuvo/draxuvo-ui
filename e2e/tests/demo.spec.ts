import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { E2E_PASSWORD, uniquePrefix } from "../support/data";
import { t } from "../support/i18n";
import { API_URL, authFile } from "../support/session";

// Demo por plan (spec 039). Los casos de super admin usan su sesión; el resto entra sin sesión, como un prospecto.
const ANON = { cookies: [], origins: [] };
const SA = authFile("super_admin-draxuvo");
const d = (key: string, values?: Record<string, string | number>) => t(`demo.${key}`, values);

test.use({ storageState: ANON });

async function enterDemo(page: Page, plan: string, giro?: string) {
  await page.goto(`/es/demo?plan=${plan}`);
  // Las opciones son etiquetas con el radio oculto: se elige tocando la etiqueta.
  if (giro) await page.locator("label").filter({ hasText: new RegExp(`^${giro}`) }).click();
  await page.getByRole("button", { name: d("entry.submit") }).click();
  await expect(page).toHaveURL(/\/es\/inicio$/);
}

const nav = (page: Page, name: string) => page.getByRole("navigation").getByRole("link", { name, exact: true });

/** Abre una demo por API y devuelve lo necesario para llamar a la API como su dueño. */
async function openByApi(request: APIRequestContext, body: Record<string, unknown> = { plan: "basic" }) {
  const res = await request.post(`${API_URL}/api/v1/demo_sessions`, { data: { locale: "es", ...body } });
  expect(res.status()).toBe(201);
  const json = await res.json();
  return { headers: { Authorization: `Bearer ${json.token}`, "X-Company-Id": String(json.company_id) }, json };
}

test.describe("la demo de cada plan", () => {
  test("[DEM-001] Básico: solo los módulos del plan, con datos y el aviso de demostración @pr", async ({ page }) => {
    await enterDemo(page, "basic");

    await expect(page.getByRole("status").filter({ hasText: d("banner.text", { plan: t("plans.basic") }) })).toBeVisible();
    await expect(nav(page, t("nav.people"))).toBeVisible();
    await expect(nav(page, t("nav.inventory"))).toBeVisible();
    await expect(nav(page, t("nav.reports"))).toBeVisible();
    for (const missing of [t("nav.orders"), t("nav.restaurant"), t("nav.terminals"), t("nav.accounts")]) {
      await expect(nav(page, missing)).toHaveCount(0);
    }

    await page.goto("/es/inventario");
    await expect(page.getByText("Aceite vegetal 900 ml")).toBeVisible();
    await page.goto("/es/personal");
    await expect(page.getByText("Ana López")).toBeVisible();
    // El aviso acompaña cada pantalla.
    await expect(page.getByRole("status").filter({ hasText: d("banner.create") })).toBeVisible();
  });

  test("[DEM-002] Pro restaurante: cuentas en cada estado y el aviso también en Tomar pedido @pr", async ({ page }) => {
    await enterDemo(page, "pro", t("demo.entry.scenarios.pro_restaurant"));

    await expect(nav(page, t("nav.accounts"))).toBeVisible();
    await page.goto("/es/ordenes");
    await expect(page.getByRole("heading", { name: new RegExp(`^${t("cuentas.toPay")}`) })).toBeVisible();
    await expect(page.getByRole("heading", { name: new RegExp(`^${t("cuentas.open")}`) })).toBeVisible();
    await expect(page.getByRole("heading", { name: new RegExp(`^${t("cuentas.paidToday")}`) })).toBeVisible();

    // Pantalla completa (Tomar pedido): sin barra lateral y aun así con el aviso.
    await page.goto("/es/pedido");
    await expect(page.getByRole("status").filter({ hasText: d("banner.leave") })).toBeVisible();
  });

  test("[DEM-003] la suscripción es informativa: sin pagos ni cambio de plan @pr", async ({ page }) => {
    await enterDemo(page, "pro", t("demo.entry.scenarios.pro_service"));

    await page.goto("/es/suscripcion");
    await expect(page.getByText(d("subscriptionNotice"))).toBeVisible();
    await expect(page.getByRole("button", { name: /^Pagar plan/ })).toHaveCount(0);
  });

  test("[DEM-004] lo que sale al exterior queda simulado: WhatsApp en la demo de Empresa @pr", async ({ request }) => {
    const { headers } = await openByApi(request, { plan: "enterprise" });
    const tickets = await request.get(`${API_URL}/api/v1/tickets`, { headers });
    const ticket = (await tickets.json()).results[0];

    const res = await request.post(`${API_URL}/api/v1/tickets/${ticket.id}/send_whatsapp`, { headers, data: { phone: "5512345678" } });

    expect(res.status()).toBe(200);
    expect((await res.json()).demo).toBe(true);
    const pay = await request.post(`${API_URL}/api/v1/subscription/checkout`, { headers, data: { plan: "pro" } });
    expect(pay.status()).toBe(403);
    expect((await pay.json()).error.details.code).toBe("demo_restricted");
  });

  test.describe("en un teléfono", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("[DEM-005] la entrada, el aviso y el menú se usan sin desbordar @pr", async ({ page }) => {
      await page.goto("/es/demo?plan=pro");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.getByRole("button", { name: d("entry.submit") }).click();
      await expect(page).toHaveURL(/\/es\/inicio$/);

      await expect(page.getByRole("status").filter({ hasText: d("banner.create") })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.getByRole("button", { name: t("nav.openMenu") }).click();
      await expect(page.getByRole("dialog").getByRole("link", { name: t("nav.people"), exact: true })).toBeVisible();
    });
  });
});

test.describe("de la demo al registro", () => {
  test("[DEM-010] «Crear mi cuenta» abre el registro con el plan y el negocio nuevo empieza vacío @pr", async ({ page }, info) => {
    await enterDemo(page, "pro", t("demo.entry.scenarios.pro_service"));

    await page.getByRole("button", { name: d("banner.create") }).first().click();
    await expect(page).toHaveURL(/\/es\/registro\?plan=pro/);
    await expect(page.getByRole("radio", { name: new RegExp(`^${t("plans.pro")} `) })).toBeChecked();

    const prefix = uniquePrefix(info.workerIndex);
    await page.getByPlaceholder(t("registration.placeholders.first_name")).fill("E2E");
    await page.getByPlaceholder(t("registration.placeholders.last_name")).fill(prefix);
    await page.getByPlaceholder(t("registration.placeholders.phone")).fill("55 1234 5678");
    await page.getByPlaceholder(t("registration.placeholders.email")).fill(`${prefix}@mailinator.com`);
    await page.getByPlaceholder(t("registration.placeholders.password")).fill(E2E_PASSWORD);
    await page.getByPlaceholder(t("registration.placeholders.company_name")).fill(`Empresa ${prefix}`);
    await page.getByRole("button", { name: t("registration.submit") }).click();
    await expect(page).toHaveURL(/\/es\/inicio$/);

    // Sin datos de ejemplo y sin aviso de demo; con su prueba de 30 días.
    await expect(page.getByRole("status").filter({ hasText: d("banner.create") })).toHaveCount(0);
    await page.goto("/es/inventario");
    await expect(page.getByText("Refacción")).toHaveCount(0);
    await page.goto("/es/suscripcion");
    await expect(page.getByText(/prueba/i).first()).toBeVisible();
  });
});

test.describe("el equipo comercial", () => {
  test("[DEM-020] crea una invitación, el prospecto la abre y el equipo ve la apertura y puede revocarla @pr", async ({ browser }) => {
    const admin = await browser.newContext({ storageState: SA });
    const page = await admin.newPage();
    const label = `Prospecto ${uniquePrefix(0)}`;

    await page.goto("/es/demos");
    await page.getByRole("button", { name: d("admin.invites.new") }).click();
    await page.getByLabel(d("admin.dialog.label")).fill(label);
    await page.getByRole("button", { name: d("admin.dialog.create") }).click();
    const link = await page.getByLabel(d("admin.dialog.link")).inputValue();
    expect(link).toMatch(/\/es\/demo\/[\w-]{20,}$/);
    await page.getByRole("button", { name: d("admin.dialog.close") }).click();

    // El prospecto abre el enlace en un navegador limpio, deja su contacto y entra a la demo del plan.
    const visitor = await browser.newContext({ storageState: ANON });
    const guest = await visitor.newPage();
    await guest.goto(link);
    // El contacto solo se pide con un aviso de privacidad configurado (NEXT_PUBLIC_PRIVACY_URL en la compilación de la UI).
    const askContact = (await guest.getByLabel(d("entry.fields.email")).count()) > 0;
    if (askContact) {
      await guest.getByLabel(d("entry.fields.name")).fill("Ana E2E");
      await guest.getByLabel(d("entry.fields.email")).fill("ana-e2e@ejemplo.mx");
    }
    await guest.getByRole("button", { name: d("entry.submit") }).click();
    await expect(guest).toHaveURL(/\/es\/inicio$/);
    await expect(guest.getByRole("status").filter({ hasText: d("banner.create") })).toBeVisible();

    // El equipo ve la apertura con el contacto y cuenta una apertura en la invitación.
    await page.getByRole("tab", { name: d("admin.tabs.sessions") }).click();
    const opening = page.getByRole("row").filter({ hasText: label });
    await expect(opening).toBeVisible();
    if (askContact) await expect(opening).toContainText("ana-e2e@ejemplo.mx");
    await page.getByRole("tab", { name: d("admin.tabs.invites") }).click();
    const invite = page.getByRole("row").filter({ hasText: label });
    await expect(invite).toContainText(d("admin.invites.status.active"));

    // Revocada, el mismo enlace ya no abre la demo.
    await invite.getByRole("button", { name: d("admin.invites.revoke") }).click();
    await page.getByRole("dialog").getByRole("button", { name: d("admin.invites.revokeConfirm") }).click();
    await expect(invite).toContainText(d("admin.invites.status.revoked"));
    const late = await browser.newContext({ storageState: ANON });
    const latePage = await late.newPage();
    await latePage.goto(link);
    await expect(latePage.getByText(d("invite.revoked"))).toBeVisible();

    await Promise.all([admin.close(), visitor.close(), late.close()]);
  });

  test("[DEM-021] una invitación inventada avisa y ofrece otra demo @pr", async ({ page }) => {
    await page.goto("/es/demo/no-existe-este-token");

    await expect(page.getByText(d("invite.notFound"))).toBeVisible();
    await expect(page.getByRole("link", { name: d("invite.tryAnother") })).toBeVisible();
  });

  test("[DEM-022] quien no es super admin no ve «Demos» @regresion", async ({ browser }) => {
    const owner = await browser.newContext({ storageState: authFile("owner-volta.demo") });
    const page = await owner.newPage();

    await page.goto("/es/inicio");
    await expect(page.getByRole("navigation").getByRole("link", { name: t("nav.demos"), exact: true })).toHaveCount(0);
    await owner.close();
  });
});

test.describe("la demo siempre se ve bien", () => {
  test("[DEM-030] lo que hace un visitante no lo ve otro y cada visita parte completa @pr", async ({ request }) => {
    const first = await openByApi(request, { plan: "basic" });
    const second = await openByApi(request, { plan: "basic" });
    const countProducts = async (headers: Record<string, string>) =>
      (await (await request.get(`${API_URL}/api/v1/products?page_size=100`, { headers })).json()).info.total as number;
    const total = await countProducts(second.headers);

    const list = await (await request.get(`${API_URL}/api/v1/products?page_size=100`, { headers: first.headers })).json();
    for (const product of list.results.slice(0, 3)) {
      expect((await request.delete(`${API_URL}/api/v1/products/${product.id}`, { headers: first.headers })).ok()).toBe(true);
    }

    expect(await countProducts(first.headers)).toBe(total - 3);
    expect(await countProducts(second.headers)).toBe(total);
    // Un tercer visitante parte completo.
    const third = await openByApi(request, { plan: "basic" });
    expect(await countProducts(third.headers)).toBe(total);
  });

  test("[DEM-031] «Salir de la demo» termina la demo y su token deja de servir @pr", async ({ page }) => {
    await enterDemo(page, "basic");
    const token = await page.evaluate(() => localStorage.getItem("auth_token"));
    const companyId = await page.evaluate(() => localStorage.getItem("selected_company_id"));

    await page.getByRole("button", { name: d("banner.leave") }).click();
    await expect(page).toHaveURL(/\/login/);

    const res = await page.request.get(`${API_URL}/api/v1/employees`, {
      headers: { Authorization: `Bearer ${token}`, "X-Company-Id": String(companyId) },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("[DEM-032] al llegar la hora de la demo, la pantalla avisa que terminó y ofrece abrir otra @pr", async ({ page }) => {
    await enterDemo(page, "basic");

    await page.evaluate(() => {
      const info = JSON.parse(localStorage.getItem("draxuvo_demo") ?? "{}");
      localStorage.setItem("draxuvo_demo", JSON.stringify({ ...info, expiresAt: new Date(Date.now() - 1000).toISOString() }));
    });
    await page.reload();

    await expect(page.getByText(d("expired.title"))).toBeVisible();
    await expect(page.getByRole("button", { name: d("expired.another") })).toBeVisible();
    await page.getByRole("button", { name: d("expired.another") }).click();
    await expect(page).toHaveURL(/\/es\/demo\?plan=basic/);
  });
});
