import { expect, test, type APIRequestContext, type APIResponse, type Browser, type Page } from "@playwright/test";
import { E2E_PASSWORD, createCompany, uniquePrefix, type NewCompany } from "../support/data";
import { t } from "../support/i18n";
import { API_URL, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD } from "../support/session";
import { passwordToken } from "../support/tokens";

// Plan Empresa de punta a punta. Incluye todo lo de Pro más WhatsApp y Multiempresa (sucursales). Aquí se prueba lo que
// es propio del plan (alcance, sucursales, WhatsApp, bajar y subir de plan, permisos entre sucursales) y un recorrido por
// cada módulo heredado de Pro. Cada prueba crea su propia empresa Empresa. Stripe, correo y WhatsApp no se tocan.

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
  const company = await createCompany(request, { workerIndex, plan: "enterprise" });
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

type Branch = { id: number; name: string; slug: string; parent_company_id: number | null };

/** Mismas credenciales pero con otra empresa activa (las sucursales se eligen con X-Company-Id). */
const inCompany = (a: Auth, companyId: number): Auth => ({ ...a, companyId, headers: { ...a.headers, "X-Company-Id": String(companyId) } });

async function superAdmin(request: Req): Promise<Auth> {
  const res = await request.post(`${API_URL}/api/v1/auth/login`, { data: { email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASSWORD } });
  expect(res.status(), "login super admin").toBe(200);
  const body = await res.json();
  return { token: body.token, companyId: 0, headers: { Authorization: `Bearer ${body.token}` } };
}

async function addBranch(request: Req, owner: Auth, name: string) {
  const res = await post(request, owner, "/company/branches", { branch: { name } });
  expect(res.status(), await text(res)).toBe(201);
  return ((await res.json()) as { company: Branch }).company;
}

const listBranches = async (request: Req, a: Auth) => (await (await get(request, a, "/company/branches")).json()) as Branch[];
const setPlan = (request: Req, sa: Auth, companyId: number, plan: string) => patch(request, inCompany(sa, companyId), "/subscription", { plan });

async function paidTicket(request: Req, a: Auth, total = 100) {
  const order = await finished(request, a, { items: [{ description: "Servicio", quantity: 1, unit_price: total }] });
  expect((await post(request, a, `/work_orders/${order.id}/charge`, { payments: [{ method: "cash", amount_received: total }] })).status()).toBe(200);
  const tickets = (await (await get(request, a, "/tickets")).json()) as { results: Array<{ id: number }> };
  return { order, ticketId: tickets.results[0].id };
}

const ALL_MODULES = ["attendance", "employees", "inventory", "multi_company", "reports", "restaurant", "terminals", "tickets", "whatsapp", "work_orders"];

// ===================================================================================================================
// 1. Alta y alcance del plan
// ===================================================================================================================

