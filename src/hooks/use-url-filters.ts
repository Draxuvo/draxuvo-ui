"use client";
// src/hooks/use-url-filters.ts
// Filtros de lista en la URL (contracts/ui-routes.md, R5). La URL es la fuente de verdad:
// un valor igual a su default no se escribe, cambiar un filtro quita `page` y "limpiar"
// deja la ruta sin query params. Usa `useSearchParams`: la página que lo llama debe quedar
// dentro de un <Suspense> para que el build de producción no falle.
import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type FilterValues<K extends string> = Record<K, string>;

export interface UseUrlFiltersOptions<K extends string> {
  /**
   * Valores permitidos por filtro. Un valor de la URL fuera de la lista se trata como
   * ausente (se usa el default). Sin lista, cualquier valor no vacío aplica.
   */
  allowed?: Partial<Record<K, readonly string[]>>;
}

export interface UseUrlFilters<K extends string> {
  filters: FilterValues<K>;
  page: number;
  setFilter: (key: K, value: string | null) => void;
  setFilters: (patch: Partial<Record<K, string | null>>) => void;
  setPage: (page: number) => void;
  reset: () => void;
  isFiltered: boolean;
}

function parsePage(raw: string | null): number {
  if (!raw) return 1;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function useUrlFilters<K extends string>(
  defaults: FilterValues<K>,
  options: UseUrlFiltersOptions<K> = {},
): UseUrlFilters<K> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { allowed } = options;

  const keys = useMemo(() => Object.keys(defaults) as K[], [defaults]);
  const query = searchParams.toString();

  const isAllowed = useCallback(
    (key: K, value: string) => {
      const list = allowed?.[key];
      return !list || list.includes(value);
    },
    [allowed],
  );

  const filters = useMemo(() => {
    const params = new URLSearchParams(query);
    const out = { ...defaults };
    for (const key of keys) {
      const raw = params.get(key)?.trim();
      if (raw && isAllowed(key, raw)) out[key] = raw;
    }
    return out;
  }, [query, defaults, keys, isAllowed]);

  const page = parsePage(new URLSearchParams(query).get("page"));

  const navigate = useCallback(
    (params: URLSearchParams) => {
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const setFilters = useCallback(
    (patch: Partial<Record<K, string | null>>) => {
      const params = new URLSearchParams(query);
      for (const key of Object.keys(patch) as K[]) {
        if (!keys.includes(key)) continue;
        const value = patch[key]?.trim() ?? "";
        if (!value || value === defaults[key] || !isAllowed(key, value)) params.delete(key);
        else params.set(key, value);
      }
      params.delete("page");
      navigate(params);
    },
    [query, keys, defaults, isAllowed, navigate],
  );

  const setFilter = useCallback(
    (key: K, value: string | null) => setFilters({ [key]: value } as Partial<Record<K, string | null>>),
    [setFilters],
  );

  const setPage = useCallback(
    (next: number) => {
      const params = new URLSearchParams(query);
      if (!Number.isInteger(next) || next <= 1) params.delete("page");
      else params.set("page", String(next));
      navigate(params);
    },
    [query, navigate],
  );

  const reset = useCallback(() => navigate(new URLSearchParams()), [navigate]);

  const isFiltered = keys.some((key) => filters[key] !== defaults[key]);

  return { filters, page, setFilter, setFilters, setPage, reset, isFiltered };
}
