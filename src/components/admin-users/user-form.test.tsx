import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { adminUsersService } from "@/services/admin-users";
import type { AdminUser } from "@/types";
import { UserForm } from "./user-form";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services/companies", () => ({
  companiesService: {
    list: vi.fn().mockResolvedValue({
      results: [
        { id: 1, name: "Volta" },
        { id: 2, name: "Sazón" },
        { id: 3, name: "Aroma" },
      ],
    }),
  },
}));
vi.mock("@/services/admin-users", () => ({
  adminUsersService: { getById: vi.fn(), update: vi.fn(), create: vi.fn() },
}));

const buildUser = (overrides: Partial<AdminUser> = {}): AdminUser => ({
  id: 3,
  email: "raciel@ejemplo.com",
  first_name: "Raciel",
  last_name: "Viveros",
  second_last_name: "Mendoza",
  phone: "7712891325",
  role: "staff",
  active: true,
  companies: [{ id: 1, name: "Volta", slug: "volta", role: "staff" }],
  created_at: "2026-10-19T00:00:00Z",
  ...overrides,
});

async function openEdit(user: AdminUser) {
  vi.mocked(adminUsersService.getById).mockResolvedValue(user);
  vi.mocked(adminUsersService.update).mockResolvedValue(user);
  renderWithProviders(<UserForm open onOpenChange={() => {}} user={user} />);
  await screen.findByDisplayValue(user.first_name);
}

async function save() {
  await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
  await waitFor(() => expect(adminUsersService.update).toHaveBeenCalled());
  return vi.mocked(adminUsersService.update).mock.calls[0][1];
}

beforeEach(() => vi.clearAllMocks());

describe("UserForm: estado activo (spec 014, US1)", () => {
  it("mantiene activa a la persona al cambiar solo su teléfono", async () => {
    await openEdit(buildUser({ active: true }));
    const phone = screen.getByDisplayValue("7712891325");
    await userEvent.clear(phone);
    await userEvent.type(phone, "5500000000");

    expect(await save()).toMatchObject({ phone: "5500000000", active: true });
  });

  it("mantiene inactiva a la persona al cambiar su nombre", async () => {
    await openEdit(buildUser({ active: false }));
    const name = screen.getByDisplayValue("Raciel");
    await userEvent.clear(name);
    await userEvent.type(name, "Raúl");

    expect(await save()).toMatchObject({ first_name: "Raúl", active: false });
  });

  it("desactiva a la persona cuando se elige Inactivo", async () => {
    await openEdit(buildUser({ active: true }));
    await userEvent.selectOptions(screen.getByDisplayValue("Activo"), "false");

    expect(await save()).toMatchObject({ active: false });
  });

  it("muestra Activo al abrir a una persona activa", async () => {
    await openEdit(buildUser({ active: true }));

    expect(screen.getByDisplayValue("Activo")).toBeInTheDocument();
  });
});

describe("UserForm: rol por empresa (spec 014, US2)", () => {
  const multi = buildUser({
    companies: [
      { id: 1, name: "Volta", slug: "volta", role: "owner" },
      { id: 2, name: "Sazón", slug: "sazon", role: "staff" },
    ],
  });

  it("muestra el rol de la persona en cada empresa marcada", async () => {
    await openEdit(multi);

    expect(await screen.findByRole("combobox", { name: "Rol en Volta" })).toHaveValue("owner");
    expect(screen.getByRole("combobox", { name: "Rol en Sazón" })).toHaveValue("staff");
    expect(screen.queryByRole("combobox", { name: "Rol en Aroma" })).not.toBeInTheDocument();
  });

  it("manda el rol de cada empresa en memberships", async () => {
    await openEdit(multi);
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Rol en Volta" }), "admin");

    const payload = await save();
    expect(payload.memberships).toEqual([
      { company_id: 1, role: "admin" },
      { company_id: 2, role: "staff" },
    ]);
    expect(payload).not.toHaveProperty("role");
    expect(payload).not.toHaveProperty("company_ids");
  });

  it("agrega una empresa como staff y quita la que se desmarca", async () => {
    await openEdit(multi);
    await userEvent.click(await screen.findByRole("checkbox", { name: "Aroma" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Sazón" }));

    expect(screen.getByRole("combobox", { name: "Rol en Aroma" })).toHaveValue("staff");
    expect((await save()).memberships).toEqual([
      { company_id: 1, role: "owner" },
      { company_id: 3, role: "staff" },
    ]);
  });
});

describe("UserForm: alta con rol por empresa (spec 014, US3)", () => {
  it("crea a la persona con el rol elegido en la empresa", async () => {
    vi.mocked(adminUsersService.create).mockResolvedValue(buildUser());
    renderWithProviders(<UserForm open onOpenChange={() => {}} user={null} />);

    await userEvent.type(screen.getByPlaceholderText("Juan"), "Nueva");
    await userEvent.type(screen.getByPlaceholderText("García"), "Persona");
    await userEvent.type(screen.getByPlaceholderText("López"), "Prueba");
    await userEvent.type(screen.getByPlaceholderText("+52 55 0000 0000"), "5511112222");
    await userEvent.type(screen.getByPlaceholderText("juan@empresa.com"), "nueva@persona.test");
    await userEvent.click(await screen.findByRole("checkbox", { name: "Aroma" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Rol en Aroma" }), "admin");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(adminUsersService.create).toHaveBeenCalled());
    expect(vi.mocked(adminUsersService.create).mock.calls[0][0].memberships).toEqual([
      { company_id: 3, role: "admin" },
    ]);
  });
});