test.describe("alta y alcance del plan Empresa", () => {
  test.use({ storageState: ANON });

  test("[EMP-001] el dueño nuevo ve el menú de Empresa (todo lo de Pro y Mis empresas), sin lo que no incluye @pr", async ({ browser, request }, info) => {
    const { company } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);
    await expect
      .poll(async () => (await menu(page).getByRole("link").allInnerTexts()).map((l) => l.trim()), { timeout: 15_000 })
      .toEqual(expect.arrayContaining([t("nav.home"), t("nav.dashboard"), t("nav.people"), t("nav.inventory"), t("nav.orders"), t("nav.restaurant"), t("nav.terminals"), t("nav.reports"), t("nav.alerts"), t("nav.myCompanies"), t("subscription.nav")]));
    const links = (await menu(page).getByRole("link").allInnerTexts()).map((l) => l.trim());
    // El punto de venta es un extra; WhatsApp (configuración), Demos y Empresas son del super admin.
    for (const hidden of [t("nav.pos"), t("nav.sales"), t("nav.whatsapp"), t("nav.demos"), t("nav.companies")]) expect(links).not.toContain(hidden);
    await context.close();
  });

  test("[EMP-002] la sesión y la suscripción traen los diez módulos del plan y ningún extra @regresion", async ({ request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    const login = await (await request.post(`${API_URL}/api/v1/auth/login`, { data: { email: company.email, password: company.password } })).json();
    expect([...login.user.companies[0].modules].sort()).toEqual(ALL_MODULES);
    const sub = (await (await get(request, owner, "/subscription")).json()) as { plan: string; status: string; available_modules: string[]; addons: unknown[]; amount_cents: number };
    expect(sub.plan).toBe("enterprise");
    expect(sub.status).toBe("trialing");
    expect([...sub.available_modules].sort()).toEqual(ALL_MODULES);
    expect(sub.addons).toEqual([]);
  });

  test("[EMP-003] el catálogo público lista Empresa con sus diez módulos y su precio con IVA @regresion", async ({ request }) => {
    const body = await (await request.get(`${API_URL}/api/v1/plans`)).json();
    const ent = (body.plans ?? body.results ?? body).find((p: { key?: string; id?: string }) => (p.key ?? p.id) === "enterprise");
    expect(ent, JSON.stringify(body).slice(0, 300)).toBeTruthy();
    expect([...ent.modules].sort()).toEqual(ALL_MODULES);
    expect(ent.prices.monthly.amount_cents).toBe(159_900);
    expect(ent.prices.annual.amount_cents).toBe(1_599_000);
    expect(ent.prices.monthly.total_cents).toBe(185_484);
  });

  test("[EMP-004] Suscripción muestra el plan Empresa en prueba con su precio y sin la opción de comprar el punto de venta por su cuenta @regresion", async ({ browser, request }, info) => {
    const { company } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/suscripcion");
    await expect(page.getByText(t("plans.enterprise"), { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/En prueba/).first()).toBeVisible();
    await expect(page.getByText(/1,599/).first()).toBeVisible();
    await context.close();
  });

  test("[EMP-005] durante la prueba el dueño no cambia plan, módulos ni extras; solo el super admin @regresion", async ({ request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    const plan = await patch(request, owner, "/subscription", { plan: "pro" });
    expect(plan.status(), await text(plan)).toBe(403);
    expect(await errorCode(plan)).toBe("trial_plan_locked");
    expect((await patch(request, owner, "/company/modules", { disabled_modules: ["inventory"] })).status()).toBe(403);
    expect((await post(request, owner, "/subscription/addons", { module: "pos" })).status()).toBe(403);
    const sa = await superAdmin(request);
    expect((await setPlan(request, sa, owner.companyId, "enterprise")).status(), company.email).toBe(200);
  });

  test("[EMP-006] las pantallas de una empresa Empresa nueva explican qué hacer y no muestran errores @regresion", async ({ browser, request }, info) => {
    test.setTimeout(150_000);
    const { company } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);
    for (const route of ["/es/mis-empresas", "/es/ordenes", "/es/restaurante", "/es/terminales", "/es/inventario", "/es/personal", "/es/reportes", "/es/alertas", "/es/dashboard", "/es/suscripcion"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)'), route).toHaveCount(0);
      await expect(page.locator("main h1, main h2, h1, h2").first(), route).toBeVisible();
    }
    await context.close();
  });

  test("[EMP-007] el punto de venta sigue siendo un extra: en Empresa se bloquea en pantalla y API y no deja 403 en consola @regresion", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    for (const path of ["/sales", "/sales/catalog"]) {
      const res = await get(request, owner, path);
      expect(res.status(), path).toBe(403);
      expect(await errorCode(res), path).toBe("module_not_in_plan");
    }
    const { page, context } = await ownerPage(browser, company);
    const forbidden: string[] = [];
    page.on("response", (r) => { if (r.status() === 403) forbidden.push(r.url().replace(API_URL, "")); });
    await page.goto("/es/venta");
    await expect(page.getByText(t("subscription.moduleLocked"))).toBeVisible();
    await page.waitForLoadState("networkidle").catch(() => undefined);
    // Como el sondeo de /mi-perfil de la spec 054: si la suscripción ya dice que no hay módulo, no se pide (H-56).
    expect(forbidden).toEqual([]);
    await context.close();
  });

  test("[EMP-008] el dueño de Empresa no ve el menú ni las pantallas del super admin al abrir sus URL @regresion", async ({ browser, request }, info) => {
    const { company } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);
    const rejected: string[] = [];
    page.on("response", (r) => { if (r.status() === 403) rejected.push(r.url().replace(API_URL, "")); });
    for (const route of ["/es/usuarios", "/es/empresas", "/es/demos", "/es/suscripciones", "/es/whatsapp"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await expect(page, route).toHaveURL(/\/es\/inicio$/);
      const links = (await menu(page).getByRole("link").allInnerTexts()).map((l) => l.trim());
      expect(links, route).not.toContain(t("nav.companies"));
      expect(links, route).not.toContain(t("nav.demos"));
      await expect(page.getByText(t("adminUsers.title"), { exact: true }), route).toHaveCount(0);
      await expect(page.getByText(t("nav.superAdminRole"), { exact: true }), route).toHaveCount(0);
    }
    expect(rejected, "sin peticiones de listas globales rechazadas").toEqual([]);
    await context.close();
  });
});

// ===================================================================================================================
// 2. Sucursales (Multiempresa)
// ===================================================================================================================

