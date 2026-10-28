import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { RestaurantAlert } from "@/hooks/use-restaurant-alerts";
import { AlertBanner } from "../alert-banner";

const readyAlert = (id: number, name = "Tacos al pastor"): RestaurantAlert => ({
  kind: "ready",
  key: `ready:${id}`,
  item: { id, name, quantity: 1, check_id: 31, table: "4", takeout_name: null, ready_at: "2026-10-19T19:00:00Z" },
});
const toPayAlert = (id: number, name = "Mesa 4"): RestaurantAlert => ({ kind: "to_pay", key: `to_pay:${id}`, checkId: id, name, takeout: false });
const takenAlert = (id: number, name = "Mesa 7"): RestaurantAlert => ({ kind: "table_taken", key: `table:${id}`, checkId: 90 + id, name });

const noop = () => {};

describe("banda de avisos del restaurante", () => {
  it("muestra el aviso de listo con la mesa y el platillo", () => {
    renderWithProviders(<AlertBanner alerts={[readyAlert(1)]} onOpen={noop} onDismiss={noop} />);

    expect(screen.getByText("Mesa 4: Tacos al pastor listo")).toBeInTheDocument();
  });

  it("muestra el aviso de cuenta por cobrar", () => {
    renderWithProviders(<AlertBanner alerts={[toPayAlert(31)]} onOpen={noop} onDismiss={noop} />);

    expect(screen.getByText("Mesa 4 por cobrar")).toBeInTheDocument();
  });

  it("muestra el aviso de mesa tomada por otra persona", () => {
    renderWithProviders(<AlertBanner alerts={[takenAlert(7)]} onOpen={noop} onDismiss={noop} />);

    expect(screen.getByText("Mesa 7: la tomó otra persona")).toBeInTheDocument();
  });

  it("tocar el aviso lo abre y la X lo descarta", async () => {
    const onOpen = vi.fn();
    const onDismiss = vi.fn();
    renderWithProviders(<AlertBanner alerts={[readyAlert(1)]} onOpen={onOpen} onDismiss={onDismiss} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Abrir Mesa 4: Tacos al pastor listo" }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ kind: "ready" }));

    await user.click(screen.getByRole("button", { name: "Descartar aviso" }));
    expect(onDismiss).toHaveBeenCalledWith("ready:1");
  });

  it("con más de tres avisos resume el resto en un contador", () => {
    renderWithProviders(
      <AlertBanner alerts={[readyAlert(1, "Uno"), readyAlert(2, "Dos"), readyAlert(3, "Tres"), readyAlert(4, "Cuatro")]} onOpen={noop} onDismiss={noop} />,
    );

    expect(screen.getByText("Mesa 4: Tres listo")).toBeInTheDocument();
    expect(screen.queryByText("Mesa 4: Cuatro listo")).not.toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("sin avisos no dibuja nada", () => {
    const { container } = renderWithProviders(<AlertBanner alerts={[]} onOpen={noop} onDismiss={noop} />);

    expect(container).toBeEmptyDOMElement();
  });
});
