import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { TerminalForm } from "./terminal-form";

const createMutate = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-payment-terminals", () => ({
  useCreateTerminal: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateTerminal: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function taken() {
  const error = new AxiosError("422");
  error.response = {
    status: 422, statusText: "", headers: {}, config: { headers: new AxiosHeaders() },
    data: { error: { status: 422, message: "x", details: { name: ["ya está en uso"] } } },
  };
  return error;
}

beforeEach(() => createMutate.mockReset());

describe("TerminalForm", () => {
  it("pide el nombre antes de guardar", async () => {
    renderWithProviders(<TerminalForm open onOpenChange={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Escribe un nombre")).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("manda nombre y proveedor, y muestra el nombre repetido que rechaza la API", async () => {
    createMutate.mockRejectedValueOnce(taken());
    renderWithProviders(<TerminalForm open onOpenChange={() => {}} />);
    await userEvent.type(screen.getByLabelText("Nombre"), "Point barra");
    await userEvent.selectOptions(screen.getByLabelText("Proveedor"), "mercado_pago");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(createMutate).toHaveBeenCalledWith({ name: "Point barra", provider: "mercado_pago", active: true });
    expect(await screen.findByText("Ya hay una terminal con ese nombre")).toBeInTheDocument();
  });
});
