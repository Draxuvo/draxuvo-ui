import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { ViewTabs, resolveView } from "./view-tabs";

describe("ViewTabs", () => {
  it("muestra Activas y Cobradas y marca la elegida", () => {
    renderWithProviders(<ViewTabs value="cobradas" onChange={() => {}} showActive showPaid />);
    expect(screen.getByRole("group", { name: "Vista de órdenes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cobradas" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Activas" })).toHaveAttribute("aria-pressed", "false");
  });

  it("no pinta nada si solo hay una vista disponible", () => {
    const { container, rerender } = renderWithProviders(<ViewTabs value="activas" onChange={() => {}} showActive showPaid={false} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ViewTabs value="cobradas" onChange={() => {}} showActive={false} showPaid />);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("avisa al cambiar de vista", async () => {
    const onChange = vi.fn();
    renderWithProviders(<ViewTabs value="activas" onChange={onChange} showActive showPaid />);
    await userEvent.click(screen.getByRole("button", { name: "Cobradas" }));
    expect(onChange).toHaveBeenCalledWith("cobradas");
  });
});

describe("resolveView", () => {
  it("respeta lo pedido si existe y cae a una vista disponible si no", () => {
    expect(resolveView("cobradas", true, true)).toBe("cobradas");
    expect(resolveView("cobradas", true, false)).toBe("activas");
    expect(resolveView(null, false, true)).toBe("cobradas");
    expect(resolveView(undefined, true, true)).toBe("activas");
    expect(resolveView("otra", true, true)).toBe("activas");
  });
});
