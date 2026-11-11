import path from "node:path";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { createCompany } from "../support/data";
import { t } from "../support/i18n";
import { API_URL } from "../support/session";

// Spec 061: el dueño sube la foto de un platillo desde Inventario y el menú QR público la entrega con el estilo
// elegido. El sitio público (`web`) no corre en el stack de e2e: la página del comensal se prueba con Vitest en `web`;
// aquí se comprueba lo que recibe el teléfono (GET /public/menus/:token) y que la foto sale en WebP y ligera.

const ANON = { cookies: [], origins: [] };
const PHOTO = path.join(import.meta.dirname, "..", "fixtures", "platillo.jpg");
const ph = (key: string, values?: Record<string, string | number>) => t(`inventory.photo.${key}`, values);

type Auth = { headers: Record<string, string> };
type MenuPhoto = { style: "card" | "thumbnail"; url: string; thumbnail_url?: string } | null;

async function ownerAuth(request: APIRequestContext, email: string, password: string): Promise<Auth> {
  const res = await request.post(`${API_URL}/api/v1/auth/login`, { data: { email, password } });
  expect(res.status()).toBe(200);
  const body = await res.json();
  return { headers: { Authorization: `Bearer ${body.token}`, "X-Company-Id": String(body.user.companies[0].id) } };
}

async function menuPhoto(request: APIRequestContext, token: string, name: string): Promise<MenuPhoto> {
  const res = await request.get(`${API_URL}/api/v1/public/menus/${token}`);
  expect(res.status(), await res.text()).toBe(200);
  const body = (await res.json()) as { categories: Array<{ items: Array<{ name: string; photo: MenuPhoto }> }> };
  return body.categories.flatMap((c) => c.items).find((i) => i.name === name)?.photo ?? null;
}

test.describe("fotos en el menú QR (spec 061)", () => {
  test.use({ storageState: ANON });

  test("[MFO-001] el dueño sube la foto de un platillo, sale en el menú público y cambia a miniatura @regresion", async ({ page, request }, info) => {
    test.setTimeout(90_000);
    const company = await createCompany(request, { workerIndex: info.workerIndex, plan: "pro" });
    const owner = await ownerAuth(request, company.email, company.password);
    const api = (p: string) => `${API_URL}/api/v1${p}`;

    // Una mesa (para el enlace del menú) y un producto que se vende.
    expect((await request.post(api("/restaurant/tables"), { headers: owner.headers, data: { table: { name: "1" } } })).status()).toBe(201);
    const types = (await (await request.get(api("/product_types"), { headers: owner.headers })).json()).results as Array<{ id: number; sellable: boolean }>;
    const name = `Pozole ${company.prefix}`;
    const created = await request.post(api("/products"), {
      headers: owner.headers,
      data: { product: { sku: `POZ-${company.prefix}`, name, price: 160, unit_cost: 50, product_type_id: types.find((x) => x.sellable)!.id } },
    });
    expect(created.status(), await created.text()).toBe(201);
    const links = (await (await request.get(api("/restaurant/menu_links"), { headers: owner.headers })).json()).results as Array<{ url: string }>;
    const token = links[0].url.split("/m/")[1];
    expect(await menuPhoto(request, token, name)).toBeNull();

    // El dueño abre el producto en Inventario y sube la foto.
    await page.goto("/es/login");
    await page.getByLabel(t("auth.email"), { exact: true }).fill(company.email);
    await page.getByLabel(t("auth.password"), { exact: true }).fill(company.password);
    await page.getByRole("button", { name: t("auth.submit") }).click();
    await expect(page).toHaveURL(/\/es\/inicio$/);
    await page.goto("/es/inventario");
    const row = page.getByRole("row").filter({ hasText: name });
    // Editar es el penúltimo botón de la fila (sin nombre accesible); un servicio no trae entrada ni salida.
    await row.getByRole("button").nth(-2).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText(ph("title"))).toBeVisible();

    await sheet.getByLabel(ph("title")).setInputFiles(PHOTO);
    await expect(page.getByText(ph("saved"))).toBeVisible();
    // La API prepara las versiones en segundo plano; el formulario consulta hasta que la foto está lista.
    await expect(sheet.getByRole("img", { name: ph("previewAlt", { name }) })).toHaveAttribute("src", /^(?!blob:)/, { timeout: 30_000 });
    await expect(sheet.getByText(ph("preparing"))).toHaveCount(0, { timeout: 30_000 });

    // El teléfono recibe la tarjeta con una URL firmada que entrega un WebP ligero.
    const card = await menuPhoto(request, token, name);
    expect(card?.style).toBe("card");
    const image = await request.get(card!.url);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/webp");
    expect((await image.body()).byteLength).toBeLessThanOrEqual(150 * 1024);

    // Cambiar a miniatura no vuelve a subir la foto y el menú la entrega con su miniatura.
    await sheet.getByRole("radio", { name: ph("styleThumbnail") }).check();
    await expect(page.getByText(ph("styleSaved"))).toBeVisible();
    const thumb = await menuPhoto(request, token, name);
    expect(thumb?.style).toBe("thumbnail");
    const small = await request.get(thumb!.thumbnail_url!);
    expect(small.status()).toBe(200);
    expect((await small.body()).byteLength).toBeLessThanOrEqual(30 * 1024);
  });
});
