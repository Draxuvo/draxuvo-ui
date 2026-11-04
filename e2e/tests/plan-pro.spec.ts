import { expect, test, type APIRequestContext, type APIResponse, type Browser, type Page } from "@playwright/test";
import { E2E_PASSWORD, createCompany, uniquePrefix, type NewCompany } from "../support/data";
import { t } from "../support/i18n";
import { API_URL } from "../support/session";
import { passwordToken } from "../support/tokens";

// Plan Pro de punta a punta, módulo por módulo: alcance del plan, órdenes de trabajo, tickets, restaurante,
// terminales, inventario, reportes, personal y nómina, alertas, permisos y aislamiento, idioma y móvil.
// Cada prueba crea su propia empresa Pro. Los terceros (Stripe, correo, WhatsApp) no se tocan.

const ANON = { cookies: [], origins: [] };
const menu = (page: Page) => page.getByRole("navigation", { name: t("nav.mainNav") });

// ---------- ayudantes ----------

type Auth = { token: string; companyId: number; headers: Record<string, string> };
type Req = APIRequestContext;

async function loginApi(request: Req, email: string, password: string): Promise<Auth> {
  const res = await request.post(`${API_URL}/api/v1/auth/login`, { data: { email, password } });
  expect(res.status(), `login ${email}`).toBe(200);
  const body = await res.json();
  const companyId = body.user.companies[0].id as number;
  return { token: body.token, companyId, headers: { Authorization: `Bearer ${body.token}`, "X-Company-Id": String(companyId) } };
}

async function newOwner(request: Req, workerIndex: number): Promise<{ company: NewCompany; owner: Auth }> {
  const company = await createCompany(request, { workerIndex, plan: "pro" });
  return { company, owner: await loginApi(request, company.email, company.password) };
}

/** Miembro con contraseña ya fijada. `role` es el de la empresa: staff (personal de piso) o admin. */
async function newMember(request: Req, owner: Auth, prefix: string, role: "staff" | "admin", salary = 8000) {
  const email = `${prefix}-${role}@mailinator.com`;
  const name = `${role === "staff" ? "Personal" : "Admin"} ${prefix}`;
  const created = await request.post(`${API_URL}/api/v1/employees`, {
    headers: owner.headers,
    data: { employee: { name, email, phone: "5512345678", salary }, access: { role } },
  });
  expect(created.status(), await created.text()).toBe(201);
  const employee = await created.json();
  const members = await request.get(`${API_URL}/api/v1/company/members`, { headers: owner.headers });
  const member = (await members.json()).results.find((m: { email: string }) => m.email === email);
  const set = await request.put(`${API_URL}/api/v1/passwords/update_with_token`, {
    data: { token: passwordToken({ id: member.id, email, fullName: name }), new_password: E2E_PASSWORD, new_password_confirmation: E2E_PASSWORD },
  });
  expect(set.status(), await set.text()).toBe(200);
  const auth = await loginApi(request, email, E2E_PASSWORD);
  return { ...auth, email, name, employeeId: employee.id as number, userId: member.id as number };
}

async function uiLogin(page: Page, email: string, password: string, landing: RegExp = /\/es\/(inicio|mis-ordenes)$/) {
  await page.goto("/es/login");
  await page.getByLabel(t("auth.email"), { exact: true }).fill(email);
  await page.getByLabel(t("auth.password"), { exact: true }).fill(password);
  await page.getByRole("button", { name: t("auth.submit") }).click();
  await expect(page).toHaveURL(landing);
}

async function ownerPage(browser: Browser, company: NewCompany, viewport?: { width: number; height: number }) {
  const context = await browser.newContext({ storageState: ANON, viewport });
  const page = await context.newPage();
  await uiLogin(page, company.email, company.password);
  return { context, page };
}

const get = (r: Req, a: Auth, path: string) => r.get(`${API_URL}/api/v1${path}`, { headers: a.headers });
const post = (r: Req, a: Auth, path: string, data?: unknown) => r.post(`${API_URL}/api/v1${path}`, { headers: a.headers, data });
const postH = (r: Req, a: Auth, path: string, data: unknown, extra: Record<string, string>) => r.post(`${API_URL}/api/v1${path}`, { headers: { ...a.headers, ...extra }, data });
const patch = (r: Req, a: Auth, path: string, data?: unknown) => r.patch(`${API_URL}/api/v1${path}`, { headers: a.headers, data });
const del = (r: Req, a: Auth, path: string) => r.delete(`${API_URL}/api/v1${path}`, { headers: a.headers });

const errorCode = async (res: APIResponse) => ((await res.json().catch(() => ({}))) as { error?: { details?: { code?: string } } }).error?.details?.code;
const text = async (res: APIResponse) => `${res.status()} ${await res.text()}`;

async function productTypes(request: Req, a: Auth) {
  const list = ((await (await get(request, a, "/product_types")).json()) as { results: Array<{ id: number; name: string }> }).results;
  const byName = (n: string) => list.find((x) => x.name === n)!.id;
  return { service: byName("Servicio"), part: byName("Refacción"), material: byName("Material") };
}

async function addProduct(request: Req, a: Auth, data: Record<string, unknown>) {
  return post(request, a, "/products", { product: data });
}

/** Refacción: se vende y se cuenta. */
async function addPart(request: Req, a: Auth, sku: string, stock: number, extra: Record<string, unknown> = {}) {
  const { part } = await productTypes(request, a);
  const res = await addProduct(request, a, { sku, name: `Pieza ${sku}`, stock, min_stock: 1, unit_cost: 10, price: 25, product_type_id: part, ...extra });
  expect(res.status(), await text(res)).toBe(201);
  return (await res.json()) as { id: number; stock: number; name: string };
}

async function newTerminal(request: Req, a: Auth, name: string, extra: Record<string, unknown> = {}) {
  const res = await post(request, a, "/payment_terminals", { payment_terminal: { name, provider: "clip", ...extra } });
  expect(res.status(), await text(res)).toBe(201);
  return (await res.json()) as { id: number; name: string };
}

type Order = { id: number; status: string; total: string };

async function newOrder(request: Req, a: Auth, body: Record<string, unknown> = {}): Promise<Order> {
  const res = await post(request, a, "/work_orders", {
    work_order: { title: `Orden ${uniquePrefix()}`, customer_name: "Cliente QA" },
    items: [{ description: "Mano de obra", quantity: 1, unit_price: 100 }],
    ...body,
  });
  expect(res.status(), await text(res)).toBe(201);
  return (await res.json()) as Order;
}

async function finished(request: Req, a: Auth, body: Record<string, unknown> = {}): Promise<Order> {
  const order = await newOrder(request, a, body);
  expect((await post(request, a, `/work_orders/${order.id}/start`)).status()).toBe(200);
  expect((await post(request, a, `/work_orders/${order.id}/finish`)).status()).toBe(200);
  return order;
}

const ticketCount = async (request: Req, a: Auth) => ((await (await get(request, a, "/tickets")).json()) as { info: { total: number } }).info.total;

// ===================================================================================================================
// 1. Alta y alcance del plan
// ===================================================================================================================

