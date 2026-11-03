// Redirección de /tickets y /mis-tickets a la pestaña Cobradas (spec 051). Conserva solo los filtros que la
// lista entiende (`status` válido, `search`, `page` entero positivo); cualquier otro parámetro se descarta.
import { TICKET_STATUSES } from "@/types";

type SearchParams = Record<string, string | string[] | undefined>;

export function buildPaidRedirect(locale: string, base: "/ordenes" | "/mis-ordenes", searchParams: SearchParams): string {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const query = new URLSearchParams({ vista: "cobradas" });

  const status = first(searchParams.status)?.trim();
  if (status && (TICKET_STATUSES as readonly string[]).includes(status)) query.set("status", status);

  const search = first(searchParams.search)?.trim();
  if (search) query.set("search", search);

  const page = first(searchParams.page)?.trim();
  if (page && /^\d+$/.test(page) && Number(page) > 0) query.set("page", String(Number(page)));

  return `/${locale}${base}?${query}`;
}
