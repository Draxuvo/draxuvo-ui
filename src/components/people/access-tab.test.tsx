import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";

const updateRole = vi.fn();
const members = [
  { id: 1, first_name: "Yo", last_name: "Mismo", email: "yo@x.mx", role: "owner", active: true },
  { id: 2, first_name: "Ana", last_name: "Admin", email: "ana@x.mx", role: "admin", active: true },
];
vi.mock("@/services/company-members", () => ({
  companyMembersService: {
    list: vi.fn(() => Promise.resolve({ results: members, info: { total: 2, pages_total: 1, page: 1 } })),
    updateRole: (...args: unknown[]) => updateRole(...args),
    invite: vi.fn(),
    remove: vi.fn(),
  },
}));

import { AccessTab } from "./access-tab";

function as(realRole: string, panelRole: string, userId: number) {
  useAuthStore.setState({
    user: { id: userId, role: realRole, companies: [{ id: 1, role: panelRole, name: "Sazón" }] } as never,
    selectedCompanyId: 1,
    role: panelRole as never,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  updateRole.mockResolvedValue({ ...members[0], role: "admin" });
});

describe("Acceso (spec 028)", () => {
  it("un administrador no puede dar ni tocar el rol de dueño", async () => {
    as("staff", "admin", 2);
    renderWithProviders(<AccessTab />);

    await screen.findByText("Yo Mismo");
    expect(screen.queryByLabelText("Rol de Yo Mismo")).not.toBeInTheDocument();
  });

  it("el super admin dentro de su empresa edita al dueño y confirma antes de dejarla sin dueño", async () => {
    as("super_admin", "admin", 99);
    renderWithProviders(<AccessTab />);

    const select = await screen.findByLabelText("Rol de Yo Mismo");
    await userEvent.selectOptions(select, "admin");

    expect(await screen.findByText("¿Dejar la empresa sin dueño?")).toBeInTheDocument();
    expect(updateRole).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() => expect(updateRole).toHaveBeenCalledWith(1, "admin"));
  });

  it("cancelar el aviso no cambia el rol", async () => {
    as("super_admin", "owner", 99);
    renderWithProviders(<AccessTab />);

    await userEvent.selectOptions(await screen.findByLabelText("Rol de Yo Mismo"), "manager");
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(updateRole).not.toHaveBeenCalled();
  });
});
