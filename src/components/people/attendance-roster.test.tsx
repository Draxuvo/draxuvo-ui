import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { RosterRow } from "@/types";

vi.mock("@/services/attendances", () => ({
  attendancesService: { roster: vi.fn(), markCheckIn: vi.fn(), markCheckOut: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { attendancesService } from "@/services/attendances";
import { AttendanceRoster } from "./attendance-roster";

const attendance = (over = {}) =>
  ({
    id: 1, checkin_at: "2026-10-20T15:00:00Z", checkout_at: null, open: true, duration_minutes: null,
    checkin_by: null, checkout_by: null, checkin_captured: false, checkout_captured: false, ...over,
  }) as never;

const rows: RosterRow[] = [
  { employee: { id: 1, name: "Ana Ruiz", position: null }, state: "none", attendance: null },
  { employee: { id: 2, name: "Luis Pérez", position: null }, state: "working", attendance: attendance() },
  {
    employee: { id: 3, name: "Zoe Cierre", position: null },
    state: "done",
    attendance: attendance({ checkout_at: "2026-10-20T23:00:00Z", open: false, checkin_captured: true, checkin_by: { id: 9, name: "Dueño" } }),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(attendancesService.roster).mockResolvedValue({ date: "2026-10-20", results: rows });
});

describe("AttendanceRoster", () => {
  it("el jefe ve el estado de cada empleado y las acciones que le tocan", async () => {
    renderWithProviders(<AttendanceRoster canMark enabled />);

    const ana = (await screen.findByText("Ana Ruiz")).closest("li")!;
    expect(within(ana).getByText("Sin entrada")).toBeInTheDocument();
    expect(within(ana).getByRole("button", { name: "Marcar entrada" })).toBeInTheDocument();

    const luis = screen.getByText("Luis Pérez").closest("li")!;
    expect(within(luis).getByText("En turno")).toBeInTheDocument();
    expect(within(luis).getByRole("button", { name: "Marcar salida" })).toBeInTheDocument();

    const zoe = screen.getByText("Zoe Cierre").closest("li")!;
    expect(within(zoe).getByText("Con salida")).toBeInTheDocument();
    expect(zoe).toHaveTextContent("capturada por Dueño");
  });

  it("el gerente lo ve sin acciones de marcar", async () => {
    renderWithProviders(<AttendanceRoster canMark={false} enabled />);

    await screen.findByText("Ana Ruiz");
    expect(screen.queryByRole("button", { name: /Marcar/ })).not.toBeInTheDocument();
  });

  it("marcar abre el diálogo del empleado", async () => {
    renderWithProviders(<AttendanceRoster canMark enabled />);

    fireEvent.click(within((await screen.findByText("Ana Ruiz")).closest("li")!).getByRole("button", { name: "Marcar entrada" }));

    expect(await screen.findByText("Marcar entrada de Ana Ruiz")).toBeInTheDocument();
  });

  it("sin el módulo no consulta", () => {
    renderWithProviders(<AttendanceRoster canMark enabled={false} />);
    expect(attendancesService.roster).not.toHaveBeenCalled();
  });
});
