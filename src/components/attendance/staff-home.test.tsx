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

import { attendancesService } from "@/services/attendances";
import { StaffHome } from "./staff-home";

const shift = { id: 1, checkin_at: "2026-10-20T15:00:00Z", checkout_at: null, open: true, duration_minutes: null };
const status = (over: Partial<MyAttendance> = {}): MyAttendance => ({
  eligible: true, state: "none", current: null, last: null, server_time: "2026-10-20T15:00:00Z", ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: { id: 7 } as never, selectedCompanyId: 3, role: "staff" });
});

describe("StaffHome (spec 052, H-40)", () => {
  it("sin entrada hoy ofrece marcarla, sin avisos de mejorar el plan", async () => {
    vi.mocked(attendancesService.today).mockResolvedValue(status());
    vi.mocked(attendancesService.checkIn).mockResolvedValue(status({ state: "working", current: shift }));
    renderWithProviders(<StaffHome />);

    fireEvent.click(await screen.findByRole("button", { name: /marcar entrada/i }));
    await waitFor(() => expect(attendancesService.checkIn).toHaveBeenCalled());
    expect(screen.queryByText(/mejora tu plan/i)).toBeNull();
  });

  it("con turno abierto ofrece marcar la salida", async () => {
    vi.mocked(attendancesService.today).mockResolvedValue(status({ state: "working", current: shift }));
    renderWithProviders(<StaffHome />);
    expect(await screen.findByRole("button", { name: /marcar salida/i })).toBeInTheDocument();
  });

  it("si no es empleado de la empresa lo explica", async () => {
    vi.mocked(attendancesService.today).mockResolvedValue(status({ eligible: false }));
    renderWithProviders(<StaffHome />);
    expect(await screen.findByText(/no está ligado a un empleado/i)).toBeInTheDocument();
  });
});
