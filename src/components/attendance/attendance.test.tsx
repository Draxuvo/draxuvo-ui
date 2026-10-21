import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import type { MyAttendance } from "@/types";

vi.mock("@/services/attendances", () => ({
  attendancesService: { today: vi.fn(), checkIn: vi.fn(), checkOut: vi.fn(), list: vi.fn() },
}));
vi.mock("@/components/subscription/module-locked", () => ({
  useModuleGate: () => ({ enabled: true, isLocked: () => false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { attendancesService } from "@/services/attendances";
import { AttendanceButton } from "./attendance-button";
import { EntryDialog } from "./entry-dialog";
import { useLogoutFlow } from "./logout-dialog";

const shift = { id: 1, checkin_at: "2026-10-20T15:00:00Z", checkout_at: null, open: true, duration_minutes: null };
const closed = { ...shift, checkout_at: "2026-10-20T23:00:00Z", open: false, duration_minutes: 480 };
const status = (over: Partial<MyAttendance> = {}): MyAttendance => ({
  eligible: true, state: "none", current: null, last: null, server_time: "2026-10-20T15:00:00Z", ...over,
});

const logout = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  useAuthStore.setState({ user: { id: 7 } as never, selectedCompanyId: 3, role: "staff", logout });
});

describe("EntryDialog", () => {
  it("aparece sin entrada abierta y marcar crea el turno", async () => {
    vi.mocked(attendancesService.today).mockResolvedValue(status());
    vi.mocked(attendancesService.checkIn).mockResolvedValue(status({ state: "working", current: shift }));
    renderWithProviders(<EntryDialog />);

    fireEvent.click(await screen.findByRole("button", { name: "Marcar entrada" }));

    await waitFor(() => expect(attendancesService.checkIn).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toast.success).toHaveBeenCalled();
  });

  it("Ahora no lo omite sin marcar y no vuelve a salir en la sesión", async () => {
    vi.mocked(attendancesService.today).mockResolvedValue(status());
    const first = renderWithProviders(<EntryDialog />);

    fireEvent.click(await screen.findByRole("button", { name: "Ahora no" }));

    expect(attendancesService.checkIn).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    first.unmount();

    renderWithProviders(<EntryDialog />);
    await waitFor(() => expect(attendancesService.today).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("no aparece con una entrada abierta ni si no es empleado", async () => {
    vi.mocked(attendancesService.today).mockResolvedValue(status({ state: "working", current: shift }));
    const open = renderWithProviders(<EntryDialog />);
    await waitFor(() => expect(attendancesService.today).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).toBeNull();
    open.unmount();

    vi.mocked(attendancesService.today).mockResolvedValue(status({ eligible: false }));
    renderWithProviders(<EntryDialog />);
    await waitFor(() => expect(attendancesService.today).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("también aparece si ya marcó una salida hoy (sin entrada abierta)", async () => {
    vi.mocked(attendancesService.today).mockResolvedValue(status({ state: "done", last: closed }));
    renderWithProviders(<EntryDialog />);

    expect(await screen.findByRole("button", { name: "Marcar entrada" })).toBeTruthy();
  });

  it("si falla al marcar avisa y deja el modal abierto", async () => {
    vi.mocked(attendancesService.today).mockResolvedValue(status());
    vi.mocked(attendancesService.checkIn).mockRejectedValue(new Error("red"));
    renderWithProviders(<EntryDialog />);

    fireEvent.click(await screen.findByRole("button", { name: "Marcar entrada" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("AttendanceButton", () => {
  it("sin entrada ofrece Marcar entrada", async () => {
    vi.mocked(attendancesService.today).mockResolvedValue(status());
    vi.mocked(attendancesService.checkIn).mockResolvedValue(status({ state: "working", current: shift }));
    renderWithProviders(<AttendanceButton />);

    fireEvent.click(await screen.findByRole("button", { name: /Marcar entrada/ }));

    await waitFor(() => expect(attendancesService.checkIn).toHaveBeenCalled());
  });

  it("en turno ofrece Marcar salida y la marca", async () => {
    vi.mocked(attendancesService.today).mockResolvedValue(status({ state: "working", current: shift }));
    vi.mocked(attendancesService.checkOut).mockResolvedValue(status({ state: "done", last: closed }));
    renderWithProviders(<AttendanceButton />);

    fireEvent.click(await screen.findByRole("button", { name: /Marcar salida/ }));

    await waitFor(() => expect(attendancesService.checkOut).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: /Marcar entrada/ })).toBeTruthy();
  });

  it("no se pinta si no es empleado o si no se pudo consultar", async () => {
    vi.mocked(attendancesService.today).mockResolvedValue(status({ eligible: false }));
    const a = renderWithProviders(<AttendanceButton />);
    await waitFor(() => expect(attendancesService.today).toHaveBeenCalled());
    expect(screen.queryByRole("button")).toBeNull();
    a.unmount();

    vi.mocked(attendancesService.today).mockRejectedValue(new Error("red"));
    renderWithProviders(<AttendanceButton />);
    await waitFor(() => expect(attendancesService.today).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button")).toBeNull();
  });
});

function LogoutHarness() {
  const { requestLogout, dialog } = useLogoutFlow();
  return (
    <>
      <button onClick={requestLogout}>Salir</button>
      {dialog}
    </>
  );
}

describe("cerrar sesión", () => {
  it("sin turno abierto cierra directo", async () => {
    vi.mocked(attendancesService.today).mockResolvedValue(status());
    renderWithProviders(<LogoutHarness />);
    await waitFor(() => expect(attendancesService.today).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Salir" }));

    expect(logout).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("con turno abierto ofrece las tres opciones", async () => {
    vi.mocked(attendancesService.today).mockResolvedValue(status({ state: "working", current: shift }));
    vi.mocked(attendancesService.checkOut).mockResolvedValue(status({ state: "done", last: closed }));
    renderWithProviders(<LogoutHarness />);
    await waitFor(() => expect(attendancesService.today).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));

    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    expect(await screen.findByRole("button", { name: "Cancelar" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(logout).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cerrar sin marcar" }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(attendancesService.checkOut).not.toHaveBeenCalled();
  });

  it("Marcar salida y cerrar sesión marca y luego cierra", async () => {
    vi.mocked(attendancesService.today).mockResolvedValue(status({ state: "working", current: shift }));
    vi.mocked(attendancesService.checkOut).mockResolvedValue(status({ state: "done", last: closed }));
    renderWithProviders(<LogoutHarness />);
    await waitFor(() => expect(attendancesService.today).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));

    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    fireEvent.click(await screen.findByRole("button", { name: "Marcar salida y cerrar sesión" }));

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(attendancesService.checkOut).toHaveBeenCalledTimes(1);
  });

  it("si falla marcar la salida no cierra la sesión", async () => {
    vi.mocked(attendancesService.today).mockResolvedValue(status({ state: "working", current: shift }));
    vi.mocked(attendancesService.checkOut).mockRejectedValue(new Error("red"));
    renderWithProviders(<LogoutHarness />);
    await waitFor(() => expect(attendancesService.today).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));

    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    fireEvent.click(await screen.findByRole("button", { name: "Marcar salida y cerrar sesión" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(logout).not.toHaveBeenCalled();
  });
});