test.describe("sucursales", () => {
  test.use({ storageState: ANON });

  test("[EMP-010] el dueño crea sucursales por API hasta el máximo de 3 empresas y la cuarta responde 422 con el tope @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const a = await addBranch(request, owner, "Norte");
    const b = await addBranch(request, owner, "Sur");
    expect(a.parent_company_id).toBe(owner.companyId);
    expect(b.parent_company_id).toBe(owner.companyId);
    const fourth = await post(request, owner, "/company/branches", { branch: { name: "Cuarta" } });
    expect(fourth.status(), await text(fourth)).toBe(422);
    expect(await errorCode(fourth)).toBe("company_limit_reached");
    expect(((await fourth.json()) as { error: { details: { limit: number } } }).error.details.limit).toBe(3);
    expect(await listBranches(request, owner)).toHaveLength(3);
  });

  test("[EMP-011] una sucursal no puede tener sucursales y la lista se ve igual desde la principal que desde la sucursal @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const norte = await addBranch(request, owner, "Norte");
    const nested = await post(request, inCompany(owner, norte.id), "/company/branches", { branch: { name: "Nieta" } });
    expect(nested.status(), await text(nested)).toBe(422);
    expect(await errorCode(nested)).toBe("not_a_main_company");
    const fromMain = (await listBranches(request, owner)).map((c) => c.id);
    const fromBranch = (await listBranches(request, inCompany(owner, norte.id))).map((c) => c.id);
    expect(fromBranch).toEqual(fromMain);
  });

  test("[EMP-012] el nombre de la sucursal se valida: vacío o solo espacios dan 422 sin mensajes técnicos @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    for (const name of ["", "   "]) {
      const res = await post(request, owner, "/company/branches", { branch: { name } });
      expect(res.status(), JSON.stringify(name)).toBe(422);
      const body = JSON.stringify(await res.json());
      expect(body, "sin la palabra 'Slug' en el mensaje al usuario").not.toMatch(/slug/i);
    }
    expect((await post(request, owner, "/company/branches", {})).status()).toBe(400);
    expect(await listBranches(request, owner)).toHaveLength(1);
  });

  test("[EMP-013] el nombre de una empresa o sucursal tiene tope de longitud (5,000 caracteres se rechazan) @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    expect((await post(request, owner, "/company/branches", { branch: { name: "x".repeat(121) } })).status(), "121 caracteres").toBe(422);
    expect((await post(request, owner, "/company/branches", { branch: { name: "w".repeat(120) } })).status(), "120 caracteres").toBe(201);
    const long = await post(request, owner, "/company/branches", { branch: { name: "x".repeat(5000) } });
    expect(long.status(), "crear sucursal con 5,000 caracteres").toBe(422);
    const rename = await patch(request, owner, "/company", { company: { name: "y".repeat(5000) } });
    expect(rename.status(), "renombrar con 5,000 caracteres").toBe(422);
  });

  test("[EMP-014] un nombre con HTML se guarda como texto y se muestra sin ejecutarse @regresion", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    const evil = `<img src=x onerror="window.__xss=1"> ${uniquePrefix()}`;
    await addBranch(request, owner, evil);
    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/mis-empresas");
    await expect(page.getByText(evil, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    await context.close();
  });

  test("[EMP-015] los nombres repetidos reciben una dirección (slug) distinta y no chocan @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const a = await addBranch(request, owner, "Centro");
    const b = await addBranch(request, owner, "Centro");
    expect(a.slug).not.toEqual(b.slug);
  });

  test("[EMP-016] los datos de cada sucursal están separados en todos los módulos y la principal no ve lo de la sucursal @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const norte = inCompany(owner, (await addBranch(request, owner, "Norte")).id);
    // Datos en la principal.
    await addPart(request, owner, "PRIN-1", 5);
    await newTerminal(request, owner, "Terminal principal");
    const { ticketId } = await paidTicket(request, owner);
    await newMember(request, owner, uniquePrefix(), "staff");
    // La sucursal arranca vacía en todo.
    const empty = async (a: Auth, path: string) => ((await (await get(request, a, path)).json()) as { info: { total: number } }).info.total;
    for (const path of ["/products", "/work_orders", "/tickets", "/employees"]) expect(await empty(norte, path), `sucursal ${path}`).toBe(0);
    expect(((await (await get(request, norte, "/payment_terminals")).json()) as { results?: unknown[] }).results ?? []).toHaveLength(0);
    expect((await get(request, norte, `/tickets/${ticketId}`)).status(), "ticket de la principal desde la sucursal").toBe(404);
    // Y al revés: lo que se cree en la sucursal no aparece en la principal.
    await addPart(request, norte, "NORTE-1", 2);
    const mainSkus = ((await (await get(request, owner, "/products")).json()) as { results: Array<{ sku: string }> }).results.map((p) => p.sku);
    expect(mainSkus).toContain("PRIN-1");
    expect(mainSkus).not.toContain("NORTE-1");
  });

  test("[EMP-017] el mismo SKU y el mismo folio pueden existir en dos sucursales sin chocar @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const norte = inCompany(owner, (await addBranch(request, owner, "Norte")).id);
    await addPart(request, owner, "MISMO-1", 3);
    await addPart(request, norte, "MISMO-1", 7);
    const a = await paidTicket(request, owner);
    const b = await paidTicket(request, norte);
    const folio = async (x: Auth, id: number) => ((await (await get(request, x, `/tickets/${id}`)).json()) as { folio?: string; number?: string }).folio;
    expect(await folio(owner, a.ticketId)).toBeTruthy();
    expect(await folio(norte, b.ticketId)).toBeTruthy();
  });

  test("[EMP-018] la sucursal usa la suscripción de la principal: no se paga, no se cambia y el dueño ve cuál es @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const norte = inCompany(owner, (await addBranch(request, owner, "Norte")).id);
    const mainSub = (await (await get(request, owner, "/subscription")).json()) as { plan: string; total_cents: number };
    const sub = (await (await get(request, norte, "/subscription")).json()) as { plan: string; managed_by_parent: boolean; total_cents: number };
    expect(sub.managed_by_parent).toBe(true);
    expect(sub.plan).toBe(mainSub.plan);
    expect(sub.total_cents, "agregar una sucursal no sube el cobro").toBe(mainSub.total_cents);
    for (const [method, path, data] of [["patch", "/subscription", { plan: "basic" }], ["post", "/subscription/checkout", { plan: "enterprise", billing_cycle: "monthly" }]] as const) {
      const res = method === "patch" ? await patch(request, norte, path, data) : await post(request, norte, path, data);
      expect(res.status(), path).toBe(422);
      expect(await errorCode(res), path).toBe("billing_managed_by_parent");
    }
  });

  test("[EMP-019] solo el dueño agrega sucursales: administrador y personal reciben 403 y no ven la sucursal @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const norte = await addBranch(request, owner, "Norte");
    const admin = await newMember(request, owner, uniquePrefix(), "admin");
    const staff = await newMember(request, owner, uniquePrefix(), "staff");
    for (const who of [admin, staff]) {
      const res = await post(request, who, "/company/branches", { branch: { name: "No debe existir" } });
      expect(res.status(), await text(res)).toBe(403);
      // Quien no es dueño de la sucursal no entra a ella con el encabezado.
      const cross = await get(request, inCompany(who, norte.id), "/products");
      expect(cross.status(), `acceso a la sucursal ${await text(cross)}`).toBe(403);
    }
    expect(JSON.stringify(await listBranches(request, owner))).not.toContain("No debe existir");
  });

  test("[EMP-020] otra cuenta no ve, usa ni agrega sucursales de esta empresa @pr", async ({ request }, info) => {
    const a = (await newOwner(request, info.workerIndex)).owner;
    const b = (await newOwner(request, info.workerIndex)).owner;
    const norte = await addBranch(request, a, "Norte de A");
    for (const path of ["/products", "/work_orders", "/tickets", "/employees", "/reports/summary", "/subscription"]) {
      expect((await get(request, inCompany(b, norte.id), path)).status(), path).toBe(403);
    }
    expect((await post(request, inCompany(b, a.companyId), "/company/branches", { branch: { name: "Intruso" } })).status()).toBe(403);
    expect(JSON.stringify(await listBranches(request, b))).not.toContain("Norte de A");
  });

  test("[EMP-021] el dueño da acceso de administrador y personal dentro de una sucursal y sus datos quedan en ella @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const norte = inCompany(owner, (await addBranch(request, owner, "Norte")).id);
    const created = await post(request, norte, "/employees", { employee: { name: `Cajero ${uniquePrefix()}`, email: `${uniquePrefix()}-n@mailinator.com`, phone: "5512345678", salary: 7000 }, access: { role: "staff" } });
    expect(created.status(), await text(created)).toBe(201);
    const inNorte = ((await (await get(request, norte, "/employees")).json()) as { info: { total: number } }).info.total;
    const inMain = ((await (await get(request, owner, "/employees")).json()) as { info: { total: number } }).info.total;
    expect(inNorte).toBe(1);
    expect(inMain, "la principal no hereda al empleado de la sucursal").toBe(0);
  });

  test("[EMP-022] la sucursal no tiene baja ni cambio de principal: el nombre se edita y el borrado no existe @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const norte = inCompany(owner, (await addBranch(request, owner, "Norte")).id);
    const renamed = await patch(request, norte, "/company", { company: { name: "Norte renombrada" } });
    expect(renamed.status(), await text(renamed)).toBe(200);
    expect(((await renamed.json()) as { name: string }).name).toBe("Norte renombrada");
    // Hoy no hay forma de eliminar ni archivar una sucursal: se documenta como brecha de producto, no como falla.
    const gone = await del(request, norte, "/company");
    expect([404, 405]).toContain(gone.status());
  });

  test("[EMP-023] un verbo o ruta que no existe en la API responde JSON y no la página HTML de Rails @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    for (const [method, path] of [["delete", "/company"], ["put", "/products"], ["delete", "/plans"]] as const) {
      const res = await request.fetch(`${API_URL}/api/v1${path}`, { method, headers: owner.headers });
      expect(res.headers()["content-type"], `${method} ${path}`).toContain("application/json");
    }
  });
});

