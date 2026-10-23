import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";

vi.mock("@/services/attendances", () => ({
  attendancesService: { markCheckIn: vi.fn(), markCheckOut: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AxiosError } from "axios";
import { toast } from "sonner";
import { attendancesService } from "@/services/attendances";
import { MarkDialog } from "./mark-dialog";

const target = { employeeId: 5, name: "Luis Pérez", kind: "in" as const };

beforeEach(() => vi.clearAllMocks());

function apiError(code: string) {
  const error = new AxiosError("422");
  error.response = { status: 422, data: { error: { status: 422, details: { code } } } } as never;
  return error;
}

describe("MarkDialog", () => {
  it("marca la entrada con la hora actual sin mandar `at`", async () => {
    vi.mocked(attendancesService.markCheckIn).mockResolvedValue({} as never);
    const onClose = vi.fn();
    renderWithProviders(<MarkDialog target={target} onClose={onClose} />);

    fireEvent.click(await screen.findByRole("button", { name: "Marcar entrada" }));

    await waitFor(() => expect(attendancesService.markCheckIn).toHaveBeenCalledWith(5, undefined));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalled();
  });

  it("si el jefe cambia la hora, la manda con el desfase de México y avisa que será capturada", async () => {
    vi.mocked(attendancesService.markCheckIn).mockResolvedValue({} as never);
    renderWithProviders(<MarkDialog target={target} onClose={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText("Fecha y hora"), { target: { value: "2026-10-01T09:00" } });
    expect(screen.getByText("Quedará señalada como capturada por ti.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Marcar entrada" }));

    await waitFor(() => expect(attendancesService.markCheckIn).toHaveBeenCalledWith(5, "2026-10-01T09:00:00-06:00"));
  });

  it("muestra el error de la API sin cerrar", async () => {
    vi.mocked(attendancesService.markCheckIn).mockRejectedValue(apiError("already_open"));
    const onClose = vi.fn();
    renderWithProviders(<MarkDialog target={target} onClose={onClose} />);

    fireEvent.click(await screen.findByRole("button", { name: "Marcar entrada" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ya tiene una entrada abierta.");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("marcar salida usa markCheckOut", async () => {
    vi.mocked(attendancesService.markCheckOut).mockResolvedValue({} as never);
    renderWithProviders(<MarkDialog target={{ ...target, kind: "out" }} onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Marcar salida" }));

    await waitFor(() => expect(attendancesService.markCheckOut).toHaveBeenCalledWith(5, undefined));
  });
});
