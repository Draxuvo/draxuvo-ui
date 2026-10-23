import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { BarcodeInput } from "../barcode-input";

function Harness({ initial = [] as string[] }) {
  const [codes, setCodes] = useState(initial);
  return (
    <>
      <BarcodeInput value={codes} onChange={setCodes} />
      <output data-testid="codes">{JSON.stringify(codes)}</output>
    </>
  );
}

const codes = () => JSON.parse(screen.getByTestId("codes").textContent ?? "[]") as string[];

describe("BarcodeInput", () => {
  it("agrega con Enter, conserva los ceros iniciales y deja vacío el campo", async () => {
    renderWithProviders(<Harness />);
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText(/Escanea o escribe/);

    await user.type(input, "0012345{Enter}");

    expect(codes()).toEqual(["0012345"]);
    expect(input).toHaveValue("");
  });

  it("separa varios códigos pegados y descarta vacíos y repetidos", async () => {
    renderWithProviders(<Harness initial={["111"]} />);
    const user = userEvent.setup();

    await user.click(screen.getByPlaceholderText(/Escanea o escribe/));
    await user.paste("111; 222,333");
    await user.keyboard("{Enter}");

    expect(codes()).toEqual(["111", "222", "333"]);
  });

  it("agrega el código pendiente al salir del campo y quita uno con su X", async () => {
    renderWithProviders(<Harness initial={["aaa", "bbb"]} />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/Escanea o escribe/), "ccc");
    await user.tab();
    expect(codes()).toEqual(["aaa", "bbb", "ccc"]);

    await user.click(screen.getByRole("button", { name: "Quitar código bbb" }));
    expect(codes()).toEqual(["aaa", "ccc"]);
  });
});
