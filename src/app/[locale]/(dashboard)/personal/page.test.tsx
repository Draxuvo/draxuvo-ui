import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";

let search = "";
let modules = ["employees", "attendance"];
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/es/personal",
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/hooks/use-router", () => ({ useAppRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/services/subscription", () => ({
  getSubscription: vi.fn(() => Promise.resolve({ active_modules: modules })),
}));
vi.mock("@/components/people/employees-tab", () => ({ EmployeesTab: () => <p>cuerpo empleados</p> }));
vi.mock("@/components/people/attendance-tab", () => ({ AttendanceTab: () => <p>cuerpo asistencia</p> }));
vi.mock("@/components/payroll/payroll-tab", () => ({ PayrollTab: () => <p>cuerpo nómina</p> }));

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
  modules = ["employees", "attendance"];
  vi.clearAllMocks();
});

describe("Personal (specs 029 y 036)", () => {
  it("admin ve Empleados y Asistencia, sin Acceso, y abre Empleados por defecto", async () => {
    as("admin");
    renderWithProviders(<PersonalPage />);

    expect(await screen.findByRole("heading", { name: "Personal" })).toBeInTheDocument();
    expect(await screen.findByRole("tab", { name: "Asistencia", selected: false })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Empleados", selected: true })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Acceso" })).not.toBeInTheDocument();
    expect(screen.getByText("cuerpo empleados")).toBeInTheDocument();
  });

  it("?tab=asistencia abre Asistencia", async () => {
    as("owner");
    search = "tab=asistencia";
    renderWithProviders(<PersonalPage />);

    expect(await screen.findByText("cuerpo asistencia")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Asistencia", selected: true })).toBeInTheDocument();
  });

  it("?tab=acceso (dirección vieja) cae en Empleados", async () => {
    as("owner");
    search = "tab=acceso";
    renderWithProviders(<PersonalPage />);

    expect(await screen.findByText("cuerpo empleados")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Empleados", selected: true })).toBeInTheDocument();
  });

  it("cambiar de pestaña pone ?tab= en la URL y descarta los filtros", async () => {
    as("admin");
    search = "status=active&page=2";
    const { default: userEvent } = await import("@testing-library/user-event");
    renderWithProviders(<PersonalPage />);

    await userEvent.click(await screen.findByRole("tab", { name: "Asistencia" }));

    expect(replace).toHaveBeenCalledWith("/es/personal?tab=asistencia", { scroll: false });
  });

  it("manager ve las dos pestañas y no la de Nómina", async () => {
    as("manager");
    renderWithProviders(<PersonalPage />);

    expect(await screen.findByText("cuerpo empleados")).toBeInTheDocument();
    expect(await screen.findByRole("tab", { name: "Asistencia" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Nómina" })).not.toBeInTheDocument();
  });

  it("dueño y administrador ven Nómina (spec 037) y ?tab=nomina la abre", async () => {
    as("owner");
    search = "tab=nomina";
    renderWithProviders(<PersonalPage />);

    expect(await screen.findByText("cuerpo nómina")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Nómina", selected: true })).toBeInTheDocument();
  });

  it("sin el módulo de empleados no hay pestaña Nómina", async () => {
    as("admin");
    modules = ["attendance"];
    renderWithProviders(<PersonalPage />);

    expect(await screen.findByText("cuerpo asistencia")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Nómina" })).not.toBeInTheDocument();
  });

  it("con solo el módulo de asistencia no hay pestaña Empleados y abre Asistencia", async () => {
    as("admin");
    modules = ["attendance"];
    search = "tab=empleados";
    renderWithProviders(<PersonalPage />);

    expect(await screen.findByText("cuerpo asistencia")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Empleados" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});
