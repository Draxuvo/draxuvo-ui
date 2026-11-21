import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { TerminalDevice } from "@/types";
import { DevicesSheet } from "./devices-sheet";

const link = vi.hoisted(() => vi.fn());
const devices = vi.hoisted(() => ({ list: [] as TerminalDevice[] }));

vi.mock("@/hooks/use-terminal-connections", () => ({
  useTerminalDevices: () => ({ data: { results: devices.list }, isLoading: false, isError: false }),
  useLinkTerminal: () => ({ mutateAsync: link, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const free: TerminalDevice = { device_id: "NEWLAND__1", label: "NEWLAND N950 · …0001", mode: "STANDALONE", store_id: null, pos_id: null, linked_terminal: null, linkable: true, reason: null };

beforeEach(() => {
  link.mockReset().mockResolvedValue({ id: 9, name: "Caja 1", restart_required: true });
  devices.list = [
    free,
    { ...free, device_id: "NEWLAND__2", label: "…0002", linked_terminal: { id: 4, name: "Barra" }, linkable: false },
    { ...free, device_id: "NEWLAND__3", label: "…0003", linkable: false, reason: "linked_elsewhere" },
  ];
});

describe("DevicesSheet (spec 069)", () => {
  it("liga un dispositivo con nombre y avisa reiniciar", async () => {
    renderWithProviders(<DevicesSheet open onOpenChange={() => {}} connectionId={3} />);
    expect(screen.getByText("Ya agregada como Barra")).toBeInTheDocument();
    expect(screen.getByText("Está en otra empresa")).toBeInTheDocument();

    const add = screen.getByRole("button", { name: "Agregar" });
    expect(add).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Nombre para NEWLAND N950 · …0001"), "Caja 1");
    await userEvent.click(add);
    expect(link).toHaveBeenCalledWith({ name: "Caja 1", terminal_connection_id: 3, device_id: "NEWLAND__1" });
    expect(await screen.findByText("Reinicia la terminal")).toBeInTheDocument();
  });
});