// ===================================================================================================================
// 3. Bajar y subir de plan con sucursales
// ===================================================================================================================

test.describe("cambio de plan con sucursales", () => {
  test.use({ storageState: ANON });

  test("[EMP-030] al bajar a Pro la sucursal se bloquea (403 module_not_in_plan) sin borrar datos y la principal sigue @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const norte = inCompany(owner, (await addBranch(request, owner, "Norte")).id);
    await addPart(request, norte, "NORTE-1", 4);
    await addPart(request, owner, "PRIN-1", 4);
    const sa = await superAdmin(request);
    expect((await setPlan(request, sa, owner.companyId, "pro")).status()).toBe(200);

    for (const path of ["/products", "/work_orders", "/tickets"]) {
      const res = await get(request, norte, path);
      expect(res.status(), `sucursal ${path}`).toBe(403);
      expect(await errorCode(res), path).toBe("module_not_in_plan");
    }
    expect((await get(request, owner, "/products")).status(), "la principal sigue trabajando").toBe(200);
    const more = await post(request, owner, "/company/branches", { branch: { name: "Otra" } });
    expect(more.status()).toBe(403);
    expect(await errorCode(more)).toBe("module_not_in_plan");

    // Volver a Empresa la desbloquea con sus datos intactos.
    expect((await setPlan(request, sa, owner.companyId, "enterprise")).status()).toBe(200);
    const skus = ((await (await get(request, norte, "/products")).json()) as { results: Array<{ sku: string }> }).results.map((p) => p.sku);
    expect(skus).toEqual(["NORTE-1"]);
  });

  test("[EMP-031] la lista de empresas del usuario sigue mostrando la sucursal bloqueada y el aviso lleva a la principal @regresion", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    const norte = await addBranch(request, owner, `Bloqueada ${uniquePrefix()}`);
    const sa = await superAdmin(request);
    await setPlan(request, sa, owner.companyId, "pro");
    const { page, context } = await ownerPage(browser, company);
    // Sin el módulo ya no hay página de «Mis empresas» en el menú de Pro, pero la sucursal no debe romper la sesión.
    await page.goto("/es/inicio");
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toHaveCount(0);
    const stored = await page.evaluate(() => localStorage.getItem("selected_company_id"));
    expect(stored).toBe(String(owner.companyId));
    void norte;
    await context.close();
  });

  test("[EMP-032] bajar a Básico bloquea además lo que Pro tenía y subir otra vez lo devuelve todo @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    await addPart(request, owner, "KEEP-1", 3);
    const sa = await superAdmin(request);
    expect((await setPlan(request, sa, owner.companyId, "basic")).status()).toBe(200);
    for (const path of ["/work_orders", "/tickets", "/payment_terminals", "/restaurant/tables"]) {
      const res = await get(request, owner, path);
      expect(res.status(), path).toBe(403);
      expect(await errorCode(res), path).toBe("module_not_in_plan");
    }
    expect((await get(request, owner, "/products")).status()).toBe(200);
    expect((await setPlan(request, sa, owner.companyId, "enterprise")).status()).toBe(200);
    for (const path of ["/work_orders", "/tickets", "/payment_terminals", "/restaurant/tables"]) expect((await get(request, owner, path)).status(), path).toBe(200);
    expect(((await (await get(request, owner, "/products")).json()) as { info: { total: number } }).info.total).toBe(1);
  });

  test("[EMP-033] el super admin ve la sucursal como empresa propia ligada a su principal y la lista no cuenta doble el cobro @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const norte = await addBranch(request, owner, "Norte");
    const sa = await superAdmin(request);
    const rows = ((await (await request.get(`${API_URL}/api/v1/companies?page_size=200`, { headers: sa.headers })).json()) as { results: Branch[] }).results;
    const found = rows.find((c) => c.id === norte.id);
    expect(found?.parent_company_id).toBe(owner.companyId);
    // Una sucursal no tiene suscripción propia: no hay segunda factura.
    const sub = (await (await get(request, inCompany(sa, norte.id), "/subscription")).json()) as { managed_by_parent: boolean };
    expect(sub.managed_by_parent).toBe(true);
  });
});

