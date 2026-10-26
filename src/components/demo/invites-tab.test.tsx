import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { DemoInvite } from "@/types";

vi.mock("@/services/demo", () => ({
  demoService: { listInvites: vi.fn(), createInvite: vi.fn(), revokeInvite: vi.fn(), listSessions: vi.fn(), open: vi.fn(), resolveInvite: vi.fn(), finish: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { demoService } from "@/services/demo";
import { InvitesTab } from "./invites-tab";

const invite = (over: Partial<DemoInvite> = {}): DemoInvite => ({
  id: 1, plan: "pro", scenario: "pro_restaurant", label: "Café La Plaza", status: "active",
  expires_at: "2030-01-15T12:00:00Z", revoked_at: null, created_by: { id: 9, name: "Ventas" }, opens_count: 3,
  last_opened_at: "2030-01-02T10:00:00Z", ...over,
});
const page = (results: DemoInvite[]) => ({ info: { page_size: 20, page_index: 1, total: results.length, page_start: 1, page_end: results.length, pages_total: 1 }, results });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(demoService.listInvites).mockResolvedValue(page([invite(), invite({ id: 2, label: "Abarrotes Lupita", plan: "basic", scenario: "basic_retail", status: "revoked", opens_count: 0, last_opened_at: null })]));
});

describe("InvitesTab", () => {
  it("lista las invitaciones con su plan, giro, estado y aperturas", async () => {
    renderWithProviders(<InvitesTab />);

    const row = (await screen.findByText("Café La Plaza")).closest("tr") as HTMLElement;
    expect(within(row).getByText("Pro")).toBeInTheDocument();
    expect(within(row).getByText("Restaurante")).toBeInTheDocument();
    expect(within(row).getByText("Activa")).toBeInTheDocument();
    expect(within(row).getByText("3")).toBeInTheDocument();
    const other = screen.getByText("Abarrotes Lupita").closest("tr") as HTMLElement;
    expect(within(other).getByText("Revocada")).toBeInTheDocument();
    expect(within(other).getByText("Sin abrir")).toBeInTheDocument();
  });

  it("solo las activas se pueden revocar", async () => {
    renderWithProviders(<InvitesTab />);

    await screen.findByText("Café La Plaza");
    expect(screen.getAllByRole("button", { name: "Revocar" })).toHaveLength(1);
  });

  it("revocar pide confirmar y luego llama a la API", async () => {
    vi.mocked(demoService.revokeInvite).mockResolvedValue(invite({ status: "revoked" }));
    renderWithProviders(<InvitesTab />);

    fireEvent.click(await screen.findByRole("button", { name: "Revocar" }));
    expect(await screen.findByText("¿Revocar esta invitación?")).toBeInTheDocument();
    expect(demoService.revokeInvite).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Revocar" }));

    await waitFor(() => expect(demoService.revokeInvite).toHaveBeenCalledWith(1));
  });

  it("los filtros viajan a la API", async () => {
    renderWithProviders(<InvitesTab />);
    await screen.findByText("Café La Plaza");

    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "revoked" } });
    await waitFor(() => expect(demoService.listInvites).toHaveBeenLastCalledWith(expect.objectContaining({ status: "revoked" })));
    fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "basic" } });
    await waitFor(() => expect(demoService.listInvites).toHaveBeenLastCalledWith(expect.objectContaining({ status: "revoked", plan: "basic" })));
    fireEvent.change(screen.getByPlaceholderText("Buscar prospecto…"), { target: { value: "lupita" } });
    await waitFor(() => expect(demoService.listInvites).toHaveBeenLastCalledWith(expect.objectContaining({ search: "lupita" })));
  });

  it("crear muestra el enlace una sola vez y avisa que no se vuelve a ver", async () => {
    vi.mocked(demoService.createInvite).mockResolvedValue(invite({ id: 3, token: "tok", url: "https://panel.test/es/demo/tok" }));
    renderWithProviders(<InvitesTab />);

    fireEvent.click(await screen.findByRole("button", { name: "Nueva invitación" }));
    fireEvent.change(await screen.findByLabelText("Prospecto o negocio"), { target: { value: "Café La Plaza" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear invitación" }));

    await waitFor(() => expect(demoService.createInvite).toHaveBeenCalledWith({ plan: "pro", scenario: "pro_service", label: "Café La Plaza", expires_in_days: 14 }));
    expect(await screen.findByDisplayValue("https://panel.test/es/demo/tok")).toBeInTheDocument();
    expect(screen.getByText(/solo se muestra ahora/)).toBeInTheDocument();
  });

  it("valida la etiqueta y la vigencia antes de crear", async () => {
    renderWithProviders(<InvitesTab />);

    fireEvent.click(await screen.findByRole("button", { name: "Nueva invitación" }));
    fireEvent.click(await screen.findByRole("button", { name: "Crear invitación" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Escribe de 2 a 120 caracteres");

    fireEvent.change(screen.getByLabelText("Prospecto o negocio"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Vigencia (días)"), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear invitación" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Elige de 1 a 60 días");
    expect(demoService.createInvite).not.toHaveBeenCalled();
  });

  it("elegir otro plan cambia los giros; Básico y Empresa tienen uno solo", async () => {
    renderWithProviders(<InvitesTab />);

    fireEvent.click(await screen.findByRole("button", { name: "Nueva invitación" }));
    const scenario = await screen.findByLabelText("Giro");
    expect(scenario).not.toBeDisabled();
    fireEvent.change(screen.getByLabelText("Plan", { selector: "#invite-plan" }), { target: { value: "enterprise" } });

    expect(scenario).toBeDisabled();
    expect(scenario).toHaveValue("enterprise_restaurant");
  });

  it("sin invitaciones lo dice y ofrece crear la primera", async () => {
    vi.mocked(demoService.listInvites).mockResolvedValue(page([]));
    renderWithProviders(<InvitesTab />);

    expect(await screen.findByText("Aún no hay invitaciones")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva invitación" })).toBeInTheDocument();
  });

  it("si falla la carga ofrece reintentar", async () => {
    vi.mocked(demoService.listInvites).mockRejectedValueOnce(new Error("x"));
    renderWithProviders(<InvitesTab />);

    expect(await screen.findByText("No pudimos cargar la lista.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Café La Plaza")).toBeInTheDocument();
  });
});