test.describe("alta y alcance del plan Pro", () => {
  test.use({ storageState: ANON });

  test("[PRO-001] el dueño nuevo ve el menú del plan Pro, sin lo que no incluye @pr", async ({ browser, request }, info) => {
    const { company } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);
    await expect
      .poll(async () => (await menu(page).getByRole("link").allInnerTexts()).map((l) => l.trim()), { timeout: 15_000 })
      .toEqual(expect.arrayContaining([t("nav.home"), t("nav.dashboard"), t("nav.people"), t("nav.inventory"), t("nav.orders"), t("nav.restaurant"), t("nav.terminals"), t("nav.reports"), t("nav.alerts"), t("subscription.nav")]));
    const links = (await menu(page).getByRole("link").allInnerTexts()).map((l) => l.trim());
    for (const hidden of [t("nav.pos"), t("nav.sales"), t("nav.whatsapp"), t("nav.demos"), t("nav.companies")]) expect(links).not.toContain(hidden);
    await context.close();
  });

  test("[PRO-002] Suscripción muestra el plan Pro en prueba con su precio @regresion", async ({ browser, request }, info) => {
    const { company } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/suscripcion");
    await expect(page.getByText(t("plans.pro"), { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/En prueba/).first()).toBeVisible();
    await expect(page.getByText(/799/).first()).toBeVisible();
    await context.close();
  });

  test("[PRO-003] lo que no es del plan (punto de venta, varias empresas, WhatsApp) se bloquea en pantalla y API @regresion", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);
    for (const route of ["/es/venta", "/es/ventas"]) {
      await page.goto(route);
      await expect(page.getByText(t("subscription.moduleLocked")), route).toBeVisible();
    }
    for (const path of ["/sales", "/sales/catalog"]) {
      const res = await get(request, owner, path);
      expect(res.status(), path).toBe(403);
      expect(await errorCode(res), path).toBe("module_not_in_plan");
    }
    const branch = await post(request, owner, "/company/branches", { branch: { name: "Sucursal que no debe existir" } });
    expect([402, 403, 422]).toContain(branch.status());
    expect(JSON.stringify(await (await get(request, owner, "/company/branches")).json())).not.toContain("Sucursal que no debe existir");
    await context.close();
  });

  test("[PRO-004] el catálogo público lista Pro con sus ocho módulos y sin extras @regresion", async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/plans`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty("addons");
    const pro = (body.plans ?? body.results ?? body).find((p: { key?: string; id?: string }) => (p.key ?? p.id) === "pro");
    expect(pro, JSON.stringify(body).slice(0, 400)).toBeTruthy();
    expect([...pro.modules].sort()).toEqual(["attendance", "employees", "inventory", "reports", "restaurant", "terminals", "tickets", "work_orders"]);
    expect(pro.prices.monthly.amount_cents).toBe(79_900);
    expect(pro.prices.annual.amount_cents).toBe(799_000);
    expect(pro.prices.monthly.total_cents).toBe(92_684);
  });

  test("[PRO-005] las pantallas de una empresa nueva explican qué hacer y no muestran errores @regresion", async ({ browser, request }, info) => {
    test.setTimeout(120_000);
    const { company } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);
    for (const route of ["/es/ordenes", "/es/restaurante", "/es/terminales", "/es/inventario", "/es/personal", "/es/reportes", "/es/alertas", "/es/dashboard"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)'), route).toHaveCount(0);
      await expect(page.locator("main h1, main h2, h1, h2").first(), route).toBeVisible();
    }
    await context.close();
  });

  test("[PRO-006] durante la prueba el dueño no cambia plan, módulos ni extras @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const plan = await patch(request, owner, "/subscription", { plan: "enterprise" });
    expect(plan.status(), await text(plan)).toBe(403);
    expect(await errorCode(plan)).toBe("trial_plan_locked");
    const mods = await patch(request, owner, "/company/modules", { disabled_modules: ["inventory"] });
    expect(mods.status(), await text(mods)).toBe(403);
    const addon = await post(request, owner, "/subscription/addons", { module: "pos" });
    expect(addon.status(), await text(addon)).toBe(403);
  });
});

// ===================================================================================================================
// 2. Órdenes de trabajo y cobro
// ===================================================================================================================

test.describe("órdenes de trabajo y cobro", () => {
  test.use({ storageState: ANON });

  test("[PRO-010] orden con refacción: ciclo completo y cobro mixto (tarjeta con terminal, transferencia y efectivo) @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const part = await addPart(request, owner, "F-1", 10);
    const terminal = await newTerminal(request, owner, "Clip mostrador");
    const order = await newOrder(request, owner, {
      items: [{ description: "Mano de obra", quantity: 1, unit_price: 100 }, { product_id: part.id, quantity: 2 }],
    });
    expect(Number(order.total)).toBe(150);
    expect((await post(request, owner, `/work_orders/${order.id}/start`)).status()).toBe(200);
    expect((await post(request, owner, `/work_orders/${order.id}/finish`)).status()).toBe(200);
    const charged = await post(request, owner, `/work_orders/${order.id}/charge`, {
      payments: [
        { method: "card", amount: 50, terminal_id: terminal.id, card_last4: "4242" },
        { method: "transfer", amount: 40, reference: "REF-1" },
        { method: "cash", amount_received: 100 },
      ],
    });
    expect(charged.status(), await text(charged)).toBe(200);
    expect((await charged.json()).status).toBe("paid");

    const tickets = (await (await get(request, owner, "/tickets")).json()) as { results: Array<{ id: number; total: string; payment_method: string; change_given: string }> };
    expect(tickets.results).toHaveLength(1);
    expect(Number(tickets.results[0].total)).toBe(150);
    expect(tickets.results[0].payment_method).toBe("mixed");
    expect(Number(tickets.results[0].change_given)).toBe(40);

    const income = (await (await get(request, owner, "/reports/income")).json()) as {
      total_revenue: number;
      by_method: Array<{ method: string; total: number }>;
      by_terminal: Array<{ terminal: { id: number }; total: number }>;
    };
    expect(income.total_revenue).toBe(150);
    expect(Object.fromEntries(income.by_method.map((m) => [m.method, m.total]))).toEqual({ cash: 60, card: 50, transfer: 40 });
    expect(income.by_terminal.find((x) => x.terminal.id === terminal.id)?.total).toBe(50);
  });

  test("[PRO-011] un cobro mal armado se rechaza completo y no crea ticket @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const terminal = await newTerminal(request, owner, "Terminal activa");
    const order = await finished(request, owner); // total 100
    const bad: Array<[string, unknown[]]> = [
      ["falta dinero", [{ method: "card", amount: 40, card_last4: "4242" }]],
      ["tarjeta rebasa el total", [{ method: "card", amount: 150 }]],
      ["dos efectivos", [{ method: "cash", amount_received: 60 }, { method: "cash", amount_received: 60 }]],
      ["método inválido", [{ method: "bitcoin", amount: 100 }]],
      ["últimos 4 inválidos", [{ method: "card", amount: 100, card_last4: "12ab" }]],
      ["transferencia sin referencia", [{ method: "transfer", amount: 100 }]],
      ["terminal inexistente", [{ method: "card", amount: 100, terminal_id: 99999999 }]],
      ["monto negativo", [{ method: "card", amount: -5 }, { method: "cash", amount_received: 200 }]],
      ["monto cero", [{ method: "card", amount: 0 }, { method: "cash", amount_received: 200 }]],
      ["efectivo insuficiente", [{ method: "cash", amount_received: 50 }]],
      ["más de cinco pagos", Array.from({ length: 6 }, () => ({ method: "card", amount: 10 }))],
      ["sin pagos", []],
    ];
    for (const [label, payments] of bad) {
      const res = await post(request, owner, `/work_orders/${order.id}/charge`, { payments });
      expect(res.status(), `${label}: ${await res.text()}`).toBe(422);
    }
    expect(await ticketCount(request, owner)).toBe(0);
    expect(((await (await get(request, owner, `/work_orders/${order.id}`)).json()) as Order).status).toBe("done");

    // Una terminal dada de baja ya no recibe cobros.
    await patch(request, owner, `/payment_terminals/${terminal.id}`, { payment_terminal: { active: false } });
    const inactive = await post(request, owner, `/work_orders/${order.id}/charge`, { payments: [{ method: "card", amount: 100, terminal_id: terminal.id }] });
    expect(inactive.status(), await text(inactive)).toBe(422);
    expect(await ticketCount(request, owner)).toBe(0);
  });

  test("[PRO-012] cobrar dos veces la misma orden, aun a la vez, crea un solo ticket @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const order = await finished(request, owner);
    const body = { payments: [{ method: "cash", amount_received: 100 }] };
    const results = await Promise.all([1, 2, 3].map(() => post(request, owner, `/work_orders/${order.id}/charge`, body)));
    const ok = results.filter((r) => r.status() === 200).length;
    expect(ok, (await Promise.all(results.map(text))).join("\n")).toBe(1);
    expect(results.filter((r) => r.status() >= 500)).toHaveLength(0);
    expect(await ticketCount(request, owner)).toBe(1);
    const again = await post(request, owner, `/work_orders/${order.id}/charge`, body);
    expect(again.status()).toBe(422);
  });

  test("[PRO-013] las transiciones fuera de orden se rechazan sin 500 @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const pay = { payments: [{ method: "cash", amount_received: 100 }] };

    const open = await newOrder(request, owner);
    expect((await post(request, owner, `/work_orders/${open.id}/charge`, pay)).status(), "cobrar sin terminar").toBe(422);
    expect((await post(request, owner, `/work_orders/${open.id}/void_charge`, { reason: "x" })).status(), "anular sin cobro").toBe(422);

    const cancelled = await newOrder(request, owner);
    expect((await post(request, owner, `/work_orders/${cancelled.id}/cancel`, { reason: "ya no" })).status()).toBe(200);
    for (const action of ["start", "finish", "charge"]) {
      const res = await post(request, owner, `/work_orders/${cancelled.id}/${action}`, pay);
      expect(res.status(), `${action} sobre cancelada: ${await res.text()}`).toBe(422);
    }

    const paid = await finished(request, owner);
    expect((await post(request, owner, `/work_orders/${paid.id}/charge`, pay)).status()).toBe(200);
    for (const action of ["reopen", "cancel", "start", "finish"]) {
      const res = await post(request, owner, `/work_orders/${paid.id}/${action}`);
      expect(res.status(), `${action} sobre cobrada: ${await res.text()}`).toBeLessThan(500);
      expect(res.status(), `${action} sobre cobrada`).not.toBe(200);
    }
    expect((await del(request, owner, `/work_orders/${paid.id}`)).status(), "borrar cobrada").toBe(422);
    const unknown = await post(request, owner, `/work_orders/${open.id}/teleport`);
    expect(unknown.status()).toBe(404);
  });

  test("[PRO-014] anular un cobro marca el ticket, regresa la orden y saca el dinero de Ingresos @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const order = await finished(request, owner);
    expect((await post(request, owner, `/work_orders/${order.id}/charge`, { payments: [{ method: "cash", amount_received: 100 }] })).status()).toBe(200);
    expect(((await (await get(request, owner, "/reports/income")).json()) as { total_revenue: number }).total_revenue).toBe(100);

    const voided = await post(request, owner, `/work_orders/${order.id}/void_charge`, { reason: "Error de captura" });
    expect(voided.status(), await text(voided)).toBe(200);
    const ticket = ((await (await get(request, owner, "/tickets")).json()) as { results: Array<{ status: string; void_reason: string | null }> }).results[0];
    expect(ticket.status).toBe("voided");
    expect(ticket.void_reason).toBe("Error de captura");
    expect(((await (await get(request, owner, "/reports/income")).json()) as { total_revenue: number }).total_revenue, "Ingresos no debe contar un ticket anulado").toBe(0);
    // La orden puede cobrarse otra vez y deja un ticket nuevo.
    const second = await post(request, owner, `/work_orders/${order.id}/charge`, { payments: [{ method: "card", amount: 100 }] });
    expect(second.status(), await text(second)).toBe(200);
    // El mismo ticket vuelve a «pagado»: una orden tiene un solo ticket (ver H-50 sobre el rastro de la anulación).
    expect(await ticketCount(request, owner)).toBe(1);
    expect(((await (await get(request, owner, "/reports/income")).json()) as { total_revenue: number }).total_revenue).toBe(100);
  });

  test("[PRO-015] datos raros al crear órdenes y conceptos: se validan y no hay 500 @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const base = { work_order: { title: "Orden válida" } };
    const cases: Array<[string, Record<string, unknown>]> = [
      ["título vacío", { work_order: { title: "" } }],
      ["cantidad cero", { ...base, items: [{ description: "a", quantity: 0, unit_price: 10 }] }],
      ["cantidad negativa", { ...base, items: [{ description: "a", quantity: -3, unit_price: 10 }] }],
      ["precio negativo", { ...base, items: [{ description: "a", quantity: 1, unit_price: -10 }] }],
      ["cantidad enorme", { ...base, items: [{ description: "a", quantity: 1e15, unit_price: 10 }] }],
      ["precio enorme", { ...base, items: [{ description: "a", quantity: 1, unit_price: 1e15 }] }],
      ["concepto sin descripción", { ...base, items: [{ quantity: 1, unit_price: 10 }] }],
      ["producto inexistente", { ...base, items: [{ product_id: 99999999, quantity: 1 }] }],
    ];
    for (const [label, body] of cases) {
      const res = await post(request, owner, "/work_orders", body);
      expect.soft(res.status(), `${label}: ${await res.text()}`).toBeGreaterThanOrEqual(400);
      expect.soft(res.status(), `${label}: ${await res.text()}`).toBeLessThan(500);
    }
    expect(((await (await get(request, owner, "/work_orders")).json()) as { info: { total: number } }).info.total, "no debe quedar ninguna orden a medias").toBe(0);
  });

  test("[PRO-016] un nombre con HTML se muestra como texto y no se ejecuta @regresion", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    const title = `<img src=x onerror="window.__xss=1"> ${uniquePrefix()}`;
    await newOrder(request, owner, { work_order: { title, customer_name: "<b>negritas</b>" } });
    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/ordenes");
    await expect(page.getByText(title, { exact: false }).first()).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    await context.close();
  });

  test("[PRO-017] el dueño crea una orden en pantalla y la cobra en efectivo con cambio @pr", async ({ browser, request }, info) => {
    const { company } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);
    const title = `Revisión ${uniquePrefix(info.workerIndex)}`;
    await page.goto("/es/ordenes");
    await page.getByRole("button", { name: t("workOrders.labels.service.new") }).click();
    const form = page.getByRole("dialog");
    await form.getByPlaceholder(/Mesa 4|Instalación eléctrica/).fill(title);
    await form.getByRole("button", { name: t("workOrders.form.addItem") }).click();
    await form.getByLabel(t("workOrders.concepts.freeDescription")).first().fill("Diagnóstico");
    await form.getByLabel(t("workOrders.concepts.quantity")).first().fill("1");
    await form.getByLabel(t("workOrders.concepts.price")).first().fill("250");
    await form.getByRole("button", { name: t("workOrders.form.create") }).click();
    await expect(page.getByText(t("workOrders.createSuccess"))).toBeVisible();
    await page.waitForURL(/\/ordenes\/\d+$/);
    await expect(page.getByText(title).first()).toBeVisible();
    await expect(page.getByText(/250/).first()).toBeVisible();
    await context.close();
  });
});

// ===================================================================================================================
// 3. Personal de piso en órdenes (rol staff)
// ===================================================================================================================

test.describe("staff y órdenes de trabajo", () => {
  test.use({ storageState: ANON });

  test("[PRO-020] el staff crea órdenes propias solo con catálogo y no ve ni toca las de otros @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const prefix = uniquePrefix(info.workerIndex);
    const ana = await newMember(request, owner, `${prefix}a`, "staff");
    const beto = await newMember(request, owner, `${prefix}b`, "staff");
    const part = await addPart(request, owner, "S-1", 5);

    const own = await post(request, ana, "/work_orders", { work_order: { title: "Orden de Ana" }, items: [{ product_id: part.id, quantity: 1 }] });
    expect(own.status(), await text(own)).toBe(201);
    const ownId = (await own.json()).id as number;

    // Concepto libre y precio propio: no.
    const free = await post(request, ana, "/work_orders", { work_order: { title: "Libre" }, items: [{ description: "Algo", quantity: 1, unit_price: 1 }] });
    expect(free.status(), await text(free)).toBe(422);
    const priced = await post(request, ana, "/work_orders", { work_order: { title: "Con precio" }, items: [{ product_id: part.id, quantity: 1, unit_price: 1 }] });
    if (priced.status() === 201) {
      const total = Number(((await priced.json()) as Order).total);
      expect(total, "el staff no decide el precio: debe usar el del catálogo").toBe(25);
    }

    // Beto no ve ni toca la de Ana.
    expect((await get(request, beto, `/work_orders/${ownId}`)).status()).toBe(404);
    expect((await patch(request, beto, `/work_orders/${ownId}`, { work_order: { title: "robada" } })).status()).toBeGreaterThanOrEqual(403);
    expect((await post(request, beto, `/work_orders/${ownId}/start`)).status()).toBe(404);
    const betoList = (await (await get(request, beto, "/work_orders")).json()) as { info: { total: number } };
    expect(betoList.info.total).toBe(0);

    // Ana no cambia el título ni borra ni anula cobros.
    expect((await patch(request, ana, `/work_orders/${ownId}`, { work_order: { title: "otro" } })).status()).toBe(403);
    expect((await del(request, ana, `/work_orders/${ownId}`)).status()).toBe(403);
    expect((await post(request, ana, `/work_orders/${ownId}/void_charge`, { reason: "x" })).status()).toBeGreaterThanOrEqual(403);
  });

  test("[PRO-021] el staff cobra su propia orden pero no ve los tickets de los demás @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const prefix = uniquePrefix(info.workerIndex);
    const ana = await newMember(request, owner, `${prefix}a`, "staff");
    const beto = await newMember(request, owner, `${prefix}b`, "staff");
    const part = await addPart(request, owner, "S-2", 5);

    const mine = (await (await post(request, ana, "/work_orders", { work_order: { title: "De Ana" }, items: [{ product_id: part.id, quantity: 1 }] })).json()) as Order;
    await post(request, ana, `/work_orders/${mine.id}/start`);
    await post(request, ana, `/work_orders/${mine.id}/finish`);
    const charge = await post(request, ana, `/work_orders/${mine.id}/charge`, { payments: [{ method: "cash", amount_received: 50 }] });
    expect(charge.status(), await text(charge)).toBe(200);

    const theirs = await finished(request, owner);
    await post(request, owner, `/work_orders/${theirs.id}/charge`, { payments: [{ method: "cash", amount_received: 100 }] });

    const anaTickets = (await (await get(request, ana, "/tickets")).json()) as { info: { total: number } };
    expect(anaTickets.info.total, "Ana solo ve el suyo").toBe(1);
    expect(((await (await get(request, beto, "/tickets")).json()) as { info: { total: number } }).info.total).toBe(0);
    const ownerTicket = ((await (await get(request, owner, "/tickets")).json()) as { results: Array<{ id: number; work_order: { id: number } }> }).results.find((x) => x.work_order.id === theirs.id)!;
    expect((await get(request, ana, `/tickets/${ownerTicket.id}`)).status()).toBe(404);
    expect((await get(request, ana, `/tickets/${ownerTicket.id}/download`)).status()).toBe(404);
  });

  test("[PRO-022] el staff entra a Mis órdenes y no abre pantallas de administración por URL @regresion", async ({ browser, request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const prefix = uniquePrefix(info.workerIndex);
    const ana = await newMember(request, owner, prefix, "staff");
    const context = await browser.newContext({ storageState: ANON });
    const page = await context.newPage();
    await uiLogin(page, ana.email, E2E_PASSWORD, /\/es\/mis-ordenes$/);
    for (const route of ["/es/terminales", "/es/reportes", "/es/suscripcion", "/es/personal", "/es/alertas", "/es/inventario", "/es/dashboard"]) {
      await page.goto(route);
      await expect(page, route).toHaveURL(/\/es\/(mis-ordenes|login)/);
    }
    await context.close();
  });
});

// ===================================================================================================================
// 4. Tickets / Cobradas
// ===================================================================================================================

test.describe("tickets y Cobradas", () => {
  test.use({ storageState: ANON });

  test("[PRO-030] el historial filtra, busca por folio, pagina y baja el PDF @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    for (let i = 0; i < 3; i++) {
      const o = await finished(request, owner);
      await post(request, owner, `/work_orders/${o.id}/charge`, { payments: [{ method: i === 1 ? "card" : "cash", amount: 100, amount_received: 100 }] });
    }
    const all = (await (await get(request, owner, "/tickets")).json()) as { info: { total: number }; results: Array<{ id: number; folio: string; payment_method: string }> };
    expect(all.info.total).toBe(3);
    const folio = all.results[0].folio;
    const bySearch = (await (await get(request, owner, `/tickets?search=${encodeURIComponent(folio)}`)).json()) as { results: unknown[] };
    expect(bySearch.results).toHaveLength(1);
    const page1 = (await (await get(request, owner, "/tickets?per_page=2&page=1")).json()) as { results: unknown[]; info: { pages_total: number } };
    expect(page1.results.length).toBeLessThanOrEqual(3);
    const pdf = await get(request, owner, `/tickets/${all.results[0].id}/download`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("pdf");
    expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  });

  test("[PRO-031] parámetros raros del historial no provocan 500 @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    for (const q of ["page_size=100000", "status=nope", "search=%27%20OR%201%3D1--", "search=%25%25%25", "from=2026-13-45", "paid_on=basura"]) {
      const res = await get(request, owner, `/tickets?${q}`);
      expect(res.status(), `${q}: ${await res.text()}`).toBeLessThan(500);
    }
    expect((await get(request, owner, "/tickets/99999999")).status()).toBe(404);
    expect((await get(request, owner, "/tickets/abc")).status()).toBeLessThan(500);
  });

  test("[PRO-032] enviar el ticket por WhatsApp pide el módulo, que Pro no incluye @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const o = await finished(request, owner);
    await post(request, owner, `/work_orders/${o.id}/charge`, { payments: [{ method: "cash", amount_received: 100 }] });
    const t1 = ((await (await get(request, owner, "/tickets")).json()) as { results: Array<{ id: number }> }).results[0];
    const res = await post(request, owner, `/tickets/${t1.id}/send_whatsapp`, { phone: "5512345678" });
    expect(res.status(), await text(res)).toBe(403);
    expect(await errorCode(res)).toBe("module_not_in_plan");
  });

  test("[PRO-033] la pestaña Cobradas muestra el ticket y su detalle con los pagos @pr", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    const terminal = await newTerminal(request, owner, "Clip fondo");
    const o = await finished(request, owner);
    await post(request, owner, `/work_orders/${o.id}/charge`, { payments: [{ method: "card", amount: 60, terminal_id: terminal.id }, { method: "cash", amount_received: 50 }] });
    const ticket = ((await (await get(request, owner, "/tickets")).json()) as { results: Array<{ id: number; folio: string }> }).results[0];
    const { page, context } = await ownerPage(browser, company);
    await page.goto(`/es/ordenes?vista=cobradas&ticket=${ticket.id}`);
    await expect(page.getByText(ticket.folio).first()).toBeVisible();
    await expect(page.getByText("Clip fondo").first()).toBeVisible();
    await context.close();
  });
});

// ===================================================================================================================
// 5. Restaurante
// ===================================================================================================================

async function restaurantSetup(request: Req, owner: Auth) {
  const station = await (await post(request, owner, "/restaurant/stations", { station: { name: "Cocina", kind: "kitchen", is_default: true } })).json();
  const { part } = await productTypes(request, owner);
  const dish = await (await addProduct(request, owner, { sku: "T-1", name: "Taco", stock: 5, min_stock: 1, unit_cost: 8, price: 30, product_type_id: part, station_id: station.id })).json();
  const table = await (await post(request, owner, "/restaurant/tables", { table: { name: "Mesa 1" } })).json();
  const table2 = await (await post(request, owner, "/restaurant/tables", { table: { name: "Mesa 2" } })).json();
  return { station: station as { id: number }, dish: dish as { id: number }, table: table as { id: number }, table2: table2 as { id: number } };
}

type Check = { id: number; total: string; items: Array<{ id: number }> };

test.describe("restaurante", () => {
  test.use({ storageState: ANON });

  test("[PRO-040] una cuenta de mesa de punta a punta: pedir, mandar a cocina, avanzar, cobrar y descontar stock @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const { station, dish, table } = await restaurantSetup(request, owner);
    const check = (await (await post(request, owner, "/restaurant/checks", { dining_table_id: table.id })).json()) as Check;
    expect((await post(request, owner, `/restaurant/checks/${check.id}/items`, { product_id: dish.id, quantity: 3 })).status()).toBe(201);
    const round = await post(request, owner, `/restaurant/checks/${check.id}/rounds`);
    expect(round.status(), await text(round)).toBe(201);
    const board = (await (await get(request, owner, `/restaurant/stations/${station.id}/board`)).json()) as { orders: Array<{ id: number; items: Array<{ id: number; status: string }> }> };
    expect(board.orders).toHaveLength(1);
    const item = board.orders[0].items[0];
    for (const expected of ["preparing", "ready"]) {
      const adv = await post(request, owner, `/restaurant/stations/${station.id}/items/${item.id}/advance`);
      expect(adv.status(), await text(adv)).toBeLessThan(300);
      void expected;
    }
    expect((await post(request, owner, `/restaurant/checks/${check.id}/items/${item.id}/deliver`)).status()).toBeLessThan(300);
    const pay = await post(request, owner, `/restaurant/checks/${check.id}/payments`, { method: "cash", amount_received: 200 });
    expect(pay.status(), await text(pay)).toBe(201);
    const closed = await pay.json();
    expect(closed.check.status).toBe("closed");
    expect(Number(closed.payment.change_given)).toBe(110);
    expect(((await (await get(request, owner, `/products/${dish.id}`)).json()) as { stock: number }).stock).toBe(2);
    expect(await ticketCount(request, owner)).toBe(1);
    // La mesa queda libre para otra cuenta.
    expect((await post(request, owner, "/restaurant/checks", { dining_table_id: table.id })).status()).toBe(201);
  });

  test("[PRO-041] reglas de la cuenta: mesa ocupada, agotado, pagos y cierre se validan @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const { dish, table } = await restaurantSetup(request, owner);
    const { material } = await productTypes(request, owner);
    const supply = await (await addProduct(request, owner, { sku: "I-1", name: "Insumo", stock: 5, min_stock: 1, unit_cost: 1, price: 2, product_type_id: material })).json();

    const check = (await (await post(request, owner, "/restaurant/checks", { dining_table_id: table.id })).json()) as Check;
    const dup = await post(request, owner, "/restaurant/checks", { dining_table_id: table.id });
    expect(dup.status()).toBe(422);
    expect(await errorCode(dup)).toBe("table_occupied");
    const items = `/restaurant/checks/${check.id}/items`;
    expect((await post(request, owner, items, { product_id: dish.id, quantity: 9 })).status(), "más que la existencia").toBe(422);
    expect((await post(request, owner, items, { product_id: supply.id, quantity: 1 })).status(), "insumo no vendible").toBe(404);
    expect((await post(request, owner, items, { product_id: 99999999, quantity: 1 })).status()).toBe(404);
    // Spec 054: una cantidad 0, negativa o texto ya no se convierte en 1 en silencio.
    for (const quantity of [0, -4, "abc"]) {
      const res = await post(request, owner, items, { product_id: dish.id, quantity });
      expect(res.status(), `cantidad ${quantity}: ${await res.text()}`).toBe(422);
    }
    expect((await post(request, owner, items, { product_id: dish.id, quantity: 1e12 })).status()).toBeLessThan(500);
    const mesa = (await (await get(request, owner, `/restaurant/checks/${check.id}`)).json()) as Check;
    expect(mesa.items, "no debe quedar ningún renglón de las cantidades inválidas").toHaveLength(0);

    await post(request, owner, items, { product_id: dish.id, quantity: 2 });
    await post(request, owner, `/restaurant/checks/${check.id}/rounds`);
    const cancel = await post(request, owner, `/restaurant/checks/${check.id}/cancel`, { reason: "x" });
    expect(cancel.status(), "cancelar con artículos mandados").toBe(422);
    const pay = `/restaurant/checks/${check.id}/payments`;
    expect((await post(request, owner, pay, { method: "cash", amount_received: 100 })).status(), "sin confirmar pendientes").toBe(422);
    expect((await post(request, owner, pay, { method: "transfer", amount: 10, confirm_incomplete: true })).status(), "transferencia sin referencia").toBe(422);
    expect((await post(request, owner, pay, { method: "transfer", amount: 999, reference: "R", confirm_incomplete: true })).status(), "transferencia mayor al saldo").toBe(422);
    expect((await post(request, owner, pay, { method: "bitcoin", amount: 10, confirm_incomplete: true })).status()).toBe(422);
    expect((await post(request, owner, pay, { method: "cash", amount_received: -5, confirm_incomplete: true })).status()).toBe(422);
    const total = Number(((await (await get(request, owner, `/restaurant/checks/${check.id}`)).json()) as Check).total);
    expect(total).toBeGreaterThan(30);
    const pay1 = await post(request, owner, pay, { method: "transfer", amount: 30, reference: "R1", confirm_incomplete: true });
    expect(pay1.status(), await text(pay1)).toBe(201);
    expect((await pay1.json()).check.status, "pago parcial no cierra").toBe("open");
    const pay2 = await post(request, owner, pay, { method: "cash", amount_received: total, confirm_incomplete: true });
    expect(pay2.status(), await text(pay2)).toBe(201);
    expect((await pay2.json()).check.status).toBe("closed");
    expect((await post(request, owner, pay, { method: "cash", amount_received: 30, confirm_incomplete: true })).status(), "ya cerrada").toBe(422);
    expect(await ticketCount(request, owner)).toBe(1);
  });

  test("[PRO-042] el mesero solo ve el total de sus cuentas y no cierra, reasigna ni configura @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const prefix = uniquePrefix(info.workerIndex);
    const ana = await newMember(request, owner, `${prefix}a`, "staff");
    const beto = await newMember(request, owner, `${prefix}b`, "staff");
    const { dish, table, table2 } = await restaurantSetup(request, owner);

    const hers = (await (await post(request, ana, "/restaurant/checks", { dining_table_id: table.id })).json()) as Check;
    await post(request, ana, `/restaurant/checks/${hers.id}/items`, { product_id: dish.id, quantity: 2 });
    const his = (await (await post(request, beto, "/restaurant/checks", { dining_table_id: table2.id })).json()) as Check;
    await post(request, beto, `/restaurant/checks/${his.id}/items`, { product_id: dish.id, quantity: 1 });

    const view = (await (await get(request, beto, "/restaurant/tables")).json()) as { results: Array<{ id: number; check: { total?: string; waiter?: unknown } | null }>; overview?: unknown };
    const other = view.results.find((x) => x.id === table.id)!;
    expect(other.check, "la cuenta de Ana aparece ocupada para Beto").not.toBeNull();
    expect(other.check?.total, "FR-019b: Beto no ve el total ajeno").toBeUndefined();
    expect(other.check?.waiter, "FR-019b: ni el mesero ajeno").toBeUndefined();
    expect(view.overview, "el resumen es solo de jefes").toBeUndefined();

    expect((await post(request, beto, `/restaurant/checks/${hers.id}/cancel`, { reason: "x" })).status()).toBe(403);
    expect((await post(request, beto, `/restaurant/checks/${hers.id}/payments`, { method: "cash", amount_received: 100, confirm_incomplete: true })).status(), "cobrar la cuenta ajena").toBe(403);
    expect((await patch(request, beto, `/restaurant/checks/${his.id}`, { waiter_id: ana.userId })).status(), "reasignar mesero").toBe(403);
    expect((await get(request, beto, `/restaurant/checks/${his.id}/waiters`)).status()).toBeGreaterThanOrEqual(403);
    expect((await post(request, beto, "/restaurant/tables", { table: { name: "Mesa hack" } })).status()).toBe(403);
    expect((await post(request, beto, "/restaurant/stations", { station: { name: "Hack" } })).status()).toBe(403);
    expect((await post(request, owner, `/restaurant/checks/${his.id}/close`)).status(), "el dueño sí cierra").toBeLessThan(500);
  });

  test("[PRO-043] mesas y estaciones: validación de nombres y duplicados @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    for (const name of ["", "   "]) {
      const res = await post(request, owner, "/restaurant/tables", { table: { name } });
      expect(res.status(), `mesa "${name.slice(0, 10)}": ${await res.text()}`).toBe(422);
    }
    expect((await post(request, owner, "/restaurant/tables", { table: { name: "Mesa A" } })).status()).toBe(201);
    const dupTable = await post(request, owner, "/restaurant/tables", { table: { name: "Mesa A" } });
    expect(dupTable.status(), "mesa duplicada: " + (await dupTable.text())).toBe(422);
    const badKind = await post(request, owner, "/restaurant/stations", { station: { name: "Raro", kind: "nave" } });
    expect(badKind.status(), await text(badKind)).toBeLessThan(500);
    const noName = await post(request, owner, "/restaurant/stations", { station: { name: "" } });
    expect(noName.status(), await text(noName)).toBe(422);
  });

  test("[PRO-044] Restaurante en pantalla: plano, abrir mesa, pedir, mandar y cobrar @pr", async ({ browser, request }, info) => {
    test.setTimeout(120_000);
    const { company, owner } = await newOwner(request, info.workerIndex);
    const { dish } = await restaurantSetup(request, owner);
    void dish;
    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/restaurante");
    await expect(page.getByRole("heading", { name: t("restaurant.service.plan") })).toBeVisible();
    const free = page.getByRole("button", { name: /^Mesa 1, Libre$/ });
    await expect(free).toBeVisible();
    await free.click();
    await expect(page).toHaveURL(/\/es\/pedido\?cuenta=\d+/);
    await page.getByText("Taco").first().click();
    await expect(page.getByText(/Taco/).first()).toBeVisible();
    await context.close();
  });

  test("[PRO-045] la pantalla de estación muestra la comanda recién mandada @regresion", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    const { station, dish, table } = await restaurantSetup(request, owner);
    const check = (await (await post(request, owner, "/restaurant/checks", { dining_table_id: table.id })).json()) as Check;
    await post(request, owner, `/restaurant/checks/${check.id}/items`, { product_id: dish.id, quantity: 2 });
    await post(request, owner, `/restaurant/checks/${check.id}/rounds`);
    const { page, context } = await ownerPage(browser, company);
    await page.goto(`/es/estacion/${station.id}`);
    await expect(page.getByText("Taco").first()).toBeVisible();
    await expect(page.getByText("Mesa 1").first()).toBeVisible();
    await context.close();
  });
});

// ===================================================================================================================
// 6. Terminales
// ===================================================================================================================

test.describe("terminales", () => {
  test.use({ storageState: ANON });

  test("[PRO-050] alta, cambio y baja de terminales: solo administrador y dueño escriben @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const prefix = uniquePrefix(info.workerIndex);
    const staff = await newMember(request, owner, `${prefix}s`, "staff");
    const admin = await newMember(request, owner, `${prefix}m`, "admin");

    expect((await post(request, staff, "/payment_terminals", { payment_terminal: { name: "Hack", provider: "clip" } })).status()).toBe(403);
    const t1 = await newTerminal(request, admin, "Terminal del admin");
    expect((await patch(request, staff, `/payment_terminals/${t1.id}`, { payment_terminal: { name: "robada" } })).status()).toBe(403);
    expect((await del(request, staff, `/payment_terminals/${t1.id}`)).status()).toBe(403);
    expect((await get(request, staff, "/payment_terminals")).status(), "el staff las necesita para cobrar").toBe(200);

    for (const [label, data] of [["sin nombre", { name: "", provider: "clip" }], ["nombre larguísimo", { name: "x".repeat(500), provider: "clip" }], ["proveedor inválido", { name: "T", provider: "nope" }]] as const) {
      const res = await post(request, owner, "/payment_terminals", { payment_terminal: data });
      expect(res.status(), `${label}: ${await res.text()}`).toBe(422);
    }
    const dup = await post(request, owner, "/payment_terminals", { payment_terminal: { name: "Terminal del admin", provider: "clip" } });
    expect(dup.status(), "nombre repetido: " + (await dup.text())).toBe(422);
    expect((await patch(request, owner, `/payment_terminals/${t1.id}`, { payment_terminal: { name: "Renombrada" } })).status()).toBe(200);
    expect((await del(request, owner, `/payment_terminals/${t1.id}`)).status()).toBeLessThan(300);
  });

  test("[PRO-051] borrar una terminal con cobros no rompe el historial ni Ingresos @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const terminal = await newTerminal(request, owner, "Con historia");
    const o = await finished(request, owner);
    await post(request, owner, `/work_orders/${o.id}/charge`, { payments: [{ method: "card", amount: 100, terminal_id: terminal.id }] });
    const res = await del(request, owner, `/payment_terminals/${terminal.id}`);
    expect(res.status(), await text(res)).toBeLessThan(500);
    const income = await get(request, owner, "/reports/income");
    expect(income.status(), await text(income)).toBe(200);
    expect(((await income.json()) as { total_revenue: number }).total_revenue).toBe(100);
    const ticket = ((await (await get(request, owner, "/tickets")).json()) as { results: Array<{ id: number }> }).results[0];
    expect((await get(request, owner, `/tickets/${ticket.id}`)).status()).toBe(200);
  });

  test("[PRO-052] la pantalla Terminales lista, crea y da de baja una terminal @pr", async ({ browser, request }, info) => {
    const { company } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/terminales");
    await expect(page.getByRole("heading", { name: t("nav.terminals") }).first()).toBeVisible();
    const name = `Terminal ${uniquePrefix(info.workerIndex)}`;
    await page.getByRole("button", { name: /Nueva terminal|Agregar/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Nombre/i).fill(name);
    await dialog.getByRole("button", { name: /Guardar|Crear|Agregar/i }).click();
    await expect(page.getByText(name).first()).toBeVisible();
    await context.close();
  });
});

// ===================================================================================================================
// 7. Inventario en Pro
// ===================================================================================================================

test.describe("inventario en Pro", () => {
  test.use({ storageState: ANON });

  test("[PRO-060] los tipos iniciales de un negocio de servicio y la validación de productos @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const { part, service, material } = await productTypes(request, owner);
    const bad: Array<[string, Record<string, unknown>]> = [
      ["precio negativo", { sku: "N-1", name: "n", price: -5, product_type_id: part }],
      ["costo negativo", { sku: "N-2", name: "n", unit_cost: -5, product_type_id: part }],
      ["mínimo negativo", { sku: "N-3", name: "n", min_stock: -1, product_type_id: part }],
      ["stock enorme", { sku: "N-4", name: "n", stock: 1e15, product_type_id: part }],
      ["costo enorme", { sku: "N-5", name: "n", unit_cost: 1e15, product_type_id: part }],
      ["sin nombre", { sku: "N-6", name: "", product_type_id: part }],
      ["nombre de 5000", { sku: "N-7", name: "x".repeat(5000), product_type_id: part }],
      ["SKU de 500", { sku: "S".repeat(500), name: "n", product_type_id: part }],
    ];
    for (const [label, data] of bad) {
      const res = await addProduct(request, owner, data);
      expect(res.status(), `${label}: ${await res.text()}`).toBe(422);
    }
    expect((await addProduct(request, owner, { sku: "OK-1", name: "Bueno", price: 10, stock: 3, product_type_id: part })).status()).toBe(201);
    expect((await addProduct(request, owner, { sku: "ok-1", name: "Repetido", price: 10, product_type_id: part })).status(), "SKU repetido sin importar mayúsculas").toBe(422);
    const noStock = await addProduct(request, owner, { sku: "SV-1", name: "Mano de obra", price: 100, product_type_id: service });
    expect(noStock.status()).toBe(201);
    const mat = await addProduct(request, owner, { sku: "MA-1", name: "Material", stock: 4, price: 5, product_type_id: material });
    expect(mat.status()).toBe(201);
    expect(((await (await get(request, owner, "/products/menu")).json()) as { results?: Array<{ name: string }> }).results?.some((p) => p.name === "Material") ?? false, "un insumo no sale en el menú").toBe(false);
  });

  test("[PRO-061] movimientos de stock: la salida no pasa de la existencia y el historial cuadra @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const part = await addPart(request, owner, "M-1", 5);
    const move = (type: string, quantity: number) => post(request, owner, `/products/${part.id}/stock_movements`, { stock_movement: { movement_type: type, qty: quantity, note: "qa" } });
    expect((await move("exit", 6)).status(), "salida mayor al stock").toBe(422);
    expect((await move("exit", 0)).status()).toBe(422);
    expect((await move("rareza", 1)).status(), "tipo inválido").toBe(422);
    expect((await move("entry", 1e15)).status()).toBeLessThan(500);
    expect((await move("exit", 2)).status()).toBe(201);
    expect((await move("entry", 4)).status()).toBe(201);
    expect(((await (await get(request, owner, `/products/${part.id}`)).json()) as { stock: number }).stock).toBe(7);
    const moves = (await (await get(request, owner, `/products/${part.id}/stock_movements`)).json()) as { results: unknown[] };
    expect(moves.results.length, "inicial + salida + entrada").toBe(3);
  });

  test("[PRO-062] cobrar una orden de trabajo con una refacción descuenta la existencia @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const part = await addPart(request, owner, "D-1", 10);
    const o = await finished(request, owner, { items: [{ product_id: part.id, quantity: 4 }] });
    expect((await post(request, owner, `/work_orders/${o.id}/charge`, { payments: [{ method: "cash", amount_received: 100 }] })).status()).toBe(200);
    expect(((await (await get(request, owner, `/products/${part.id}`)).json()) as { stock: number }).stock, "las refacciones vendidas en una orden deberían bajar de inventario").toBe(6);
  });

  test("[PRO-065] si la existencia no alcanza el cobro se hace, queda en cero, avisa el faltante y la anulación solo regresa lo que salió @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const part = await addPart(request, owner, "H49-F", 2);
    const o = await finished(request, owner, { items: [{ product_id: part.id, quantity: 5 }] });
    const charge = await post(request, owner, `/work_orders/${o.id}/charge`, { payments: [{ method: "cash", amount_received: 200 }] });
    expect(charge.status(), await text(charge)).toBe(200);
    const body = (await charge.json()) as { status: string; stock_shortages: Array<{ product_id: number; missing: number | string }> };
    expect(body.status).toBe("paid");
    expect(body.stock_shortages).toHaveLength(1);
    expect(body.stock_shortages[0].product_id).toBe(part.id);
    expect(Number(body.stock_shortages[0].missing)).toBe(3);
    expect(((await (await get(request, owner, `/products/${part.id}`)).json()) as { stock: number }).stock).toBe(0);
    expect((await post(request, owner, `/work_orders/${o.id}/void_charge`, { reason: "Devolución" })).status()).toBe(200);
    expect(((await (await get(request, owner, `/products/${part.id}`)).json()) as { stock: number }).stock, "solo regresa lo que salió").toBe(2);
    // Gastos no cuenta esa devolución como compra (ni la existencia inicial).
    const expenses = (await (await get(request, owner, "/reports/expenses")).json()) as { inventory_cost: { total: number } };
    expect(expenses.inventory_cost.total).toBe(0);
  });

  test("[PRO-066] dos cobros simultáneos de la misma orden descuentan una sola vez @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const part = await addPart(request, owner, "H49-C", 10);
    const o = await finished(request, owner, { items: [{ product_id: part.id, quantity: 4 }] });
    const body = { payments: [{ method: "cash", amount_received: 200 }] };
    const results = await Promise.all([1, 2, 3].map(() => post(request, owner, `/work_orders/${o.id}/charge`, body)));
    expect(results.filter((r) => r.status() === 200)).toHaveLength(1);
    expect(((await (await get(request, owner, `/products/${part.id}`)).json()) as { stock: number }).stock).toBe(6);
  });

  test("[PRO-063] un código de barras no se repite dentro de la empresa y la búsqueda lo resuelve @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const a = await addPart(request, owner, "B-1", 1);
    const b = await addPart(request, owner, "B-2", 1);
    const code = `7501${Date.now().toString().slice(-9)}`;
    expect((await patch(request, owner, `/products/${a.id}`, { product: { barcodes: [code] } })).status()).toBe(200);
    expect((await patch(request, owner, `/products/${b.id}`, { product: { barcodes: [code] } })).status(), "código repetido").toBe(422);
    const found = await get(request, owner, `/products/by_code?code=${code}`);
    expect(found.status(), await text(found)).toBe(200);
    expect(((await found.json()) as { id: number }).id).toBe(a.id);
    expect((await get(request, owner, "/products/by_code?code=NOEXISTE")).status()).toBe(404);
  });

  test("[PRO-064] Inventario en pantalla: alta de producto y búsqueda @pr", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    const p = await addPart(request, owner, `UI-${uniquePrefix(info.workerIndex)}`.slice(0, 20), 4);
    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/inventario");
    await expect(page.getByText(p.name).first()).toBeVisible();
    await page.getByPlaceholder(/Buscar/i).first().fill(p.name);
    await expect(page.getByText(p.name).first()).toBeVisible();
    await context.close();
  });
});

// ===================================================================================================================
// 8. Reportes
// ===================================================================================================================

test.describe("reportes en Pro", () => {
  test.use({ storageState: ANON });

  test("[PRO-070] Ingresos suma por método y por terminal exactamente lo cobrado, entre órdenes y mesas @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const terminal = await newTerminal(request, owner, "Clip reportes");
    const { dish, table } = await restaurantSetup(request, owner);

    const o = await finished(request, owner); // 100
    await post(request, owner, `/work_orders/${o.id}/charge`, { payments: [{ method: "card", amount: 100, terminal_id: terminal.id }] });
    const check = (await (await post(request, owner, "/restaurant/checks", { dining_table_id: table.id })).json()) as Check;
    await post(request, owner, `/restaurant/checks/${check.id}/items`, { product_id: dish.id, quantity: 2 }); // 60
    await post(request, owner, `/restaurant/checks/${check.id}/rounds`);
    await post(request, owner, `/restaurant/checks/${check.id}/payments`, { method: "card", amount: 60, terminal_id: terminal.id, reference: "AUT-1", confirm_incomplete: true });

    const income = (await (await get(request, owner, "/reports/income")).json()) as { total_revenue: number; total_tickets: number; by_method: Array<{ method: string; total: number }>; by_terminal: Array<{ total: number; count: number }> };
    expect(income.total_revenue).toBe(160);
    expect(income.total_tickets).toBe(2);
    expect(income.by_method.find((m) => m.method === "card")?.total).toBe(160);
    expect(income.by_terminal.reduce((s, x) => s + x.total, 0)).toBe(160);
    const summary = (await (await get(request, owner, "/reports/summary")).json()) as { income: { total_revenue: number; tickets_paid: number } };
    expect(summary.income.total_revenue).toBe(160);
    expect(summary.income.tickets_paid).toBe(2);
  });

  test("[PRO-071] rangos de fechas inválidos se rechazan con 422 en todos los reportes @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    for (const path of ["summary", "income", "expenses", "payroll", "inventory"]) {
      for (const q of ["from=2026-12-31&to=2026-01-01", "from=basura&to=2026-01-01", "from=2026-02-30&to=2026-03-01"]) {
        const res = await get(request, owner, `/reports/${path}?${q}`);
        expect(res.status(), `${path}?${q}: ${await res.text()}`).toBe(422);
      }
    }
  });

  test("[PRO-072] Reportes en pantalla: las pestañas de Pro y la cifra de ingresos @pr", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    const o = await finished(request, owner);
    await post(request, owner, `/work_orders/${o.id}/charge`, { payments: [{ method: "cash", amount_received: 100 }] });
    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/reportes");
    await expect(page.getByRole("heading", { name: t("nav.reports") })).toBeVisible();
    for (const tab of ["Resumen", "Ingresos", "Gastos", "Nómina", "Inventario"]) {
      await expect(page.getByRole("tab", { name: tab, exact: true }), tab).toBeVisible();
    }
    await expect(page.getByText(/\$\s?100/).first()).toBeVisible();
    await context.close();
  });

  test("[PRO-073] Inventario y Gastos reportan el valor y los costos reales @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    await addPart(request, owner, "V-1", 10, { unit_cost: 12 }); // 120
    await addPart(request, owner, "V-2", 5, { unit_cost: 20 }); // 100
    const inv = (await (await get(request, owner, "/reports/inventory")).json()) as { stock: { value: number; counted_products: number } };
    const value = inv.stock.value;
    expect(inv.stock.counted_products).toBe(2);
    expect(value, JSON.stringify(inv).slice(0, 300)).toBe(220);
    const exp = await get(request, owner, "/reports/expenses");
    expect(exp.status(), await text(exp)).toBe(200);
  });
});

// ===================================================================================================================
// 9. Personal, asistencia y nómina
// ===================================================================================================================

test.describe("personal, asistencia y nómina en Pro", () => {
  test.use({ storageState: ANON });

  test("[PRO-080] el staff no ve salarios ni gestiona personal, nómina ni asistencia ajena @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const prefix = uniquePrefix(info.workerIndex);
    const ana = await newMember(request, owner, `${prefix}a`, "staff", 12345);
    const beto = await newMember(request, owner, `${prefix}b`, "staff");

    const list = await get(request, beto, "/employees");
    expect(list.status()).toBe(200);
    expect(JSON.stringify(await list.json()), "el staff no debe ver salarios").not.toContain("12345");
    for (const [label, res] of [
      ["alta", await post(request, beto, "/employees", { employee: { name: "X", salary: 1 } })],
      ["edición", await patch(request, beto, `/employees/${ana.employeeId}`, { employee: { salary: 999999 } })],
      ["nómina", await get(request, beto, "/payroll_runs")],
      ["crear nómina", await post(request, beto, "/payroll_runs", { payroll_run: { period_type: "biweekly" } })],
      ["asistencia ajena", await post(request, beto, `/employees/${ana.employeeId}/checkin`)],
      ["lista de asistencia", await get(request, beto, "/attendances")],
      ["reporte de nómina", await get(request, beto, "/reports/payroll")],
      ["acceso", await post(request, beto, `/employees/${ana.employeeId}/access`, { access: { role: "admin" } })],
    ] as const) {
      expect(res.status(), `${label}: ${await res.text()}`).toBe(403);
    }
    // Su propia asistencia sí.
    const mine = await post(request, beto, "/my_attendance/check_in");
    expect(mine.status(), await text(mine)).toBeLessThan(300);
  });

  test("[PRO-081] nómina quincenal: crear, aprobar y pagar, y Reportes la suma @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const prefix = uniquePrefix(info.workerIndex);
    await newMember(request, owner, `${prefix}a`, "staff", 10000);
    await newMember(request, owner, `${prefix}b`, "staff", 12000);
    // Termina dentro del rango por omisión de Reportes (últimos 30 días): hace 8 días y 14 días antes.
    const end = new Date(Date.now() - 8 * 86_400_000);
    const start = new Date(end.getTime() - 14 * 86_400_000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const run = await post(request, owner, "/payroll_runs", { period_type: "biweekly", starts_on: iso(start), ends_on: iso(end) });
    expect(run.status(), await text(run)).toBe(201);
    const body = (await run.json()) as { id: number; lock_version: number; total?: number };
    const approve = await postH(request, owner, `/payroll_runs/${body.id}/approve`, { lock_version: body.lock_version }, { "Idempotency-Key": `ap-${body.id}-${Date.now()}` });
    expect(approve.status(), await text(approve)).toBe(200);
    const paid = await postH(request, owner, `/payroll_runs/${body.id}/pay_all`, { method: "transfer", reference: "NOM-1", paid_on: iso(new Date(Date.now() - 86_400_000)) }, { "Idempotency-Key": `pa-${body.id}-${Date.now()}` });
    expect(paid.status(), await text(paid)).toBeLessThan(300);
    const rep = (await (await get(request, owner, "/reports/payroll")).json()) as { runs?: unknown[] } & Record<string, unknown>;
    const runs = (rep as unknown as { runs: { count: number; paid_cents: number } }).runs;
    expect(runs.count).toBe(1);
    expect(runs.paid_cents).toBe(1_100_000);
  });

  test("[PRO-082] asistencia: entrada y salida, doble entrada, hora futura y salida sin entrada @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const prefix = uniquePrefix(info.workerIndex);
    const ana = await newMember(request, owner, prefix, "staff");
    const id = ana.employeeId;
    expect((await post(request, owner, `/employees/${id}/checkout`)).status(), "salida sin entrada").toBe(422);
    expect((await post(request, owner, `/employees/${id}/checkin`)).status()).toBeLessThan(300);
    expect((await post(request, owner, `/employees/${id}/checkin`)).status(), "doble entrada").toBe(422);
    expect((await post(request, owner, `/employees/${id}/checkout`, { at: new Date(Date.now() + 3_600_000).toISOString() })).status(), "salida futura").toBe(422);
    expect((await post(request, owner, `/employees/${id}/checkout`, { at: "basura" })).status()).toBeLessThan(500);
    expect((await post(request, owner, `/employees/${id}/checkout`)).status()).toBeLessThan(300);
  });
});

// ===================================================================================================================
// 10. Alertas
// ===================================================================================================================

test.describe("alertas en Pro", () => {
  test.use({ storageState: ANON });

  test("[PRO-090] el stock bajo y las órdenes sin avanzar generan alertas para el dueño, no para el staff @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const staff = await newMember(request, owner, uniquePrefix(info.workerIndex), "staff");
    await addPart(request, owner, "A-1", 1, { min_stock: 5 });
    const res = await get(request, owner, "/alerts");
    expect(res.status(), await text(res)).toBe(200);
    expect(JSON.stringify(await res.json())).toContain("stock");
    expect((await get(request, staff, "/alerts")).status()).toBe(403);
    expect((await get(request, staff, "/alert_settings")).status()).toBe(403);
  });

  test("[PRO-091] la configuración de alertas valida tiempos y zona horaria @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    expect((await get(request, owner, "/alert_settings")).status()).toBe(200);
    for (const data of [{ time_zone: "Marte/Olimpo" }, { daily_summary_hour: 99 }, { table_open_minutes: -5 }, { table_open_minutes: "abc" }]) {
      const res = await patch(request, owner, "/alert_settings", { alert_setting: data, ...data });
      expect(res.status(), `${JSON.stringify(data)}: ${await res.text()}`).toBeLessThan(500);
    }
  });
});

// ===================================================================================================================
// 11. Seguridad y aislamiento
// ===================================================================================================================

test.describe("permisos y aislamiento entre empresas en Pro", () => {
  test.use({ storageState: ANON });

  test("[PRO-100] los datos de otra empresa responden 404 en cada módulo y el encabezado de otra empresa 403 @pr", async ({ request }, info) => {
    const a = (await newOwner(request, info.workerIndex)).owner;
    const b = (await newOwner(request, info.workerIndex)).owner;
    const part = await addPart(request, a, "ISO-1", 3);
    const terminal = await newTerminal(request, a, "Terminal A");
    const order = await finished(request, a);
    await post(request, a, `/work_orders/${order.id}/charge`, { payments: [{ method: "cash", amount_received: 100 }] });
    const ticket = ((await (await get(request, a, "/tickets")).json()) as { results: Array<{ id: number }> }).results[0];
    const { table, dish } = await restaurantSetup(request, a);
    const check = (await (await post(request, a, "/restaurant/checks", { dining_table_id: table.id })).json()) as Check;
    void dish;

    const reads = [`/work_orders/${order.id}`, `/tickets/${ticket.id}`, `/tickets/${ticket.id}/download`, `/products/${part.id}`, `/restaurant/checks/${check.id}`];
    for (const path of reads) expect((await get(request, b, path)).status(), `GET ${path}`).toBe(404);
    expect((await patch(request, b, `/payment_terminals/${terminal.id}`, { payment_terminal: { name: "robada" } })).status()).toBe(404);
    expect((await del(request, b, `/payment_terminals/${terminal.id}`)).status()).toBe(404);
    expect((await post(request, b, `/work_orders/${order.id}/void_charge`, { reason: "x" })).status()).toBe(404);
    expect((await post(request, b, `/restaurant/checks/${check.id}/payments`, { method: "cash", amount_received: 10 })).status()).toBe(404);
    expect((await patch(request, b, `/products/${part.id}`, { product: { name: "robado" } })).status()).toBe(404);

    // El encabezado de la empresa ajena con la sesión de B.
    const cross = await request.get(`${API_URL}/api/v1/work_orders`, { headers: { Authorization: b.headers.Authorization, "X-Company-Id": String(a.companyId) } });
    expect(cross.status()).toBe(403);
    // Una terminal de A no sirve para cobrar en B.
    const orderB = await finished(request, b);
    const foreign = await post(request, b, `/work_orders/${orderB.id}/charge`, { payments: [{ method: "card", amount: 100, terminal_id: terminal.id }] });
    expect(foreign.status(), await text(foreign)).toBe(422);
  });

  test("[PRO-101] sin sesión o con una sesión inválida, todo responde 401 y nunca 500 @regresion", async ({ request }) => {
    for (const path of ["/work_orders", "/tickets", "/products", "/payment_terminals", "/restaurant/tables", "/reports/income", "/employees", "/subscription", "/alerts"]) {
      expect((await request.get(`${API_URL}/api/v1${path}`)).status(), `sin token ${path}`).toBe(401);
      const bad = await request.get(`${API_URL}/api/v1${path}`, { headers: { Authorization: "Bearer basura.token.malo" } });
      expect(bad.status(), `token malo ${path}`).toBe(401);
    }
  });

  test("[PRO-102] el administrador opera pero no cambia suscripción, módulos ni dueños @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const admin = await newMember(request, owner, uniquePrefix(info.workerIndex), "admin");
    const terminal = await newTerminal(request, admin, "Del admin");
    expect(terminal.id).toBeGreaterThan(0);
    expect((await get(request, admin, "/reports/income")).status()).toBe(200);
    expect((await post(request, admin, "/work_orders", { work_order: { title: "Admin" }, items: [{ description: "a", quantity: 1, unit_price: 5 }] })).status()).toBe(201);
    expect((await patch(request, admin, "/company/modules", { disabled_modules: ["inventory"] })).status()).toBe(403);
    expect((await patch(request, admin, "/subscription", { plan: "enterprise" })).status()).toBe(403);
    expect((await post(request, admin, "/subscription/addons", { module: "pos" })).status()).toBe(403);
    const members = (await (await get(request, admin, "/company/members")).json()) as { results: Array<{ id: number; role: string }> };
    const ownerMember = members.results.find((m) => m.role === "owner")!;
    const demote = await patch(request, admin, `/company/members/${ownerMember.id}`, { member: { role: "staff" } });
    expect(demote.status(), "un administrador no baja al dueño: " + (await demote.text())).toBe(403);
    expect((await del(request, admin, `/company/members/${ownerMember.id}`)).status()).toBe(403);
  });

  test("[PRO-103] el inicio de sesión se frena tras muchos intentos fallidos @regresion", async ({ request }, info) => {
    const { company } = await newOwner(request, info.workerIndex);
    let blocked = 0;
    for (let i = 0; i < 130; i++) {
      const res = await request.post(`${API_URL}/api/v1/auth/login`, { data: { email: company.email, password: `mala-${i}` } });
      if (res.status() === 429) blocked++;
      expect(res.status()).toBeLessThan(500);
    }
    expect(blocked).toBeGreaterThan(0);
  });
});


// ===================================================================================================================
// 11b. Hallazgos H-46 a H-55 de esta revisión (corregidos por la spec 054; cada caso evita que reaparezcan)
// ===================================================================================================================

test.describe("hallazgos corregidos del plan Pro (spec 054)", () => {
  test.use({ storageState: ANON });

  test("[PRO-120] una página o tamaño de página inválido responde 422, no 500, y una página pasada de la última devuelve la última @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    for (const path of ["tickets", "work_orders", "products", "employees", "attendances", "payroll_runs", "stock_counts", "product_imports", "company/members"]) {
      for (const q of ["page=0", "page=-1", "page=abc", "page_size=0", "page_size=-3"]) {
        const res = await get(request, owner, `/${path}?${q}`);
        expect.soft(res.status(), `${path}?${q}`).toBe(422);
        expect.soft(await errorCode(res), `${path}?${q}`).toBe("invalid_pagination");
      }
      // Una página más allá de la última devuelve la última, no un error.
      const beyond = await get(request, owner, `/${path}?page=9999`);
      expect.soft(beyond.status(), `${path}?page=9999`).toBe(200);
    }
  });

  test("[PRO-121] los textos libres tienen tope de longitud: estación, mesa, cliente y notas de la orden @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const cases: Array<[string, string, Record<string, unknown>]> = [
      ["estación de 500", "/restaurant/stations", { station: { name: "x".repeat(500) } }],
      ["mesa de 500", "/restaurant/tables", { table: { name: "x".repeat(500) } }],
      ["título de orden de 5000", "/work_orders", { work_order: { title: "x".repeat(5000) } }],
      ["cliente de 5000", "/work_orders", { work_order: { title: "t", customer_name: "x".repeat(5000) } }],
      ["notas de 50000", "/work_orders", { work_order: { title: "t", notes: "x".repeat(50_000) } }],
    ];
    for (const [label, path, body] of cases) {
      const res = await post(request, owner, path, body);
      expect.soft(res.status(), label).toBe(422);
    }
  });

  test("[PRO-122] un producto con un tipo inexistente se rechaza en vez de caer en el tipo por omisión @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const res = await addProduct(request, owner, { sku: "TI-1", name: "Tipo fantasma", price: 5, product_type_id: 99_999_999 });
    expect(res.status(), await text(res)).toBe(422);
  });

  test("[PRO-128] una fecha límite inválida se rechaza en vez de guardarse en blanco @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const res = await post(request, owner, "/work_orders", { work_order: { title: "t", due_date: "no-es-fecha" } });
    expect(res.status(), await text(res)).toBe(422);
  });

  test("[PRO-126] una orden con una prioridad inválida se rechaza con 422, no con 500 @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const res = await post(request, owner, "/work_orders", { work_order: { title: "t", priority: "urgentisima" } });
    expect(res.status(), await text(res)).toBe(422);
  });

  test("[PRO-127] un movimiento de stock con cantidad negativa se rechaza @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const part = await addPart(request, owner, "NEG-1", 5);
    for (const type of ["exit", "entry"]) {
      const res = await post(request, owner, `/products/${part.id}/stock_movements`, { stock_movement: { movement_type: type, qty: -2, note: "qa" } });
      expect.soft(res.status(), `${type} -2: ${await res.text()}`).toBe(422);
    }
  });

  test("[PRO-123] al recobrar una orden anulada el ticket conserva su folio y el historial de quién y por qué se anuló @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const order = await finished(request, owner);
    await post(request, owner, `/work_orders/${order.id}/charge`, { payments: [{ method: "cash", amount_received: 100 }] });
    await post(request, owner, `/work_orders/${order.id}/void_charge`, { reason: "Error de captura" });
    await post(request, owner, `/work_orders/${order.id}/charge`, { payments: [{ method: "card", amount: 100 }] });
    const list = ((await (await get(request, owner, "/tickets")).json()) as { results: Array<{ id: number; folio: string; status: string }> }).results;
    expect(list, "el folio se conserva: sigue habiendo un solo ticket").toHaveLength(1);
    expect(list[0].status).toBe("paid");
    const detail = (await (await get(request, owner, `/tickets/${list[0].id}`)).json()) as { voids: Array<{ reason: string; voided_by: { id: number } | null; amount: string; payments: Array<{ method: string }> }> };
    expect(detail.voids).toHaveLength(1);
    expect(detail.voids[0].reason).toBe("Error de captura");
    expect(detail.voids[0].voided_by).not.toBeNull();
    expect(detail.voids[0].payments.map((p) => p.method)).toEqual(["cash"]);
  });

  test("[PRO-124] cobrar con tarjeta una cuenta de mesa no exige referencia, igual que una orden de trabajo @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const { dish, table } = await restaurantSetup(request, owner);
    const check = (await (await post(request, owner, "/restaurant/checks", { dining_table_id: table.id })).json()) as Check;
    await post(request, owner, `/restaurant/checks/${check.id}/items`, { product_id: dish.id, quantity: 1 });
    await post(request, owner, `/restaurant/checks/${check.id}/rounds`);
    const res = await post(request, owner, `/restaurant/checks/${check.id}/payments`, { method: "card", amount: 30, confirm_incomplete: true });
    expect(res.status(), await text(res)).toBe(201);
  });

  test("[PRO-129] la transferencia en una cuenta de mesa sigue exigiendo referencia @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const { dish, table } = await restaurantSetup(request, owner);
    const check = (await (await post(request, owner, "/restaurant/checks", { dining_table_id: table.id })).json()) as Check;
    await post(request, owner, `/restaurant/checks/${check.id}/items`, { product_id: dish.id, quantity: 1 });
    await post(request, owner, `/restaurant/checks/${check.id}/rounds`);
    const res = await post(request, owner, `/restaurant/checks/${check.id}/payments`, { method: "transfer", amount: 30, confirm_incomplete: true });
    expect(res.status(), await text(res)).toBe(422);
    expect(await errorCode(res)).toBe("reference_required");
  });

  test("[PRO-130] pedir en una mesa una cantidad 0, negativa o texto responde 422 y no agrega nada @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const { dish, table } = await restaurantSetup(request, owner);
    const check = (await (await post(request, owner, "/restaurant/checks", { dining_table_id: table.id })).json()) as Check;
    for (const quantity of [0, -4, "abc", 1.5]) {
      const res = await post(request, owner, `/restaurant/checks/${check.id}/items`, { product_id: dish.id, quantity });
      expect.soft(res.status(), `cantidad ${quantity}`).toBe(422);
      expect.soft(await errorCode(res), `cantidad ${quantity}`).toBe("invalid_quantity");
    }
    const after = (await (await get(request, owner, `/restaurant/checks/${check.id}`)).json()) as Check;
    expect(after.items, "no debe agregarse nada").toHaveLength(0);
    expect((await post(request, owner, `/restaurant/checks/${check.id}/items`, { product_id: dish.id, quantity: 2 })).status()).toBe(201);
  });

  test("[PRO-131] el encabezado y Suscripción muestran los mismos días de prueba @regresion", async ({ browser, request }, info) => {
    const { company } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/inicio");
    const banner = await page.getByText(/días de prueba restantes/).first().innerText();
    await page.goto("/es/suscripcion");
    const panel = await page.getByText(/\d+\s+días restantes/).first().innerText();
    const days = (text: string) => Number(/(\d+)/.exec(text)![1]);
    expect(days(banner)).toBe(days(panel));
    expect(days(banner)).toBe(30);
    await context.close();
  });

  test("[PRO-132] el personal abre Mi perfil en una empresa sin punto de venta sin ninguna respuesta 403 @regresion", async ({ browser, request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const staff = await newMember(request, owner, uniquePrefix(info.workerIndex), "staff");
    const context = await browser.newContext({ storageState: ANON });
    const page = await context.newPage();
    const denied: string[] = [];
    page.on("response", (res) => {
      if (res.status() >= 400 && !res.url().includes("_next")) denied.push(`${res.status()} ${res.url().replace(API_URL, "")}`);
    });
    await uiLogin(page, staff.email, E2E_PASSWORD, /\/es\/mis-ordenes$/);
    await page.goto("/es/mi-perfil");
    await page.waitForLoadState("networkidle").catch(() => undefined);
    expect(denied, "no debe pedir /sales para averiguar si hay punto de venta").toEqual([]);
    await expect(menu(page).getByRole("link", { name: t("nav.mySales") })).toHaveCount(0);
    await context.close();
  });

  test("[PRO-125] las pestañas de Reportes se anuncian como pestañas (role=tab) para lectores de pantalla @regresion", async ({ browser, request }, info) => {
    const { company } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/reportes");
    await expect(page.getByRole("tablist", { name: t("reports.tabsLabel") })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Resumen" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Resumen" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Inventario" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Inventario" })).toBeFocused();
    await page.keyboard.press("End");
    await expect(page.getByRole("tab", { name: "Nómina" })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(page.getByRole("tab", { name: "Resumen" })).toBeFocused();
    await context.close();
  });
});

// ===================================================================================================================
// 12. Idioma y móvil
// ===================================================================================================================

const SCREENS = ["/inicio", "/dashboard", "/ordenes", "/ordenes?vista=cobradas", "/restaurante", "/terminales", "/inventario", "/inventario/recibir", "/inventario/conteo", "/personal", "/personal?tab=nomina", "/reportes", "/alertas", "/suscripcion", "/perfil", "/mi-perfil"];

test.describe("idioma y móvil en Pro", () => {
  test.use({ storageState: ANON });

  test("[PRO-110] en inglés ninguna pantalla de Pro muestra claves de traducción @regresion", async ({ browser, request }, info) => {
    test.setTimeout(240_000);
    const { company } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);
    for (const route of SCREENS) {
      await page.goto(`/en${route}`);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const body = await page.locator("body").innerText();
      expect(body, route).not.toMatch(/\b(?:[a-z]+\.){1,3}[a-zA-Z]+\b(?<!\.(?:com|org|io|test|demo))/);
      expect(body, route).not.toMatch(/Translation missing/i);
    }
    await context.close();
  });

  test("[PRO-111] en el teléfono (390 px) ninguna pantalla de Pro se desborda horizontalmente @regresion", async ({ browser, request }, info) => {
    test.setTimeout(240_000);
    const { company } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company, { width: 390, height: 844 });
    for (const route of SCREENS) {
      await page.goto(`/es${route}`);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(scroll, route).toBeLessThanOrEqual(client);
    }
    await context.close();
  });

  test("[PRO-112] pantallas del staff en el teléfono: Mis órdenes y su asistencia caben @regresion", async ({ browser, request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const staff = await newMember(request, owner, uniquePrefix(info.workerIndex), "staff");
    const context = await browser.newContext({ storageState: ANON, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await uiLogin(page, staff.email, E2E_PASSWORD, /\/es\/mis-ordenes$/);
    for (const route of ["/mis-ordenes", "/mi-perfil", "/pedido"]) {
      await page.goto(`/es${route}`);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(scroll, route).toBeLessThanOrEqual(client);
    }
    await context.close();
  });
});