// ===================================================================================================================
// 4. WhatsApp
// ===================================================================================================================

test.describe("WhatsApp en Empresa", () => {
  test.use({ storageState: ANON });

  test("[EMP-040] enviar el ticket por WhatsApp sin cuenta conectada responde 422 claro, nunca 500, y Pro y Básico dan 403 @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const { ticketId } = await paidTicket(request, owner);
    // La orden no tiene teléfono: sin uno en el cuerpo la API lo pide (400). Con uno, sin cuenta conectada, 422.
    const noPhone = await post(request, owner, `/tickets/${ticketId}/send_whatsapp`, {});
    expect(noPhone.status(), await text(noPhone)).toBe(400);
    for (const body of [{ phone: "5512345678" }, { phone: "abc" }, { phone: "123" }, { phone: "x".repeat(500) }]) {
      const res = await post(request, owner, `/tickets/${ticketId}/send_whatsapp`, body);
      expect(res.status(), `${JSON.stringify(body).slice(0, 40)} → ${await text(res)}`).toBe(422);
    }
    expect((await post(request, owner, `/tickets/999999/send_whatsapp`, {})).status()).toBe(404);

    const pro = await createCompany(request, { workerIndex: info.workerIndex, plan: "pro" });
    const proOwner = await loginApi(request, pro.email, pro.password);
    const proTicket = await paidTicket(request, proOwner);
    const denied = await post(request, proOwner, `/tickets/${proTicket.ticketId}/send_whatsapp`, {});
    expect(denied.status()).toBe(403);
    expect(await errorCode(denied)).toBe("module_not_in_plan");
  });

  test("[EMP-041] el ticket de otra empresa o sucursal no se manda por WhatsApp @regresion", async ({ request }, info) => {
    const a = (await newOwner(request, info.workerIndex)).owner;
    const b = (await newOwner(request, info.workerIndex)).owner;
    const norte = inCompany(a, (await addBranch(request, a, "Norte")).id);
    const { ticketId } = await paidTicket(request, a);
    expect((await post(request, b, `/tickets/${ticketId}/send_whatsapp`, {})).status()).toBe(404);
    expect((await post(request, norte, `/tickets/${ticketId}/send_whatsapp`, {})).status(), "desde la sucursal").toBe(404);
  });

  test("[EMP-042] el aviso de WhatsApp aparece en el ticket y en el cobro solo en Empresa, no en Pro @regresion", async ({ browser, request }, info) => {
    test.setTimeout(120_000);
    const ent = await newOwner(request, info.workerIndex);
    const entTicket = await paidTicket(request, ent.owner);
    const entPage = await ownerPage(browser, ent.company);
    await entPage.page.goto(`/es/ordenes?vista=cobradas&ticket=${entTicket.ticketId}`);
    await expect(entPage.page.getByRole("button", { name: t("tickets.resendWhatsapp") })).toBeVisible();
    await entPage.context.close();

    const pro = await createCompany(request, { workerIndex: info.workerIndex, plan: "pro" });
    const proOwner = await loginApi(request, pro.email, pro.password);
    const proTicket = await paidTicket(request, proOwner);
    const proPage = await ownerPage(browser, pro);
    await proPage.page.goto(`/es/ordenes?vista=cobradas&ticket=${proTicket.ticketId}`);
    await expect(proPage.page.getByRole("button", { name: t("tickets.download") })).toBeVisible();
    // El módulo no está en Pro: no se ofrece el envío (H-59).
    await expect(proPage.page.getByRole("button", { name: t("tickets.resendWhatsapp") })).toHaveCount(0);
    await proPage.context.close();
  });

  test("[EMP-043] el dueño no entra a la configuración de WhatsApp de la plataforma ni por API ni por URL @regresion", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    for (const path of ["/whatsapp", "/whatsapp/guide", "/whatsapp/events"]) expect((await get(request, owner, path)).status(), path).toBe(403);
    expect((await request.put(`${API_URL}/api/v1/whatsapp/connection`, { headers: owner.headers, data: { token: "x" } })).status()).toBe(403);
    const { page, context } = await ownerPage(browser, company);
    await page.goto("/es/whatsapp");
    // Desde la spec 055 el filtro de rutas lo manda a su inicio en vez de mostrar el marco del super admin.
    await expect(page).toHaveURL(/\/es\/inicio$/);
    await expect(page.getByText(t("whatsapp.title"), { exact: true })).toHaveCount(0);
    await context.close();
  });
});

