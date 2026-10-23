import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useAuthStore } from "@/store/auth";
import type { ProductImport } from "@/types";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/services/inventory", () => ({
  inventoryService: { startImport: vi.fn(), getImport: vi.fn(), listImports: vi.fn(), downloadTemplate: vi.fn() },
}));

import { inventoryService } from "@/services/inventory";
import { ProductImportDialog } from "../product-import-dialog";

const item = (over: Partial<ProductImport> = {}): ProductImport => ({
  id: 5, status: "queued", filename: "catalogo.xlsx", total_rows: 100, processed_rows: 0, created: 0, updated: 0, unchanged: 0,
  errors: [], errors_total: 0, started_at: null, finished_at: null, created_at: "2026-10-23T10:00:00Z", user: { id: 1, name: "Ana" }, ...over,
});

const file = () => new File(["sku,name\nA,Uno"], "catalogo.csv", { type: "text/csv" });

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ selectedCompanyId: 1 } as never);
  vi.mocked(inventoryService.listImports).mockResolvedValue({ info: {} as never, results: [] });
});

describe("importar productos en segundo plano (spec 034)", () => {
  it("sube el archivo, muestra el avance y al terminar el resumen con las filas con error", async () => {
    vi.mocked(inventoryService.startImport).mockResolvedValue(item());
    vi.mocked(inventoryService.getImport)
      .mockResolvedValueOnce(item({ status: "processing", processed_rows: 40 }))
      .mockResolvedValue(
        item({
          status: "done", processed_rows: 100, created: 90, updated: 7, unchanged: 1, errors_total: 2,
          errors: [{ row: 12, sku: "BAD-1", error: "Nombre no puede estar en blanco" }, { row: 30, error: "Código repetido" }],
        }),
      );
    renderWithProviders(<ProductImportDialog open onOpenChange={() => {}} />);
    const user = userEvent.setup();

    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file());
    await user.click(screen.getByRole("button", { name: "Importar" }));

    expect(await screen.findByText("Importando 40 de 100 filas…")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
    expect(screen.getByText(/seguirá en segundo plano|sigue en segundo plano/)).toBeInTheDocument();

    expect(await screen.findByText("Importación terminada", { exact: false }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText("90")).toBeInTheDocument();
    expect(screen.getByText("Fila 12")).toBeInTheDocument();
    expect(screen.getByText("BAD-1")).toBeInTheDocument();
    expect(screen.getByText("Código repetido")).toBeInTheDocument();
  });

  it("al abrir retoma la importación que ya está corriendo", async () => {
    vi.mocked(inventoryService.listImports).mockImplementation((params) =>
      Promise.resolve({ info: {} as never, results: params?.active ? [item({ status: "processing", processed_rows: 10 })] : [] }),
    );
    vi.mocked(inventoryService.getImport).mockResolvedValue(item({ status: "processing", processed_rows: 10 }));
    renderWithProviders(<ProductImportDialog open onOpenChange={() => {}} />);

    expect(await screen.findByText("Importando 10 de 100 filas…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Importar" })).not.toBeInTheDocument();
  });

  it("si ya había una importación (409) muestra esa en lugar de la que se intentó subir", async () => {
    const conflict = Object.assign(new Error("x"), {
      isAxiosError: true,
      response: { status: 409, data: { error: { message: "Ya hay una importación en curso", details: { code: "import_in_progress", import: item({ id: 9 }) } } } },
    });
    vi.mocked(inventoryService.startImport).mockRejectedValue(conflict);
    vi.mocked(inventoryService.getImport).mockResolvedValue(item({ id: 9, status: "processing", processed_rows: 5 }));
    renderWithProviders(<ProductImportDialog open onOpenChange={() => {}} />);
    const user = userEvent.setup();

    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file());
    await user.click(screen.getByRole("button", { name: "Importar" }));

    expect(await screen.findByText("Importando 5 de 100 filas…")).toBeInTheDocument();
    expect(inventoryService.getImport).toHaveBeenCalledWith(9);
  });

  it("una importación fallida lo dice y permite importar otro archivo", async () => {
    vi.mocked(inventoryService.listImports).mockImplementation((params) =>
      Promise.resolve({ info: {} as never, results: params?.active ? [item({ status: "failed" })] : [] }),
    );
    vi.mocked(inventoryService.getImport).mockResolvedValue(item({ status: "failed", errors: [{ row: null, error: "La importación se interrumpió" }], errors_total: 1 }));
    renderWithProviders(<ProductImportDialog open onOpenChange={() => {}} />);
    const user = userEvent.setup();

    expect(await screen.findByText("La importación falló")).toBeInTheDocument();
    expect(screen.getByText("La importación se interrumpió")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Importar otro archivo" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Importar" })).toBeInTheDocument());
  });

  it("lista las importaciones recientes y abre su resultado", async () => {
    vi.mocked(inventoryService.listImports).mockImplementation((params) =>
      Promise.resolve({ info: {} as never, results: params?.active ? [] : [item({ id: 3, status: "done", created: 4, filename: "viejo.xlsx" })] }),
    );
    vi.mocked(inventoryService.getImport).mockResolvedValue(item({ id: 3, status: "done", created: 4, filename: "viejo.xlsx", processed_rows: 100 }));
    renderWithProviders(<ProductImportDialog open onOpenChange={() => {}} />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Ver resultado de viejo.xlsx" }));

    expect(await screen.findByText("Importación terminada", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Creados")).toBeInTheDocument();
  });

  it("rechaza un archivo que no es Excel o CSV sin subirlo", async () => {
    renderWithProviders(<ProductImportDialog open onOpenChange={() => {}} />);
    const user = userEvent.setup({ applyAccept: false });

    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, new File(["x"], "datos.pdf", { type: "application/pdf" }));

    expect(inventoryService.startImport).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
  });
});
