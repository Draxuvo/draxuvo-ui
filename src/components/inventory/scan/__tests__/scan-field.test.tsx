import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { ScanField } from "../scan-field";

describe("ScanField (spec 034)", () => {
  it("toma el foco, manda el código con Enter, vuelve a vaciar y a enfocar", async () => {
    const onScan = vi.fn();
    renderWithProviders(<ScanField onScan={onScan} />);
    const input = screen.getByLabelText("Código de barras");
    expect(input).toHaveFocus();

    await userEvent.setup().type(input, "7501234567890{Enter}");

    expect(onScan).toHaveBeenCalledWith("7501234567890");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("ignora Enter vacío y toma Tab como fin de captura sin salirse del campo", async () => {
    const onScan = vi.fn();
    renderWithProviders(<ScanField onScan={onScan} />);
    const user = userEvent.setup();
    const input = screen.getByLabelText("Código de barras");

    await user.keyboard("{Enter}");
    expect(onScan).not.toHaveBeenCalled();

    await user.type(input, "123{Tab}");
    expect(onScan).toHaveBeenCalledWith("123");
    expect(input).toHaveFocus();
  });

  it("procesa los escaneos en orden aunque el primero tarde", async () => {
    const order: string[] = [];
    const onScan = vi.fn(async (code: string) => {
      if (code === "uno") await new Promise((resolve) => setTimeout(resolve, 60));
      order.push(code);
    });
    renderWithProviders(<ScanField onScan={onScan} />);
    const user = userEvent.setup();
    const input = screen.getByLabelText("Código de barras");

    await user.type(input, "uno{Enter}");
    await user.type(input, "dos{Enter}");

    await waitFor(() => expect(order).toEqual(["uno", "dos"]));
  });

  it("un código que falla no frena los siguientes", async () => {
    const onScan = vi.fn(async (code: string) => {
      if (code === "mal") throw new Error("falló");
    });
    renderWithProviders(<ScanField onScan={onScan} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Código de barras"), "mal{Enter}bien{Enter}");

    await waitFor(() => expect(onScan).toHaveBeenCalledWith("bien"));
  });

  it("deshabilitado no deja escribir", () => {
    renderWithProviders(<ScanField onScan={vi.fn()} disabled />);
    expect(screen.getByLabelText("Código de barras")).toBeDisabled();
  });
});
