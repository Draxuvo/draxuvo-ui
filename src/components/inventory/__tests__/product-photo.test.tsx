import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { Product, ProductPhoto as PhotoData } from "@/types";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services/inventory", () => ({
  inventoryService: { uploadPhoto: vi.fn(), updatePhotoStyle: vi.fn(), removePhoto: vi.fn() },
}));

import { inventoryService } from "@/services/inventory";
import { ProductPhoto, photoProblem } from "../product-photo";

const ready: PhotoData = { style: "card", ready: true, url: "https://fotos.test/card", thumbnail_url: "https://fotos.test/thumb", updated_at: "2026-11-11T19:00:00Z" };
const product = (photo: PhotoData | null) => ({ id: 7, name: "Pozole", photo }) as unknown as Product;
const jpg = (bytes = 10) => new File(["x".repeat(bytes)], "pozole.jpg", { type: "image/jpeg" });

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:local");
  URL.revokeObjectURL = vi.fn();
});

describe("photoProblem", () => {
  it("acepta JPG, PNG y WebP y rechaza otros formatos o más de 10 MB", () => {
    expect(photoProblem(jpg())).toBeNull();
    expect(photoProblem(new File(["x"], "a.png", { type: "image/png" }))).toBeNull();
    expect(photoProblem(new File(["x"], "a.webp", { type: "image/webp" }))).toBeNull();
    expect(photoProblem(new File(["x"], "a.heic", { type: "image/heic" }))).toBe("invalidType");
    const big = jpg();
    Object.defineProperty(big, "size", { value: 10 * 1024 * 1024 + 1 });
    expect(photoProblem(big)).toBe("tooLarge");
  });
});

describe("ProductPhoto en un producto existente", () => {
  it("sin foto ofrece agregarla y la sube al elegirla, con el estilo por omisión", async () => {
    const user = userEvent.setup();
    vi.mocked(inventoryService.uploadPhoto).mockResolvedValue(product({ ...ready, ready: false, url: null, thumbnail_url: null }));
    renderWithProviders(<ProductPhoto productId={7} productName="Pozole" photo={null} />);

    expect(screen.getByText("Foto para el menú")).toBeInTheDocument();
    await user.upload(screen.getByLabelText("Foto para el menú"), jpg());

    await waitFor(() => expect(inventoryService.uploadPhoto).toHaveBeenCalledWith(7, expect.any(File), "card", expect.objectContaining({ signal: expect.any(AbortSignal) })));
  });

  it("rechaza en el navegador un formato no admitido, sin subir nada", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderWithProviders(<ProductPhoto productId={7} productName="Pozole" photo={null} />);

    await user.upload(screen.getByLabelText("Foto para el menú"), new File(["x"], "a.heic", { type: "image/heic" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Formato no admitido: usa JPG, PNG o WebP");
    expect(inventoryService.uploadPhoto).not.toHaveBeenCalled();
  });

  it("muestra el error de la API sin cambiar la foto", async () => {
    const user = userEvent.setup();
    vi.mocked(inventoryService.uploadPhoto).mockRejectedValue({ isAxiosError: true, response: { data: { error: { details: { code: "photo_too_large" } } } } });
    renderWithProviders(<ProductPhoto productId={7} productName="Pozole" photo={ready} />);

    await user.upload(screen.getByLabelText("Foto para el menú"), jpg());
    expect(await screen.findByRole("alert")).toHaveTextContent("La foto pesa más de 10 MB");
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://fotos.test/card");
  });

  it("muestra el avance y cancela la subida", async () => {
    const user = userEvent.setup();
    let signal: AbortSignal | undefined;
    vi.mocked(inventoryService.uploadPhoto).mockImplementation((_id, _file, _style, options) => {
      signal = options?.signal;
      options?.onProgress?.(40);
      return new Promise((_, reject) => signal!.addEventListener("abort", () => reject(Object.assign(new Error("canceled"), { __CANCEL__: true }))));
    });
    renderWithProviders(<ProductPhoto productId={7} productName="Pozole" photo={null} />);

    await user.upload(screen.getByLabelText("Foto para el menú"), jpg());
    expect(await screen.findByText("Subiendo… 40 %")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(signal?.aborted).toBe(true);
    await waitFor(() => expect(screen.queryByText("Subiendo… 40 %")).not.toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("cambiar el estilo guarda solo el estilo, sin volver a subir", async () => {
    const user = userEvent.setup();
    vi.mocked(inventoryService.updatePhotoStyle).mockResolvedValue(product({ ...ready, style: "thumbnail" }));
    renderWithProviders(<ProductPhoto productId={7} productName="Pozole" photo={ready} />);

    await user.click(screen.getByRole("radio", { name: "Miniatura" }));

    await waitFor(() => expect(inventoryService.updatePhotoStyle).toHaveBeenCalledWith(7, "thumbnail"));
    expect(inventoryService.uploadPhoto).not.toHaveBeenCalled();
  });

  it("la vista previa usa el recorte del estilo: tarjeta 4:3 o miniatura cuadrada", () => {
    const { unmount } = renderWithProviders(<ProductPhoto productId={7} productName="Pozole" photo={ready} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://fotos.test/card");
    expect(screen.getByRole("img").parentElement).toHaveClass("aspect-[4/3]");
    unmount();

    renderWithProviders(<ProductPhoto productId={7} productName="Pozole" photo={{ ...ready, style: "thumbnail" }} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://fotos.test/thumb");
    expect(screen.getByRole("img").parentElement).toHaveClass("size-24");
  });

  it("quitar la foto pide confirmación", async () => {
    const user = userEvent.setup();
    vi.mocked(inventoryService.removePhoto).mockResolvedValue(product(null));
    renderWithProviders(<ProductPhoto productId={7} productName="Pozole" photo={ready} />);

    await user.click(screen.getByRole("button", { name: "Quitar foto" }));
    expect(inventoryService.removePhoto).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Sí, quitar" }));

    await waitFor(() => expect(inventoryService.removePhoto).toHaveBeenCalledWith(7));
  });

  it("mientras la API prepara la foto lo dice", () => {
    renderWithProviders(<ProductPhoto productId={7} productName="Pozole" photo={{ ...ready, ready: false, url: null, thumbnail_url: null }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Preparando foto…");
  });
});

describe("ProductPhoto en un producto nuevo", () => {
  it("guarda la foto elegida como pendiente, sin subirla", async () => {
    const user = userEvent.setup();
    const onPendingChange = vi.fn();
    renderWithProviders(<ProductPhoto productName="Pozole" onPendingChange={onPendingChange} />);

    await user.upload(screen.getByLabelText("Foto para el menú"), jpg());
    expect(onPendingChange).toHaveBeenLastCalledWith({ file: expect.any(File), style: "card" });
    expect(screen.getByText("La foto se sube al guardar el producto.")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Miniatura" }));
    expect(onPendingChange).toHaveBeenLastCalledWith({ file: expect.any(File), style: "thumbnail" });
    expect(inventoryService.uploadPhoto).not.toHaveBeenCalled();
  });
});