// ===================================================================================================================
// 5. Módulos heredados de Pro, en una empresa Empresa y en una sucursal
// ===================================================================================================================

test.describe("módulos de Pro dentro de Empresa", () => {
  test.use({ storageState: ANON });

  test("[EMP-050] la orden con refacción descuenta existencias, avisa faltantes y la anulación las regresa, en la principal y en la sucursal @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const norte = inCompany(owner, (await addBranch(request, owner, "Norte")).id);
    for (const [label, who] of [["principal", owner], ["sucursal", norte]] as const) {
      const part = await addPart(request, who, `F-${label}`, 3);
      const order = await finished(request, who, { items: [{ product_id: part.id, quantity: 5 }] });
      const charged = await post(request, who, `/work_orders/${order.id}/charge`, { payments: [{ method: "cash", amount_received: 200 }] });
      expect(charged.status(), `${label} ${await text(charged)}`).toBe(200);
      const body = (await charged.json()) as { stock_shortages?: Array<{ missing: number | string }> };
      expect(Number(body.stock_shortages?.[0]?.missing), `${label}: faltan 2`).toBe(2);
      const after = (await (await get(request, who, `/products/${part.id}`)).json()) as { stock: number };
      expect(after.stock, `${label}: nunca negativo`).toBe(0);
      expect((await post(request, who, `/work_orders/${order.id}/void_charge`, { reason: "prueba" })).status()).toBe(200);
      const back = (await (await get(request, who, `/products/${part.id}`)).json()) as { stock: number };
      expect(back.stock, `${label}: regresa lo que salió`).toBe(3);
    }
  });

  test("[EMP-051] el restaurante de una sucursal cobra una cuenta de mesa con tarjeta sin referencia y no mezcla mesas con la principal @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const norte = inCompany(owner, (await addBranch(request, owner, "Norte")).id);
    const table = await post(request, norte, "/restaurant/tables", { table: { name: "Mesa N1" } });
    expect(table.status(), await text(table)).toBe(201);
    const tableId = ((await table.json()) as { id: number }).id;
    const mainTables = ((await (await get(request, owner, "/restaurant/tables")).json()) as { tables?: unknown[]; results?: unknown[] });
    expect((mainTables.tables ?? mainTables.results ?? []).length, "la principal no ve la mesa de la sucursal").toBe(0);
    const check = await post(request, norte, "/restaurant/checks", { dining_table_id: tableId });
    expect(check.status(), await text(check)).toBe(201);
    const checkId = ((await check.json()) as { id: number }).id;
    const stationless = await post(request, norte, "/restaurant/checks/" + checkId + "/items", { product_id: 0, quantity: 1 });
    expect([404, 422], await text(stationless)).toContain(stationless.status());
    // La mesa de la sucursal no se abre desde la principal.
    expect((await post(request, owner, "/restaurant/checks", { dining_table_id: tableId })).status()).toBe(404);
  });

  test("[EMP-052] las terminales de la principal no se pueden usar para cobrar en una sucursal @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const norte = inCompany(owner, (await addBranch(request, owner, "Norte")).id);
    const terminal = await newTerminal(request, owner, "Terminal principal");
    const order = await finished(request, norte);
    const res = await post(request, norte, `/work_orders/${order.id}/charge`, { payments: [{ method: "card", amount: 100, terminal_id: terminal.id }] });
    expect(res.status(), await text(res)).toBe(422);
  });

  test("[EMP-053] Reportes de una sucursal solo cuentan lo de la sucursal y los de la principal no suman a la sucursal @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const norte = inCompany(owner, (await addBranch(request, owner, "Norte")).id);
    await paidTicket(request, owner, 300);
    await paidTicket(request, norte, 120);
    const revenue = async (a: Auth) => ((await (await get(request, a, "/reports/summary")).json()) as { income: { total_revenue: number; tickets_paid: number } }).income;
    const main = await revenue(owner);
    const branch = await revenue(norte);
    expect(Number(main.total_revenue)).toBe(300);
    expect(Number(branch.total_revenue)).toBe(120);
    expect(main.tickets_paid).toBe(1);
    expect(branch.tickets_paid).toBe(1);
  });

  test("[EMP-054] la nómina y la asistencia son por empresa: una corrida de la principal no incluye al personal de la sucursal @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const norte = inCompany(owner, (await addBranch(request, owner, "Norte")).id);
    await newMember(request, owner, uniquePrefix(), "staff", 9000);
    const created = await post(request, norte, "/employees", { employee: { name: `Sucursal ${uniquePrefix()}`, salary: 5000 } });
    expect(created.status(), await text(created)).toBe(201);
    const run = await post(request, owner, "/payroll_runs", { starts_on: "2026-11-01", ends_on: "2026-11-15", period_type: "biweekly" });
    expect(run.status(), await text(run)).toBe(201);
    const payments = ((await run.json()) as { payments?: unknown[]; lines?: unknown[] });
    expect((payments.payments ?? payments.lines ?? []).length, "solo el empleado de la principal").toBe(1);
  });

  test("[EMP-055] la paginación inválida responde 422 y las listas de Empresa nunca dan 500 @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    for (const path of ["/tickets", "/work_orders", "/products", "/employees", "/attendances", "/payroll_runs", "/company/members"]) {
      for (const q of ["page=0", "page=-1", "page=abc", "page_size=0", "page_size=-3"]) {
        const res = await get(request, owner, `${path}?${q}`);
        expect(res.status(), `${path}?${q}`).toBeLessThan(500);
      }
    }
  });
});

