import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import type { Product } from "@/types";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/services/inventory", () => ({ inventoryService: { byCode: vi.fn(), receive: vi.fn() } }));
const created = vi.hoisted(() => ({ product: null as unknown }));
vi.mock("../../product-form", () => ({
  ProductForm: (props: { open: boolean; initialBarcodes?: string[]; onSaved?: (p: unknown) => void; onOpenChange: (o: boolean) => void }) =>
    props.open ? (
      <div role="dialog" aria-label="Formulario">
        Código {props.initialBarcodes?.join(",")}
        <button onClick={() => { props.onSaved?.(created.product); props.onOpenChange(false); }}>Guardar producto</button>
      </div>
    ) : null,
}));

import { inventoryService } from "@/services/inventory";
import { ReceiveScreen } from "../receive-screen";

const product = (id: number, name: string, over: Partial<Product> = {}): Product =>
  ({ id, sku: `S-${id}`, name, barcodes: [`750${id}`], stock: 5, min_stock: 1, unit_cost: 1, low_stock: false,
     product_type: { id: 1, name: "Refacción", sellable: true, counted: true, fractional: false }, ...over }) as Product;

const TACOS = product(1, "Tacos");
const COLA = product(2, "Cola");
const SOPA = product(3, "Sopa", { product_type: { id: 2, name: "Platillo", sellable: true, counted: false, fractional: false } });

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ role: "owner", selectedCompanyId: 1 } as never);
  vi.mocked(inventoryService.byCode).mockImplementation(async (code) => ({ "7501": TACOS, "7502": COLA, "7503": SOPA } as Record<string, Product>)[code] ?? null);
  vi.mocked(inventoryService.receive).mockResolvedValue({ movements: [{ id: 1 }, { id: 2 }] as never, products: [] });
});

const scan = async (code: string) => userEvent.setup().type(screen.getByLabelText("Código de barras"), `${code}{Enter}`);

describe("Recibir mercancía (spec 034)", () => {
  it("agrega con cantidad 1, suma un escaneo repetido y confirma las cantidades con la llave", async () => {
    renderWithProviders(<ReceiveScreen />);
    const user = userEvent.setup();

    await scan("7501");
    expect(await screen.findByText("Tacos")).toBeInTheDocument();
    await scan("7501");
    await waitFor(() => expect(screen.getByLabelText("Cantidad de Tacos")).toHaveValue(2));
    await scan("7502");
    expect(await screen.findByText("Cola")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Cantidad de Cola"));
    await user.type(screen.getByLabelText("Cantidad de Cola"), "10");
    expect(screen.getByText("12 piezas en 2 productos")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirmar recepción" }));

    await waitFor(() => expect(inventoryService.receive).toHaveBeenCalled());
    const [items, key] = vi.mocked(inventoryService.receive).mock.calls[0];
    expect(items).toEqual([{ product_id: 1, qty: 2 }, { product_id: 2, qty: 10 }]);
    expect(typeof key).toBe("string");
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(screen.queryByText("Tacos")).not.toBeInTheDocument();
  });

  it("un producto que no se cuenta se rechaza con aviso", async () => {
    renderWithProviders(<ReceiveScreen />);

    await scan("7503");

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Sopa no se cuenta en el inventario, no se puede recibir."));
    expect(screen.queryByText("Sopa")).not.toBeInTheDocument();
  });

  it("un código inexistente ofrece crear el producto con el código y lo agrega a la lista", async () => {
    created.product = product(9, "Nuevo");
    renderWithProviders(<ReceiveScreen />);
    const user = userEvent.setup();

    await scan("0000");
    expect(await screen.findByText(/Ningún producto tiene el código 0000/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Crear producto" }));
    expect(await screen.findByRole("dialog", { name: "Formulario" })).toHaveTextContent("Código 0000");
    await user.click(screen.getByRole("button", { name: "Guardar producto" }));

    expect(await screen.findByText("Nuevo")).toBeInTheDocument();
  });

  it("editar y quitar renglones actualiza el total; sin renglones no se puede confirmar", async () => {
    renderWithProviders(<ReceiveScreen />);
    const user = userEvent.setup();
    expect(screen.getByRole("button", { name: "Confirmar recepción" })).toBeDisabled();

    await scan("7501");
    await screen.findByText("Tacos");
    await user.click(screen.getByRole("button", { name: "Una más de Tacos" }));
    expect(screen.getByText("2 piezas en 1 productos")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Quitar Tacos" }));
    expect(screen.getByRole("button", { name: "Confirmar recepción" })).toBeDisabled();
  });

  it("advierte al cerrar la pestaña mientras haya algo sin confirmar", async () => {
    renderWithProviders(<ReceiveScreen />);
    const before = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(before);
    expect(before.defaultPrevented).toBe(false);

    await scan("7501");
    await screen.findByText("Tacos");
    const during = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(during);
    expect(during.defaultPrevented).toBe(true);
  });
});
