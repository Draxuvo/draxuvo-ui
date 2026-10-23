import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import type { Employee } from "@/types";

vi.mock("@/services/employees", () => ({
  employeesService: { grantAccess: vi.fn(), changeAccess: vi.fn(), revokeAccess: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AxiosError } from "axios";
import { toast } from "sonner";
import { employeesService } from "@/services/employees";
import { CreateAccessFields, EditAccess, useAssignableRoles } from "./access-section";

const base: Employee = { id: 4, name: "Marta Gómez", status: "active", created_at: "", email: "marta@x.mx", phone: "5511" };

function as(role: string, userRole = role) {
  useAuthStore.setState({ user: { id: 1, role: userRole } as never, selectedCompanyId: 1, role: role as never });
}

beforeEach(() => {
  vi.clearAllMocks();
  as("admin");
});

function Roles() {
  return <p>{useAssignableRoles().join(",")}</p>;
}

describe("useAssignableRoles", () => {
  it("admin llega hasta admin; owner hasta owner; manager y staff a ninguno", () => {
    as("admin");
    const { unmount } = renderWithProviders(<Roles />);
    expect(screen.getByText("staff,manager,admin")).toBeInTheDocument();
    unmount();
    as("owner");
    const second = renderWithProviders(<Roles />);
    expect(screen.getByText("staff,manager,admin,owner")).toBeInTheDocument();
    second.unmount();
    as("manager");
    const third = renderWithProviders(<Roles />);
    expect(third.container.textContent).toBe("");
  });
});

describe("CreateAccessFields", () => {
  it("el rol solo aparece con el interruptor encendido y ofrece roles hasta el propio", () => {
    const onEnabled = vi.fn();
    const { rerender } = renderWithProviders(<CreateAccessFields enabled={false} onEnabledChange={onEnabled} role="staff" onRoleChange={vi.fn()} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(onEnabled).toHaveBeenCalledWith(true);

    rerender(<CreateAccessFields enabled onEnabledChange={onEnabled} role="staff" onRoleChange={vi.fn()} />);
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toHaveLength(3);
    expect(options).not.toContain("Propietario");
  });
});

describe("EditAccess", () => {
  it("sin acceso: da acceso con correo, teléfono y rol", async () => {
    vi.mocked(employeesService.grantAccess).mockResolvedValue(base);
    renderWithProviders(<EditAccess employee={base} />);

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dar acceso al panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Dar acceso" }));

    await waitFor(() => expect(employeesService.grantAccess).toHaveBeenCalledWith(4, { email: "marta@x.mx", phone: "5511", role: "staff" }));
    expect(toast.success).toHaveBeenCalled();
  });

  it("con acceso: cambia el rol y lo quita con confirmación", async () => {
    vi.mocked(employeesService.changeAccess).mockResolvedValue({ ...base, access: { id: 8, email: "marta@x.mx", role: "manager", active: true } });
    vi.mocked(employeesService.revokeAccess).mockResolvedValue(base);
    const employee = { ...base, access: { id: 8, email: "marta@x.mx", role: "staff" as const, active: true } };
    renderWithProviders(<EditAccess employee={employee} />);

    fireEvent.change(screen.getByLabelText("Rol de Marta Gómez"), { target: { value: "manager" } });
    await waitFor(() => expect(employeesService.changeAccess).toHaveBeenCalledWith(4, "manager"));

    fireEvent.click(screen.getByRole("button", { name: "Quitar acceso" }));
    fireEvent.click((await screen.findAllByRole("button", { name: "Quitar acceso" })).at(-1)!);
    await waitFor(() => expect(employeesService.revokeAccess).toHaveBeenCalledWith(4));
  });

  it("muestra el mensaje propio del código de error de la API", async () => {
    const error = new AxiosError("403");
    error.response = { status: 403, data: { error: { details: { code: "role_not_allowed" } } } } as never;
    vi.mocked(employeesService.changeAccess).mockRejectedValue(error);
    renderWithProviders(<EditAccess employee={{ ...base, access: { id: 8, email: "m@x.mx", role: "staff", active: true } }} />);

    fireEvent.change(screen.getByLabelText("Rol de Marta Gómez"), { target: { value: "admin" } });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("No puedes asignar ni modificar un rol mayor al tuyo")));
  });
});