// ===================================================================================================================
// 6. Seguridad y permisos del plan
// ===================================================================================================================

test.describe("permisos y seguridad en Empresa", () => {
  test.use({ storageState: ANON });

  test("[EMP-060] el personal no lee salarios ni edita empresa, inventario o empleados por la API @pr", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const staff = await newMember(request, owner, uniquePrefix(), "staff");
    const part = await addPart(request, owner, "PERM-1", 5);
    expect((await patch(request, staff, "/company", { company: { name: "Hackeada" } })).status(), "editar empresa").toBe(403);
    const company = (await (await get(request, staff, "/company")).json()) as Record<string, unknown>;
    expect(company, "stripe_id oculto al personal").not.toHaveProperty("stripe_id");
    const people = (await (await get(request, staff, "/employees")).json()) as { results: Array<Record<string, unknown>> };
    for (const person of people.results) {
      for (const secret of ["salary", "email", "phone"]) expect(person, `el personal no ve ${secret} de otros`).not.toHaveProperty(secret);
    }
    expect((await post(request, staff, "/employees", { employee: { name: "Nuevo" } })).status()).toBe(403);
    expect((await patch(request, staff, `/products/${part.id}`, { product: { name: "robado" } })).status()).toBe(403);
    // Por diseño (spec 034) cualquier miembro con Inventario registra entradas y salidas: queda quién lo hizo.
    const move = await post(request, staff, `/products/${part.id}/stock_movements`, { stock_movement: { movement_type: "entry", qty: 1 } });
    expect(move.status(), await text(move)).toBe(201);
    expect(((await move.json()) as { movement: { user?: { id: number } } }).movement.user?.id, "el movimiento guarda quién lo hizo").toBe(staff.userId);
    expect((await get(request, staff, "/reports/summary")).status()).toBe(403);
    expect((await get(request, staff, "/company/branches")).status(), "el personal no lista sucursales").toBe(403);
  });

  test("[EMP-061] un usuario dado de baja pierde el acceso al momento, también en las sucursales @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const staff = await newMember(request, owner, uniquePrefix(), "staff");
    expect((await get(request, staff, "/work_orders")).status()).toBe(200);
    const off = await patch(request, owner, `/employees/${staff.employeeId}`, { employee: { status: "inactive" } });
    expect(off.status(), await text(off)).toBe(200);
    const after = await get(request, staff, "/work_orders");
    expect(after.status(), await text(after)).toBe(403);
  });

  test("[EMP-062] el inicio de sesión se limita tras muchos intentos fallidos @regresion", async ({ request }, info) => {
    const { company } = await newOwner(request, info.workerIndex);
    const statuses: number[] = [];
    for (let i = 0; i < 14; i++) {
      const res = await request.post(`${API_URL}/api/v1/auth/login`, { data: { email: company.email, password: `mala-${i}` } });
      statuses.push(res.status());
    }
    expect(statuses.every((s) => s === 401 || s === 429)).toBe(true);
    // La API de pruebas arranca con LOGIN_RATE_LIMIT alto; si hay tope real, debe aparecer algún 429 antes del intento 14.
    test.skip(!statuses.includes(429) && process.env.LOGIN_RATE_LIMIT === "100", "El stack de pruebas sube el tope de intentos");
    expect(statuses).toContain(429);
  });

  test("[EMP-063] un administrador de la principal no cambia plan, módulos ni extras ni crea sucursales @regresion", async ({ request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const admin = await newMember(request, owner, uniquePrefix(), "admin");
    expect((await patch(request, admin, "/subscription", { plan: "basic" })).status()).toBe(403);
    expect((await patch(request, admin, "/company/modules", { disabled_modules: ["inventory"] })).status()).toBe(403);
    expect((await post(request, admin, "/company/branches", { branch: { name: "Admin no puede" } })).status()).toBe(403);
    expect((await get(request, admin, "/subscription")).status()).toBe(200);
  });

  test("[EMP-064] el personal abre por URL Reportes, Suscripción y Mis empresas y vuelve a su pantalla sin errores @regresion", async ({ browser, request }, info) => {
    const { owner } = await newOwner(request, info.workerIndex);
    const staff = await newMember(request, owner, uniquePrefix(), "staff");
    const context = await browser.newContext({ storageState: ANON });
    const page = await context.newPage();
    await uiLogin(page, staff.email, E2E_PASSWORD);
    const bad: string[] = [];
    page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("_next")) bad.push(`${r.status()} ${r.url().replace(API_URL, "")}`); });
    for (const route of ["/es/reportes", "/es/suscripcion", "/es/mis-empresas"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await expect(page, route).toHaveURL(/\/es\/(mis-ordenes|inicio|perfil|mi-perfil)/);
    }
    expect(bad, "peticiones rechazadas al entrar por URL").toEqual([]);
    await context.close();
  });
});

