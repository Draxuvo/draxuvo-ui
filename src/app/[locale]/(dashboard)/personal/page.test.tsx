import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";

let search = "";
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/es/personal",
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/hooks/use-router", () => ({ useAppRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/services/subscription", () => ({
  getSubscription: vi.fn().mockResolvedValue({ active_modules: ["employees"] }),
}));
vi.mock("@/components/people/employees-tab", () => ({ EmployeesTab: () => <p>cuerpo empleados</p> }));
vi.mock("@/components/people/access-tab", () => ({ AccessTab: () => <p>cuerpo acceso</p> }));

import PersonalPage from "./page";

function as(role: string) {
  useAuthStore.setState({
    user: { id: 1, role, companies: [{ id: 1, role, name: "Sazón" }] } as never,
    selectedCompanyId: 1,
    role: role as never,
  });
}

beforeEach(() => {
  search = "";
  vi.clearAllMocks();
});

describe("Personal (spec 028)", () => {
  it("admin ve las dos pestañas y abre Empleados por defecto", async () => {
    as("admin");
    renderWithProviders(<PersonalPage />);

    expect(await screen.findByRole("heading", { name: "Personal" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Empleados", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Acceso", selected: false })).toBeInTheDocument();
    expect(screen.getByText("cuerpo empleados")).toBeInTheDocument();
  });

  it("?tab=acceso abre Acceso", async () => {
    as("owner");
    search = "tab=acceso";
    renderWithProviders(<PersonalPage />);

    expect(await screen.findByText("cuerpo acceso")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Acceso", selected: true })).toBeInTheDocument();
  });

  it("cambiar de pestaña pone ?tab= en la URL y descarta los filtros", async () => {
    as("admin");
    search = "status=active&page=2";
    const { default: userEvent } = await import("@testing-library/user-event");
    renderWithProviders(<PersonalPage />);

    await userEvent.click(await screen.findByRole("tab", { name: "Acceso" }));

    expect(replace).toHaveBeenCalledWith("/es/personal?tab=acceso", { scroll: false });
  });

  it("manager solo ve Empleados, sin pestañas, aunque pida acceso", async () => {
    as("manager");
    search = "tab=acceso";
    renderWithProviders(<PersonalPage />);

    expect(await screen.findByText("cuerpo empleados")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByText("cuerpo acceso")).not.toBeInTheDocument();
  });
});
