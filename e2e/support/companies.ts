import type { Page } from "@playwright/test";
import { t } from "./i18n";

/**
 * Busca en la lista de empresas del super admin y espera la respuesta filtrada. Mientras llega, la lista se vacía y una hoja
 * abierta sobre una fila se cierra y se vuelve a montar: abrirla antes pierde el clic (SAD-014 y EXT-001, spec 060).
 */
export async function searchCompanies(page: Page, text: string) {
  const query = new URLSearchParams({ search: text }).toString();
  const filtered = page.waitForResponse((r) => r.url().includes("/api/v1/companies?") && r.url().includes(query));
  await page.getByPlaceholder(t("companies.searchPlaceholder")).fill(text);
  await filtered;
}
