import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { formatMinutes, minutesOpen, TableTile } from "../table-tile";

const NOW = new Date("2026-10-22T12:00:00Z").getTime();
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();

describe("TableTile", () => {
  it("una mesa libre solo dice su nombre y su estado", () => {
    renderWithProviders(<TableTile name="3" state="free" now={NOW} onClick={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Mesa 3, Libre" })).toBeInTheDocument();
    expect(screen.queryByText(/min/)).not.toBeInTheDocument();
  });

  it("una mesa ocupada muestra estado, tiempo, total y mesero", () => {
    renderWithProviders(<TableTile name="1" state="occupied" openedAt={ago(12)} total={155} owner="Ana" now={NOW} onClick={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Mesa 1, Ocupada, 12 min abierta, $155.00, Ana" })).toBeInTheDocument();
    expect(screen.getByText("Ocupada")).toBeInTheDocument();
    expect(screen.getByText("12 min")).toBeInTheDocument();
  });

  it("por cobrar se distingue en texto y sin el total de cuentas ajenas no inventa uno", () => {
    renderWithProviders(<TableTile name="2" state="to_pay" openedAt={ago(75)} now={NOW} onClick={vi.fn()} />);

    expect(screen.getByText("Por cobrar")).toBeInTheDocument();
    expect(screen.getByText("1 h 15 min")).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it("marca la mesa propia y avisa al tocarla", async () => {
    const onClick = vi.fn();
    renderWithProviders(<TableTile name="1" state="occupied" openedAt={ago(5)} total={10} owner="Ana" mine now={NOW} onClick={onClick} />);

    expect(screen.getByText("Tuya")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("sin onClick es solo informativa", () => {
    renderWithProviders(<TableTile name="1" state="free" now={NOW} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Mesa 1, Libre" })).toBeInTheDocument();
  });
});

describe("tiempo abierta", () => {
  it("formatea minutos y horas", () => {
    expect(formatMinutes(0)).toBe("0 min");
    expect(formatMinutes(59)).toBe("59 min");
    expect(formatMinutes(60)).toBe("1 h 00 min");
    expect(formatMinutes(125)).toBe("2 h 05 min");
  });

  it("nunca es negativo ni existe sin hora de apertura", () => {
    expect(minutesOpen(ago(-5), NOW)).toBe(0);
    expect(minutesOpen(null, NOW)).toBeNull();
  });
});
