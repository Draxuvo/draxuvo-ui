import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { flexRender } from "@tanstack/react-table";
import messages from "../../../messages/es.json";
import type { Company, Subscription } from "@/types";
import { getCompanyColumns, type CompanyRow } from "./columns";

function cell(row: CompanyRow) {
  const t = (key: string, values?: Record<string, string | number>) => {
    const text = key.split(".").reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], messages.companies) as string;
    return Object.entries(values ?? {}).reduce((out, [name, value]) => out.replace(`{${name}}`, String(value)), text ?? key);
  };
  const column = getCompanyColumns(t, (key) => key, { onEdit: vi.fn(), onDelete: vi.fn(), onViewSubscription: vi.fn(), onModules: vi.fn() })
    .find((item) => item.id === "modules")!;
  const context = { row: { original: row } } as never;
  return render(
    <NextIntlClientProvider locale="es" messages={messages}>
      {flexRender(column.cell, context)}
    </NextIntlClientProvider>,
  );
}

const company = { id: 1, name: "Taller" } as Company;
const sub = (available: string[], active: string[]) => ({ available_modules: available, active_modules: active }) as unknown as Subscription;

describe("columna Módulos de Empresas (spec 017)", () => {
  it("muestra los activos del total del plan", () => {
    cell({ company, subscription: sub(["a", "b", "c", "d", "e", "f", "g"], ["a", "b", "c", "d", "e", "f"]), isLoadingSub: false });
    expect(screen.getByText("6/7")).toBeInTheDocument();
  });

  it("muestra un guion sin suscripción y carga mientras consulta", () => {
    const view = cell({ company, subscription: null, isLoadingSub: false });
    expect(screen.getByText("—")).toBeInTheDocument();
    view.unmount();
    cell({ company, subscription: null, isLoadingSub: true });
    expect(screen.getByText("Cargando...")).toBeInTheDocument();
  });
});