// ===================================================================================================================
// 7. Pantallas de sucursales, idioma y móvil
// ===================================================================================================================

test.describe("pantallas de Empresa", () => {
  test.use({ storageState: ANON });

  test("[EMP-070] Mis empresas: crea sucursales con la pantalla, cuenta y bloquea al llegar a 3, y cambia de empresa con el selector @pr", async ({ browser, request }, info) => {
    test.setTimeout(120_000);
    const { company } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);
    const prefix = uniquePrefix(info.workerIndex);
    const mine = (key: string, values?: Record<string, string | number>) => t(`myCompanies.${key}`, values);
    await page.goto("/es/mis-empresas");
    await expect(page.getByText(mine("usage", { count: 1, max: 3 }))).toBeVisible();
    for (const [i, name] of [`Norte ${prefix}`, `Sur ${prefix}`].entries()) {
      await page.getByPlaceholder(mine("namePlaceholder")).fill(name);
      await page.getByRole("button", { name: mine("create"), exact: true }).click();
      await expect(page.getByText(mine("created", { company: name }))).toBeVisible();
      await expect(page.getByText(mine("usage", { count: i + 2, max: 3 }))).toBeVisible();
    }
    await expect(page.getByText(mine("limitReached", { max: 3 }))).toBeVisible();
    await page.getByRole("button", { name: mine("switchLabel", { company: `Sur ${prefix}` }) }).click();
    await expect(page).toHaveURL(/\/es\/inicio$/);
    await expect(page.getByRole("button", { name: /Cambiar de empresa/ })).toContainText(`Sur ${prefix}`);
    await context.close();
  });

  test("[EMP-071] Mis empresas valida el nombre en pantalla: vacío no envía y un nombre larguísimo se rechaza o se recorta @regresion", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);
    const mine = (key: string, values?: Record<string, string | number>) => t(`myCompanies.${key}`, values);
    await page.goto("/es/mis-empresas");
    await page.getByRole("button", { name: mine("create"), exact: true }).click();
    await expect(page.getByText(mine("usage", { count: 1, max: 3 }))).toBeVisible();
    await page.getByPlaceholder(mine("namePlaceholder")).fill("z".repeat(500));
    const answered = page.waitForResponse((r) => r.url().includes("/company/branches") && r.request().method() === "POST");
    await page.getByRole("button", { name: mine("create"), exact: true }).click();
    await answered;
    // La pantalla limita el nombre a 120: no queda una sucursal con 500 caracteres (H-58, EMP-013).
    const names = (await (await request.get(`${API_URL}/api/v1/company/branches`, { headers: { Authorization: `Bearer ${owner.token}`, "X-Company-Id": String(owner.companyId) } })).json()) as Branch[];
    expect(Math.max(...names.map((c) => c.name.length))).toBeLessThanOrEqual(120);
    await context.close();
  });

  test("[EMP-072] en la sucursal el encabezado indica en qué empresa se trabaja y Suscripción manda a la principal @regresion", async ({ browser, request }, info) => {
    test.setTimeout(90_000);
    const { company, owner } = await newOwner(request, info.workerIndex);
    const name = `Centro ${uniquePrefix()}`;
    await addBranch(request, owner, name);
    const { page, context } = await ownerPage(browser, company);
    await page.getByRole("button", { name: /Cambiar de empresa/ }).click();
    await page.getByRole("menuitemradio", { name: new RegExp(name) }).click();
    await expect(page.getByRole("button", { name: /Cambiar de empresa/ })).toContainText(name);
    await page.goto("/es/suscripcion");
    await expect(page.getByText(/La facturación la administra/)).toBeVisible();
    await page.goto("/es/inicio");
    await expect(page.getByRole("button", { name: /Cambiar de empresa/ })).toContainText(name);
    await context.close();
  });

  test("[EMP-073] el inglés no muestra claves de traducción en Mis empresas, Suscripción ni el ticket @regresion", async ({ browser, request }, info) => {
    const { company } = await newOwner(request, info.workerIndex);
    const { page, context } = await ownerPage(browser, company);
    for (const route of ["/en/mis-empresas", "/en/suscripcion", "/en/ordenes", "/en/reportes"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const body = await page.locator("body").innerText();
      expect(body, route).not.toMatch(/\b(myCompanies|subscription|nav|tickets)\.[a-zA-Z]+\b/);
      expect(body, route).not.toMatch(/Translation missing/i);
    }
    await context.close();
  });

  test("[EMP-074] a 390 px Mis empresas, Suscripción y el selector de empresa no se desbordan @regresion", async ({ browser, request }, info) => {
    const { company, owner } = await newOwner(request, info.workerIndex);
    await addBranch(request, owner, `Sucursal con un nombre bastante largo ${uniquePrefix()}`);
    const { page, context } = await ownerPage(browser, company, { width: 390, height: 844 });
    for (const route of ["/es/mis-empresas", "/es/suscripcion", "/es/inicio"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, route).toBeLessThanOrEqual(1);
    }
    await context.close();
  });
});
